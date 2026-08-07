import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const REQUEST_PATH = '.agent-control/v1/orchestrator/PAGES_ROUTING_DIAGNOSTIC_REQUEST_v3.json';
const WORKFLOW_PATH = '.github/workflows/pages-routing-diagnostic-v3.yml';
const DESIGN_PATH = 'docs/superpowers/specs/2026-08-07-round5-pages-routing-diagnostic-v3-design.md';
const EXPECTED_PARENT = '2a2ef752b82fc9e4f16bd973bb065d000e768c22';
const APPLICATION_SOURCE = '2c6e543dfcaa17ca975bbde3c15302269bbf8072';
const REQUEST_ID = 'round5-pages-routing-diagnostic-20260807-v3';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('routing diagnostic v3 isolates each metadata HTTP status and stays Cloudflare GET-only', () => {
  assert.ok(existsSync(DESIGN_PATH), `missing design: ${DESIGN_PATH}`);
  assert.ok(existsSync(REQUEST_PATH), `missing request: ${REQUEST_PATH}`);
  assert.ok(existsSync(WORKFLOW_PATH), `missing workflow: ${WORKFLOW_PATH}`);

  const request = JSON.parse(read(REQUEST_PATH));
  assert.equal(request.schemaVersion, 'round5-pages-routing-diagnostic-request-v3');
  assert.equal(request.requestId, REQUEST_ID);
  assert.equal(request.repository, 'CurveYield/contract-automation');
  assert.equal(request.releaseBranch, 'orchestrator/round4-ci-base-v1');
  assert.equal(request.expectedBeforeSha, EXPECTED_PARENT);
  assert.equal(request.acceptedApplicationSource, APPLICATION_SOURCE);
  assert.equal(request.v11Run, 30832528012);
  assert.equal(request.v11Job, 91749723106);
  assert.equal(request.v11DeploymentShortId, 'c3d3e149');
  assert.equal(request.failedV2Run, 31183446228);
  assert.equal(request.failedV2Job, 92882075058);
  assert.deepEqual(request.activeNetworks, ['ethereum', 'base']);
  assert.equal(request.defaultNetwork, 'base');
  assert.equal(request.readOnly, true);
  assert.equal(request.cloudflareMethodsAllowed, 'GET-only');
  assert.equal(request.capturePerEndpointHttpStatus, true);
  assert.equal(request.continueAfterHttp404, true);
  assert.equal(request.dependencyInstallationAllowed, false);
  assert.equal(request.repositoryCompilationAllowed, false);
  assert.equal(request.cloudflareMutationAllowed, false);
  assert.equal(request.pagesDeploymentAllowed, false);
  assert.equal(request.failedOrHistoricalWorkflowRerunAllowed, false);

  const workflow = read(WORKFLOW_PATH);
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  assert.match(workflow, /PAGES_ROUTING_DIAGNOSTIC_REQUEST_v3\.json/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, new RegExp(EXPECTED_PARENT));
  assert.match(workflow, new RegExp(APPLICATION_SOURCE));
  assert.match(workflow, /31183446228/);
  assert.match(workflow, /92882075058/);
  assert.match(workflow, /--write-out ['"]%\{http_code\}['"]/);
  assert.match(workflow, /PROJECT_GET_HTTP_STATUS/);
  assert.match(workflow, /PRODUCTION_DEPLOYMENTS_GET_HTTP_STATUS/);
  assert.match(workflow, /PAGES_DOMAINS_LIST_GET_HTTP_STATUS/);
  assert.match(workflow, /EXACT_DOMAIN_GET_HTTP_STATUS/);
  assert.match(workflow, /EXACT_V11_DEPLOYMENT_GET_HTTP_STATUS/);
  assert.match(workflow, /pages-project-get-failed/);
  assert.match(workflow, /production-deployments-get-failed/);
  assert.match(workflow, /pages-domains-list-get-failed/);
  assert.match(workflow, /custom-domain-not-associated-with-pages-project/);
  assert.match(workflow, /exact-custom-domain-get-failed/);
  assert.match(workflow, /exact-v11-deployment-get-failed/);
  assert.match(workflow, /exact-v11-deployment-metadata-mismatch/);
  assert.match(workflow, /custom-domain-routing-mismatch/);
  assert.match(workflow, /Pages routing diagnostic v3 result/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);

  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /curl[^\n]*--fail[^\n]*(pages\/projects|CLOUDFLARE_API_BASE)/i);
  assert.doesNotMatch(workflow, /\b(npm|npx|pnpm|yarn|bunx?|wrangler)\b/i);
  assert.doesNotMatch(workflow, /\b(solc|forge|hardhat)\b/i);
  assert.doesNotMatch(workflow, /--request\s+(POST|PUT|PATCH|DELETE)|-X\s*(POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(workflow, /eth_send|eth_sign|personal_|wallet_|\/api\/v1\/jobs|\/api\/v1\/uploads/i);
});
