import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const CONTROLLER_SHA = '1cdd830d862beb46338f9088115857de9a815d45';

test('Tier 3 Worker manifest pins the exact accepted controller release and active network scope', () => {
  const wrangler = read('apps/api/wrangler-tier3-v1.toml');
  assert.match(wrangler, new RegExp(`AUDIT_CONTROLLER_COMMIT = "${CONTROLLER_SHA}"`));
  assert.match(wrangler, /AUDIT_CONTROLLER_SKILL_RELEASE = "ai-auditor-deep-assurance-v6@16\.13\.0"/);
  assert.match(wrangler, /AUTOMATION_RELEASE = "contract-automation@round5-tier3-v1"/);
  assert.match(wrangler, /AUDIT_CONTROLLER_INTAKE_ISSUE = "64"/);
  assert.match(wrangler, /ACTIVE_CHAINS = "ethereum,base"/);
  assert.doesNotMatch(wrangler, /ACTIVE_CHAINS\s*=.*katana|ACTIVE_CHAINS\s*=.*arbitrum|ACTIVE_CHAINS\s*=.*polygon|ACTIVE_CHAINS\s*=.*optimism|ACTIVE_CHAINS\s*=.*fraxtal/i);
});

test('API keeps execution and controller GitHub credentials separate', () => {
  const source = read('apps/api/src/index.mjs');
  const adapter = source.slice(source.indexOf('function auditControllerAdapter'), source.indexOf('async function parseAuditCommandBody'));
  const dispatch = source.slice(source.indexOf('async function dispatchGithub'), source.indexOf('async function handleUpload'));
  assert.match(adapter, /token:\s*env\.AUDIT_CONTROLLER_GITHUB_TOKEN/);
  assert.doesNotMatch(adapter, /token:\s*env\.GITHUB_TOKEN/);
  assert.match(dispatch, /authorization:\s*`Bearer \$\{env\.GITHUB_TOKEN\}`/);
  assert.doesNotMatch(dispatch, /AUDIT_CONTROLLER_GITHUB_TOKEN/);
});

test('Tier 3 browser artifacts and safe command path are present', () => {
  for (const path of [
    'apps/web/public/audit-v1.html',
    'apps/web/public/audit-v1.js',
    'apps/web/public/audit-v1.css',
    'apps/web/src/tier3-model-v1.mjs',
    'apps/api/src/audit-controller-adapter-v1.mjs',
  ]) assert.equal(existsSync(resolve(root, path)), true, `${path} missing`);
  const html = read('apps/web/public/audit-v1.html');
  const script = read('apps/web/public/audit-v1.js');
  assert.match(html, /id="lease-token"[^>]*type="password"/);
  assert.match(script, /submitAuditCommand/);
  assert.match(script, /submitAuditCampaignCreate/);
  assert.match(script, /leaseToken\.value\s*=\s*['"]['"]/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|api\.github\.com|innerHTML\s*=/);
});

test('Lite browser remains exactly Ethereum and Base with Base default', () => {
  const html = read('apps/web/public/index.html');
  assert.match(html, /value="ethereum"/);
  assert.match(html, /value="base" selected/);
  assert.doesNotMatch(html, /value="katana"|value="arbitrum"|value="polygon"|value="optimism"|value="fraxtal"/i);
  assert.match(html, /href="\.\/audit-v1\.html"/);
});

test('versioned Tier 3 deployment workflow exists and binds the dedicated controller secret', () => {
  const workflowPath = resolve(root, '.github/workflows/deploy-tier3-v1.yml');
  assert.equal(existsSync(workflowPath), true, 'deploy-tier3-v1.yml missing');
  const workflow = read('.github/workflows/deploy-tier3-v1.yml');
  assert.match(workflow, /PREFLIGHTSIM_GITHUB_TOKEN/);
  assert.match(workflow, /AUDIT_CONTROLLER_GITHUB_TOKEN/);
  assert.match(workflow, /AUDIT_CONTROLLER_COMMIT/);
  assert.match(workflow, new RegExp(CONTROLLER_SHA));
  assert.match(workflow, /wrangler-tier3-v1\.toml/);
  assert.match(workflow, /TIER3_WEB_INTEGRATION_REQUEST_v1\.json/);
});
