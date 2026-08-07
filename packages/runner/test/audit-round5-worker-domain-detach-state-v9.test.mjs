import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const REQUEST='.agent-control/v1/orchestrator/WORKER_DOMAIN_DETACH_STATE_REQUEST_v9.json';
const WORKFLOW='.github/workflows/worker-domain-detach-state-v9.yml';
const DESIGN='docs/superpowers/specs/2026-08-07-round5-worker-domain-detach-state-v9-design.md';
const PARENT='f14bddb27107c3f4295d6932e9c3432bf389fa7d';
const APP='2c6e543dfcaa17ca975bbde3c15302269bbf8072';
const read=p=>readFileSync(p,'utf8');

test('v9 uses canonical deployment and remains GET-only',()=>{
  assert.ok(existsSync(DESIGN)); assert.ok(existsSync(REQUEST)); assert.ok(existsSync(WORKFLOW));
  const r=JSON.parse(read(REQUEST));
  assert.equal(r.schemaVersion,'round5-worker-domain-detach-state-request-v9');
  assert.equal(r.expectedBeforeSha,PARENT); assert.equal(r.acceptedApplicationSource,APP);
  assert.equal(r.v7DeploymentShortId,'db5d91bc'); assert.equal(r.v8Run,31187427226);
  assert.equal(r.readOnly,true); assert.equal(r.cloudflareMethodsAllowed,'GET-only');
  assert.equal(r.cloudflareMutationAllowed,false); assert.equal(r.dependencyInstallationAllowed,false); assert.equal(r.repositoryCompilationAllowed,false);
  const w=read(WORKFLOW);
  assert.match(w,new RegExp(PARENT)); assert.match(w,new RegExp(APP)); assert.match(w,/canonical_deployment/); assert.match(w,/db5d91bc/);
  assert.match(w,/PAGES_DOMAIN_MATCH_COUNT/); assert.match(w,/WORKER_DOMAIN_MATCH_COUNT/); assert.match(w,/IMMUTABLE_CONTENT_CLASS/); assert.match(w,/PRODUCTION_CONTENT_CLASS/);
  assert.match(w,/worker-domain-detach-remains-only-routing-blocker/); assert.match(w,/routing-already-complete/); assert.match(w,/Worker-domain detach state v9 result/);
  assert.match(w,/actions\/checkout@[0-9a-f]{40}/);
  assert.doesNotMatch(w,/deployments\?env=production/); assert.doesNotMatch(w,/workflow_dispatch:/);
  assert.doesNotMatch(w,/--request\s+(POST|PUT|PATCH|DELETE)|-X\s*(POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(w,/\b(npm|npx|pnpm|yarn|bunx?|wrangler|solc|forge|hardhat)\b/i);
});
