import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const HTML_PATH = 'apps/web/public/index.html';
const APP_PATH = 'apps/web/public/app.js';
const WORKFLOW_PATH = '.github/workflows/deploy-v4.yml';
const REQUEST_PATH = '.agent-control/v1/orchestrator/DEPLOY_REQUEST_v4.json';
const EXPECTED_PARENT = 'ec6c5c3c99a767dbed5505846a3ce4efee9290ca';
const REQUEST_ID = 'round5-production-ui-scope-deploy-20260803T1100Z-v4';

test('production operator exposes only API-authorized Ethereum and Base chains and redeploys from an exact-parent request', () => {
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
  assert.match(workflow, /DEPLOY_REQUEST_v4\.json/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, new RegExp(EXPECTED_PARENT));
  assert.match(workflow, new RegExp(REQUEST_ID));
  assert.match(workflow, /wrangler deploy --config apps\/api\/wrangler\.toml/);
  assert.match(workflow, /wrangler pages deploy dist\/web/);
  assert.match(workflow, /Production UI scope deployment v4 result/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /RPC_ARBITRUM|RPC_FRAXTAL|RPC_KATANA|RPC_OPTIMISM|RPC_POLYGON/);
  assert.doesNotMatch(workflow, /r2 bucket create/);

  const request = JSON.parse(readFileSync(REQUEST_PATH, 'utf8'));
  assert.equal(request.schemaVersion, 'round5-trusted-deployment-request-v4');
  assert.equal(request.requestId, REQUEST_ID);
  assert.equal(request.expectedBeforeSha, EXPECTED_PARENT);
  assert.deepEqual(request.activeNetworks, ['ethereum', 'base']);
  assert.deepEqual(request.remediation, {
    finding: 'production-web-chain-selector-exposed-deferred-networks',
    repair: 'static-and-api-synchronized-ethereum-base-only-selector',
    priorSmokeRun: 30807373463,
    priorSmokeInvalidatedByApplicationChange: true,
    failedOrHistoricalWorkflowRerun: false,
  });
  assert.equal(request.safety.secretValuesIncluded, false);
  assert.equal(request.safety.walletSigningAllowed, false);
  assert.equal(request.safety.publicTransactionBroadcastAllowed, false);
});
