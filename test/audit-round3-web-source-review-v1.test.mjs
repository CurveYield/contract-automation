import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const file = (value) => path.join(root, value);
const load = (value) => import(`${pathToFileURL(file(value)).href}?v=${Date.now()}-${Math.random()}`);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test('Round 3 strict contracts cover complete compatibility and operator entities', async () => {
  const { UI_ENTITY_KINDS_V2, UI_CONTRACTS_V2 } = await load('packages/audit-ui-contracts/src/index.mjs');
  const required = [
    'capability', 'catalogTool', 'workspace', 'campaign', 'job', 'evidence', 'report',
    'fork', 'checkpoint', 'export', 'cleanRoomCampaign', 'merge', 'provenance',
    'quota', 'retention', 'operationBudget', 'profile', 'parser', 'result',
    'githubDirectStatus', 'releaseProvenance', 'diagnostic'
  ];
  assert.deepEqual(UI_ENTITY_KINDS_V2, required);
  assert.deepEqual(Object.keys(UI_CONTRACTS_V2), required);
});

test('contract and view-model boundaries convert revoked proxies to bounded safe failures', async () => {
  const { parseUiEntity, readUiEntityData, UiContractError } = await load('packages/audit-ui-contracts/src/index.mjs');
  const { createReportViewModel } = await load('packages/audit-report-view-model/src/index.mjs');
  const { proxy, revoke } = Proxy.revocable({ id: 'r', title: 'R', status: 'published' }, {});
  revoke();
  assert.throws(() => parseUiEntity('report', proxy), (error) => error instanceof UiContractError && error.code === 'UI_CONTRACT_INPUT');
  assert.deepEqual(readUiEntityData('report', proxy), Object.create(null));
  assert.deepEqual(createReportViewModel(proxy), {
    id: '', title: '', status: 'unknown', createdAt: null, sourceUrl: null, evidence: []
  });
});

test('safe URL policy rejects fragments while retaining bounded prior http compatibility', async () => {
  const { toSafeUrl } = await load('packages/audit-report-view-model/src/index.mjs');
  assert.equal(toSafeUrl('/reports/r-1#token=secret'), null);
  assert.equal(toSafeUrl('https://example.test/report#private'), null);
  assert.equal(toSafeUrl('http://example.test/report'), 'http://example.test/report');
});

test('route registry accepts query state, never throws on malformed encoding, and covers Round 3 pages', async () => {
  const { AUDIT_ROUTES_V2, resolveAuditRoute } = await load('apps/audit-web/src/routes.mjs');
  const names = AUDIT_ROUTES_V2.map((entry) => entry.name);
  for (const name of ['profiles', 'profileDetail', 'parserDetail', 'resultDetail', 'githubDirectStatus', 'operations', 'releaseProvenance']) {
    assert.ok(names.includes(name), name);
  }
  const reports = resolveAuditRoute('/reports?page=2&sort=title-asc');
  assert.equal(reports.name, 'reports');
  assert.deepEqual(reports.query, { page: '2', sort: 'title-asc' });
  assert.doesNotThrow(() => resolveAuditRoute('/reports/%ZZ'));
  assert.equal(resolveAuditRoute('/reports/%ZZ').name, 'notFound');
});

test('lifecycle registry names every Round 3 state without invented progress', async () => {
  const { lifecycleState } = await load('packages/audit-report-view-model/src/index.mjs');
  const expected = {
    admitted: 'Admitted',
    'running-model-only': 'Model analysis in progress',
    timeout: 'Timed out',
    restored: 'Restored',
    tombstoned: 'Tombstoned'
  };
  for (const [status, label] of Object.entries(expected)) {
    assert.deepEqual(lifecycleState(status).label, label);
  }
});

test('clean-room view model requires explicit visible-resource membership and leaks no hidden counts', async () => {
  const { createCleanRoomViewModel } = await load('packages/audit-report-view-model/src/index.mjs');
  const base = {
    id: 'clean-1', name: 'Clean', status: 'review', visibleResourceIds: [],
    provenance: [
      { id: 'p-1', sourceType: 'commit', sourceId: 'hidden', label: 'hidden', visible: true },
      { id: 'p-2', sourceType: 'commit', sourceId: 'also-hidden', label: 'hidden2', visible: false }
    ],
    merges: [{ id: 'm-hidden', status: 'completed', visible: false }]
  };
  const model = createCleanRoomViewModel(base);
  assert.deepEqual(model.provenance, []);
  assert.deepEqual(model.merges, []);
  assert.equal('hiddenResourceCount' in model, false);
});

