import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const WORKFLOW_PATH = '.github/workflows/deploy-v5.yml';
const REQUEST_PATH = '.agent-control/v1/orchestrator/DEPLOY_REQUEST_v5.json';
const EXPECTED_PARENT = 'b31c79a2b48b3d1390e050489e2b9307f1fb75af';
const REQUEST_ID = 'round5-pages-production-target-20260803T1230Z-v5';

test('deployment v5 promotes the accepted web assets to the Pages production target and verifies the custom domain', () => {
  assert.ok(existsSync(WORKFLOW_PATH), `missing workflow: ${WORKFLOW_PATH}`);
  assert.ok(existsSync(REQUEST_PATH), `missing request: ${REQUEST_PATH}`);

  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  assert.match(workflow, /DEPLOY_REQUEST_v5\.json/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, new RegExp(EXPECTED_PARENT));
  assert.match(workflow, new RegExp(REQUEST_ID));
  assert.match(workflow, /pages\/projects\/\$PAGES_PROJECT_NAME/);
  assert.match(workflow, /\.production_branch/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /wrangler pages deploy dist\/web --project-name="\$PAGES_PROJECT_NAME"/);
  assert.doesNotMatch(workflow, /wrangler pages deploy[^\n]*--branch/);
  assert.match(workflow, /Verify production custom domain serves accepted UI/);
  assert.match(workflow, /unexpected chain option scope/);
  assert.match(workflow, /Base is not the sole default/);
  assert.match(workflow, /chain synchronization contract missing/);
  assert.match(workflow, /Production Pages target deployment v5 result/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
  assert.doesNotMatch(workflow, /wrangler deploy --config apps\/api\/wrangler\.toml/);
  assert.doesNotMatch(workflow, /wrangler secret/);
  assert.doesNotMatch(workflow, /r2 bucket create|r2 bucket lifecycle|r2 bucket cors/);
  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /RPC_|private.?key|eth_sendRawTransaction|wallet/i);

  const request = JSON.parse(readFileSync(REQUEST_PATH, 'utf8'));
  assert.equal(request.schemaVersion, 'round5-pages-production-target-request-v5');
  assert.equal(request.requestId, REQUEST_ID);
  assert.equal(request.expectedBeforeSha, EXPECTED_PARENT);
  assert.equal(request.deployedApplicationSourceSha, '2c6e543dfcaa17ca975bbde3c15302269bbf8072');
  assert.deepEqual(request.activeNetworks, ['ethereum', 'base']);
  assert.equal(request.priorDeploymentRun, 30808377849);
  assert.equal(request.failedAcceptanceRun, 30813209037);
  assert.equal(request.failedOrHistoricalWorkflowRerunAllowed, false);
  assert.equal(request.workerDeploymentAllowed, false);
  assert.equal(request.secretMutationAllowed, false);
  assert.equal(request.r2MutationAllowed, false);
  assert.equal(request.jobOrUploadSubmissionAllowed, false);
  assert.equal(request.walletSigningAllowed, false);
  assert.equal(request.publicTransactionBroadcastAllowed, false);
});
