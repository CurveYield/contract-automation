import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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

test('operator diagnostics render actionable bounded facts without announcing every persisted item as an alert', async () => {
  const { renderDiagnosticsPage } = await load('apps/audit-web/src/pages.mjs');
  const html = renderDiagnosticsPage([{
    code: 'STALE_CAS', message: 'State changed before publication', correlationId: 'corr-1',
    retryAfterSeconds: 30, quotaRemaining: 5, retentionDays: 14, publicationStatus: 'partial',
    staleState: true, retryPlan: 'Refresh status and compare the latest revision.',
    transportState: 'offline', reportId: 'report-1', details: 'bounded detail'
  }]);
  for (const label of ['Retry plan', 'Transport state', 'Report reference', 'Partial publication', 'Stale-state conflict']) assert.match(html, new RegExp(label));
  assert.match(html, /href="\/reports\/report-1"/);
  assert.doesNotMatch(html, /<p role="alert">/);
  assert.match(html, /role="status"/);
});

test('safe client converts revoked proxies to null and uses prototype-safe records without dangerous own keys', async () => {
  const { createAuditClient } = await load('apps/audit-web/src/client.mjs');
  const { proxy, revoke } = Proxy.revocable({ id: 'revoked' }, {});
  revoke();
  const first = createAuditClient({ transport: async () => proxy });
  assert.equal(await first.request('/api/audit/reports'), null);

  const source = JSON.parse('{"safe":1,"__proto__":{"polluted":true},"constructor":{"prototype":{"bad":true}},"prototype":{"bad":true}}');
  const second = createAuditClient({ transport: async () => source });
  const output = await second.request('/api/audit/reports');
  assert.equal(output.safe, 1);
  assert.equal(Object.getPrototypeOf(output), Object.prototype);
  assert.equal(Object.hasOwn(output, 'constructor'), false);
  assert.equal(Object.hasOwn(output, 'prototype'), false);
  assert.equal({}.polluted, undefined);
});

