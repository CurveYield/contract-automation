import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const workflow = readFileSync(path.join(root, '.github/workflows/tier3-production-deploy-v2.yml'), 'utf8');

function has(pattern, message) {
  assert.match(workflow, pattern, message);
}

test('Tier 3 deployment is one-shot on the accepted Round 5 release branch', () => {
  has(/branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  has(/TIER3_PRODUCTION_DEPLOY_REQUEST_v2\.json/);
  has(/round5-tier3-production-deploy-request-v2/);
  has(/expectedBeforeSha/);
  has(/DEPLOY_EVENT_BEFORE/);
  has(/github\.event\.before/);
});

test('deployment requires explicit dependency and production authorization without wallet or broadcast authority', () => {
  has(/dependencyInstallationAuthorized/);
  has(/deploymentAuthorized/);
  has(/walletSigningAllowed/);
  has(/publicTransactionBroadcastAllowed/);
  has(/dependencyInstallationAuthorized == true/);
  has(/deploymentAuthorized == true/);
  has(/walletSigningAllowed == false/);
  has(/publicTransactionBroadcastAllowed == false/);
});

test('deployment keeps controller and execution GitHub credentials separate', () => {
  has(/PREFLIGHTSIM_GITHUB_TOKEN:\s*\$\{\{ secrets\.PREFLIGHTSIM_GITHUB_TOKEN \}\}/);
  has(/PREFLIGHTSIM_AUDIT_CONTROLLER_GITHUB_TOKEN:\s*\$\{\{ secrets\.PREFLIGHTSIM_AUDIT_CONTROLLER_GITHUB_TOKEN \}\}/);
  has(/AUDIT_CONTROLLER_GITHUB_TOKEN:\$AUDIT_CONTROLLER_GITHUB_TOKEN/);
  has(/controllerSecretName/);
  has(/PREFLIGHTSIM_AUDIT_CONTROLLER_GITHUB_TOKEN/);
});

test('deployment uses approved pinned install then no-install Wrangler and exact Ethereum/Base scope', () => {
  has(/npm install --ignore-scripts --no-audit --no-fund/);
  has(/npx --no-install wrangler/);
  has(/\["ethereum", "base"\]/);
  assert.doesNotMatch(workflow, /activeNetworks[^\n]*katana|activeNetworks[^\n]*arbitrum|activeNetworks[^\n]*polygon|activeNetworks[^\n]*optimism|activeNetworks[^\n]*fraxtal/i);
});

test('deployment runs tests, syntax, build, Worker/Pages deployment and bounded production Tier 3 smoke checks', () => {
  has(/npm test/);
  has(/npm run lint/);
  has(/npm run build/);
  has(/\/api\/v1\/health/);
  has(/\/api\/v1\/setup/);
  has(/\/api\/v1\/chains/);
  has(/\/api\/v1\/controller\/compatibility/);
  has(/preflight\.curveyield\.online\/execution\//);
  has(/Deep Assurance/);
  has(/PreflightSim Lite/);
  has(/issue comment 170|gh issue comment 170/);
});
