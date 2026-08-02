import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const vmPath = path.join(root, 'packages/audit-report-view-model/src/index.mjs');
const pagesPath = path.join(root, 'apps/audit-web/src/pages.mjs');
const clientPath = path.join(root, 'apps/audit-web/src/client.mjs');
const layoutPath = path.join(root, 'apps/audit-web/src/layout.mjs');
const appPath = path.join(root, 'apps/audit-web/src/app.mjs');
const cssPath = path.join(root, 'apps/audit-web/src/styles.css');

async function load(file) {
  assert.equal(fs.existsSync(file), true, `expected ${path.relative(root, file)} to exist`);
  return import(`${pathToFileURL(file).href}?v=${Date.now()}-${Math.random()}`);
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('diagnostic view model bounds fields and redacts secrets, raw URLs, and host paths', async () => {
  const { createDiagnosticViewModel } = await load(vmPath);
  const model = createDiagnosticViewModel({
    code: 'quota exceeded<script>',
    message: 'Bearer abc.def.ghi failed at https://host.test/private?token=super-secret from /home/alice/project/file.js and C:\\Users\\Alice\\key.txt',
    correlationId: 'corr-123',
    retryAfterSeconds: 999999,
    quotaRemaining: -5,
    retentionDays: 99999,
    publicationStatus: 'partial',
    staleState: true,
    details: 'api_key=xyz password=hunter2 Authorization: Basic deadbeef'
  });
  assert.equal(model.code, 'QUOTA-EXCEEDEDSCRIPT');
  assert.equal(model.retryAfterSeconds, 86400);
  assert.equal(model.quotaRemaining, 0);
  assert.equal(model.retentionDays, 3650);
  assert.equal(model.publicationStatus, 'partial');
  assert.equal(model.staleState, true);
  for (const forbidden of ['abc.def.ghi', 'super-secret', 'https://', '/home/alice', 'C:\\Users', 'xyz', 'hunter2', 'deadbeef']) {
    assert.equal(`${model.message} ${model.details}`.includes(forbidden), false, forbidden);
  }
  assert.match(model.message, /\[redacted-url\]/);
  assert.match(model.message, /\[redacted-path\]/);
  assert.match(model.details, /\[redacted-secret\]/);
  assert.equal(Object.isFrozen(model), true);
});

test('operator diagnostics render all bounded operational fields with expandable details', async () => {
  const { renderDiagnosticsPage } = await load(pagesPath);
  const html = renderDiagnosticsPage([{
    code: 'STALE_STATE',
    message: 'State changed before publication',
    correlationId: 'corr-1',
    retryAfterSeconds: 30,
    quotaRemaining: 12,
    retentionDays: 14,
    publicationStatus: 'partial',
    staleState: true,
    details: 'Detail '.repeat(100) + 'token=must-not-render'
  }]);
  for (const label of ['Correlation ID', 'Retry after', 'Quota remaining', 'Retention', 'Publication', 'Stale-state conflict']) {
    assert.match(html, new RegExp(label));
  }
  assert.match(html, /<details class="expandable">/);
  assert.match(html, /<summary>Show full details<\/summary>/);
  assert.doesNotMatch(html, /must-not-render/);
  assert.match(html, /data-copy-value="corr-1"/);
});

test('accessible rendered structures use captions, scopes, details, focus targets, and copy-safe identifiers', async () => {
  const { renderAuditPage } = await load(pagesPath);
  const reportHtml = renderAuditPage('reportDetail', {
    id: 'r-' + 'x'.repeat(400), title: 'Long report', status: 'published',
    evidence: [{ id: 'e-1', title: 'Evidence', severity: 'medium', summary: 'S', url: '/evidence/e-1' }]
  });
  assert.match(reportHtml, /<caption>Evidence summary<\/caption>/);
  assert.match(reportHtml, /scope="col"/);
  assert.match(reportHtml, /scope="row"/);
  assert.match(reportHtml, /id="main-heading"/);
  assert.match(reportHtml, /tabindex="-1"/);
  const copyValue = reportHtml.match(/data-copy-value="([^"]+)"/)?.[1];
  assert.ok(copyValue.length <= 160);
  assert.doesNotMatch(copyValue, /\s/);
});

test('layout contract defines mobile, tablet, and desktop modes with bounded widths', async () => {
  const { VIEWPORT_CASES, getLayoutMode } = await load(layoutPath);
  assert.deepEqual(VIEWPORT_CASES, [
    { name: 'mobile', width: 360, mode: 'stacked' },
    { name: 'tablet', width: 768, mode: 'split' },
    { name: 'desktop', width: 1280, mode: 'wide' }
  ]);
  assert.equal(getLayoutMode(320), 'stacked');
  assert.equal(getLayoutMode(600), 'split');
  assert.equal(getLayoutMode(899), 'split');
  assert.equal(getLayoutMode(900), 'wide');
  assert.equal(getLayoutMode(Number.POSITIVE_INFINITY), 'wide');
});

