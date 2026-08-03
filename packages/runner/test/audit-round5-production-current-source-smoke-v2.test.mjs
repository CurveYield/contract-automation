import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const HTML_PATH = 'apps/web/public/index.html';
const APP_PATH = 'apps/web/public/app.js';
const WORKFLOW_PATH = '.github/workflows/production-acceptance-v2.yml';
const REQUEST_PATH = '.agent-control/v1/orchestrator/PRODUCTION_ACCEPTANCE_REQUEST_v2.json';
const EXPECTED_PARENT = '2c6e543dfcaa17ca975bbde3c15302269bbf8072';
const REQUEST_ID = 'round5-production-current-source-smoke-20260803T1158Z-v2';

const CHECKS = [
  'pages-availability',
  'api-health',
  'api-setup-readiness',
  'api-auth-rejection',
  'api-chain-allowlist',
  'cors-origin',
  'ethereum-rpc-identity-and-head',
  'base-rpc-identity-and-head',
  'deployed-ui-ethereum-base-only',
  'deployed-ui-base-default',
  'deployed-client-chain-synchronization',
  'deferred-networks-not-selectable',
  'zero-job-upload-signing-wallet-or-broadcast-operation',
];

test('current production source has an exact-parent read-only smoke gate including deployed UI scope', () => {
  const html = readFileSync(HTML_PATH, 'utf8');
  const app = readFileSync(APP_PATH, 'utf8');
  const chainSelect = html.match(/<select id="chain">([\s\S]*?)<\/select>/)?.[1] ?? '';
  const options = [...chainSelect.matchAll(/<option value="([^"]+)"([^>]*)>/g)]
    .map((match) => ({ value: match[1], attributes: match[2] }));

  assert.deepEqual(options.map((option) => option.value), ['ethereum', 'base']);
  assert.equal(options.filter((option) => /\bselected\b/.test(option.attributes)).length, 1);
  assert.equal(options.find((option) => /\bselected\b/.test(option.attributes))?.value, 'base');
  assert.doesNotMatch(chainSelect, /katana|fraxtal|arbitrum|polygon|optimism/i);
  assert.match(app, /function syncChainOptions\(chains\)/);
  assert.match(app, /syncChainOptions\(response\.chains\)/);
  assert.match(app, /Object\.entries\(chains\)/);
  assert.match(app, /elements\.chain\.replaceChildren/);
  assert.match(app, /preferred === 'base'/);

  assert.ok(existsSync(WORKFLOW_PATH), `missing workflow: ${WORKFLOW_PATH}`);
  assert.ok(existsSync(REQUEST_PATH), `missing request: ${REQUEST_PATH}`);

  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  assert.match(workflow, /PRODUCTION_ACCEPTANCE_REQUEST_v2\.json/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, new RegExp(EXPECTED_PARENT));
  assert.match(workflow, new RegExp(REQUEST_ID));
  assert.match(workflow, /https:\/\/preflight\.curveyield\.online/);
  assert.match(workflow, /https:\/\/api\.preflight\.curveyield\.online\/api\/v1\/health/);
  assert.match(workflow, /\/api\/v1\/setup/);
  assert.match(workflow, /\/api\/v1\/chains/);
  assert.match(workflow, /\/app\.js/);
  assert.match(workflow, /Invalid client API key/);
  assert.match(workflow, /access-control-allow-origin/);
  assert.match(workflow, /RPC_ETHEREUM/);
  assert.match(workflow, /RPC_BASE/);
  assert.doesNotMatch(workflow, /RPC_ARBITRUM|RPC_FRAXTAL|RPC_KATANA|RPC_OPTIMISM|RPC_POLYGON/);
  assert.match(workflow, /eth_chainId/);
  assert.match(workflow, /eth_blockNumber/);
  assert.match(workflow, /0x1/);
  assert.match(workflow, /0x2105/);
  assert.match(workflow, /deployed UI Ethereum\/Base scope/);
  assert.match(workflow, /Production current-source smoke acceptance v2 result/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /eth_send|eth_sign|personal_|wallet_|\/api\/v1\/jobs|\/api\/v1\/uploads/);
  assert.doesNotMatch(workflow, /wrangler|set -x/);

  const request = JSON.parse(readFileSync(REQUEST_PATH, 'utf8'));
  assert.equal(request.schemaVersion, 'round5-production-current-source-smoke-request-v2');
  assert.equal(request.requestId, REQUEST_ID);
  assert.equal(request.expectedBeforeSha, EXPECTED_PARENT);
  assert.equal(request.deployedSourceSha, EXPECTED_PARENT);
  assert.equal(request.deploymentRun, 30808377849);
  assert.equal(request.deploymentJob, 91668946456);
  assert.deepEqual(request.activeNetworks, ['ethereum', 'base']);
  assert.deepEqual(request.deferredNetworks, ['arbitrum', 'fraxtal', 'katana', 'optimism', 'polygon']);
  assert.deepEqual(request.checks, CHECKS);
  assert.equal(request.readOnly, true);
  assert.equal(request.jobSubmissionAllowed, false);
  assert.equal(request.uploadSubmissionAllowed, false);
  assert.equal(request.walletSigningAllowed, false);
  assert.equal(request.publicTransactionBroadcastAllowed, false);
  assert.equal(request.secretValuesIncluded, false);
  assert.equal(request.failedOrHistoricalWorkflowRerunAllowed, false);
  assert.equal(request.supersedesSmokeRun, 30807373463);
});