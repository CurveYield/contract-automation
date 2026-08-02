import test from 'node:test';
import assert from 'node:assert/strict';
import auditApi, { signInternalRequest } from '../src/index.mjs';
import { InMemoryAuditStore } from '../../../packages/audit-r2-store/src/index.mjs';

const validJob = {
  workspaceId: 'ws_0123456789abcdef0123456789abcdef',
  campaignId: 'cmp_0123456789abcdef0123456789abcdef',
  profileId: 'prf_0123456789abcdef0123456789abcdef',
  tool: 'foundry-test',
  configuration: { matchPath: 'test/**/*.t.sol' },
  resourceClass: 'standard-test',
  timeoutSeconds: 1800,
  retentionPolicy: 'free-development',
  expectedEvidence: ['tests', 'raw-output'],
  idempotencyKey: 'idem-phase1-001'
};

function env(overrides = {}) {
  return {
    AUDIT_READ_API_KEY: 'audit-read-test-key',
    AUDIT_SUBMIT_API_KEY: 'audit-submit-test-key',
    AUDIT_ADMIN_API_KEY: 'audit-admin-test-key',
    AUDIT_INTERNAL_SERVICE_KEY: 'audit-internal-test-key',
    AUDIT_EXECUTION_ENABLED: 'false',
    AUDIT_NONCE_STORE: new InMemoryAuditStore(),
    CORS_ORIGIN: 'https://audit.preflight.curveyield.online',
    ...overrides
  };
}

function request(path, init = {}) {
  return new Request(`https://api.audit.preflight.curveyield.online${path}`, init);
}

function bearer(key) {
  return { authorization: `Bearer ${key}` };
}

test('health is public and consumes no R2 operations', async () => {
  const state = env();
  const response = await auditApi.fetch(request('/audit/v1/health'), state);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: 'ok', service: 'curveyield-audit-api', version: '0.2.0', phase: 2
  });
  assert.deepEqual(state.AUDIT_NONCE_STORE.usage(), { classA: 0, classB: 0, free: 0, storedBytes: 0 });
});

test('capabilities require read scope and remain execution disabled', async () => {
  const unauthorized = await auditApi.fetch(request('/audit/v1/capabilities'), env());
  assert.equal(unauthorized.status, 401);
  const response = await auditApi.fetch(request('/audit/v1/capabilities', {
    headers: bearer('audit-read-test-key')
  }), env());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.executionEnabled, false);
  assert.equal(body.executionState, 'awaiting_executor');
});

test('readiness requires admin scope and never exposes secret values', async () => {
  const denied = await auditApi.fetch(request('/audit/v1/readiness', {
    headers: bearer('audit-submit-test-key')
  }), env());
  assert.equal(denied.status, 403);
  const response = await auditApi.fetch(request('/audit/v1/readiness', {
    headers: bearer('audit-admin-test-key')
  }), env());
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.doesNotMatch(text, /audit-(?:read|submit|admin|internal)-test-key/);
  const body = JSON.parse(text);
  assert.equal(body.ready, true);
  assert.deepEqual(body.configuration, {
    readKey: true,
    submitKey: true,
    adminKey: true,
    internalKey: true,
    nonceStore: true,
    executionEnabled: false
  });
});

test('Lite credentials are unauthorized and rejected before R2 access', async () => {
  const state = env();
  const response = await auditApi.fetch(request('/audit/v1/capabilities', {
    headers: bearer('lite-client-key')
  }), state);
  assert.equal(response.status, 401);
  assert.deepEqual(state.AUDIT_NONCE_STORE.usage(), { classA: 0, classB: 0, free: 0, storedBytes: 0 });
});

test('valid Phase 1 submissions are validated but never persisted or executed', async () => {
  const state = env();
  const response = await auditApi.fetch(request('/audit/v1/jobs', {
    method: 'POST',
    headers: { ...bearer('audit-submit-test-key'), 'content-type': 'application/json' },
    body: JSON.stringify(validJob)
  }), state);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: {
      code: 'execution_plane_unavailable',
      message: 'Submitted Audit execution is disabled until the hardened executor is approved'
    },
    capabilities: { executionEnabled: false, executionState: 'awaiting_executor' }
  });
  assert.deepEqual(state.AUDIT_NONCE_STORE.usage(), { classA: 0, classB: 0, free: 0, storedBytes: 0 });
});

test('forbidden nested fields fail before any store call', async () => {
  const state = env();
  const response = await auditApi.fetch(request('/audit/v1/jobs', {
    method: 'POST',
    headers: { ...bearer('audit-submit-test-key'), 'content-type': 'application/json' },
    body: JSON.stringify({ ...validJob, configuration: { nested: { command: 'forge test' } } })
  }), state);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'forbidden_field');
  assert.deepEqual(state.AUDIT_NONCE_STORE.usage(), { classA: 0, classB: 0, free: 0, storedBytes: 0 });
});

test('valid internal signatures are accepted once and replay is rejected', async () => {
  const state = env();
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = 'nonce-0123456789abcdef';
  const headers = await signInternalRequest({
    key: state.AUDIT_INTERNAL_SERVICE_KEY,
    timestamp,
    nonce,
    method: 'POST',
    path: '/audit-internal/v1/ping',
    body: '{}'
  });
  const first = await auditApi.fetch(request('/audit-internal/v1/ping', {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{}'
  }), state);
  assert.equal(first.status, 200);
  const replay = await auditApi.fetch(request('/audit-internal/v1/ping', {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{}'
  }), state);
  assert.equal(replay.status, 409);
  assert.equal((await replay.json()).error.code, 'replay_detected');
  assert.equal(state.AUDIT_NONCE_STORE.usage().classA, 2);
});

test('expired and invalid internal signatures are rejected before nonce-store writes', async () => {
  for (const mode of ['expired', 'invalid']) {
    const state = env();
    const timestamp = Math.floor(Date.now() / 1000) - (mode === 'expired' ? 1000 : 0);
    const headers = await signInternalRequest({
      key: state.AUDIT_INTERNAL_SERVICE_KEY,
      timestamp,
      nonce: `nonce-${mode}-0123456789`,
      method: 'POST',
      path: '/audit-internal/v1/ping',
      body: '{}'
    });
    if (mode === 'invalid') headers['x-audit-signature'] = '00'.repeat(32);
    const response = await auditApi.fetch(request('/audit-internal/v1/ping', {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{}'
    }), state);
    assert.equal(response.status, 401);
    assert.deepEqual(state.AUDIT_NONCE_STORE.usage(), { classA: 0, classB: 0, free: 0, storedBytes: 0 });
  }
});
