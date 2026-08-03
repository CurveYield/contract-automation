import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const WORKFLOW_PATH = '.github/workflows/deploy-v10.yml';
const REQUEST_PATH = '.agent-control/v1/orchestrator/DEPLOY_REQUEST_v10.json';
const EXPECTED_PARENT = '11036211d5448e0bd32bb4c4fdd85bf638caa53d';
const APPLICATION_SOURCE = '2c6e543dfcaa17ca975bbde3c15302269bbf8072';
const RELEASE_BRANCH = 'orchestrator/round4-ci-base-v1';
const REQUEST_ID = 'round5-pages-api-production-20260803T1615Z-v10';

test('deployment v10 repairs pre-run context validation and preserves the dependency-free Pages API gate', () => {
  assert.ok(existsSync(WORKFLOW_PATH), `missing workflow: ${WORKFLOW_PATH}`);
  assert.ok(existsSync(REQUEST_PATH), `missing request: ${REQUEST_PATH}`);

  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
  const request = JSON.parse(readFileSync(REQUEST_PATH, 'utf8'));

  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  assert.match(workflow, /DEPLOY_REQUEST_v10\.json/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, new RegExp(EXPECTED_PARENT));
  assert.match(workflow, new RegExp(APPLICATION_SOURCE));
  assert.match(workflow, new RegExp(REQUEST_ID));
  assert.match(workflow, /github\.event\.before/);

  assert.doesNotMatch(
    workflow,
    /\$\{\{\s*runner\./,
    'runner context must not be evaluated in a pre-run workflow key',
  );
  assert.match(workflow, /V10_TEMP_DIR="\$RUNNER_TEMP\/pages-v10"/);
  assert.match(workflow, /echo "V10_TEMP_DIR=\$V10_TEMP_DIR" >> "\$GITHUB_ENV"/);
  assert.match(workflow, /mkdir -p "\$V10_TEMP_DIR"/);

  assert.match(workflow, /git diff --quiet "\$APPLICATION_SOURCE_SHA" -- apps\/web\/public/);
  assert.match(workflow, /pages_asset_manifest_v1\.py/);
  assert.match(workflow, /pages\/projects\/\$PAGES_PROJECT_NAME\/upload-token/);
  assert.match(workflow, /\/pages\/assets\/check-missing/);
  assert.match(workflow, /missing_asset_count="\$\(jq -r '\.result \| length'/);
  assert.match(workflow, /test "\$missing_asset_count" = "0"/);
  assert.match(workflow, /pages\/projects\/\$PAGES_PROJECT_NAME\/deployments/);
  assert.match(workflow, /commit_hash/);
  assert.match(workflow, /commit_message/);
  assert.match(workflow, /commit_dirty/);
  assert.match(workflow, /\.result\.environment == "production"/);
  assert.match(workflow, /\.result\.deployment_trigger\.metadata\.branch == \$release_branch/);
  assert.match(workflow, /\.result\.deployment_trigger\.metadata\.commit_hash == \$application_source/);
  assert.match(workflow, /\.result\.latest_stage\.status == "success"/);
  assert.match(workflow, /\.result\.aliases/);
  assert.match(workflow, /Verify production custom domain serves API-bound production deployment/);
  assert.match(workflow, /unexpected chain option scope/);
  assert.match(workflow, /Base is not the sole default/);
  assert.match(workflow, /chain synchronization contract missing/);
  assert.match(workflow, /Production Pages API deployment v10 result/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
  assert.match(workflow, /actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/);

  assert.doesNotMatch(workflow, /\bnpm\b|\bnpx\b|\bpnpm\b|\byarn\b|\bcorepack\b|\bpip(?:3)?\b|\bapt(?:-get)?\b|\bbrew\b/);
  assert.doesNotMatch(workflow, /\bwrangler\b/i);
  assert.doesNotMatch(workflow, /\/pages\/assets\/upload|\/pages\/assets\/upsert-hashes/);
  assert.doesNotMatch(workflow, /(?:--form|-F)\s+["']?branch=/);
  assert.doesNotMatch(workflow, /workflow_dispatch:|RPC_|PRIVATE_KEY|MNEMONIC|eth_sendRawTransaction/);

  assert.equal(request.schemaVersion, 'round5-pages-api-production-request-v10');
  assert.equal(request.requestId, REQUEST_ID);
  assert.equal(request.expectedBeforeSha, EXPECTED_PARENT);
  assert.equal(request.applicationSourceSha, APPLICATION_SOURCE);
  assert.equal(request.releaseBranch, RELEASE_BRANCH);
  assert.equal(request.supersededNoRunMergeSha, EXPECTED_PARENT);
  assert.equal(request.supersededNoRunReason, 'invalid-runner-context-in-job-env');
  assert.deepEqual(request.activeNetworks, ['ethereum', 'base']);
  assert.deepEqual(request.deferredNetworks, ['arbitrum', 'fraxtal', 'katana', 'optimism', 'polygon']);
  assert.equal(request.failedOrHistoricalWorkflowRerunAllowed, false);
  assert.equal(request.dependencyInstallationAllowed, false);
  assert.equal(request.directPagesApiRequired, true);
  assert.equal(request.assetUploadAllowed, false);
  assert.equal(request.missingAssetFailsClosed, true);
  assert.equal(request.preRunContextValidationRequired, true);
  assert.equal(request.runnerTempInitializedInShell, true);
  assert.equal(request.productionEnvironmentResponseRequired, true);
  assert.equal(request.productionAliasBindingRequired, true);
  assert.equal(request.repositoryCompilationAllowed, false);
  assert.equal(request.workerDeploymentAllowed, false);
  assert.equal(request.secretMutationAllowed, false);
  assert.equal(request.r2MutationAllowed, false);
  assert.equal(request.jobOrUploadSubmissionAllowed, false);
  assert.equal(request.rpcCallsAllowed, false);
  assert.equal(request.walletSigningAllowed, false);
  assert.equal(request.publicTransactionBroadcastAllowed, false);
});
