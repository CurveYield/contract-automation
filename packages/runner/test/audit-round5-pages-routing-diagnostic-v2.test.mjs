import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const REQUEST_PATH = '.agent-control/v1/orchestrator/PAGES_ROUTING_DIAGNOSTIC_REQUEST_v2.json';
const WORKFLOW_PATH = '.github/workflows/pages-routing-diagnostic-v2.yml';
const DESIGN_PATH = 'docs/superpowers/specs/2026-08-07-round5-pages-routing-diagnostic-v2-design.md';
const PLAN_PATH = 'docs/superpowers/plans/2026-08-07-round5-pages-routing-diagnostic-v2.md';
const EXPECTED_PARENT = '1f81be09b16614b24d81c57fa388447231dd629a';
const APPLICATION_SOURCE = '2c6e543dfcaa17ca975bbde3c15302269bbf8072';
const REQUEST_ID = 'round5-pages-routing-diagnostic-20260807-v2';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('routing diagnostic v2 is exact-parent, v11-bound, GET-only, and compares every Pages routing layer', () => {
  assert.ok(existsSync(DESIGN_PATH), `missing design: ${DESIGN_PATH}`);
  assert.ok(existsSync(PLAN_PATH), `missing plan: ${PLAN_PATH}`);
  assert.ok(existsSync(REQUEST_PATH), `missing request: ${REQUEST_PATH}`);
  assert.ok(existsSync(WORKFLOW_PATH), `missing workflow: ${WORKFLOW_PATH}`);

  const request = JSON.parse(read(REQUEST_PATH));
  assert.equal(request.schemaVersion, 'round5-pages-routing-diagnostic-request-v2');
  assert.equal(request.requestId, REQUEST_ID);
  assert.equal(request.repository, 'CurveYield/contract-automation');
  assert.equal(request.releaseBranch, 'orchestrator/round4-ci-base-v1');
  assert.equal(request.expectedBeforeSha, EXPECTED_PARENT);
  assert.equal(request.acceptedApplicationSource, APPLICATION_SOURCE);
  assert.equal(request.v11Run, 30832528012);
  assert.equal(request.v11Job, 91749723106);
  assert.equal(request.v11DeploymentShortId, 'c3d3e149');
  assert.deepEqual(request.activeNetworks, ['ethereum', 'base']);
  assert.equal(request.defaultNetwork, 'base');
  assert.equal(request.readOnly, true);
  assert.equal(request.cloudflareMethodsAllowed, 'GET-only');
  assert.equal(request.dependencyInstallationAllowed, false);
  assert.equal(request.repositoryCompilationAllowed, false);
  assert.equal(request.cloudflareMutationAllowed, false);
  assert.equal(request.pagesDeploymentAllowed, false);
  assert.equal(request.secretValuesIncluded, false);
  assert.equal(request.failedOrHistoricalWorkflowRerunAllowed, false);
  assert.deepEqual(request.checks, [
    'pages-project-production-branch-and-subdomain',
    'production-deployment-list-v11-binding',
    'exact-v11-deployment-metadata',
    'pages-domain-list-association',
    'exact-pages-domain-status',
    'immutable-v11-deployment-content',
    'project-subdomain-content',
    'custom-domain-content',
    'cache-busted-project-and-custom-content',
  ]);

  const workflow = read(WORKFLOW_PATH);
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  assert.match(workflow, /PAGES_ROUTING_DIAGNOSTIC_REQUEST_v2\.json/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, new RegExp(EXPECTED_PARENT));
  assert.match(workflow, new RegExp(APPLICATION_SOURCE));
  assert.match(workflow, /c3d3e149/);
  assert.match(workflow, /\?env=production(?:&|&amp;)per_page=50/);
  assert.match(workflow, /pages\/projects\/\$PAGES_PROJECT_NAME\/deployments\/\$V11_DEPLOYMENT_ID/);
  assert.match(workflow, /pages\/projects\/\$PAGES_PROJECT_NAME\/domains(?:"|\?)/);
  assert.match(workflow, /pages\/projects\/\$PAGES_PROJECT_NAME\/domains\/preflight\.curveyield\.online/);
  assert.match(workflow, /production_branch/);
  assert.match(workflow, /\.result\.subdomain/);
  assert.match(workflow, /\.result\.status/);
  assert.match(workflow, /environment.*production/s);
  assert.match(workflow, /deployment_trigger\.metadata\.branch/);
  assert.match(workflow, /deployment_trigger\.metadata\.commit_hash/);
  assert.match(workflow, /latest_stage\.name/);
  assert.match(workflow, /latest_stage\.status/);
  assert.match(workflow, /sha256sum/);
  assert.match(workflow, /immutable-deployment-content/);
  assert.match(workflow, /project-subdomain-content/);
  assert.match(workflow, /custom-domain-content/);
  assert.match(workflow, /exact-v11-deployment-metadata-mismatch/);
  assert.match(workflow, /production-deployment-list-mismatch/);
  assert.match(workflow, /pages-production-branch-mismatch/);
  assert.match(workflow, /pages-domain-association-or-status-mismatch/);
  assert.match(workflow, /immutable-deployment-content-mismatch/);
  assert.match(workflow, /project-subdomain-routing-mismatch/);
  assert.match(workflow, /custom-domain-routing-mismatch/);
  assert.match(workflow, /no-current-routing-mismatch-detected/);
  assert.match(workflow, /Pages routing diagnostic v2 result/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);

  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\b(npm|npx|pnpm|yarn|bunx?|wrangler)\b/i);
  assert.doesNotMatch(workflow, /\b(solc|forge|hardhat)\b/i);
  assert.doesNotMatch(workflow, /--request\s+(POST|PUT|PATCH|DELETE)|-X\s*(POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(workflow, /pages\/projects\/\$PAGES_PROJECT_NAME\/deployments\/\$V11_DEPLOYMENT_ID\/(retry|rollback)/i);
  assert.doesNotMatch(workflow, /eth_send|eth_sign|personal_|wallet_|\/api\/v1\/jobs|\/api\/v1\/uploads/i);
});
