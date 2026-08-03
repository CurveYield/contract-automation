import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const WORKFLOW_PATH = '.github/workflows/deploy-v7.yml';
const REQUEST_PATH = '.agent-control/v1/orchestrator/DEPLOY_REQUEST_v7.json';
const EXPECTED_PARENT = '3c37394f814c40b1fc6fff134d2de698635bd185';
const APPLICATION_SOURCE = '2c6e543dfcaa17ca975bbde3c15302269bbf8072';
const REQUEST_ID = 'round5-pages-commit-object-20260803T1300Z-v7';

test('deployment v7 makes the application source commit available before explicit Pages deployment', () => {
  assert.ok(existsSync(WORKFLOW_PATH), `missing workflow: ${WORKFLOW_PATH}`);
  assert.ok(existsSync(REQUEST_PATH), `missing request: ${REQUEST_PATH}`);

  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  assert.match(workflow, /DEPLOY_REQUEST_v7\.json/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, new RegExp(EXPECTED_PARENT));
  assert.match(workflow, new RegExp(APPLICATION_SOURCE));
  assert.match(workflow, new RegExp(REQUEST_ID));
  assert.match(workflow, /fetch-depth:\s*0/);
  assert.match(workflow, /git cat-file -e "\$APPLICATION_SOURCE_SHA\^\{commit\}"/);
  assert.match(workflow, /\.result\.production_branch/);
  assert.match(workflow, /test "\$production_branch" = "\$RELEASE_BRANCH"/);
  assert.match(workflow, /wrangler pages deploy apps\/web\/public/);
  assert.match(workflow, /--branch="\$RELEASE_BRANCH"/);
  assert.match(workflow, /--commit-hash="\$APPLICATION_SOURCE_SHA"/);
  assert.match(workflow, /Verify production custom domain serves commit-bound production deployment/);
  assert.match(workflow, /unexpected chain option scope/);
  assert.match(workflow, /Base is not the sole default/);
  assert.match(workflow, /chain synchronization contract missing/);
  assert.match(workflow, /Production Pages commit-bound deployment v7 result/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
  assert.doesNotMatch(workflow, /npm install|npm ci|npm test|npm run build|npm run lint/);
  assert.doesNotMatch(workflow, /wrangler deploy --config apps\/api\/wrangler\.toml/);
  assert.doesNotMatch(workflow, /wrangler secret|r2 bucket create|r2 bucket lifecycle|r2 bucket cors/);
  assert.doesNotMatch(workflow, /workflow_dispatch:|RPC_|PRIVATE_KEY|MNEMONIC|eth_sendRawTransaction/);

  const request = JSON.parse(readFileSync(REQUEST_PATH, 'utf8'));
  assert.equal(request.schemaVersion, 'round5-pages-commit-object-request-v7');
  assert.equal(request.requestId, REQUEST_ID);
  assert.equal(request.expectedBeforeSha, EXPECTED_PARENT);
  assert.equal(request.applicationSourceSha, APPLICATION_SOURCE);
  assert.deepEqual(request.activeNetworks, ['ethereum', 'base']);
  assert.deepEqual(request.supersededRuns, [30808377849, 30813209037, 30814064657, 30815289252]);
  assert.equal(request.failedOrHistoricalWorkflowRerunAllowed, false);
  assert.equal(request.fullHistoryCheckoutRequired, true);
  assert.equal(request.applicationCommitObjectVerificationRequired, true);
  assert.equal(request.repositoryCompilationAllowed, false);
  assert.equal(request.workerDeploymentAllowed, false);
  assert.equal(request.secretMutationAllowed, false);
  assert.equal(request.r2MutationAllowed, false);
  assert.equal(request.jobOrUploadSubmissionAllowed, false);
  assert.equal(request.walletSigningAllowed, false);
  assert.equal(request.publicTransactionBroadcastAllowed, false);
});
