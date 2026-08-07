import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const REQUEST_PATH = '.agent-control/v1/orchestrator/PAGES_WORKER_DOMAIN_CUTOVER_REQUEST_v5.json';
const WORKFLOW_PATH = '.github/workflows/pages-worker-domain-cutover-v5.yml';
const DESIGN_PATH = 'docs/superpowers/specs/2026-08-07-round5-pages-worker-domain-cutover-v5-design.md';
const EXPECTED_PARENT = '4867e5ee29b36acd4f32c74ee1f6eb8fe8ada6e6';
const APPLICATION_SOURCE = '2c6e543dfcaa17ca975bbde3c15302269bbf8072';
const REQUEST_ID = 'round5-pages-worker-domain-cutover-20260807-v5';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('v5 stages accepted Pages content before narrow Worker-domain cutover with rollback', () => {
  assert.ok(existsSync(DESIGN_PATH), `missing design: ${DESIGN_PATH}`);
  assert.ok(existsSync(REQUEST_PATH), `missing request: ${REQUEST_PATH}`);
  assert.ok(existsSync(WORKFLOW_PATH), `missing workflow: ${WORKFLOW_PATH}`);

  const request = JSON.parse(read(REQUEST_PATH));
  assert.equal(request.schemaVersion, 'round5-pages-worker-domain-cutover-request-v5');
  assert.equal(request.requestId, REQUEST_ID);
  assert.equal(request.repository, 'CurveYield/contract-automation');
  assert.equal(request.releaseBranch, 'orchestrator/round4-ci-base-v1');
  assert.equal(request.expectedBeforeSha, EXPECTED_PARENT);
  assert.equal(request.acceptedApplicationSource, APPLICATION_SOURCE);
  assert.equal(request.v11Run, 30832528012);
  assert.equal(request.v11Job, 91749723106);
  assert.equal(request.v4Run, 31184375729);
  assert.equal(request.pagesProject, 'curveyield-preflight');
  assert.equal(request.pagesDomain, 'preflight.curveyield.online');
  assert.deepEqual(request.activeNetworks, ['ethereum', 'base']);
  assert.equal(request.defaultNetwork, 'base');
  assert.equal(request.createPagesProjectAllowed, true);
  assert.equal(request.pagesDeploymentAllowed, true);
  assert.equal(request.workerDomainDetachAllowed, true);
  assert.equal(request.pagesDomainAttachAllowed, true);
  assert.equal(request.workerDomainRollbackAllowed, true);
  assert.equal(request.assetUploadAllowed, false);
  assert.equal(request.workerScriptMutationAllowed, false);
  assert.equal(request.pagesProjectDeleteAllowed, false);
  assert.equal(request.dependencyInstallationAllowed, false);
  assert.equal(request.repositoryCompilationAllowed, false);
  assert.equal(request.failedOrHistoricalWorkflowRerunAllowed, false);

  const workflow = read(WORKFLOW_PATH);
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  assert.match(workflow, /PAGES_WORKER_DOMAIN_CUTOVER_REQUEST_v5\.json/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, new RegExp(EXPECTED_PARENT));
  assert.match(workflow, new RegExp(APPLICATION_SOURCE));
  assert.match(workflow, /pages\/projects"/);
  assert.match(workflow, /production_branch/);
  assert.match(workflow, /pages\/projects\/\$PAGES_PROJECT_NAME\/upload-token/);
  assert.match(workflow, /pages\/assets\/check-missing/);
  assert.match(workflow, /pages\/projects\/\$PAGES_PROJECT_NAME\/deployments/);
  assert.match(workflow, /workers\/domains\?hostname=preflight\.curveyield\.online/);
  assert.match(workflow, /--request DELETE[\s\S]*workers\/domains\/\$worker_domain_id/);
  assert.match(workflow, /pages\/projects\/\$PAGES_PROJECT_NAME\/domains/);
  assert.match(workflow, /--request PUT[\s\S]*workers\/domains/);
  assert.match(workflow, /ROLLBACK_ATTEMPTED/);
  assert.match(workflow, /ROLLBACK_OK/);
  assert.match(workflow, /IMMUTABLE_CONTENT_CHECK/);
  assert.match(workflow, /PRODUCTION_DOMAIN_UI_CHECK/);
  assert.match(workflow, /WORKER_DOMAIN_FINAL_ABSENT/);
  assert.match(workflow, /Pages Worker-domain cutover v5 result/);
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);

  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\b(npm|npx|pnpm|yarn|bunx?|wrangler)\b/i);
  assert.doesNotMatch(workflow, /\b(solc|forge|hardhat)\b/i);
  assert.doesNotMatch(workflow, /pages\/assets\/(upload|upsert)/i);
  assert.doesNotMatch(workflow, /workers\/scripts[^\n]*(PUT|POST|PATCH|DELETE)/i);
  assert.doesNotMatch(workflow, /eth_send|eth_sign|personal_|wallet_|\/api\/v1\/jobs|\/api\/v1\/uploads/i);
});
