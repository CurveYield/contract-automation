import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const RELEASE_BINDING_ID = 'round5-release-source-3da6b10-v1';
const ACCEPTED_SOURCE_SHA = '3da6b10f240e2abd031195f440c7cd80b72b691b';
const ACCEPTED_BASE_SHA = 'bbb4cac794865f84b65ee78a2fc78d391421c759';
const ATTESTATION_DIGEST = '22ee6ee759c027189b9e8887e584c976e378a6de917a20acb0e5275e3a1afc16';

const MANIFEST_PATHS = Object.freeze({
  release: 'docs/audit/round5/release-source-binding-v1.json',
  productionTest: 'docs/audit/round5/production-test-manifest-v1.json',
  secrets: 'docs/audit/round5/secret-variable-binding-manifest-v1.json',
  resources: 'docs/audit/round5/production-resource-manifest-v1.json',
  deployment: 'docs/audit/round5/deployment-preflight-manifest-v1.json',
  rollback: 'docs/audit/round5/rollback-recovery-manifest-v1.json',
  observability: 'docs/audit/round5/observability-redaction-manifest-v1.json',
  v27: 'docs/audit/round5/trusted-v27-live-regression-contract-v1.json',
  authorization: 'docs/audit/round5/production-authorization-gate-v1.json'
});

const REQUIRED_SECRET_NAMES = Object.freeze([
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_API_TOKEN',
  'PREFLIGHTSIM_CLIENT_API_KEY',
  'PREFLIGHTSIM_GITHUB_BRIDGE_API_KEY',
  'PREFLIGHTSIM_GITHUB_TOKEN',
  'PREFLIGHTSIM_GPT_API_KEY',
  'PREFLIGHTSIM_R2_ACCESS_KEY_ID',
  'PREFLIGHTSIM_R2_SECRET_ACCESS_KEY',
  'PREFLIGHTSIM_RUNNER_API_KEY',
  'RPC_ARBITRUM',
  'RPC_BASE',
  'RPC_ETHEREUM',
  'RPC_FRAXTAL',
  'RPC_KATANA',
  'RPC_OPTIMISM',
  'RPC_POLYGON'
]);

const REQUIRED_VARIABLE_NAMES = Object.freeze([
  'PAGES_PROJECT_NAME',
  'PREFLIGHTSIM_ALLOWED_GITHUB_USERS',
  'PREFLIGHTSIM_API_URL'
]);

const EXPECTED_NETWORKS = Object.freeze([
  ['arbitrum', 42161, 'RPC_ARBITRUM'],
  ['base', 8453, 'RPC_BASE'],
  ['ethereum', 1, 'RPC_ETHEREUM'],
  ['fraxtal', 252, 'RPC_FRAXTAL'],
  ['katana', 747474, 'RPC_KATANA'],
  ['optimism', 10, 'RPC_OPTIMISM'],
  ['polygon', 137, 'RPC_POLYGON']
]);

const EXPECTED_STAGE_IDS = Object.freeze([
  'configuration-preflight',
  'deployment',
  'live-api-auth-gpt',
  'live-r2',
  'live-github-direct',
  'live-read-only-rpc',
  'web-operator',
  'observability-recovery'
]);

const FORBIDDEN_VALUE_KEYS = new Set([
  'value',
  'secretValue',
  'privateKey',
  'privateKeys',
  'mnemonic',
  'seedPhrase',
  'rpcUrl',
  'endpointUrl',
  'rawUrl',
  'authorizationHeader',
  'bearerToken'
]);

