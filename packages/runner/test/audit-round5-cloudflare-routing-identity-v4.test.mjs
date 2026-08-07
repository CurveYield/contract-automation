import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const REQUEST_PATH = '.agent-control/v1/orchestrator/CLOUDFLARE_ROUTING_IDENTITY_REQUEST_v4.json';
const WORKFLOW_PATH = '.github/workflows/cloudflare-routing-identity-v4.yml';
const DESIGN_PATH = 'docs/superpowers/specs/2026-08-07-round5-cloudflare-routing-identity-v4-design.md';
const EXPECTED_PARENT = 'bf879a18381a5b2a3e2d240d27e498e79b992d22';
const APPLICATION_SOURCE = '2c6e543dfcaa17ca975bbde3c15302269bbf8072';
const REQUEST_ID = 'round5-cloudflare-routing-identity-20260807-v4';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('routing identity v4 inventories Pages and Worker ownership with GET only', () => {
  assert.ok(existsSync(DESIGN_PATH), `missing design: ${DESIGN_PATH}`);
  assert.ok(existsSync(REQUEST_PATH), `missing request: ${REQUEST_PATH}`);
  assert.ok(existsSync(WORKFLOW_PATH), `missing workflow: ${WORKFLOW_PATH}`);

  const request = JSON.parse(read(REQUEST_PATH));
  assert.equal(request.schemaVersion, 'round5-cloudflare-routing-identity-request-v4');
  assert.equal(request.requestId, REQUEST_ID);
  assert.equal(request.repository, 'CurveYield/contract-automation');
  assert.equal(request.releaseBranch, 'orchestrator/round4-ci-base-v1');
  assert.equal(request.expectedBeforeSha, EXPECTED_PARENT);
  assert.equal(request.acceptedApplicationSource, APPLICATION_SOURCE);
  assert.equal(request.v11Run, 30832528012);
  assert.equal(request.v11Job, 91749723106);
  assert.equal(request.v3Run, 31183971849);
  assert.equal(request.expectedPagesProject, 'curveyield-preflight');
  assert.equal(request.customDomain, 'preflight.curveyield.online');
  assert.equal(request.readOnly, true);
  assert.equal(request.cloudflareMethodsAllowed, 'GET-only');
  assert.equal(request.accountWidePagesInventory, true);
  assert.equal(request.workerCustomDomainInventory, true);
  assert.equal(request.dependencyInstallationAllowed, false);
  assert.equal(request.repositoryCompilationAllowed, false);
  assert.equal(request.cloudflareMutationAllowed, false);
  assert.equal(request.failedOrHistoricalWorkflowRerunAllowed, false);

  const workflow = read(WORKFLOW_PATH);
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  assert.match(workflow, /CLOUDFLARE_ROUTING_IDENTITY_REQUEST_v4\.json/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, new RegExp(EXPECTED_PARENT));
  assert.match(workflow, new RegExp(APPLICATION_SOURCE));
  assert.match(workflow, /pages\/projects\?per_page=50/);
  assert.match(workflow, /workers\/domains\?hostname=preflight\.curveyield\.online/);
  assert.match(workflow, /PAGES_PROJECT_LIST_HTTP_STATUS/);
  assert.match(workflow, /WORKER_DOMAINS_HTTP_STATUS/);
  assert.match(workflow, /EXPECTED_PROJECT_PRESENT/);
  assert.match(workflow, /TARGET_DOMAIN_ON_ANY_PAGES_PROJECT/);
  assert.match(workflow, /TARGET_DOMAIN_ON_ALTERNATE_PAGES_PROJECT/);
  assert.match(workflow, /TARGET_DOMAIN_ON_WORKER/);
  assert.match(workflow, /pages-project-list-get-failed/);
  assert.match(workflow, /expected-pages-project-present-detail-get-inconsistent/);
  assert.match(workflow, /custom-domain-bound-to-alternate-pages-project/);
  assert.match(workflow, /custom-domain-bound-to-worker/);
  assert.match(workflow, /expected-pages-project-missing-routing-origin-unresolved/);
  assert.match(workflow, /expected-pages-project-present-no-target-domain-association/);
  assert.match(workflow, /expected-pages-project-present-target-domain-associated/);
  assert.match(workflow, /Cloudflare routing identity diagnostic v4 result/);
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);

  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\b(npm|npx|pnpm|yarn|bunx?|wrangler)\b/i);
  assert.doesNotMatch(workflow, /\b(solc|forge|hardhat)\b/i);
  assert.doesNotMatch(workflow, /--request\s+(POST|PUT|PATCH|DELETE)|-X\s*(POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(workflow, /pages\/projects[^\n]*(POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(workflow, /eth_send|eth_sign|personal_|wallet_|\/api\/v1\/jobs|\/api\/v1\/uploads/i);
});
