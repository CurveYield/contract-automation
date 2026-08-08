import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const workflow = readFileSync(path.join(root, '.github/workflows/tier3-production-deploy-v3.yml'), 'utf8');

function has(pattern, message) { assert.match(workflow, pattern, message); }

test('v3 is one-shot on accepted release and checks out full history for accepted-source verification', () => {
  has(/branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  has(/TIER3_PRODUCTION_DEPLOY_REQUEST_v3\.json/);
  has(/round5-tier3-production-deploy-request-v3/);
  has(/fetch-depth:\s*0/);
  has(/2df81aacb6f5747f06b49297e89e02c3f013d4ef/);
  has(/git diff --exit-code[^\n]*apps\/web\/public apps\/api\/src\/index\.mjs/);
});

test('v3 binds exact request parent and explicit owner authorizations', () => {
  has(/DEPLOY_EVENT_BEFORE/);
  has(/git rev-parse HEAD\^/);
  has(/expectedBeforeSha/);
  has(/deploymentAuthorized == true/);
  has(/dependencyInstallationAuthorized == true/);
  has(/activeNetworks == \["ethereum", "base"\]/);
  has(/walletSigningAllowed == false/);
  has(/publicTransactionBroadcastAllowed == false/);
});

test('v3 separates controller and execution GitHub credentials', () => {
  has(/PREFLIGHTSIM_GITHUB_TOKEN:\s*\$\{\{ secrets\.PREFLIGHTSIM_GITHUB_TOKEN \}\}/);
  has(/PREFLIGHTSIM_AUDIT_CONTROLLER_GITHUB_TOKEN:\s*\$\{\{ secrets\.PREFLIGHTSIM_AUDIT_CONTROLLER_GITHUB_TOKEN \}\}/);
  has(/--arg AUDIT_CONTROLLER_GITHUB_TOKEN "\$PREFLIGHTSIM_AUDIT_CONTROLLER_GITHUB_TOKEN"/);
  has(/AUDIT_CONTROLLER_GITHUB_TOKEN:\$AUDIT_CONTROLLER_GITHUB_TOKEN/);
});

test('v3 uses authorized install, full tests/lint/build and no explicit Solidity compiler command', () => {
  has(/npm install --ignore-scripts --no-audit --no-fund/);
  has(/npm test/);
  has(/npm run lint/);
  has(/npm run build/);
  has(/npx --no-install wrangler/);
  assert.doesNotMatch(workflow, /^\s*(forge|hardhat|solc)\b/m);
});

test('v3 deploys Worker and Pages then verifies Tier 3 root, Lite execution, API compatibility and CORS', () => {
  has(/wrangler deploy --config apps\/api\/wrangler\.toml/);
  has(/wrangler pages deploy dist\/web/);
  has(/\/api\/v1\/health/);
  has(/\/api\/v1\/setup/);
  has(/\/api\/v1\/chains/);
  has(/\/api\/v1\/controller\/compatibility/);
  has(/Deep Assurance/);
  has(/PreflightSim Lite/);
  has(/\/execution\//);
  has(/access-control-allow-origin/);
  has(/gh issue comment 170/);
});
