import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const LIFECYCLE_PATH = 'infra/r2-lifecycle.json';
const WORKFLOW_PATH = '.github/workflows/deploy-v3.yml';
const REQUEST_PATH = '.agent-control/v1/orchestrator/DEPLOY_REQUEST_v3.json';
const EXPECTED_PARENT = 'bb500321d084dfc9336304898f9cdd8b65bd9e1b';
const REQUEST_ID = 'round5-production-deploy-20260803T1035Z-v3';

test('R2 lifecycle uses the native Cloudflare rules schema and a fresh exact-parent deployment request', () => {
  const lifecycle = JSON.parse(readFileSync(LIFECYCLE_PATH, 'utf8'));
  assert.deepEqual(Object.keys(lifecycle), ['rules']);
  assert.ok(Array.isArray(lifecycle.rules));
  assert.equal(lifecycle.rules.length, 1);

  const [rule] = lifecycle.rules;
  assert.deepEqual(Object.keys(rule).sort(), [
    'abortMultipartUploadsTransition',
    'conditions',
    'deleteObjectsTransition',
    'enabled',
    'id',
  ]);
  assert.equal(rule.id, 'delete-preflight-artifacts-after-30-days');
  assert.equal(rule.enabled, true);
  assert.deepEqual(rule.conditions, { prefix: '' });
  assert.deepEqual(rule.deleteObjectsTransition, {
    condition: { type: 'Age', maxAge: 2_592_000 },
  });
  assert.deepEqual(rule.abortMultipartUploadsTransition, {
    condition: { type: 'Age', maxAge: 86_400 },
  });

  assert.ok(existsSync(WORKFLOW_PATH), `missing workflow: ${WORKFLOW_PATH}`);
  assert.ok(existsSync(REQUEST_PATH), `missing request: ${REQUEST_PATH}`);

  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  assert.match(workflow, /DEPLOY_REQUEST_v3\.json/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, new RegExp(EXPECTED_PARENT));
  assert.match(workflow, new RegExp(REQUEST_ID));
  assert.match(workflow, /r2 bucket lifecycle set "\$R2_BUCKET_NAME" --file infra\/r2-lifecycle\.json --force/);
  assert.match(workflow, /r2 bucket lifecycle list "\$R2_BUCKET_NAME"/);
  assert.doesNotMatch(workflow, /r2 bucket create/);
  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.match(workflow, /RPC_ETHEREUM/);
  assert.match(workflow, /RPC_BASE/);
  assert.doesNotMatch(workflow, /RPC_ARBITRUM|RPC_FRAXTAL|RPC_KATANA|RPC_OPTIMISM|RPC_POLYGON/);
  assert.match(workflow, /wrangler deploy --config apps\/api\/wrangler\.toml/);
  assert.match(workflow, /wrangler pages deploy dist\/web/);
  assert.match(workflow, /Cloudflare deployment v3 result/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);

  const request = JSON.parse(readFileSync(REQUEST_PATH, 'utf8'));
  assert.equal(request.schemaVersion, 'round5-trusted-deployment-request-v3');
  assert.equal(request.requestId, REQUEST_ID);
  assert.equal(request.expectedBeforeSha, EXPECTED_PARENT);
  assert.deepEqual(request.accountOwnerAuthorization.activeNetworks, ['ethereum', 'base']);
  assert.equal(request.remediation.sourceRun, 30805768611);
  assert.equal(request.remediation.failedStep, 'Configure bounded R2 browser uploads and retention');
  assert.equal(request.remediation.failedOrHistoricalWorkflowRerun, false);
  assert.equal(request.safety.secretValuesIncluded, false);
  assert.equal(request.safety.walletSigningAllowed, false);
  assert.equal(request.safety.publicTransactionBroadcastAllowed, false);
});
