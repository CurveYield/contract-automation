import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (relative) => import(`${pathToFileURL(path.join(root, relative)).href}?v=${Date.now()}-${Math.random()}`);
function deferred() { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; }

test('identical requests deduplicate while a different route cancels the prior slot', async () => {
  const { createAuditClient, AuditClientError } = await load('apps/audit-web/src/client.mjs');
  const gates = [];
  const client = createAuditClient({ transport: ({ signal }) => { const gate = deferred(); signal.addEventListener('abort', () => gate.reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true }); gates.push(gate); return gate.promise; } });
  const first = client.request('/api/audit/github-direct/status', { slot: 'route' });
  const duplicate = client.request('/api/audit/github-direct/status', { slot: 'route' });
  assert.equal(first, duplicate);
  assert.equal(gates.length, 1);
  const next = client.request('/api/audit/reports', { slot: 'route' });
  assert.equal(gates.length, 2);
  gates[1].resolve({ id: 'report-list' });
  await assert.rejects(first, (error) => error instanceof AuditClientError && error.code === 'UI_CLIENT_ABORTED');
  assert.deepEqual(await next, { id: 'report-list' });
});

test('transport that ignores abort cannot publish a stale response', async () => {
  const { createAuditClient, AuditClientError } = await load('apps/audit-web/src/client.mjs');
  const gates = [];
  const client = createAuditClient({ transport: () => { const gate = deferred(); gates.push(gate); return gate.promise; } });
  const old = client.request('/api/audit/github-direct/status', { slot: 'route' });
  const current = client.request('/api/audit/reports', { slot: 'route' });
  gates[1].resolve({ id: 'current' });
  assert.deepEqual(await current, { id: 'current' });
  gates[0].resolve({ id: 'stale' });
  await assert.rejects(old, (error) => error instanceof AuditClientError && error.code === 'UI_CLIENT_STALE_RESPONSE');
});

test('ETag cache is scoped and supports bounded offline-stale recovery', async () => {
  const { createAuditClient, AuditClientError } = await load('apps/audit-web/src/client.mjs');
  let step = 0;
  const plans = [];
  const client = createAuditClient({ transport: async (plan) => {
    plans.push(plan);
    step += 1;
    if (step === 1) return { status: 200, etag: '"direct-v1"', body: { id: 'direct', token: 'must-strip' } };
    if (step === 2) return { status: 304 };
    if (step === 3) throw Object.assign(new Error('offline'), { code: 'OFFLINE' });
    return { status: 304 };
  } });
  const first = await client.request('/api/audit/github-direct/status', { cacheScope: 'tenant-a' });
  const second = await client.request('/api/audit/github-direct/status', { cacheScope: 'tenant-a' });
  const stale = await client.request('/api/audit/github-direct/status', { cacheScope: 'tenant-a', allowStaleOnError: true });
  assert.deepEqual(first, { id: 'direct' });
  assert.equal(first, second);
  assert.equal(stale.__auditCacheState, 'offline-stale');
  assert.equal(stale.value, first);
  assert.equal(plans[1].headers['if-none-match'], '"direct-v1"');
  await assert.rejects(client.request('/api/audit/github-direct/status', { cacheScope: 'tenant-b' }), (error) => error instanceof AuditClientError && error.code === 'UI_CLIENT_CACHE_MISS');
  assert.equal(plans[3].headers['if-none-match'], undefined);
});

test('client rejects secret-bearing paths/scopes and persists no credentials', async () => {
  const { createAuditClient, AuditClientError } = await load('apps/audit-web/src/client.mjs');
  let calls = 0;
  const client = createAuditClient({ transport: async () => { calls += 1; return {}; } });
  for (const pathValue of ['https://evil.test/a', '/api/audit/x?token=secret', '/outside']) {
    assert.throws(() => client.request(pathValue), (error) => error instanceof AuditClientError && error.code === 'UI_CLIENT_UNSAFE_PATH');
  }
  assert.throws(() => client.request('/api/audit/reports', { cacheScope: 'token:secret' }), (error) => error instanceof AuditClientError && error.code === 'UI_CLIENT_UNSAFE_PATH');
  assert.equal(calls, 0);
});
