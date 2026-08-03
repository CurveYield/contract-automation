import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const WORKFLOW_PATH = '.github/workflows/production-acceptance-v2.yml';
const REQUEST_PATH = '.agent-control/v1/orchestrator/PRODUCTION_ACCEPTANCE_REQUEST_v2.json';
const INDEX_PATH = 'apps/web/public/index.html';
const APP_PATH = 'apps/web/public/app.js';
const EXPECTED_PARENT = '2c6e543dfcaa17ca975bbde3c15302269bbf8072';
const REQUEST_ID = 'round5-production-post-ui-smoke-20260803T1124Z-v2';

test('post-UI production smoke is exact-parent, Ethereum/Base-only, and read-only', () => {
  assert.ok(existsSync(WORKFLOW_PATH), `missing workflow: ${WORKFLOW_PATH}`);
  assert.ok(existsSync(REQUEST_PATH), `missing request: ${REQUEST_PATH}`);

  const index = readFileSync(INDEX_PATH, 'utf8');
  const app = readFileSync(APP_PATH, 'utf8');
  const chainOptions = [...index.matchAll(/<option value="([a-z]+)"(?: selected)?>([^<]+)<\/option>/g)]
    .filter(([, value]) => value === 'ethereum' || value === 'base')
    .map(([, value, label]) => ({ value, label }));
  assert.deepEqual(chainOptions, [
    { value: 'ethereum', label: 'Ethereum' },
    { value: 'base', label: 'Base' },
  ]);
  assert.match(index, /<option value="base" selected>Base<\/option>/);
  assert.doesNotMatch(index, /value="(?:arbitrum|fraxtal|katana|optimism|polygon)"/);
  assert.match(app, /function syncChainOptions\(chains\)/);
  assert.match(app, /name === 'ethereum' \|\| name === 'base'/);
  assert.match(app, /syncChainOptions\(response\.chains\)/);

  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  assert.match(workflow, /PRODUCTION_ACCEPTANCE_REQUEST_v2\.json/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, new RegExp(EXPECTED_PARENT));
  assert.match(workflow, new RegExp(REQUEST_ID));
  assert.match(workflow, /https:\/\/preflight\.curveyield\.online/);
  assert.match(workflow, /https:\/\/api\.preflight\.curveyield\.online\/api\/v1\/health/);
  assert.match(workflow, /Verify live operator network selector/);
  assert.match(workflow, /syncChainOptions/);
  assert.match(workflow, /Invalid client API key/);
  assert.match(workflow, /access-control-allow-origin/);
  assert.match(workflow, /RPC_ETHEREUM/);
  assert.match(workflow, /RPC_BASE/);
  assert.doesNotMatch(workflow, /RPC_ARBITRUM|RPC_FRAXTAL|RPC_KATANA|RPC_OPTIMISM|RPC_POLYGON/);
  assert.match(workflow, /eth_chainId/);
  assert.match(workflow, /eth_blockNumber/);
  assert.match(workflow, /Post-UI production smoke v2 result/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /eth_send|eth_sign|personal_|wallet_|\/api\/v1\/jobs|\/api\/v1\/uploads|wrangler|set -x/);

  const request = JSON.parse(readFileSync(REQUEST_PATH, 'utf8'));
  assert.equal(request.schemaVersion, 'round5-production-post-ui-smoke-request-v2');
  assert.equal(request.requestId, REQUEST_ID);
  assert.equal(request.expectedBeforeSha, EXPECTED_PARENT);
  assert.equal(request.deployedSourceSha, EXPECTED_PARENT);
  assert.equal(request.deploymentRun, 30808377849);
  assert.equal(request.deploymentJob, 91668946456);
  assert.deepEqual(request.activeNetworks, ['ethereum', 'base']);
  assert.deepEqual(request.checks, [
    'pages-availability',
    'live-operator-network-selector',
    'live-operator-chain-sync-code',
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
