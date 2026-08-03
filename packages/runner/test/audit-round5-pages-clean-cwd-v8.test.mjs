import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const WORKFLOW_PATH = '.github/workflows/deploy-v8.yml';
const REQUEST_PATH = '.agent-control/v1/orchestrator/DEPLOY_REQUEST_v8.json';
const EXPECTED_PARENT = '70719851d8e18faf89e65027858b9f4f728d979d';
const APPLICATION_SOURCE = '2c6e543dfcaa17ca975bbde3c15302269bbf8072';
const REQUEST_ID = 'round5-pages-clean-cwd-20260803T1315Z-v8';

test('deployment v8 runs Pages deploy from a clean directory outside repository Wrangler redirects', () => {
  assert.ok(existsSync(WORKFLOW_PATH), `missing workflow: ${WORKFLOW_PATH}`);
  assert.ok(existsSync(REQUEST_PATH), `missing request: ${REQUEST_PATH}`);

  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  assert.match(workflow, /DEPLOY_REQUEST_v8\.json/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, new RegExp(EXPECTED_PARENT));
  assert.match(workflow, new RegExp(APPLICATION_SOURCE));
  assert.match(workflow, new RegExp(REQUEST_ID));
  assert.match(workflow, /PAGES_DEPLOY_ROOT=\$\(mktemp -d\)/);
  assert.match(workflow, /cp -R apps\/web\/public\/\. "\$PAGES_DEPLOY_ROOT\/"/);
  assert.match(workflow, /test ! -e "\$PAGES_DEPLOY_ROOT\/\.wrangler\/deploy\/config\.json"/);
  assert.match(workflow, /cd "\$PAGES_DEPLOY_ROOT"/);
  assert.match(workflow, /wrangler pages deploy \. /);
  assert.match(workflow, /--branch="\$RELEASE_BRANCH"/);
  assert.match(workflow, /--commit-hash="\$APPLICATION_SOURCE_SHA"/);
  assert.match(workflow, /Verify production custom domain serves clean-cwd production deployment/);
  assert.match(workflow, /unexpected chain option scope/);
  assert.match(workflow, /Base is not the sole default/);
  assert.match(workflow, /chain synchronization contract missing/);
  assert.match(workflow, /Production Pages clean-cwd deployment v8 result/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
  assert.doesNotMatch(workflow, /npm install|npm ci|npm test|npm run build|npm run lint/);
  assert.doesNotMatch(workflow, /wrangler deploy --config apps\/api\/wrangler\.toml/);
  assert.doesNotMatch(workflow, /wrangler secret|r2 bucket create|r2 bucket lifecycle|r2 bucket cors/);
  assert.doesNotMatch(workflow, /workflow_dispatch:|RPC_|PRIVATE_KEY|MNEMONIC|eth_sendRawTransaction/);

  const request = JSON.parse(readFileSync(REQUEST_PATH, 'utf8'));
  assert.equal(request.schemaVersion, 'round5-pages-clean-cwd-request-v8');
  assert.equal(request.requestId, REQUEST_ID);
  assert.equal(request.expectedBeforeSha, EXPECTED_PARENT);
  assert.equal(request.applicationSourceSha, APPLICATION_SOURCE);
  assert.deepEqual(request.activeNetworks, ['ethereum', 'base']);
  assert.deepEqual(request.supersededRuns, [30808377849, 30813209037, 30814064657, 30815289252, 30815965400]);
  assert.equal(request.failedOrHistoricalWorkflowRerunAllowed, false);
  assert.equal(request.cleanDeploymentDirectoryRequired, true);
  assert.equal(request.repositoryWranglerRedirectAllowed, false);
  assert.equal(request.repositoryCompilationAllowed, false);
  assert.equal(request.workerDeploymentAllowed, false);
  assert.equal(request.secretMutationAllowed, false);
  assert.equal(request.r2MutationAllowed, false);
  assert.equal(request.jobOrUploadSubmissionAllowed, false);
  assert.equal(request.walletSigningAllowed, false);
  assert.equal(request.publicTransactionBroadcastAllowed, false);
});
