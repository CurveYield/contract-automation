import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const REQUEST='.agent-control/v1/orchestrator/PAGES_DOMAIN_ATTACH_REQUEST_v10.json';
const WORKFLOW='.github/workflows/pages-domain-attach-v10.yml';
const DESIGN='docs/superpowers/specs/2026-08-07-round5-pages-domain-attach-v10-design.md';
const PARENT='7abbf2d0c090d8bc6344014e2d326ffbcb2ccafe';
const APP='2c6e543dfcaa17ca975bbde3c15302269bbf8072';
const read=p=>readFileSync(p,'utf8');

test('v10 only attaches the verified production hostname to Pages and verifies final browser state',()=>{
  assert.ok(existsSync(DESIGN)); assert.ok(existsSync(REQUEST)); assert.ok(existsSync(WORKFLOW));
  const r=JSON.parse(read(REQUEST));
  assert.equal(r.schemaVersion,'round5-pages-domain-attach-request-v10');
  assert.equal(r.expectedBeforeSha,PARENT); assert.equal(r.acceptedApplicationSource,APP);
  assert.equal(r.v9Run,31187717248); assert.equal(r.pagesDeploymentShortId,'db5d91bc');
  assert.equal(r.pagesDomainAttachAllowed,true); assert.equal(r.workerMutationAllowed,false);
  assert.equal(r.pagesProjectMutationAllowed,false); assert.equal(r.pagesDeploymentMutationAllowed,false); assert.equal(r.assetMutationAllowed,false);
  assert.equal(r.dependencyInstallationAllowed,false); assert.equal(r.repositoryCompilationAllowed,false);
  const w=read(WORKFLOW);
  assert.match(w,new RegExp(PARENT)); assert.match(w,new RegExp(APP)); assert.match(w,/db5d91bc/);
  assert.match(w,/--request POST/); assert.match(w,/pages\/projects\/\$PAGES_PROJECT_NAME\/domains/);
  assert.match(w,/PAGES_DOMAIN_POST_HTTP_STATUS/); assert.match(w,/PAGES_DOMAIN_ACTIVE/); assert.match(w,/PRODUCTION_UI_ACCEPTED/); assert.match(w,/FINAL_WORKER_DOMAIN_MATCH_COUNT/);
  assert.match(w,/Pages production-domain attach v10 result/); assert.match(w,/actions\/checkout@[0-9a-f]{40}/);
  assert.doesNotMatch(w,/workers\/domains[^\n]*--request\s+(POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(w,/pages\/projects[^\n]*\/deployments[^\n]*--request\s+(POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(w,/pages\/assets\/(upload|upsert-hashes)/i);
  assert.doesNotMatch(w,/\b(npm|npx|pnpm|yarn|bunx?|wrangler|solc|forge|hardhat)\b/i);
});
