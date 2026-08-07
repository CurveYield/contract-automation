import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const D='docs/superpowers/specs/2026-08-07-round5-production-browser-acceptance-v3-design.md';
const W='.github/workflows/production-browser-acceptance-v3.yml';
const R='.agent-control/v1/orchestrator/PRODUCTION_BROWSER_ACCEPTANCE_REQUEST_v3.json';
const APP='2c6e543dfcaa17ca975bbde3c15302269bbf8072';
const read=p=>readFileSync(p,'utf8');

test('v3 proves the accepted Pages UI can use the production API from a browser',()=>{
  assert.ok(existsSync(D));
  assert.ok(existsSync(W));
  assert.ok(existsSync(R));
  const r=JSON.parse(read(R));
  assert.equal(r.schemaVersion,'round5-production-browser-acceptance-request-v3');
  assert.equal(r.acceptedApplicationSource,APP);
  assert.equal(r.v13RoutingRun,31202904539);
  assert.match(r.expectedBeforeSha,/^[0-9a-f]{40}$/);
  assert.deepEqual(r.activeNetworks,['ethereum','base']);
  assert.equal(r.defaultNetwork,'base');
  assert.equal(r.readOnly,true);
  assert.equal(r.jobSubmissionAllowed,false);
  assert.equal(r.walletSigningAllowed,false);

  const w=read(W);
  for (const s of ['PAGES_OWNERSHIP_CHECK','PAGES_UI_CHECK','API_HEALTH_CHECK','API_SETUP_CHECK','API_AUTH_REJECTION_CHECK','CORS_PREFLIGHT_CHECK','API_CHAIN_ALLOWLIST_CHECK','ETHEREUM_RPC_CHECK','BASE_RPC_CHECK','FINAL_BROWSER_DEPLOYMENT_ACCEPTANCE']) assert.match(w,new RegExp(s));
  assert.match(w,/workers\/domains\?hostname=/);
  assert.match(w,/pages\/projects\/\$PAGES_PROJECT_NAME\/domains\/\$PAGES_DOMAIN/);
  assert.match(w,/Access-Control-Request-Method/);
  assert.match(w,/Access-Control-Request-Headers/);
  assert.match(w,/Authorization: Bearer \$PREFLIGHTSIM_CLIENT_API_KEY/);
  assert.match(w,/eth_chainId/);
  assert.match(w,/eth_blockNumber/);
  assert.match(w,/actions\/checkout@[0-9a-f]{40}/);
  assert.doesNotMatch(w,/workflow_dispatch:/);
  assert.doesNotMatch(w,/--request\s+(POST|PUT|PATCH|DELETE)[^\n]*cloudflare/i);
  assert.doesNotMatch(w,/\b(npm|npx|pnpm|yarn|bunx?|wrangler|solc|forge|hardhat)\b/i);
});
