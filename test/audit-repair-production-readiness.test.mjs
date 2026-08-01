import test from 'node:test';
import assert from 'node:assert/strict';
import auditWorker from '../apps/audit-api/src/entry.mjs';
import { InMemoryAuditStore } from '../packages/audit-r2-store/src/index.mjs';

const tenantId = `ten_${'1'.repeat(32)}`;
const workspaceId = `ws_${'2'.repeat(32)}`;
const campaignId = `cmp_${'3'.repeat(32)}`;

function request(path, init = {}) {
  return new Request(`https://api.audit.preflight.curveyield.online${path}`, init);
}
function bearer(key) { return { authorization: `Bearer ${key}` }; }
function baseEnv(overrides = {}) {
  return {
    AUDIT_CLIENT_API_KEY: 'audit-client-test-key-000000000001',
    AUDIT_GPT_API_KEY: 'audit-gpt-test-key-000000000000001',
    AUDIT_EDGE_CONTROL_PLANE_TOKEN: 'audit-edge-control-plane-test-token-0001',
    AUDIT_NONCE_STORE: new InMemoryAuditStore(),
    AUDIT_CONTROL_STORE: new InMemoryAuditStore(),
    CORS_ORIGIN: 'https://audit.preflight.curveyield.online',
    ...overrides
  };
}

test('production capabilities ignore function-valued test seams and report unavailable integrations', async () => {
  let calls = 0;
  const env = baseEnv({
    AUDIT_UPLOAD_URL_SIGNER: async () => { calls += 1; },
    AUDIT_GITHUB_ARCHIVE_RESOLVER: async () => { calls += 1; },
    AUDIT_LAYER_BUNDLE_RESOLVER: async () => { calls += 1; },
    AUDIT_EVIDENCE_VALIDATOR: async () => { calls += 1; },
    AUDIT_EVIDENCE_ATTESTATION_SIGNER: async () => { calls += 1; }
  });
  const response = await auditWorker.fetch(request('/audit/v1/capabilities', { headers: bearer(env.AUDIT_CLIENT_API_KEY) }), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.executionEnabled, false);
  assert.equal(body.workspaceUploads, false);
  assert.equal(body.githubImports, false);
  assert.equal(body.generatedLayers, false);
  assert.equal(body.evidenceAcceptance, false);
  assert.equal(body.reportPublication, false);
  assert.deepEqual(body.retention, { freeDevelopment: true, extended90d: false, archive365d: false });
  assert.equal(calls, 0);
});

test('admin readiness contains canonical identity booleans only', async () => {
  const env = baseEnv({
    AUDIT_UPLOAD_URL_SIGNER: async () => 'should be ignored',
    AUDIT_GITHUB_ARCHIVE_RESOLVER: async () => 'should be ignored'
  });
  const response = await auditWorker.fetch(request('/audit/v1/readiness', { headers: bearer(env.AUDIT_CLIENT_API_KEY) }), env);
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.doesNotMatch(text, /audit-(?:client|gpt|edge)-/);
  const body = JSON.parse(text);
  assert.equal(body.ready, false);
  assert.equal(body.coreReady, true);
  assert.equal(body.configuration.clientKey, true);
  assert.equal(body.configuration.gptKey, true);
  assert.equal(body.configuration.edgeControlKey, true);
  assert.equal(body.configuration.controlStore, true);
  assert.equal(body.configuration.uploadGrantSigner, true);
  assert.equal(body.configuration.directUploadSigner, false);
  assert.equal(body.configuration.githubArchiveResolver, false);
  assert.equal(body.configuration.generatedLayerResolver, false);
  assert.equal(body.configuration.evidenceValidator, false);
  assert.equal(body.configuration.attestationSigner, false);
  assert.equal(body.configuration.executionEnabled, false);
  assert.equal('readKey' in body.configuration, false);
  assert.equal('internalKey' in body.configuration, false);
  for (const value of Object.values(body.configuration)) assert.equal(typeof value, 'boolean');
});

test('GPT identity cannot use admin readiness', async () => {
  const env = baseEnv();
  const response = await auditWorker.fetch(request('/audit/v1/readiness', { headers: bearer(env.AUDIT_GPT_API_KEY) }), env);
  assert.equal(response.status, 403);
});

test('production upload-grant route rejects function-valued signer before calling it', async () => {
  let calls = 0;
  const env = baseEnv({ AUDIT_UPLOAD_URL_SIGNER: async () => { calls += 1; return {}; } });
  const response = await auditWorker.fetch(request('/audit/v1/workspace-upload-grants', {
    method: 'POST',
    headers: { ...bearer(env.AUDIT_GPT_API_KEY), 'content-type': 'application/json' },
    body: JSON.stringify({
      tenantId,
      sha256: 'a'.repeat(64),
      bytes: 100,
      contentType: 'application/zip',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    })
  }), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'upload_url_signer_unavailable');
  assert.equal(calls, 0);
});

test('explicit test mode may use injected adapters without making them production capabilities', async () => {
  let calls = 0;
  const env = baseEnv({
    AUDIT_TEST_MODE: 'true',
    AUDIT_NOW: () => new Date('2026-08-01T08:00:00.000Z'),
    AUDIT_UPLOAD_URL_SIGNER: async (input) => {
      calls += 1;
      return { method: 'PUT', url: 'https://upload.invalid/signed', headers: { 'content-type': input.contentType }, expiresAt: input.expiresAt };
    }
  });
  const response = await auditWorker.fetch(request('/audit/v1/workspace-upload-grants', {
    method: 'POST',
    headers: { ...bearer(env.AUDIT_GPT_API_KEY), 'content-type': 'application/json' },
    body: JSON.stringify({
      tenantId,
      sha256: 'a'.repeat(64),
      bytes: 100,
      contentType: 'application/zip',
      expiresAt: '2026-08-01T08:30:00.000Z'
    })
  }), env);
  assert.equal(response.status, 201);
  assert.equal(calls, 1);
});

test('deployed route rejects retention classes that current R2 keys cannot enforce', async () => {
  for (const retentionPolicy of ['extended-90d', 'archive-365d']) {
    const env = baseEnv();
    const response = await auditWorker.fetch(request('/audit/v1/campaigns', {
      method: 'POST',
      headers: { ...bearer(env.AUDIT_GPT_API_KEY), 'content-type': 'application/json' },
      body: JSON.stringify({
        creation: {
          schemaVersion: 'campaign-creation-v1', campaignId, workspaceId,
          name: 'Unsupported retention campaign', createdAt: '2026-08-01T08:00:00.000Z', retentionPolicy
        }
      })
    }), env);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'unsupported_retention_policy');
    assert.deepEqual(env.AUDIT_CONTROL_STORE.usage(), { classA: 0, classB: 0, free: 0, storedBytes: 0 });
  }
});

test('Wrangler never enables test adapters or unsupported retention', async () => {
  const fs = await import('node:fs/promises');
  const wrangler = await fs.readFile(new URL('../apps/audit-api/wrangler.toml', import.meta.url), 'utf8');
  assert.doesNotMatch(wrangler, /AUDIT_TEST_MODE/);
  assert.doesNotMatch(wrangler, /AUDIT_TRUSTED_FIXTURE_ENABLED\s*=\s*"true"/);
  assert.doesNotMatch(wrangler, /extended-90d|archive-365d/);
});
