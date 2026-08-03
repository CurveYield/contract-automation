import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const WORKFLOW_PATH = '.github/workflows/deploy-v9.yml';
const REQUEST_PATH = '.agent-control/v1/orchestrator/DEPLOY_REQUEST_v9.json';
const MANIFEST_SCRIPT_PATH = 'scripts/pages_asset_manifest_v1.py';
const EXPECTED_PARENT = '70719851d8e18faf89e65027858b9f4f728d979d';
const APPLICATION_SOURCE = '2c6e543dfcaa17ca975bbde3c15302269bbf8072';
const RELEASE_BRANCH = 'orchestrator/round4-ci-base-v1';
const REQUEST_ID = 'round5-pages-api-production-20260803T1320Z-v9';
const OFFICIAL_CHUNK_BOUNDARY_VECTORS = [
  [1023, '10108970eeda3eb932baac1428c7a2163b0e924c9a9e25b35bba72b28f70bd11'],
  [1024, '42214739f095a406f3fc83deb889744ac00df831c10daa55189b5d121c855af7'],
  [1025, 'd00278ae47eb27b34faecf67b4fe263f82d5412916c1ffd97c8cb7fb814b8444'],
];

test('deployment v9 uses the dependency-free Pages API and accepts only exact production binding', () => {
  assert.ok(existsSync(WORKFLOW_PATH), `missing workflow: ${WORKFLOW_PATH}`);
  assert.ok(existsSync(REQUEST_PATH), `missing request: ${REQUEST_PATH}`);
  assert.ok(existsSync(MANIFEST_SCRIPT_PATH), `missing manifest script: ${MANIFEST_SCRIPT_PATH}`);

  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
  const manifestScript = readFileSync(MANIFEST_SCRIPT_PATH, 'utf8');
  const request = JSON.parse(readFileSync(REQUEST_PATH, 'utf8'));

  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  assert.match(workflow, /DEPLOY_REQUEST_v9\.json/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, new RegExp(EXPECTED_PARENT));
  assert.match(workflow, new RegExp(APPLICATION_SOURCE));
  assert.match(workflow, new RegExp(REQUEST_ID));
  assert.match(workflow, /github\.event\.before/);
  assert.match(workflow, /git diff --quiet "\$APPLICATION_SOURCE_SHA" -- apps\/web\/public/);
  assert.match(workflow, /pages_asset_manifest_v1\.py/);
  assert.match(workflow, /pages\/projects\/\$PAGES_PROJECT_NAME\/upload-token/);
  assert.match(workflow, /\/pages\/assets\/check-missing/);
  assert.match(workflow, /missing.*length.*0|length == 0|length==0/s);
  assert.match(workflow, /pages\/projects\/\$PAGES_PROJECT_NAME\/deployments/);
  assert.match(workflow, /commit_hash/);
  assert.match(workflow, /commit_message/);
  assert.match(workflow, /commit_dirty/);
  assert.match(workflow, /\.result\.environment == "production"/);
  assert.match(workflow, /\.result\.deployment_trigger\.metadata\.branch == \$release_branch/);
  assert.match(workflow, /\.result\.deployment_trigger\.metadata\.commit_hash == \$application_source/);
  assert.match(workflow, /\.result\.latest_stage\.status == "success"/);
  assert.match(workflow, /preflight\.curveyield\.online/);
  assert.match(workflow, /\.result\.aliases/);
  assert.match(workflow, /Verify production custom domain serves API-bound production deployment/);
  assert.match(workflow, /unexpected chain option scope/);
  assert.match(workflow, /Base is not the sole default/);
  assert.match(workflow, /chain synchronization contract missing/);
  assert.match(workflow, /Production Pages API deployment v9 result/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
  assert.match(workflow, /actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/);

  assert.doesNotMatch(workflow, /\bnpm\b|\bnpx\b|\bpnpm\b|\byarn\b|\bcorepack\b|\bpip(?:3)?\b|\bapt(?:-get)?\b|\bbrew\b/);
  assert.doesNotMatch(workflow, /\bwrangler\b/i);
  assert.doesNotMatch(workflow, /\/pages\/assets\/upload|\/pages\/assets\/upsert-hashes/);
  assert.doesNotMatch(workflow, /(?:--form|-F)\s+["']?branch=/);
  assert.doesNotMatch(workflow, /npm install|npm ci|npm test|npm run build|npm run lint/);
  assert.doesNotMatch(workflow, /apps\/api\/wrangler\.toml|r2 bucket|workflow_dispatch:|RPC_|PRIVATE_KEY|MNEMONIC|eth_sendRawTransaction/);

  assert.match(manifestScript, /af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262/);
  assert.match(manifestScript, /6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85/);
  for (const [, expectedHash] of OFFICIAL_CHUNK_BOUNDARY_VECTORS) {
    assert.match(manifestScript, new RegExp(expectedHash));
  }
  assert.match(manifestScript, /base64\.b64encode/);
  assert.match(manifestScript, /suffix\.lstrip\(['"]\.['"]\)/);
  assert.match(manifestScript, /\[:32\]/);
  assert.match(manifestScript, /sha256/);
  assert.doesNotMatch(manifestScript, /import blake3|from blake3/);

  const pythonCheck = `
import importlib.util
from pathlib import Path
spec = importlib.util.spec_from_file_location("pages_asset_manifest_v1", Path(${JSON.stringify(MANIFEST_SCRIPT_PATH)}))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
vectors = ${JSON.stringify(OFFICIAL_CHUNK_BOUNDARY_VECTORS)}
for length, expected in vectors:
    payload = bytes(index % 251 for index in range(length))
    actual = module.blake3_digest(payload).hex()
    if actual != expected:
        raise SystemExit(f"BLAKE3 mismatch at {length}: {actual}")
`;
  const pythonResult = spawnSync('python3', ['-c', pythonCheck], {
    encoding: 'utf8',
    timeout: 20_000,
  });
  assert.equal(
    pythonResult.status,
    0,
    `dependency-free BLAKE3 vector verification failed: ${pythonResult.stderr || pythonResult.stdout}`,
  );

  assert.equal(request.schemaVersion, 'round5-pages-api-production-request-v9');
  assert.equal(request.requestId, REQUEST_ID);
  assert.equal(request.expectedBeforeSha, EXPECTED_PARENT);
  assert.equal(request.applicationSourceSha, APPLICATION_SOURCE);
  assert.equal(request.releaseBranch, RELEASE_BRANCH);
  assert.deepEqual(request.activeNetworks, ['ethereum', 'base']);
  assert.deepEqual(request.deferredNetworks, ['arbitrum', 'fraxtal', 'katana', 'optimism', 'polygon']);
  assert.deepEqual(request.supersededRuns, [30808377849, 30813209037, 30814064657, 30815289252, 30815965400]);
  assert.equal(request.failedOrHistoricalWorkflowRerunAllowed, false);
  assert.equal(request.dependencyInstallationAllowed, false);
  assert.equal(request.directPagesApiRequired, true);
  assert.equal(request.assetUploadAllowed, false);
  assert.equal(request.missingAssetFailsClosed, true);
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
