import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIT_API_BOUNDS,
  AUDIT_API_CONTRACT_VERSION,
  ApiContractError,
  authenticateAuditRead,
  canonicalJson,
  createJsonResponse,
  normalizeApiError,
  validateExternalValue
} from '../src/index.mjs';

const request = (authorization) => new Request('https://api.example/audit/v1/resource', {
  headers: authorization ? { authorization } : {}
});

test('Round 3 API contract exports exact v2 byte and collection bounds', () => {
  assert.equal(AUDIT_API_CONTRACT_VERSION, 'audit-api-contracts-v2');
  assert.deepEqual(AUDIT_API_BOUNDS, {
    encodedValueBytes: 1_000_000,
    responseBodyBytes: 1_000_000,
    stringBytes: 8_192,
    keyBytes: 160,
    collectionEntries: 1_000,
    nestingDepth: 24,
    cursorBytes: 4_096
  });
  assert.ok(Object.isFrozen(AUDIT_API_BOUNDS));
});

test('external boundaries enforce encoded UTF-8 bytes rather than JavaScript code-unit length', () => {
  const accepted = 'é'.repeat(4_096);
  assert.equal(new TextEncoder().encode(accepted).byteLength, 8_192);
  assert.equal(validateExternalValue(accepted), accepted);
  assert.throws(
    () => validateExternalValue(`${accepted}é`),
    (error) => error.code === 'invalid_string'
  );
  const oversized = { value: 'a'.repeat(AUDIT_API_BOUNDS.encodedValueBytes + 1) };
  assert.throws(
    () => validateExternalValue(oversized),
    (error) => error.code === 'value_too_large'
  );
});

test('authentication rejects duplicate configured credentials before identity matching', async () => {
  const conflicted = {
    AUDIT_CLIENT_API_KEY: 'same-secret',
    AUDIT_GPT_API_KEY: 'same-secret',
    AUDIT_READ_API_KEY: 'read-secret'
  };
  for (const token of ['same-secret', 'read-secret', 'unrelated']) {
    await assert.rejects(
      () => authenticateAuditRead(request(`Bearer ${token}`), conflicted),
      (error) => (
        error.code === 'credential_configuration_conflict' &&
        error.status === 500 &&
        !error.message.includes('same-secret')
      )
    );
  }
});

test('authentication preserves exact identities and rejects mixed-case or internal-whitespace schemes', async () => {
  const env = {
    AUDIT_CLIENT_API_KEY: 'client-secret',
    AUDIT_GPT_API_KEY: 'gpt-secret',
    AUDIT_READ_API_KEY: 'read-secret',
    AUDIT_SUBMIT_API_KEY: 'submit-secret',
    AUDIT_ADMIN_API_KEY: 'admin-secret',
    AUDIT_SERVICE_READ_API_KEY: 'service-secret'
  };
  for (const [token, identity] of [
    ['client-secret', 'client'],
    ['gpt-secret', 'gpt'],
    ['read-secret', 'legacy-read'],
    ['submit-secret', 'legacy-submit'],
    ['admin-secret', 'legacy-admin'],
    ['service-secret', 'service-read']
  ]) {
    assert.equal((await authenticateAuditRead(request(`Bearer ${token}`), env)).identity, identity);
  }
  for (const header of [
    'bearer client-secret', 'BEARER client-secret', 'Bearer  client-secret', 'Bearer\tclient-secret'
  ]) {
    await assert.rejects(
      () => authenticateAuditRead(request(header), env),
      (error) => error.code === 'unauthorized'
    );
  }
  for (const normalizedByWebHeaders of [' Bearer client-secret', 'Bearer client-secret ']) {
    assert.equal(
      (await authenticateAuditRead(request(normalizedByWebHeaders), env)).identity,
      'client'
    );
  }
});

test('configured CORS origin is canonicalized as an origin or fails closed to null', async () => {
  for (const [configured, expected] of [
    ['https://audit.example', 'https://audit.example'],
    ['http://localhost:8787', 'http://localhost:8787'],
    ['null', 'null'],
    ['https://audit.example/path', 'null'],
    ['https://user:pass@audit.example', 'null'],
    ['https://audit.example?x=1', 'null'],
    ['https://audit.example\r\nx-attacker: injected', 'null'],
    ['javascript:alert(1)', 'null'],
    ['', 'null']
  ]) {
    const response = await createJsonResponse({ ok: true }, { env: { CORS_ORIGIN: configured } });
    assert.equal(response.headers.get('access-control-allow-origin'), expected, configured);
  }
});

test('caller response headers cannot override content type, cache policy, CORS, or security headers', async () => {
  const response = await createJsonResponse({ ok: true }, {
    env: { CORS_ORIGIN: 'https://audit.example' },
    cache: {
      tenantId: 'tenant-a',
      workspaceId: 'workspace-a',
      route: '/audit/v1/resource',
      query: ''
    },
    headers: {
      'content-type': 'text/html',
      'cache-control': 'public, max-age=999999',
      'access-control-allow-origin': '*',
      'x-content-type-options': 'off',
      'x-safe-extension': 'allowed'
    }
  });
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.match(response.headers.get('cache-control'), /^private,/);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://audit.example');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-safe-extension'), 'allowed');
});

test('canonical responses and normalized errors are recursively frozen, byte-stable, and bounded', () => {
  const value = { z: ['é', 2], a: { b: true } };
  const one = canonicalJson(value);
  const two = canonicalJson(structuredClone(value));
  assert.equal(one, two);
  const cause = new ApiContractError(
    'invalid_request',
    `Authorization: Bearer secret https://attacker.example ${'x'.repeat(1_000)}`,
    '$.request'
  );
  const normalized = normalizeApiError(cause);
  assert.ok(Object.isFrozen(normalized));
  assert.ok(Object.isFrozen(normalized.body));
  assert.ok(Object.isFrozen(normalized.body.error));
  assert.ok(JSON.stringify(normalized).length < 1_000);
  assert.equal(JSON.stringify(normalized).includes('secret'), false);
  assert.equal(JSON.stringify(normalized).includes('attacker.example'), false);
});
