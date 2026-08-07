import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const REQUEST_PATH = '.agent-control/v1/orchestrator/PAGES_ROUTING_DIAGNOSTIC_REQUEST_v1.json';
const WORKFLOW_PATH = '.github/workflows/pages-routing-diagnostic-v1.yml';
const EXPECTED_PARENT = 'b31c79a2b48b3d1390e050489e2b9307f1fb75af';
const REQUEST_ID = 'round5-pages-routing-diagnostic-20260803T1230Z-v1';

test('Pages custom-domain routing is diagnosed through an exact-parent GET-only workflow', () => {
  assert.ok(existsSync(REQUEST_PATH), `missing request: ${REQUEST_PATH}`);
  assert.ok(existsSync(WORKFLOW_PATH), `missing workflow: ${WORKFLOW_PATH}`);

  const request = JSON.parse(readFileSync(REQUEST_PATH, 'utf8'));
  assert.equal(request.schemaVersion, 'round5-pages-routing-diagnostic-request-v1');
  assert.equal(request.requestId, REQUEST_ID);
  assert.equal(request.expectedBeforeSha, EXPECTED_PARENT);
  assert.equal(request.failedSmokeRun, 30813209037);
  assert.equal(request.failedSmokeJob, 91684591058);
  assert.equal(request.readOnly, true);
  assert.equal(request.cloudflareMutationAllowed, false);
  assert.equal(request.pagesDeploymentAllowed, false);
  assert.equal(request.secretValuesIncluded, false);
  assert.equal(request.failedOrHistoricalWorkflowRerunAllowed, false);

  const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  assert.match(workflow, /PAGES_ROUTING_DIAGNOSTIC_REQUEST_v1\.json/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, new RegExp(EXPECTED_PARENT));
  assert.match(workflow, new RegExp(REQUEST_ID));
  assert.match(workflow, /pages\/projects\/\$PAGES_PROJECT_NAME/);
  assert.match(workflow, /pages\/projects\/\$PAGES_PROJECT_NAME\/deployments/);
  assert.match(workflow, /deployment_trigger\.metadata\.branch/);
  assert.match(workflow, /production_branch/);
  assert.match(workflow, /sha256sum/);
  assert.match(workflow, /custom-domain-index-digest-matches/);
  assert.match(workflow, /custom-domain-app-digest-matches/);
  assert.match(workflow, /custom-domain-selector-matches/);
  assert.match(workflow, /branch-deployment-selector-matches/);
  assert.match(workflow, /Pages routing diagnostic v1 result/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /wrangler|pages deploy|wrangler deploy/);
  assert.doesNotMatch(workflow, /--request\s+(POST|PUT|PATCH|DELETE)|-X\s*(POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(workflow, /eth_send|eth_sign|personal_|wallet_|\/api\/v1\/jobs|\/api\/v1\/uploads/);
});
