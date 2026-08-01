import test from 'node:test';
import assert from 'node:assert/strict';
import auditWorker from '../apps/audit-api/src/entry.mjs';
import { deriveUploadGrantSigningKey } from '../apps/audit-api/src/index.mjs';
import { InMemoryAuditStore } from '../packages/audit-r2-store/src/index.mjs';

const tenantId = `ten_${'1'.repeat(32)}`;
const edgeToken = 'edge-control-token-test-0123456789abcdef';

function hex(value) {
  return [...value].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function request(path, init = {}) {
  return new Request(`https://api.audit.preflight.curveyield.online${path}`, init);
}
function uploadRequest() {
  return request('/audit/v1/workspace-upload-grants', {
    method: 'POST',
    headers: { authorization: 'Bearer audit-submit-test-key', 'content-type': 'application/json' },
    body: JSON.stringify({
      tenantId,
      sha256: 'a'.repeat(64),
      bytes: 100,
      contentType: 'application/zip',
      expiresAt: '2026-08-01T08:30:00.000Z'
    })
  });
}
function env(overrides = {}) {
  return {
    AUDIT_TEST_MODE: 'true',
    AUDIT_SUBMIT_API_KEY: 'audit-submit-test-key',
    AUDIT_EDGE_CONTROL_PLANE_TOKEN: edgeToken,
    AUDIT_NOW: () => new Date('2026-08-01T08:00:00.000Z'),
    AUDIT_NONCE_STORE: new InMemoryAuditStore(),
    AUDIT_UPLOAD_URL_SIGNER: async (input) => ({ method: 'PUT', url: 'https://upload.invalid/signed', headers: { 'content-type': input.contentType }, expiresAt: input.expiresAt }),
    CORS_ORIGIN: 'https://audit.preflight.curveyield.online',
    ...overrides
  };
}

test('derives the exact versioned upload-grant key from the edge control-plane token', async () => {
  assert.equal(hex(await deriveUploadGrantSigningKey(edgeToken)), 'df3648e0756144811bf303f4f38e4351340ccfc217e6e21c113552b51c3c1d4a');
});

test('edge control-plane token enables upload grants without a standalone signing key', async () => {
  const response = await auditWorker.fetch(uploadRequest(), env());
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.match(body.grant.signature, /^[0-9a-f]{64}$/);
});

test('legacy standalone upload signing key does not satisfy the runtime contract', async () => {
  const response = await auditWorker.fetch(uploadRequest(), env({
    AUDIT_EDGE_CONTROL_PLANE_TOKEN: undefined,
    AUDIT_UPLOAD_GRANT_SIGNING_KEY: 'legacy-upload-signing-key-that-must-not-work'
  }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'upload_grant_signer_unavailable');
});
