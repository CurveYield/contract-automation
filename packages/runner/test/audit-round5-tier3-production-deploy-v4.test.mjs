import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const workflow = readFileSync(path.join(root, '.github/workflows/tier3-production-deploy-v4.yml'), 'utf8');
const CONTROLLER = '48b031f06c7d7ed3573b42e371e123299722b451';
const AUTOMATION = 'ad11d7d5a623c1411cbabb4bb0cd9acf7975bce8';

function has(pattern) { assert.match(workflow, pattern); }

test('v4 is one-shot on accepted release with full history and exact request parent', () => {
  has(/orchestrator\/round4-ci-base-v1/);
  has(/TIER3_PRODUCTION_DEPLOY_REQUEST_v4\.json/);
  has(/round5-tier3-production-deploy-request-v4/);
  has(/fetch-depth:\s*0/);
  has(/DEPLOY_EVENT_BEFORE/);
  has(/git rev-parse HEAD\^/);
  has(/expectedBeforeSha/);
  has(/2df81aacb6f5747f06b49297e89e02c3f013d4ef/);
});

test('v4 retains explicit owner authorization and Ethereum/Base-only safety boundary', () => {
  has(/deploymentAuthorized == true/);
  has(/dependencyInstallationAuthorized == true/);
  has(/activeNetworks == \["ethereum", "base"\]/);
  has(/walletSigningAllowed == false/);
  has(/publicTransactionBroadcastAllowed == false/);
  assert.doesNotMatch(workflow, /activeNetworks[^\n]*(katana|arbitrum|polygon|optimism|fraxtal)/i);
});

test('v4 separates controller and execution GitHub secrets', () => {
  has(/PREFLIGHTSIM_GITHUB_TOKEN:\s*\$\{\{ secrets\.PREFLIGHTSIM_GITHUB_TOKEN \}\}/);
  has(/PREFLIGHTSIM_AUDIT_CONTROLLER_GITHUB_TOKEN:\s*\$\{\{ secrets\.PREFLIGHTSIM_AUDIT_CONTROLLER_GITHUB_TOKEN \}\}/);
  has(/AUDIT_CONTROLLER_GITHUB_TOKEN:\$AUDIT_CONTROLLER_GITHUB_TOKEN/);
});

test('v4 verifies current controller 16.14 and automation compatibility plus live Phase 0 state', () => {
  has(new RegExp(CONTROLLER));
  has(/ai-auditor-deep-assurance-v6@16\.14\.0/);
  has(new RegExp(AUTOMATION));
  has(/tier3-controller-adapter-v2/);
  has(/\/api\/v1\/controller\/projects\/vlsdt/);
  has(/PHASE0_BOOTSTRAP_FENCED/);
  has(/launchAuthorized == false/);
  has(/substantiveWorkAuthorized == false/);
});

test('v4 uses authorized install, repository tests/lint/build and no explicit Solidity compiler command', () => {
  has(/npm install --ignore-scripts --no-audit --no-fund/);
  has(/npm test/);
  has(/npm run lint/);
  has(/npm run build/);
  has(/npx --no-install wrangler/);
  assert.doesNotMatch(workflow, /^\s*(forge|hardhat|solc)\b/m);
});

test('v4 deploys Worker and Pages then verifies root, execution, API and controller CORS', () => {
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
