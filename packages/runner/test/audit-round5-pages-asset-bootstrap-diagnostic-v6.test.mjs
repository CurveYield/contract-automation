import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const REQUEST = '.agent-control/v1/orchestrator/PAGES_ASSET_BOOTSTRAP_DIAGNOSTIC_REQUEST_v6.json';
const WORKFLOW = '.github/workflows/pages-asset-bootstrap-diagnostic-v6.yml';
const DESIGN = 'docs/superpowers/specs/2026-08-07-round5-pages-asset-bootstrap-diagnostic-v6-design.md';
const PARENT = '76dcb1e9fcba83ecbbc704495c9962293a99bb59';
const APP = '2c6e543dfcaa17ca975bbde3c15302269bbf8072';

const read = (path) => readFileSync(path, 'utf8');

test('v6 diagnoses recreated Pages asset bootstrap without uploading or routing mutation', () => {
  assert.ok(existsSync(DESIGN));
  assert.ok(existsSync(REQUEST));
  assert.ok(existsSync(WORKFLOW));

  const request = JSON.parse(read(REQUEST));
  assert.equal(request.schemaVersion, 'round5-pages-asset-bootstrap-diagnostic-request-v6');
  assert.equal(request.expectedBeforeSha, PARENT);
  assert.equal(request.acceptedApplicationSource, APP);
  assert.equal(request.v5Run, 31184973446);
  assert.equal(request.v5Job, 92887124197);
  assert.equal(request.assetUploadAllowed, false);
  assert.equal(request.pagesMutationAllowed, false);
  assert.equal(request.workerMutationAllowed, false);
  assert.equal(request.dependencyInstallationAllowed, false);
  assert.equal(request.repositoryCompilationAllowed, false);
  assert.equal(request.failedOrHistoricalWorkflowRerunAllowed, false);

  const workflow = read(WORKFLOW);
  assert.match(workflow, new RegExp(PARENT));
  assert.match(workflow, new RegExp(APP));
  assert.match(workflow, /PAGES_ASSET_BOOTSTRAP_DIAGNOSTIC_REQUEST_v6\.json/);
  assert.match(workflow, /upload-token/);
  assert.match(workflow, /pages\/assets\/check-missing/);
  assert.match(workflow, /PAGES_UPLOAD_TOKEN_HTTP_STATUS/);
  assert.match(workflow, /CHECK_MISSING_HTTP_STATUS/);
  assert.match(workflow, /MISSING_ASSET_COUNT/);
  assert.match(workflow, /MISSING_HASHES_ALL_ACCEPTED/);
  assert.match(workflow, /WORKER_DOMAIN_MATCH_COUNT/);
  assert.match(workflow, /PRODUCTION_UI_CLASS/);
  assert.match(workflow, /Pages asset bootstrap diagnostic v6 result/);
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);

  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /pages\/assets\/(upload|upsert-hashes)/i);
  assert.doesNotMatch(workflow, /pages\/projects[^\n]*\/deployments[^\n]*--request\s+POST/i);
  assert.doesNotMatch(workflow, /workers\/domains[^\n]*--request\s+(PUT|POST|DELETE|PATCH)/i);
  assert.doesNotMatch(workflow, /\b(npm|npx|pnpm|yarn|bunx?|wrangler)\b/i);
  assert.doesNotMatch(workflow, /\b(solc|forge|hardhat)\b/i);
  assert.doesNotMatch(workflow, /eth_send|eth_sign|personal_|wallet_|\/api\/v1\/jobs|\/api\/v1\/uploads/i);
});