function readJson(path) {
  assert.ok(existsSync(path), `missing Round 5 readiness manifest: ${path}`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function sorted(values) {
  return [...values].sort();
}

function assertNoForbiddenValues(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenValues(item, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_VALUE_KEYS.has(key)) {
      assert.ok(
        child === null || child === false || child === '',
        `${childPath} must not contain a credential, endpoint, key or secret value`
      );
    }
    assertNoForbiddenValues(child, childPath);
  }
}

test('Round 5 production-test readiness manifests are complete, consistent and closed by default', () => {
  assert.ok(
    existsSync('docs/audit/round5/README_v1.md'),
    'missing Round 5 operator README: docs/audit/round5/README_v1.md'
  );

  const manifests = Object.fromEntries(
    Object.entries(MANIFEST_PATHS).map(([name, path]) => [name, readJson(path)])
  );

  for (const [name, manifest] of Object.entries(manifests)) {
    assert.equal(manifest.releaseBindingId, RELEASE_BINDING_ID, `${name} release binding mismatch`);
    assertNoForbiddenValues(manifest, `$.${name}`);
  }

  assert.equal(manifests.release.schemaVersion, 'round5-release-source-binding-v1');
  assert.equal(manifests.release.acceptedSourceSha, ACCEPTED_SOURCE_SHA);
  assert.equal(manifests.release.acceptedBaseSha, ACCEPTED_BASE_SHA);
  assert.equal(manifests.release.exactTreeAttestation.digestSha256, ATTESTATION_DIGEST);
  assert.equal(manifests.release.exactTreeAttestation.attestedPathCount, 198);
  assert.equal(manifests.release.changedPathCount, 202);
  assert.deepEqual(manifests.release.exactHeadWorkflowRuns, [30788571549, 30788571507]);
  assert.equal(manifests.release.staticAcceptance, 'ACCEPT');
  assert.equal(manifests.release.mergeAuthorized, false);

  assert.equal(manifests.secrets.schemaVersion, 'round5-secret-variable-binding-manifest-v1');
  assert.deepEqual(sorted(manifests.secrets.secrets.map((entry) => entry.name)), REQUIRED_SECRET_NAMES);
  assert.deepEqual(sorted(manifests.secrets.variables.map((entry) => entry.name)), REQUIRED_VARIABLE_NAMES);
  assert.ok(manifests.secrets.secrets.every((entry) => entry.valueRecorded === false));
  assert.ok(manifests.secrets.secrets.every((entry) => entry.presenceConfirmed === false));
  assert.ok(manifests.secrets.variables.every((entry) => entry.valueRecorded === false));
  assert.ok(manifests.secrets.variables.every((entry) => entry.presenceConfirmed === false));

  assert.equal(manifests.resources.schemaVersion, 'round5-production-resource-manifest-v1');
  assert.equal(manifests.resources.cloudflare.zone, 'curveyield.online');
  assert.equal(manifests.resources.cloudflare.apiHostname, 'api.preflight.curveyield.online');
  assert.equal(manifests.resources.cloudflare.pagesProject, 'curveyield-preflight');
  assert.equal(manifests.resources.cloudflare.pagesHostname, 'preflight.curveyield.online');
  assert.equal(manifests.resources.cloudflare.r2Bucket, 'curveyield-preflight');
  assert.deepEqual(manifests.resources.cloudflare.corsOrigins, ['https://preflight.curveyield.online']);
  assert.deepEqual(
    manifests.resources.readOnlyRpcNetworks.map((entry) => [entry.network, entry.chainId, entry.legacySecretName]),
    EXPECTED_NETWORKS
  );
  assert.ok(manifests.resources.readOnlyRpcNetworks.every((entry) => entry.transactionBroadcastAllowed === false));
  assert.ok(manifests.resources.readOnlyRpcNetworks.every((entry) => entry.signingAllowed === false));

  assert.equal(manifests.productionTest.schemaVersion, 'round5-production-test-manifest-v1');
  assert.deepEqual(manifests.productionTest.stages.map((stage) => stage.id), EXPECTED_STAGE_IDS);
  assert.ok(manifests.productionTest.stages.every((stage) => stage.prerequisites.length > 0));
  assert.ok(manifests.productionTest.stages.every((stage) => stage.checks.length > 0));
  assert.ok(manifests.productionTest.stages.every((stage) => stage.requiredEvidence.length > 0));
  assert.ok(manifests.productionTest.stages.every((stage) => stage.rejectConditions.length > 0));
  assert.ok(
    manifests.productionTest.stages
      .filter((stage) => stage.id.startsWith('live-') || stage.id === 'web-operator')
      .every((stage) => stage.requiresVerifiedDeploymentCheckpoint === true)
  );

  assert.equal(manifests.deployment.schemaVersion, 'round5-deployment-preflight-manifest-v1');
  assert.equal(manifests.deployment.trustedSource.exactSha, ACCEPTED_SOURCE_SHA);
  assert.equal(manifests.deployment.workflowTrust.pullRequestEventsMayReceiveProductionSecrets, false);
  assert.equal(manifests.deployment.workflowTrust.thirdPartyActionsMustUseFullCommitSha, true);
  assert.equal(manifests.deployment.deploymentAuthorized, false);
  assert.ok(manifests.deployment.requiredEvidence.includes('deployment-run-id'));
  assert.ok(manifests.deployment.requiredEvidence.includes('artifact-id-and-digest'));

  assert.equal(manifests.rollback.schemaVersion, 'round5-rollback-recovery-manifest-v1');
  assert.equal(manifests.rollback.destructiveRecoveryAgainstIrreplaceableDataAllowed, false);
  assert.ok(manifests.rollback.requiredDrills.includes('rollback-to-last-known-good'));
  assert.ok(manifests.rollback.requiredDrills.includes('idempotent-redeploy'));
  assert.ok(manifests.rollback.requiredDrills.includes('r2-partial-publication-recovery'));
  assert.ok(manifests.rollback.requiredDrills.includes('github-duplicate-publication-reconciliation'));
  assert.ok(manifests.rollback.requiredDrills.includes('non-production-test-key-rotation'));

  assert.equal(manifests.observability.schemaVersion, 'round5-observability-redaction-manifest-v1');
  assert.ok(manifests.observability.requiredFields.includes('correlationId'));
  assert.ok(manifests.observability.requiredFields.includes('exactSha'));
  assert.ok(manifests.observability.prohibitedOutputs.includes('secret-values'));
  assert.ok(manifests.observability.prohibitedOutputs.includes('raw-rpc-urls'));
  assert.ok(manifests.observability.prohibitedOutputs.includes('stack-traces-in-public-output'));
  assert.equal(manifests.observability.recursiveRedactionRequired, true);

  assert.equal(manifests.v27.schemaVersion, 'round5-trusted-v27-live-regression-contract-v1');
  assert.equal(manifests.v27.workflowDispatchAuthorized, false);
  assert.equal(manifests.v27.pullRequestEventAllowed, false);
  assert.equal(manifests.v27.publicChainBroadcastsRequired, 0);
  assert.ok(manifests.v27.requiredEvidence.includes('artifact-digest-match'));
  assert.ok(manifests.v27.requiredEvidence.includes('fork-identity-match'));
  assert.ok(manifests.v27.requiredEvidence.includes('assertion-counts'));

  assert.equal(manifests.authorization.schemaVersion, 'round5-production-authorization-gate-v1');
  assert.deepEqual(Object.keys(manifests.authorization.gates).sort(), [
    'credentialNameReadiness',
    'deployment',
    'liveProductionTesting',
    'promotion'
  ]);
  assert.ok(Object.values(manifests.authorization.gates).every((gate) => gate.authorized === false));
  assert.ok(Object.values(manifests.authorization.gates).every((gate) => gate.authorizer === 'account-owner'));
  assert.equal(manifests.authorization.productionTestingReady, false);
});
