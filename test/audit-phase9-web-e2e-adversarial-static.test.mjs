import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const inertFixturePath = path.join(root, 'test/fixtures/audit-phase9-web/inert-data-v1.json');
const adversarialFixturePath = path.join(root, 'test/fixtures/audit-phase9-web/adversarial-v1.mjs');
const appPath = path.join(root, 'apps/audit-web/src/app.mjs');
const clientPath = path.join(root, 'apps/audit-web/src/client.mjs');
const pagesPath = path.join(root, 'apps/audit-web/src/pages.mjs');
const vmPath = path.join(root, 'packages/audit-report-view-model/src/index.mjs');

async function load(file) {
  assert.equal(fs.existsSync(file), true, `expected ${path.relative(root, file)} to exist`);
  return import(`${pathToFileURL(file).href}?v=${Date.now()}-${Math.random()}`);
}

function readInertData() {
  assert.equal(fs.existsSync(inertFixturePath), true, 'expected inert route fixture');
  return JSON.parse(fs.readFileSync(inertFixturePath, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function createFixtureApp() {
  const fixtures = readInertData();
  const { createAuditClient } = await load(clientPath);
  const { createAuditApp } = await load(appPath);
  const requested = [];
  const focused = [];
  const client = createAuditClient({
    transport: async ({ path: requestPath, method, headers }) => {
      requested.push({ path: requestPath, method, headers });
      if (!Object.hasOwn(fixtures.routes, requestPath)) throw new Error('fixture route missing');
      return clone(fixtures.routes[requestPath]);
    }
  });
  return {
    app: createAuditApp({ client, focus: (target) => focused.push(target) }),
    requested,
    focused,
    fixtures
  };
}

test('repository-owned inert fixture covers all end-to-end route resources', () => {
  const fixtures = readInertData();
  assert.equal(fixtures.version, 'audit-phase9-web-inert/v1');
  const expected = [
    '/api/audit/catalog',
    '/api/audit/campaigns/campaign-1',
    '/api/audit/jobs/job-1',
    '/api/audit/reports/report-1',
    '/api/audit/forks/fork-1',
    '/api/audit/clean-room/clean-1',
    '/api/audit/diagnostics',
    '/api/audit/reports'
  ];
  assert.deepEqual(Object.keys(fixtures.routes).sort(), expected.sort());
});

test('inert browse catalog to campaign job report and evidence journey remains read-only', async () => {
  const { app, requested, focused } = await createFixtureApp();
  const catalog = await app.navigate('/catalog');
  assert.match(catalog.html, /Report browser/);
  assert.match(catalog.html, /Execution is not enabled by this catalog/);

  const campaign = await app.navigate('/campaigns/campaign-1');
  assert.match(campaign.html, /Audit campaign one/);
  assert.match(campaign.html, /href="\/jobs\/job-1"/);

  const job = await app.navigate('/jobs/job-1');
  assert.match(job.html, /Completed/);
  assert.match(job.html, /href="\/reports\/report-1"/);

  const report = await app.navigate('/reports/report-1');
  assert.match(report.html, /Evidence summary/);
  assert.match(report.html, /Invariant finding/);
  assert.match(report.html, /href="\/evidence\/evidence-1"/);

  assert.deepEqual(requested.map((entry) => entry.path), [
    '/api/audit/catalog',
    '/api/audit/campaigns/campaign-1',
    '/api/audit/jobs/job-1',
    '/api/audit/reports/report-1'
  ]);
  assert.ok(requested.every((entry) => entry.method === 'GET'));
  assert.ok(requested.every((entry) => entry.headers.accept === 'application/json'));
  assert.deepEqual(focused, ['main-heading', 'main-heading', 'main-heading', 'main-heading']);
  assert.doesNotMatch(`${catalog.html}${campaign.html}${job.html}${report.html}`, /<button[^>]*>\s*(?:Run|Retry|Execute|Delete|Export)/i);
});

test('inert persistent-fork journey shows lifecycle facts without mutation controls', async () => {
  const { app } = await createFixtureApp();
  const fork = await app.navigate('/forks/fork-1');
  assert.match(fork.html, /Persistent fork summary/);
  assert.match(fork.html, /Export status/);
  assert.match(fork.html, /exported/);
  assert.match(fork.html, /Delete status/);
  assert.match(fork.html, /not-requested/);
  assert.match(fork.html, /Checkpoint one/);
  assert.match(fork.html, /Open export/);
  assert.doesNotMatch(fork.html, /<button/);
});

test('inert clean-room journey renders controlled merge and visible provenance only', async () => {
  const { app } = await createFixtureApp();
  const clean = await app.navigate('/clean-room/clean-1');
  assert.match(clean.html, /merge-1/);
  assert.match(clean.html, /Visible source/);
  assert.doesNotMatch(clean.html, /HIDDEN-SOURCE-MARKER/);
  assert.doesNotMatch(clean.html, /NOT-ALLOWLISTED-MARKER/);
});

test('operator transport failure renders a bounded recoverable state and later navigation succeeds', async () => {
  const { createAuditClient } = await load(clientPath);
  const { createAuditApp } = await load(appPath);
  let attempt = 0;
  const client = createAuditClient({
    transport: async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('token=SECRET https://private.test /home/operator/file');
      return [];
    }
  });
  const app = createAuditApp({ client });
  const failed = await app.navigate('/reports');
  assert.equal(failed.error, true);
  assert.equal(failed.errorCode, 'UI_CLIENT_TRANSPORT');
  assert.match(failed.html, /role="alert"/);
  assert.match(failed.html, /Unable to load audit data/);
  assert.doesNotMatch(failed.html, /SECRET|private\.test|\/home\/operator/);

  const recovered = await app.navigate('/reports');
  assert.equal(recovered.error, false);
  assert.match(recovered.html, /No reports match the current filters/);
  assert.equal(app.current().error, false);
});

test('adversarial report fixture neutralizes XSS, unsafe URL, prototype, accessor, sparse, cycle, oversize, Unicode, controls, and secrets', async () => {
  const { createAdversarialFixtures } = await load(adversarialFixturePath);
  const { createReportViewModel, createDiagnosticViewModel } = await load(vmPath);
  const { renderReportDetailPage } = await load(pagesPath);
  const suite = createAdversarialFixtures();
  const report = createReportViewModel(suite.report);
  const html = renderReportDetailPage(suite.report);
  const diagnostic = createDiagnosticViewModel(suite.diagnostic);

  assert.equal(suite.accessorCalls(), 0);
  assert.equal('inheritedSecret' in report, false);
  assert.equal(report.sourceUrl, null);
  assert.equal(report.evidence.length, 2);
  assert.ok(report.title.length <= 240);
  assert.doesNotMatch(report.title, /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/);
  assert.doesNotMatch(html, /<(?:script|svg|img)\b/i);
  assert.doesNotMatch(html, /javascript:/i);
  assert.doesNotMatch(`${diagnostic.message} ${diagnostic.details}`, /fixture-secret|Bearer fixture-token|https:\/\/private\.test|\/home\/fixture/);
  assert.match(diagnostic.details, /\[redacted-secret\]/);
  assert.equal(Object.isFrozen(report), true);
  assert.equal(Object.isFrozen(report.evidence), true);
});

test('adversarial injected payload never invokes accessors and bounds cycles, sparse arrays, prototypes, and collection size', async () => {
  const { createAdversarialFixtures } = await load(adversarialFixturePath);
  const { createAuditClient } = await load(clientPath);
  const suite = createAdversarialFixtures();
  const client = createAuditClient({ transport: async () => suite.clientPayload });
  const payload = await client.request('/api/audit/reports');
  assert.equal(suite.accessorCalls(), 0);
  assert.equal(payload.inheritedSecret, undefined);
  assert.equal(payload.token, undefined);
  assert.equal(payload.self, null);
  assert.equal(payload.items.length, 100);
  assert.equal(Object.isFrozen(payload), true);
  assert.equal(Object.isFrozen(payload.items), true);
});

test('owned production source proves static execution and persistence boundaries', () => {
  const roots = [
    path.join(root, 'apps/audit-web/src'),
    path.join(root, 'packages/audit-report-view-model/src'),
    path.join(root, 'packages/audit-ui-contracts/src')
  ];
  const files = roots.flatMap((directory) => fs.readdirSync(directory).filter((name) => /\.(?:mjs|js|css)$/.test(name)).map((name) => path.join(directory, name)));
  const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  const forbidden = [
    /\bwindow\.ethereum\b/i,
    /\b(?:wallet|signer|signTransaction|sendTransaction|broadcastTransaction)\b/i,
    /\b(?:deploy|deployment)\b/i,
    /\brpc\b/i,
    /\beval\s*\(/,
    /new\s+Function\b/,
    /node:child_process/,
    /\b(?:exec|execFile|spawn|fork)Sync?\s*\(/,
    /\bfetch\s*\(/,
    /XMLHttpRequest|WebSocket/,
    /\b(?:npm\s+install|pnpm\s+add|yarn\s+add)\b/i,
    /\.github\/workflows/,
    /localStorage|sessionStorage|indexedDB|document\.cookie/
  ];
  for (const pattern of forbidden) assert.doesNotMatch(source, pattern);
  const endpoints = [...source.matchAll(/['"`]([^'"`]*\/api\/[^'"`]*)['"`]/g)].map((match) => match[1]);
  assert.ok(endpoints.length >= 10);
  assert.ok(endpoints.every((endpoint) => endpoint === '/api/audit' || endpoint.startsWith('/api/audit/')));
});