test('safe client deduplicates identical in-flight reads and different route reads cancel prior work', async () => {
  const { createAuditClient, AuditClientError } = await load('apps/audit-web/src/client.mjs');
  const requests = [];
  const client = createAuditClient({
    transport: ({ path: requestPath, signal }) => {
      const gate = deferred();
      signal.addEventListener('abort', () => gate.reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
      requests.push({ requestPath, signal, gate });
      return gate.promise;
    }
  });
  const first = client.request('/api/audit/reports', { slot: 'route' });
  const duplicate = client.request('/api/audit/reports', { slot: 'route' });
  assert.equal(requests.length, 1);
  requests[0].gate.resolve({ items: ['report'] });
  assert.deepEqual({ ...(await first) }, { items: ['report'] });
  assert.deepEqual({ ...(await duplicate) }, { items: ['report'] });

  const oldRequest = client.request('/api/audit/reports?page=2', { slot: 'route' });
  const oldOutcome = oldRequest.catch((error) => error);
  const newRequest = client.request('/api/audit/workspaces', { slot: 'route' });
  assert.equal(requests[1].signal.aborted, true);
  requests[2].gate.resolve({ items: ['workspace'] });
  const oldError = await oldOutcome;
  assert.ok(oldError instanceof AuditClientError);
  assert.equal(oldError.code, 'UI_CLIENT_ABORTED');
  assert.deepEqual({ ...(await newRequest) }, { items: ['workspace'] });
});

test('safe client uses bounded scoped ETags and matching 304 cache only', async () => {
  const { createAuditClient, AuditClientError } = await load('apps/audit-web/src/client.mjs');
  const calls = [];
  const client = createAuditClient({
    transport: async (request) => {
      calls.push(request);
      if (calls.length === 1) return { status: 200, etag: '"reports-v1"', body: { items: ['a'] } };
      if (calls.length === 2) return { status: 304, etag: '"reports-v1"' };
      return { status: 304, etag: '"reports-v1"' };
    }
  });
  assert.deepEqual({ ...(await client.request('/api/audit/reports', { slot: 'reports', cacheScope: 'workspace-a' })) }, { items: ['a'] });
  assert.equal(calls[0].headers['if-none-match'], undefined);
  assert.deepEqual({ ...(await client.request('/api/audit/reports', { slot: 'reports', cacheScope: 'workspace-a' })) }, { items: ['a'] });
  assert.equal(calls[1].headers['if-none-match'], '"reports-v1"');
  await assert.rejects(
    client.request('/api/audit/reports', { slot: 'reports-b', cacheScope: 'workspace-b' }),
    (error) => error instanceof AuditClientError && error.code === 'UI_CLIENT_CACHE_MISS'
  );
  assert.equal(calls[2].headers['if-none-match'], undefined);
});

test('offline recovery is opt-in, scoped, immutable, and explicitly marked stale', async () => {
  const { createAuditClient, AuditClientError } = await load('apps/audit-web/src/client.mjs');
  let offline = false;
  const client = createAuditClient({
    transport: async () => {
      if (offline) throw Object.assign(new Error('offline'), { code: 'OFFLINE' });
      return { status: 200, etag: '"v1"', body: { items: ['cached'] } };
    }
  });
  await client.request('/api/audit/reports', { cacheScope: 'workspace-a' });
  offline = true;
  await assert.rejects(client.request('/api/audit/reports', { cacheScope: 'workspace-a' }), (error) => error instanceof AuditClientError && error.code === 'UI_CLIENT_OFFLINE');
  const stale = await client.request('/api/audit/reports', { cacheScope: 'workspace-a', allowStaleOnError: true });
  assert.equal(stale.__auditCacheState, 'offline-stale');
  assert.deepEqual({ ...stale.value }, { items: ['cached'] });
  assert.equal(Object.isFrozen(stale), true);
  assert.equal(Object.isFrozen(stale.value), true);
});

test('application concurrent navigation commits only latest content and announces offline-stale state', async () => {
  const { createAuditApp } = await load('apps/audit-web/src/app.mjs');
  const gates = [];
  const states = [];
  const client = {
    request: () => {
      const gate = deferred();
      gates.push(gate);
      return gate.promise;
    }
  };
  const app = createAuditApp({ client, onState: (state) => states.push(state.kind) });
  const oldNavigation = app.navigate('/reports');
  const newNavigation = app.navigate('/workspaces');
  gates[1].resolve([]);
  assert.equal((await newNavigation).route.name, 'workspaces');
  gates[0].resolve([{ id: 'old', title: 'Old', status: 'published' }]);
  assert.equal((await oldNavigation).kind, 'stale');
  assert.equal(app.current().route.name, 'workspaces');

  const staleNavigation = app.navigate('/reports');
  gates[2].resolve({ __auditCacheState: 'offline-stale', value: [] });
  const stale = await staleNavigation;
  assert.equal(stale.kind, 'offline-stale');
  assert.match(stale.html, /Offline data/);
  assert.match(stale.html, /aria-live="polite"/);
  assert.deepEqual(states, ['loading', 'loading', 'ready', 'loading', 'offline-stale']);
});

test('layout contract adds narrow and zoom hostile cases while retaining legacy viewport modes', async () => {
  const { VIEWPORT_CASES, HOSTILE_LAYOUT_CASES, getLayoutMode, getLayoutModeForViewport } = await load('apps/audit-web/src/layout.mjs');
  assert.deepEqual(VIEWPORT_CASES, [
    { name: 'mobile', width: 360, mode: 'stacked' },
    { name: 'tablet', width: 768, mode: 'split' },
    { name: 'desktop', width: 1280, mode: 'wide' }
  ]);
  assert.ok(HOSTILE_LAYOUT_CASES.some((entry) => entry.name === 'narrow-320'));
  assert.ok(HOSTILE_LAYOUT_CASES.some((entry) => entry.name === 'zoom-400'));
  assert.equal(getLayoutMode(900), 'wide');
  assert.equal(getLayoutModeForViewport({ width: 1280, zoom: 4 }), 'stacked');
  assert.equal(getLayoutModeForViewport({ width: 768, zoom: 2 }), 'stacked');
});

test('responsive CSS documents contrast tokens, forced colors, zoom-safe grids, overflow, and reduced motion', () => {
  const css = fs.readFileSync(file('apps/audit-web/src/styles.css'), 'utf8');
  for (const pattern of [
    /--surface:/, /--text:/, /--accent:/, /color:\s*var\(--text\)/,
    /@media\s*\(forced-colors:\s*active\)/, /@media\s*\(prefers-reduced-motion:\s*reduce\)/,
    /overflow-wrap:\s*anywhere/, /overflow-x:\s*auto/, /minmax\(0,\s*1fr\)/,
    /max-inline-size:\s*100%/
  ]) assert.match(css, pattern);
  assert.doesNotMatch(css, /width:\s*\d{4,}px/);
});

test('hostile layout fixture bounds huge counts, long identifiers, partial data, bidi, and graph payloads', async () => {
  const { renderAuditPage } = await load('apps/audit-web/src/pages.mjs');
  const fixture = JSON.parse(fs.readFileSync(file('test/fixtures/audit-round3-web/hostile-layout-v1.json'), 'utf8'));
  assert.equal(fixture.version, 'audit-round3-web-hostile-layout/v1');
  const seed = fixture.reportSeed;
  const reportPayload = {
    id: `report-${'L'.repeat(seed.idLength)}`,
    title: `\u202eHostile report ${'T'.repeat(seed.titleLength)}`,
    status: 'published',
    summary: `partial data ${'S'.repeat(seed.summaryLength)}`,
    references: Array.from({ length: seed.referenceCount }, (_, index) => ({
      id: `reference-${String(index).padStart(3, '0')}`,
      label: `Reference ${'x'.repeat(seed.referenceLabelLength)}`,
      url: `/reports/reference-${String(index).padStart(3, '0')}`
    })),
    evidence: Array.from({ length: seed.evidenceCount }, (_, index) => ({
      id: `evidence-${String(index).padStart(3, '0')}`,
      title: index % 10 === 0 ? '' : `Evidence ${index}`,
      summary: `\u202e${'detail'.repeat(seed.evidenceSummaryRepeats)}`,
      visible: true
    })),
    graph: { nodes: Array.from({ length: seed.graphNodeCount }, (_, index) => ({ id: `n-${index}` })) }
  };
  const report = renderAuditPage('reportDetail', reportPayload);
  const operations = renderAuditPage('operations', fixture.operations);
  assert.ok(report.length < 100_000);
  assert.ok(operations.length < 100_000);
  assert.doesNotMatch(`${report}${operations}`, /[\u202A-\u202E\u2066-\u2069]/);
  assert.doesNotMatch(`${report}${operations}`, /Infinity|NaN|<script/i);
  assert.match(report, /References/);
  assert.match(operations, /1000000000/);
});

test('accessibility review document distinguishes static evidence from browser-only checks', () => {
  const review = fs.readFileSync(file('docs/audit/web/2026-08-01-audit-round3-accessibility-review-v1.md'), 'utf8');
  assert.match(review, /Executed static checks/);
  assert.match(review, /Browser-only checks not executed/);
  assert.match(review, /WCAG 2\.2 AA/);
  assert.match(review, /screen reader/i);
  assert.match(review, /400%/);
});
