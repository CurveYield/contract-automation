import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiContractError, authenticateAuditRead, createJsonResponse, decodePageCursor,
  encodePageCursor, normalizeApiError, validateExternalValue
} from '../src/index.mjs';

const env = {
  AUDIT_CLIENT_API_KEY: 'client-key',
  AUDIT_GPT_API_KEY: 'gpt-key',
  AUDIT_READ_API_KEY: 'read-key',
  AUDIT_SUBMIT_API_KEY: 'submit-key',
  AUDIT_ADMIN_API_KEY: 'admin-key',
  CORS_ORIGIN: 'https://audit.example'
};
const req = (authorization) => new Request('https://api.example/audit/v1/x', {
  headers: authorization ? { authorization } : {}
});

test('read authentication accepts only exact approved non-empty bearer identities', async () => {
  for (const [token, identity] of [
    ['client-key', 'client'], ['gpt-key', 'gpt'], ['read-key', 'legacy-read'],
    ['submit-key', 'legacy-submit'], ['admin-key', 'legacy-admin']
  ]) {
    assert.equal((await authenticateAuditRead(req(`Bearer ${token}`), env)).identity, identity);
  }
  for (const value of [
    undefined, '', 'Bearer ', 'bearer client-key', 'Bearer  client-key',
    'Basic client-key', 'Bearer edge-secret', 'Bearer lite-secret'
  ]) {
    await assert.rejects(
      () => authenticateAuditRead(req(value), {
        ...env,
        AUDIT_EDGE_CONTROL_PLANE_TOKEN: 'edge-secret',
        CURVEYIELD_LITE_API_KEY: 'lite-secret'
      }),
      (error) => error.code === 'unauthorized'
    );
  }
});

test('external value validation rejects accessors, sparse arrays, cycles, and custom prototypes without invoking getters', () => {
  let invoked = false;
  const accessor = {};
  Object.defineProperty(accessor, 'x', {
    enumerable: true,
    get() { invoked = true; return 1; }
  });
  assert.throws(() => validateExternalValue(accessor), (error) => error.code === 'hostile_object');
  assert.equal(invoked, false);
  const sparse = [];
  sparse.length = 2;
  sparse[1] = 'x';
  assert.throws(() => validateExternalValue(sparse), (error) => error.code === 'sparse_array');
  const cycle = {};
  cycle.self = cycle;
  assert.throws(() => validateExternalValue(cycle), (error) => error.code === 'cyclic_value');
  assert.throws(() => validateExternalValue(Object.create({ x: 1 })), (error) => error.code === 'invalid_plain_object');
});

test('pagination cursors are deterministic, scoped, bounded, and reject tampering', async () => {
  const input = { scope: 'tenant-a/workspace-a', kind: 'reports', after: 'report-0007' };
  const one = await encodePageCursor(input);
  const two = await encodePageCursor(input);
  assert.equal(one, two);
  assert.deepEqual(await decodePageCursor(one, { scope: input.scope, kind: input.kind }), input);
  await assert.rejects(
    () => decodePageCursor(one, { scope: 'tenant-a/workspace-b', kind: 'reports' }),
    (error) => error.code === 'invalid_cursor'
  );
  await assert.rejects(
    () => decodePageCursor(`${one}x`, { scope: input.scope, kind: input.kind }),
    (error) => error.code === 'invalid_cursor'
  );
});

test('JSON responses are canonical, CORS-safe, and private-scope cached without secrets', async () => {
  const response = await createJsonResponse({ b: 2, a: 1 }, {
    status: 200,
    env,
    cache: { tenantId: 'tenant-a', workspaceId: 'workspace-a', route: '/x' }
  });
  assert.equal(await response.text(), '{"a":1,"b":2}');
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://audit.example');
  assert.match(response.headers.get('cache-control'), /^private,/);
  assert.match(response.headers.get('etag'), /^"sha256-[A-Za-z0-9_-]+"$/);
  assert.equal(response.headers.get('etag').includes('client-key'), false);
});

test('error normalization redacts tokens, URLs, host paths, headers, and attacker text', () => {
  const cause = new Error('Authorization: Bearer supersecret https://evil.example/x C:\\Users\\alice\\secret.txt /home/alice/secret.txt TOKEN=hunter2');
  cause.details = { headers: { authorization: 'Bearer abc' }, nested: ['https://evil.example', '/etc/passwd'] };
  const normalized = normalizeApiError(cause);
  const serialized = JSON.stringify(normalized);
  for (const secret of ['supersecret', 'evil.example', 'alice', 'hunter2', '/etc/passwd', 'Bearer abc']) {
    assert.equal(serialized.includes(secret), false);
  }
  assert.equal(normalized.error.code, 'internal_error');
  assert.ok(Object.isFrozen(normalized));
});

test('ApiContractError exposes stable bounded code and path only', () => {
  const error = new ApiContractError('invalid_cursor', 'attacker '.repeat(1000), `$.${'x'.repeat(1000)}`);
  assert.equal(error.code, 'invalid_cursor');
  assert.ok(error.message.length <= 160);
  assert.ok(error.path.length <= 120);
});
