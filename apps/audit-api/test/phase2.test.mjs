import test from 'node:test';
import assert from 'node:assert/strict';
import auditApi from '../src/index.mjs';
import { InMemoryAuditStore } from '../../../packages/audit-r2-store/src/index.mjs';

const tenantId = `ten_${'1'.repeat(32)}`;
const workspaceId = `ws_${'2'.repeat(32)}`;
const layerId = `lyr_${'3'.repeat(32)}`;
const digest = 'a'.repeat(64);
const grantExpiry = '2026-07-31T13:00:00.000Z';

function request(path, init = {}) {
  return new Request(`https://api.audit.preflight.curveyield.online${path}`, init);
}
function bearer(key) { return { authorization: `Bearer ${key}` }; }
function jsonPost(path, key, body) {
  return request(path, { method: 'POST', headers: { ...bearer(key), 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
function state(overrides = {}) {
  const calls = [];
  return {
    calls,
    AUDIT_READ_API_KEY: 'audit-read-test-key',
    AUDIT_SUBMIT_API_KEY: 'audit-submit-test-key',
    AUDIT_ADMIN_API_KEY: 'audit-admin-test-key',
    AUDIT_INTERNAL_SERVICE_KEY: 'audit-internal-test-key',
    AUDIT_UPLOAD_GRANT_SIGNING_KEY: 'audit-upload-grant-test-key',
    AUDIT_NOW: () => new Date('2026-07-31T12:00:00.000Z'),
    AUDIT_NONCE_STORE: new InMemoryAuditStore(),
    AUDIT_CONTROL_STORE: new InMemoryAuditStore(),
    AUDIT_UPLOAD_URL_SIGNER: async (input) => { calls.push(['uploadSigner', input]); return { method: 'PUT', url: 'https://upload.invalid/signed', headers: { 'content-type': input.contentType }, expiresAt: input.expiresAt }; },
    AUDIT_GITHUB_ARCHIVE_RESOLVER: async (input) => { calls.push(['githubResolver', input]); return { archiveBytes: new Uint8Array([1, 2, 3]), archiveSha256: digest, bytes: 3 }; },
    AUDIT_LAYER_BUNDLE_RESOLVER: async (input) => { calls.push(['layerResolver', input]); return { archiveBytes: new Uint8Array([4, 5, 6]) }; },
    AUDIT_WORKSPACE_SERVICE: {
      async sealUploadedWorkspace(input) { calls.push(['seal', input]); return { workspaceId, manifest: { workspaceId, fileCount: 12 } }; },
      async importGitHubWorkspace(input) { calls.push(['import', input]); return { workspaceId, manifest: { workspaceId, sourceKind: 'github' } }; },
      async readWorkspace(id) { calls.push(['readWorkspace', id]); return { workspaceId: id, fileCount: 12 }; },
      async readLayerIndex(id) { calls.push(['readLayers', id]); return { workspaceId: id, layers: [layerId] }; },
      async attachLayer(input) { calls.push(['attachLayer', input]); return { workspaceId, layerId }; }
    },
    AUDIT_PROFILE_REGISTRY: {
      async readIndex() { calls.push(['profiles']); return { schemaVersion: 'profile-index-v1', profiles: ['slither-solidity-v1'] }; },
      async read(id) { calls.push(['profile', id]); return { profileId: id, revoked: false }; }
    },
    CORS_ORIGIN: 'https://audit.preflight.curveyield.online',
    ...overrides
  };
}

test('Phase 2 health and capabilities expose metadata features while execution stays disabled', async () => {
  const env = state();
  const health = await auditApi.fetch(request('/audit/v1/health'), env);
  assert.deepEqual(await health.json(), { status: 'ok', service: 'curveyield-audit-api', version: '0.2.0', phase: 2 });
  const capabilities = await auditApi.fetch(request('/audit/v1/capabilities', { headers: bearer('audit-read-test-key') }), env);
  const body = await capabilities.json();
  assert.equal(body.phase, 2);
  assert.equal(body.workspaces, true);
  assert.equal(body.profileRegistry, true);
  assert.equal(body.executionEnabled, false);
});

test('creates a signed upload grant with submit scope and never exposes signing material', async () => {
  const env = state();
  const response = await auditApi.fetch(jsonPost('/audit/v1/workspace-upload-grants', 'audit-submit-test-key', {
    tenantId, sha256: digest, bytes: 1_000_000, contentType: 'application/zip', expiresAt: grantExpiry
  }), env);
  assert.equal(response.status, 201);
  const text = await response.text();
  assert.doesNotMatch(text, /audit-upload-grant-test-key/);
  const body = JSON.parse(text);
  assert.equal(body.grant.destinationKey, `ingress/${tenantId}/${digest}.zip`);
  assert.equal(body.upload.method, 'PUT');
  assert.equal(env.calls[0][0], 'uploadSigner');
});

test('Lite or read-only credentials fail before upload signer and workspace service calls', async () => {
  for (const key of ['lite-client-key', 'audit-read-test-key']) {
    const env = state();
    const response = await auditApi.fetch(jsonPost('/audit/v1/workspace-upload-grants', key, {
      tenantId, sha256: digest, bytes: 1_000_000, contentType: 'application/zip', expiresAt: grantExpiry
    }), env);
    assert.equal(response.status, key.startsWith('lite') ? 401 : 403);
    assert.deepEqual(env.calls, []);
  }
});

test('seals workspaces and reads workspace/layer indexes through reviewed service contracts', async () => {
  const env = state();
  const sealed = await auditApi.fetch(jsonPost('/audit/v1/workspaces/seal', 'audit-submit-test-key', {
    workspaceId,
    grant: { schemaVersion: 'upload-grant-v1', tenantId, sha256: digest, bytes: 1_000_000, contentType: 'application/zip', expiresAt: grantExpiry, destinationKey: `ingress/${tenantId}/${digest}.zip`, issuedAt: '2026-07-31T12:00:00.000Z', signature: 'sig' },
    tenantIndex: { schemaVersion: 'tenant-workspaces-v1', tenantId, workspaces: [workspaceId] }
  }), env);
  assert.equal(sealed.status, 201);
  const workspace = await auditApi.fetch(request(`/audit/v1/workspaces/${workspaceId}`, { headers: bearer('audit-read-test-key') }), env);
  assert.equal((await workspace.json()).fileCount, 12);
  const layers = await auditApi.fetch(request(`/audit/v1/workspaces/${workspaceId}/layers`, { headers: bearer('audit-read-test-key') }), env);
  assert.deepEqual((await layers.json()).layers, [layerId]);
  assert.deepEqual(env.calls.map((item) => item[0]), ['seal', 'readWorkspace', 'readLayers']);
});

test('GitHub import requires an exact commit SHA before the resolver is called', async () => {
  const invalid = state();
  const denied = await auditApi.fetch(jsonPost('/audit/v1/workspaces/import-github', 'audit-submit-test-key', {
    tenantId, workspaceId, repository: 'CurveYield/contract-automation', commitSha: 'main', refName: 'main',
    tenantIndex: { schemaVersion: 'tenant-workspaces-v1', tenantId, workspaces: [workspaceId] }
  }), invalid);
  assert.equal(denied.status, 400);
  assert.equal(invalid.calls.length, 0);

  const env = state();
  const imported = await auditApi.fetch(jsonPost('/audit/v1/workspaces/import-github', 'audit-submit-test-key', {
    tenantId, workspaceId, repository: 'CurveYield/contract-automation', commitSha: 'b'.repeat(40), refName: 'main',
    tenantIndex: { schemaVersion: 'tenant-workspaces-v1', tenantId, workspaces: [workspaceId] }
  }), env);
  assert.equal(imported.status, 201);
  assert.deepEqual(env.calls.map((item) => item[0]), ['githubResolver', 'import']);
});

test('generated layer attachment requires admin scope and a trusted bundle resolver', async () => {
  const body = {
    layerBundleId: 'bundle-0001',
    manifest: { schemaVersion: 'layer-manifest-v1', layerId, workspaceId, archiveSha256: 'c'.repeat(64), archiveBytes: 3, archiveObjectKey: `workspaces/${workspaceId}/layers/${layerId}.tar.zst`, createdAt: '2026-07-31T12:05:00.000Z', generator: 'curveyield-audit-spec-layer-v1', fileCount: 3 },
    layerIndex: { schemaVersion: 'workspace-layer-index-v1', workspaceId, layers: [layerId] },
    eventBatch: { schemaVersion: 'workspace-event-batch-v1', batchId: '00000001', workspaceId, events: [{ type: 'layer_attached', layerId }] }
  };
  const denied = state();
  assert.equal((await auditApi.fetch(jsonPost(`/audit/v1/workspaces/${workspaceId}/layers`, 'audit-submit-test-key', body), denied)).status, 403);
  assert.deepEqual(denied.calls, []);
  const env = state();
  assert.equal((await auditApi.fetch(jsonPost(`/audit/v1/workspaces/${workspaceId}/layers`, 'audit-admin-test-key', body), env)).status, 201);
  assert.deepEqual(env.calls.map((item) => item[0]), ['layerResolver', 'attachLayer']);
});

test('lists and reads profiles without bucket listing or browser R2 access', async () => {
  const env = state();
  const list = await auditApi.fetch(request('/audit/v1/profiles', { headers: bearer('audit-read-test-key') }), env);
  assert.deepEqual((await list.json()).profiles, ['slither-solidity-v1']);
  const profile = await auditApi.fetch(request('/audit/v1/profiles/slither-solidity-v1', { headers: bearer('audit-read-test-key') }), env);
  assert.equal((await profile.json()).profileId, 'slither-solidity-v1');
  assert.deepEqual(env.calls.map((item) => item[0]), ['profiles', 'profile']);
});

test('Phase 2 JSON routes reject unsupported content types before integration calls', async () => {
  const env = state();
  const response = await auditApi.fetch(request('/audit/v1/workspaces/seal', {
    method: 'POST', headers: { ...bearer('audit-submit-test-key'), 'content-type': 'text/plain' }, body: '{}'
  }), env);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'unsupported_content_type');
  assert.deepEqual(env.calls, []);
});
