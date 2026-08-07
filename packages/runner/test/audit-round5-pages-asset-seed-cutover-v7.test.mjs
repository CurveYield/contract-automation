import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const REQUEST = '.agent-control/v1/orchestrator/PAGES_ASSET_SEED_CUTOVER_REQUEST_v7.json';
const WORKFLOW = '.github/workflows/pages-asset-seed-cutover-v7.yml';
const DESIGN = 'docs/superpowers/specs/2026-08-07-round5-pages-asset-seed-cutover-v7-design.md';
const PARENT = '3116c65a450cb41cc74cd0cfc4d8bc892858204d';
const APP = '2c6e543dfcaa17ca975bbde3c15302269bbf8072';
const read = (path) => readFileSync(path, 'utf8');

test('v7 seeds only accepted Pages assets before guarded Worker-to-Pages cutover', () => {
  assert.ok(existsSync(DESIGN));
  assert.ok(existsSync(REQUEST));
  assert.ok(existsSync(WORKFLOW));

  const request = JSON.parse(read(REQUEST));
  assert.equal(request.schemaVersion, 'round5-pages-asset-seed-cutover-request-v7');
  assert.equal(request.expectedBeforeSha, PARENT);
  assert.equal(request.acceptedApplicationSource, APP);
  assert.equal(request.v6Run, 31185640760);
  assert.equal(request.expectedMissingAssetCount, 9);
  assert.equal(request.acceptedAssetUploadAllowed, true);
  assert.equal(request.unacceptedAssetUploadAllowed, false);
  assert.equal(request.pagesDeploymentAllowed, true);
  assert.equal(request.workerDomainDetachAllowed, true);
  assert.equal(request.pagesDomainAttachAllowed, true);
  assert.equal(request.routingRollbackAllowed, true);
  assert.equal(request.workerScriptMutationAllowed, false);
  assert.equal(request.dependencyInstallationAllowed, false);
  assert.equal(request.repositoryCompilationAllowed, false);
  assert.equal(request.failedOrHistoricalWorkflowRerunAllowed, false);

  const workflow = read(WORKFLOW);
  assert.match(workflow, new RegExp(PARENT));
  assert.match(workflow, new RegExp(APP));
  assert.match(workflow, /PAGES_ASSET_SEED_CUTOVER_REQUEST_v7\.json/);
  assert.match(workflow, /pages\/assets\/check-missing/);
  assert.match(workflow, /pages\/assets\/upload/);
  assert.match(workflow, /pages\/assets\/upsert-hashes/);
  assert.match(workflow, /mimetypes\.guess_type/);
  assert.match(workflow, /base64\.b64encode/);
  assert.match(workflow, /ACCEPTED_ASSET_UPLOAD_COUNT/);
  assert.match(workflow, /POST_UPLOAD_MISSING_ASSET_COUNT/);
  assert.match(workflow, /pages\/projects\/\$PAGES_PROJECT_NAME\/deployments/);
  assert.match(workflow, /IMMUTABLE_CONTENT_CHECK/);
  assert.match(workflow, /workers\/domains\/\$worker_domain_id/);
  assert.match(workflow, /pages\/projects\/\$PAGES_PROJECT_NAME\/domains/);
  assert.match(workflow, /ROLLBACK_ATTEMPTED/);
  assert.match(workflow, /ROLLBACK_OK/);
  assert.match(workflow, /PRODUCTION_DOMAIN_UI_CHECK/);
  assert.match(workflow, /FINAL_PAGES_DOMAIN_ACTIVE/);
  assert.match(workflow, /FINAL_WORKER_DOMAIN_MATCH_COUNT/);
  assert.match(workflow, /Pages asset seed and Worker-domain cutover v7 result/);
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);

  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\b(npm|npx|pnpm|yarn|bunx?|wrangler)\b/i);
  assert.doesNotMatch(workflow, /\b(solc|forge|hardhat)\b/i);
  assert.doesNotMatch(workflow, /pages\/projects[^\n]*--request\s+(PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(workflow, /workers\/scripts[^\n]*(PUT|POST|PATCH|DELETE)/i);
  assert.doesNotMatch(workflow, /eth_send|eth_sign|personal_|wallet_|\/api\/v1\/jobs|\/api\/v1\/uploads/i);
});