test('diagnostic redaction removes root paths, stack traces, URLs, and attacker text', async () => {
  const { createDiagnosticViewModel } = await load('packages/audit-report-view-model/src/index.mjs');
  const model = createDiagnosticViewModel({
    code: 'ERR',
    message: 'Error: boom\n at attacker (/root/private/app.mjs:10:2) https://private.test/x?token=y',
    details: '<img onerror=alert(1)> token=secret'
  });
  const text = `${model.message} ${model.details}`;
  for (const forbidden of ['/root/private', 'attacker', 'https://private.test', 'token=secret', '<img']) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});

test('safe client handles revoked proxies and prevents __proto__ pollution', async () => {
  const { createAuditClient } = await load('apps/audit-web/src/client.mjs');
  const { proxy, revoke } = Proxy.revocable({ value: 1 }, {});
  revoke();
  const client = createAuditClient({ transport: async () => proxy });
  assert.deepEqual(await client.request('/api/audit/reports'), null);

  const polluted = JSON.parse('{"safe":1,"__proto__":{"polluted":true},"constructor":{"prototype":{"bad":true}}}');
  const second = createAuditClient({ transport: async () => polluted });
  const output = await second.request('/api/audit/reports');
  assert.equal(output.safe, 1);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.hasOwn(output, 'constructor'), false);
  assert.equal(Object.getPrototypeOf(output), Object.prototype);
});

test('safe client deduplicates identical in-flight reads instead of cancelling them', async () => {
  const { createAuditClient } = await load('apps/audit-web/src/client.mjs');
  const gate = deferred();
  let calls = 0;
  const client = createAuditClient({ transport: async () => { calls += 1; return gate.promise; } });
  const first = client.request('/api/audit/reports', { slot: 'route' });
  const second = client.request('/api/audit/reports', { slot: 'route' });
  assert.equal(calls, 1);
  gate.resolve({ reports: [] });
  assert.deepEqual({ ...(await first) }, { reports: [] });
  assert.deepEqual({ ...(await second) }, { reports: [] });
});

test('safe client sends ETag validators and serves a scoped cached body on 304/offline recovery', async () => {
  const { createAuditClient } = await load('apps/audit-web/src/client.mjs');
  const calls = [];
  const client = createAuditClient({
    transport: async (request) => {
      calls.push(request);
      if (calls.length === 1) return { status: 200, etag: '"reports-v1"', body: { items: ['a'] } };
      if (calls.length === 2) return { status: 304, etag: '"reports-v1"' };
      throw Object.assign(new Error('offline'), { code: 'OFFLINE' });
    }
  });
  assert.deepEqual({ ...(await client.request('/api/audit/reports', { slot: 'reports', cacheScope: 'workspace-1' })) }, { items: ['a'] });
  assert.equal(calls[0].headers['if-none-match'], undefined);
  assert.deepEqual({ ...(await client.request('/api/audit/reports', { slot: 'reports', cacheScope: 'workspace-1' })) }, { items: ['a'] });
  assert.equal(calls[1].headers['if-none-match'], '"reports-v1"');
  const stale = await client.request('/api/audit/reports', { slot: 'reports', cacheScope: 'workspace-1', allowStaleOnError: true });
  assert.equal(stale.__auditCacheState, 'offline-stale');
  assert.deepEqual({ ...stale.value }, { items: ['a'] });
});

test('application exposes loading, history, unauthorized, and latest-navigation state truthfully', async () => {
  const { createAuditApp } = await load('apps/audit-web/src/app.mjs');
  const gate = deferred();
  const historyCalls = [];
  const stateCalls = [];
  let mode = 'load';
  const client = {
    request: async () => {
      if (mode === 'load') return gate.promise;
      throw Object.assign(new Error('denied'), { code: 'UI_CLIENT_UNAUTHORIZED' });
    }
  };
  const app = createAuditApp({
    client,
    history: { push: (path) => historyCalls.push(path), replace: () => {} },
    onState: (state) => stateCalls.push(state.kind)
  });
  const pending = app.navigate('/reports?page=2');
  assert.equal(app.current().kind, 'loading');
  assert.match(app.current().html, /aria-busy="true"/);
  gate.resolve([]);
  const ready = await pending;
  assert.equal(ready.kind, 'ready');
  assert.deepEqual(historyCalls, ['/reports?page=2']);
  mode = 'unauthorized';
  const denied = await app.navigate('/workspaces');
  assert.equal(denied.kind, 'unauthorized');
  assert.match(denied.html, /Access unavailable/);
  assert.deepEqual(stateCalls, ['loading', 'ready', 'loading', 'unauthorized']);
});
