import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const WORKFLOW_PATH = '.github/workflows/deploy-v2.yml';
const REQUEST_PATH = '.agent-control/v1/orchestrator/DEPLOY_REQUEST_v2.json';
const EXPECTED_PARENT = '4a4cf0f85ba1fdf9a31e7e7dfa4341256bebb667';
const REQUEST_ID = 'round5-production-deploy-20260803T1025Z-v2';

test('fresh production deployment uses an exact-parent one-time request and verifies existing R2 without recreating it', () => {
  assert.ok(existsSync(WORKFLOW_PATH), `missing workflow: ${WORKFLOW_PATH}`);
  assert.ok(existsSync(REQUEST_PATH), `missing request: ${REQUEST_PATH}`);

  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  assert.match(workflow, /DEPLOY_REQUEST_v2\.json/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, new RegExp(EXPECTED_PARENT));
  assert.match(workflow, new RegExp(REQUEST_ID));
  assert.match(workflow, /accounts\/\$CLOUDFLARE_ACCOUNT_ID\/r2\/buckets\/\$R2_BUCKET_NAME/);
  assert.match(workflow, /R2 bucket verification succeeded/);
  assert.doesNotMatch(workflow, /r2 bucket create/);
  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.match(workflow, /RPC_ETHEREUM/);
  assert.match(workflow, /RPC_BASE/);
  assert.doesNotMatch(workflow, /RPC_ARBITRUM|RPC_FRAXTAL|RPC_KATANA|RPC_OPTIMISM|RPC_POLYGON/);
  assert.match(workflow, /wrangler deploy --config apps\/api\/wrangler\.toml/);
  assert.match(workflow, /wrangler pages deploy dist\/web/);
  assert.match(workflow, /Cloudflare Pages and Worker deployment result/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
  assert.doesNotMatch(workflow, /echo .*\$CLOUDFLARE_API_TOKEN|cat .*response|set -x/);

  const request = JSON.parse(readFileSync(REQUEST_PATH, 'utf8'));
  assert.equal(request.schemaVersion, 'round5-trusted-deployment-request-v2');
  assert.equal(request.requestId, REQUEST_ID);
  assert.equal(request.expectedBeforeSha, EXPECTED_PARENT);
  assert.deepEqual(request.accountOwnerAuthorization.activeNetworks, ['ethereum', 'base']);
  assert.equal(request.accountOwnerAuthorization.deploymentAuthorized, true);
  assert.equal(request.accountOwnerAuthorization.liveProductionTestingAuthorized, true);
  assert.equal(request.safety.failedOrHistoricalWorkflowRerunAllowed, false);
  assert.equal(request.safety.secretValuesIncluded, false);
  assert.equal(request.safety.walletSigningAllowed, false);
  assert.equal(request.safety.publicTransactionBroadcastAllowed, false);
});
