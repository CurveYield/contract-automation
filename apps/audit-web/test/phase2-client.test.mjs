import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuditApiClient } from '../src/client.mjs';

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('Phase 2 client uses only Audit metadata routes with bearer auth', async () => {
  const calls = [];
  const client = createAuditApiClient({
    apiUrl: 'https://api.audit.preflight.curveyield.online',
    apiKey: 'audit-submit-key',
    fetcher: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith('/profiles')) return response({ profiles: [] });
      return response({ ok: true });
    }
  });
  await client.createWorkspaceUploadGrant({ tenantId: `ten_${'1'.repeat(32)}`, sha256: 'a'.repeat(64), bytes: 100, contentType: 'application/zip', expiresAt: '2026-08-01T12:00:00.000Z' });
  await client.sealWorkspace({ workspaceId: `ws_${'2'.repeat(32)}` });
  await client.importGitHubWorkspace({ workspaceId: `ws_${'2'.repeat(32)}`, repository: 'CurveYield/contract-automation', commitSha: 'b'.repeat(40) });
  await client.getWorkspace(`ws_${'2'.repeat(32)}`);
  await client.getWorkspaceLayers(`ws_${'2'.repeat(32)}`);
  await client.attachWorkspaceLayer(`ws_${'2'.repeat(32)}`, { layerBundleId: 'bundle-0001' });
  await client.listProfiles();
  await client.getProfile('slither-solidity-v1');
  assert.equal(calls.length, 8);
  for (const call of calls) {
    const parsed = new URL(call.url);
    assert.match(parsed.pathname, /^\/audit\/v1\//);
    assert.equal(call.init.headers.get('authorization'), 'Bearer audit-submit-key');
    assert.doesNotMatch(call.url, /\/api\/v1|\/internal\/v1|r2|access_key/i);
  }
});

test('client validates workspace/profile path identifiers before fetch', async () => {
  let calls = 0;
  const client = createAuditApiClient({ apiUrl: 'https://api.audit.preflight.curveyield.online', apiKey: 'key', fetcher: async () => { calls += 1; return response({}); } });
  await assert.rejects(() => client.getWorkspace('../escape'), /workspace/i);
  await assert.rejects(() => client.getWorkspaceLayers('ws_bad'), /workspace/i);
  await assert.rejects(() => client.getProfile('Slither-v1'), /profile/i);
  assert.equal(calls, 0);
});

test('client exposes metadata methods but no direct R2, arbitrary URL, or execution method', () => {
  const client = createAuditApiClient({ apiUrl: 'https://api.audit.preflight.curveyield.online', apiKey: 'key', fetcher: async () => response({}) });
  assert.equal(typeof client.createWorkspaceUploadGrant, 'function');
  assert.equal(typeof client.sealWorkspace, 'function');
  assert.equal(typeof client.listProfiles, 'function');
  for (const forbidden of ['listR2Objects', 'putR2Object', 'setRpcUrl', 'executeJob', 'runCommand', 'broadcastTransaction']) {
    assert.equal(forbidden in client, false);
  }
});
