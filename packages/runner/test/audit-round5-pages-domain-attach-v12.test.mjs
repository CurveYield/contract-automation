import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const REQUEST='.agent-control/v1/orchestrator/PAGES_DOMAIN_ATTACH_REQUEST_v12.json';
const WORKFLOW='.github/workflows/pages-domain-attach-v12.yml';
const DESIGN='docs/superpowers/specs/2026-08-07-round5-pages-domain-attach-v12-design.md';
const APP='2c6e543dfcaa17ca975bbde3c15302269bbf8072';
const read=p=>readFileSync(p,'utf8');

test('v12 preinstalls workflow and binds its later request to the exact push parent',()=>{
  assert.ok(existsSync(DESIGN));
  assert.ok(existsSync(WORKFLOW));
  assert.ok(existsSync(REQUEST));
  const r=JSON.parse(read(REQUEST));
  assert.equal(r.schemaVersion,'round5-pages-domain-attach-request-v12');
  assert.equal(r.acceptedApplicationSource,APP);
  assert.equal(r.pagesDeploymentShortId,'db5d91bc');
  assert.equal(r.v9Run,31187717248);
  assert.match(r.expectedBeforeSha,/^[0-9a-f]{40}$/);
  assert.equal(r.idempotentAttach,true);
  assert.equal(r.pagesDomainAttachAllowed,true);
  assert.equal(r.workerMutationAllowed,false);
  assert.equal(r.pagesProjectMutationAllowed,false);
  assert.equal(r.pagesDeploymentMutationAllowed,false);
  assert.equal(r.assetMutationAllowed,false);
  assert.equal(r.dependencyInstallationAllowed,false);
  assert.equal(r.repositoryCompilationAllowed,false);

  const w=read(WORKFLOW);
  assert.match(w,/PAGES_DOMAIN_ATTACH_REQUEST_v12\.json/);
  assert.match(w,/group: curveyield-preflight-pages-domain-attach-v10/);
  assert.match(w,/EVENT_BEFORE_SHA/);
  assert.match(w,/expectedBeforeSha/);
  assert.match(w,/PREATTACH_PAGES_DOMAIN_COUNT/);
  assert.match(w,/PREATTACH_WORKER_DOMAIN_COUNT/);
  assert.match(w,/ATTACH_ATTEMPTED/);
  assert.match(w,/PAGES_DOMAIN_ACTIVE/);
  assert.match(w,/PRODUCTION_UI_ACCEPTED/);
  assert.match(w,/FINAL_WORKER_DOMAIN_MATCH_COUNT/);
  assert.match(w,/FINAL_ROUTING_ACCEPTANCE/);
  assert.match(w,/Pages production-domain attach v12 result/);
  assert.match(w,/actions\/checkout@[0-9a-f]{40}/);
  assert.doesNotMatch(w,/workflow_dispatch:/);
  assert.doesNotMatch(w,/workers\/domains[^\n]*--request\s+(POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(w,/pages\/projects[^\n]*\/deployments[^\n]*--request\s+(POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(w,/pages\/assets\/(upload|upsert-hashes)/i);
  assert.doesNotMatch(w,/\b(npm|npx|pnpm|yarn|bunx?|wrangler|solc|forge|hardhat)\b/i);
});
