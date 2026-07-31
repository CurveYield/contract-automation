import test from 'node:test';
import assert from 'node:assert/strict';
import auditApi, { signInternalRequest } from '../src/index.mjs';

test('real R2 null conditional result is treated as replay', async () => {
  let calls = 0;
  const env = {
    AUDIT_INTERNAL_SERVICE_KEY: 'audit-internal-test-key',
    AUDIT_NONCE_STORE: {
      async put() {
        calls += 1;
        return calls === 1 ? { etag: 'first' } : null;
      }
    },
    CORS_ORIGIN: 'https://audit.preflight.curveyield.online'
  };
  const timestamp = Math.floor(Date.now() / 1000);
  const headers = await signInternalRequest({
    key: env.AUDIT_INTERNAL_SERVICE_KEY,
    timestamp,
    nonce: 'nonce-real-r2-01234567',
    method: 'POST',
    path: '/audit-internal/v1/ping',
    body: '{}'
  });
  const makeRequest = () => new Request('https://api.audit.preflight.curveyield.online/audit-internal/v1/ping', {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{}'
  });
  assert.equal((await auditApi.fetch(makeRequest(), env)).status, 200);
  const replay = await auditApi.fetch(makeRequest(), env);
  assert.equal(replay.status, 409);
  assert.equal((await replay.json()).error.code, 'replay_detected');
});