test('responsive CSS covers overflow, visible focus, two breakpoints, and reduced motion', () => {
  assert.equal(fs.existsSync(cssPath), true, 'expected responsive stylesheet');
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\s*\(min-width:\s*600px\)/);
  assert.match(css, /@media\s*\(min-width:\s*900px\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /overflow-x:\s*auto/);
  assert.doesNotMatch(css, /width:\s*\d{4,}px/);
});

test('safe client rejects external and secret-bearing paths before transport invocation', async () => {
  const { createAuditClient, AuditClientError } = await load(clientPath);
  let calls = 0;
  const client = createAuditClient({ transport: async () => { calls += 1; return {}; } });
  for (const unsafe of ['https://evil.test/a', '//evil.test/a', '/api/audit/reports?token=secret', '/outside/path', 'x'.repeat(3000)]) {
    await assert.rejects(
      client.request(unsafe),
      (error) => error instanceof AuditClientError && error.code === 'UI_CLIENT_UNSAFE_PATH'
    );
  }
  assert.equal(calls, 0);
});

test('safe client cancels the prior request in the same slot', async () => {
  const { createAuditClient, AuditClientError } = await load(clientPath);
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
  const second = client.request('/api/audit/workspaces', { slot: 'route' });
  assert.equal(requests[0].signal.aborted, true);
  requests[1].gate.resolve({ items: ['workspace'] });
  await assert.rejects(first, (error) => error instanceof AuditClientError && error.code === 'UI_CLIENT_ABORTED');
  assert.deepEqual(await second, { items: ['workspace'] });
});

test('safe client rejects stale responses even when transport ignores abort', async () => {
  const { createAuditClient, AuditClientError } = await load(clientPath);
  const gates = [];
  const client = createAuditClient({
    transport: () => {
      const gate = deferred();
      gates.push(gate);
      return gate.promise;
    }
  });
  const first = client.request('/api/audit/reports', { slot: 'route' });
  const second = client.request('/api/audit/workspaces', { slot: 'route' });
  gates[1].resolve({ id: 'new' });
  assert.deepEqual(await second, { id: 'new' });
  gates[0].resolve({ id: 'old' });
  await assert.rejects(first, (error) => error instanceof AuditClientError && error.code === 'UI_CLIENT_STALE_RESPONSE');
});

test('safe client strips credential-shaped fields and hostile accessors from returned view state', async () => {
  const { createAuditClient } = await load(clientPath);
  let getterCalls = 0;
  const payload = { id: 'safe', token: 'secret', password: 'hidden', nested: { authorization: 'Bearer no', value: 7 } };
  Object.defineProperty(payload, 'danger', { enumerable: true, get() { getterCalls += 1; return 'boom'; } });
  const client = createAuditClient({ transport: async () => payload });
  const result = await client.request('/api/audit/reports');
  assert.deepEqual(result, { id: 'safe', nested: { value: 7 } });
  assert.equal(getterCalls, 0);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.nested), true);
  assert.equal('token' in result, false);
});

test('client source contains no persistence or logging sink for credentials', () => {
  assert.equal(fs.existsSync(clientPath), true, 'expected client source');
  const source = fs.readFileSync(clientPath, 'utf8');
  for (const forbidden of ['localStorage', 'sessionStorage', 'indexedDB', 'console.log', 'console.error', 'document.cookie']) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test('application navigation restores focus after the latest route render', async () => {
  const { createAuditApp } = await load(appPath);
  const focusCalls = [];
  const client = {
    request: async (resource) => resource.endsWith('/reports') ? [] : { id: 'job-1', title: 'Job', status: 'pending' }
  };
  const app = createAuditApp({ client, focus: (id) => focusCalls.push(id) });
  const reports = await app.navigate('/reports');
  const job = await app.navigate('/jobs/job-1');
  assert.equal(reports.route.name, 'reports');
  assert.equal(job.route.name, 'jobDetail');
  assert.deepEqual(focusCalls, ['main-heading', 'main-heading']);
  assert.equal(app.current().route.name, 'jobDetail');
  assert.equal(Object.isFrozen(job), true);
});

test('frozen diagnostic and client outputs resist representative mutations', async () => {
  const { createDiagnosticViewModel } = await load(vmPath);
  const { createAuditClient } = await load(clientPath);
  const diagnostic = createDiagnosticViewModel({ code: 'ERR', message: 'safe' });
  const client = createAuditClient({ transport: async () => ({ list: [{ id: 'a' }] }) });
  const payload = await client.request('/api/audit/reports');
  const mutationAttempts = [
    () => { diagnostic.code = 'CHANGED'; },
    () => { diagnostic.extra = true; },
    () => { payload.list = []; },
    () => { payload.list.push({ id: 'b' }); },
    () => { payload.list[0].id = 'changed'; },
    () => { delete payload.list[0].id; }
  ];
  for (const mutate of mutationAttempts) assert.throws(mutate, TypeError);
  assert.equal(mutationAttempts.length, 6);
});
