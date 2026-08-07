import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const REQUEST = '.agent-control/v1/orchestrator/WORKER_DOMAIN_DETACH_STATE_REQUEST_v8.json';
const WORKFLOW = '.github/workflows/worker-domain-detach-state-v8.yml';
const DESIGN = 'docs/superpowers/specs/2026-08-07-round5-worker-domain-detach-state-v8-design.md';
const PARENT = '6876ed3c0934d7b49850f3af8239f7045375171a';
const APP = '2c6e543dfcaa17ca975bbde3c15302269bbf8072';
const read = (path) => readFileSync(path, 'utf8');

test('v8 freezes post-v7 Pages and Worker-domain state with GET only', () => {
  assert.ok(existsSync(DESIGN));
  assert.ok(existsSync(REQUEST));
  assert.ok(existsSync(WORKFLOW));

  const request = JSON.parse(read(REQUEST));
  assert.equal(request.schemaVersion, 'round5-worker-domain-detach-state-request-v8');
  assert.equal(request.expectedBeforeSha, PARENT);
  assert.equal(request.acceptedApplicationSource, APP);
  assert.equal(request.v7Run, 31186401186);
  assert.equal(request.v7Job, 92891932721);
  assert.equal(request.v7DeploymentShortId, 'db5d91bc');
  assert.equal(request.readOnly, true);
  assert.equal(request.cloudflareMethodsAllowed, 'GET-only');
  assert.equal(request.cloudflareMutationAllowed, false);
  assert.equal(request.dependencyInstallationAllowed, false);
  assert.equal(request.repositoryCompilationAllowed, false);
  assert.equal(request.failedOrHistoricalWorkflowRerunAllowed, false);

  const workflow = read(WORKFLOW);
  assert.match(workflow, new RegExp(PARENT));
  assert.match(workflow, new RegExp(APP));
  assert.match(workflow, /WORKER_DOMAIN_DETACH_STATE_REQUEST_v8\.json/);
  assert.match(workflow, /db5d91bc/);
  assert.match(workflow, /pages\/projects\/\$PAGES_PROJECT_NAME\/deployments\?env=production/);
  assert.match(workflow, /WORKER_DOMAIN_MATCH_COUNT/);
  assert.match(workflow, /PAGES_DOMAIN_MATCH_COUNT/);
  assert.match(workflow, /IMMUTABLE_CONTENT_CLASS/);
  assert.match(workflow, /PRODUCTION_CONTENT_CLASS/);
  assert.match(workflow, /worker-domain-detach-remains-only-routing-blocker/);
  assert.match(workflow, /worker-domain-detached-pages-domain-not-attached/);
  assert.match(workflow, /routing-already-complete/);
  assert.match(workflow, /conflicting-worker-and-pages-domain-state/);
  assert.match(workflow, /Worker-domain detach state v8 result/);
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);

  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /--request\s+(POST|PUT|PATCH|DELETE)|-X\s*(POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(workflow, /\b(npm|npx|pnpm|yarn|bunx?|wrangler)\b/i);
  assert.doesNotMatch(workflow, /\b(solc|forge|hardhat)\b/i);
  assert.doesNotMatch(workflow, /eth_send|eth_sign|personal_|wallet_|\/api\/v1\/jobs|\/api\/v1\/uploads/i);
});
