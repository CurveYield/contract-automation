import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const WORKFLOW_PATH = '.github/workflows/production-acceptance-v1.yml';
const REQUEST_PATH = '.agent-control/v1/orchestrator/PRODUCTION_ACCEPTANCE_REQUEST_v1.json';
const EXPECTED_PARENT = 'fbe27b824da8084970915b31f2051679abe39cfc';
const REQUEST_ID = 'round5-production-smoke-acceptance-20260803T1045Z-v1';

test('production acceptance is exact-parent, read-only, Ethereum/Base-only, and reports sanitized evidence', () => {
  assert.ok(existsSync(WORKFLOW_PATH), `missing workflow: ${WORKFLOW_PATH}`);
  assert.ok(existsSync(REQUEST_PATH), `missing request: ${REQUEST_PATH}`);

  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  assert.match(workflow, /PRODUCTION_ACCEPTANCE_REQUEST_v1\.json/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, new RegExp(EXPECTED_PARENT));
  assert.match(workflow, new RegExp(REQUEST_ID));
  assert.match(workflow, /https:\/\/preflight\.curveyield\.online/);
  assert.match(workflow, /https:\/\/api\.preflight\.curveyield\.online\/api\/v1\/health/);
  assert.match(workflow, /\/api\/v1\/setup/);
  assert.match(workflow, /\/api\/v1\/chains/);
  assert.match(workflow, /Invalid client API key/);
  assert.match(workflow, /access-control-allow-origin/);
  assert.match(workflow, /RPC_ETHEREUM/);
  assert.match(workflow, /RPC_BASE/);
  assert.doesNotMatch(workflow, /RPC_ARBITRUM|RPC_FRAXTAL|RPC_KATANA|RPC_OPTIMISM|RPC_POLYGON/);
  assert.match(workflow, /eth_chainId/);
  assert.match(workflow, /eth_blockNumber/);
  assert.match(workflow, /0x1/);
  assert.match(workflow, /0x2105/);
  assert.match(workflow, /Production smoke acceptance result/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /eth_send|eth_sign|personal_|wallet_|\/api\/v1\/jobs|\/api\/v1\/uploads/);
  assert.doesNotMatch(workflow, /wrangler|curl .*\$RPC_ETHEREUM|curl .*\$RPC_BASE|set -x/);

  const request = JSON.parse(readFileSync(REQUEST_PATH, 'utf8'));
  assert.equal(request.schemaVersion, 'round5-production-smoke-acceptance-request-v1');
  assert.equal(request.requestId, REQUEST_ID);
  assert.equal(request.expectedBeforeSha, EXPECTED_PARENT);
  assert.equal(request.deployedSourceSha, EXPECTED_PARENT);
  assert.equal(request.deploymentRun, 30806403201);
  assert.equal(request.deploymentJob, 91662681725);
  assert.deepEqual(request.activeNetworks, ['ethereum', 'base']);
  assert.deepEqual(request.checks, [
    'pages-availability',
    'api-health',
    'api-setup-readiness',
    'api-auth-rejection',
    'api-chain-allowlist',
    'cors-origin',
    'ethereum-rpc-identity-and-head',
    'base-rpc-identity-and-head',
  ]);
  assert.equal(request.readOnly, true);
  assert.equal(request.jobSubmissionAllowed, false);
  assert.equal(request.walletSigningAllowed, false);
  assert.equal(request.publicTransactionBroadcastAllowed, false);
  assert.equal(request.secretValuesIncluded, false);
});
