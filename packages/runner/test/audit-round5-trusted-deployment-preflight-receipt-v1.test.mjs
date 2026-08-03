import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const RECEIPT_PATH = 'docs/audit/round5/trusted-deployment-preflight-receipt-v1.json';

const EXPECTED_CHANGED_FILES = Object.freeze([
  '.github/workflows/deploy.yml',
  '.github/workflows/simulate.yml',
  'apps/api/src/entry.mjs',
  'apps/api/wrangler.toml',
  'packages/runner/test/audit-round5-trusted-deployment-runtime-scope-v1.test.mjs',
  'test/audit-round4-final-tree-attestation-v1.test.mjs'
]);

const ACTIVE_NETWORKS = Object.freeze([
  { network: 'base', chainId: 8453, secretName: 'RPC_BASE' },
  { network: 'ethereum', chainId: 1, secretName: 'RPC_ETHEREUM' }
]);

const DEFERRED_NETWORKS = Object.freeze([
  'arbitrum',
  'fraxtal',
  'katana',
  'optimism',
  'polygon'
]);

test('Round 5 trusted deployment preflight receipt binds exact verified evidence and leaves deployment unexecuted', () => {
  assert.ok(existsSync(RECEIPT_PATH), `missing trusted deployment preflight receipt: ${RECEIPT_PATH}`);
  const receipt = JSON.parse(readFileSync(RECEIPT_PATH, 'utf8'));

  assert.equal(receipt.schemaVersion, 'round5-trusted-deployment-preflight-receipt-v1');
  assert.equal(receipt.releaseBindingId, 'round5-release-source-3da6b10-v1');
  assert.equal(receipt.repository, 'CurveYield/contract-automation');
  assert.equal(receipt.pullRequest, 141);
  assert.equal(receipt.baseReleaseSha, '6e2ec3d4ac3b8a454ecf605195cd8a43049de6ca');
  assert.equal(receipt.verifiedImplementationHeadSha, 'ec9262767626bce89fc1697548bfbc2717859d51');
  assert.deepEqual(receipt.verifiedImplementationChangedFiles, EXPECTED_CHANGED_FILES);

  assert.deepEqual(receipt.exactHeadWorkflowEvidence, [
    {
      workflow: 'GitHub-Native Simulation CI',
      runId: 30796278078,
      jobId: 91630474627,
      conclusion: 'success'
    },
    {
      workflow: 'Live Fork Upgrade CI',
      runId: 30796278237,
      jobId: 91630475119,
      conclusion: 'success'
    }
  ]);

  assert.deepEqual(receipt.verification, {
    repositoryTestsPassed: 469,
    repositoryTestsFailed: 0,
    githubNativeFocusedTestsPassed: 49,
    githubNativeFocusedTestsFailed: 0,
    liveForkFocusedTestsPassed: 14,
    liveForkFocusedTestsFailed: 0,
    javascriptModulesSyntaxValid: 282,
    lintSucceeded: true,
    staticPagesBuildSucceeded: true,
    thirdPartyActionsPinnedToFullCommitShas: true,
    pullRequestWorkflowsSecretlessAndReadOnly: true,
    trustedLiveWorkflowsUnavailableToPullRequests: true
  });

  assert.deepEqual(receipt.activeReadOnlyRpcNetworks, ACTIVE_NETWORKS);
  assert.deepEqual(receipt.deferredReadOnlyRpcNetworks, DEFERRED_NETWORKS);
  assert.equal(receipt.credentialEvidence.namesOnly, true);
  assert.equal(receipt.credentialEvidence.requiredActiveSecretNameCount, 11);
  assert.equal(receipt.credentialEvidence.requiredRepositoryVariableNameCount, 3);
  assert.equal(receipt.credentialEvidence.secretValuesReadOrRecorded, false);

  assert.equal(receipt.safety.deploymentWorkflowBoundToExactReleaseBranch, true);
  assert.equal(receipt.safety.productionEnvironmentRequired, true);
  assert.equal(receipt.safety.runtimeRejectsDeferredNetworksBeforeDispatch, true);
  assert.equal(receipt.safety.walletSigningAllowed, false);
  assert.equal(receipt.safety.publicTransactionBroadcastAllowed, false);
  assert.equal(receipt.safety.secretDisclosureAllowed, false);
  assert.equal(receipt.safety.manualWorkflowRerunOrHistoricalRerunPerformed, false);

  assert.equal(receipt.executionState.deploymentPreflight, 'ACCEPT');
  assert.equal(receipt.executionState.productionEnvironmentProtectionConfirmed, false);
  assert.equal(receipt.executionState.deploymentExecuted, false);
  assert.equal(receipt.executionState.liveProductionTestingExecuted, false);
  assert.equal(receipt.executionState.trustedV27RegressionExecuted, false);
});
