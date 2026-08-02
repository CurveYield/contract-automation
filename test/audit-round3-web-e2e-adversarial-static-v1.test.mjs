import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const file = (value) => path.join(root, value);
const load = (value) => import(`${pathToFileURL(file(value)).href}?v=${Date.now()}-${Math.random()}`);
const fixture = () => JSON.parse(fs.readFileSync(file('test/fixtures/audit-round3-web/complete-routes-v1.json'), 'utf8'));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test('inert discovery journey links catalog to profile parser result report and evidence', async () => {
  const { renderAuditPage } = await load('apps/audit-web/src/pages.mjs');
  const data = fixture().routes;
  const catalog = renderAuditPage('catalog', data.catalog);
  const profiles = renderAuditPage('profiles', data.profiles);
  const profile = renderAuditPage('profileDetail', data.profileDetail);
  const parser = renderAuditPage('parserDetail', data.parserDetail);
  const result = renderAuditPage('resultDetail', data.resultDetail);
  const report = renderAuditPage('reportDetail', data.reportDetail);
  assert.match(catalog, /Read reports/);
  assert.match(profiles, /\/profiles\/profile-solidity/);
  assert.match(profile, /\/parsers\/parser-solidity/);
  assert.match(parser, /\/profiles\/profile-solidity/);
  assert.match(result, /\/reports\/report-1/);
  assert.match(report, /Evidence one/);
  for (const html of [catalog, profiles, profile, parser, result, report]) assert.match(html, /Execution is unavailable|Execution unavailable/);
});

test('inert workspace journey links workspace campaign job and immutable report', async () => {
  const { renderAuditPage } = await load('apps/audit-web/src/pages.mjs');
  const data = fixture().routes;
  const workspaces = renderAuditPage('workspaces', data.workspaces);
  const workspace = renderAuditPage('workspaceDetail', data.workspaceDetail);
  const campaign = renderAuditPage('campaignDetail', data.campaignDetail);
  const job = renderAuditPage('jobDetail', data.jobDetail);
  assert.match(workspaces, /\/workspaces\/workspace-1/);
  assert.match(workspace, /\/campaigns\/campaign-1/);
  assert.match(campaign, /\/jobs\/job-1/);
  assert.match(job, /\/reports\/report-1/);
  assert.match(campaign, /Model analysis in progress/);
  assert.doesNotMatch(`${campaign}${job}`, /\b\d{1,3}%\b|\bETA\b|estimated completion/i);
});

test('inert fork and clean-room journeys expose factual lifecycle and allowlisted provenance only', async () => {
  const { renderAuditPage } = await load('apps/audit-web/src/pages.mjs');
  const data = fixture().routes;
  const fork = renderAuditPage('forkDetail', data.forkDetail);
  for (const fact of ['Restored', 'Checkpoint one', 'Export one', 'Restore status', 'Tombstone status']) assert.match(fork, new RegExp(fact));
  assert.doesNotMatch(fork, /<button|method="post"/i);
  const clean = renderAuditPage('cleanRoomDetail', {
    ...data.cleanRoomDetail,
    merges: [...data.cleanRoomDetail.merges, { id: 'merge-hidden', status: 'completed', label: 'HIDDEN-MERGE', visible: false }],
    provenance: [...data.cleanRoomDetail.provenance, { id: 'p-hidden', sourceType: 'commit', sourceId: 'hidden-source', label: 'HIDDEN-SOURCE', visible: true }]
  });
  assert.match(clean, /Visible source/);
  assert.match(clean, /Access status/);
  assert.match(clean, /Share status/);
  assert.doesNotMatch(clean, /HIDDEN-MERGE|HIDDEN-SOURCE|hidden resource|hidden count/i);
});

test('GitHub Direct, operations, release and diagnostic recovery remain status-only', async () => {
  const { renderAuditPage } = await load('apps/audit-web/src/pages.mjs');
  const data = fixture().routes;
  const direct = renderAuditPage('githubDirectStatus', data.githubDirectStatus);
  const operations = renderAuditPage('operations', data.operations);
  const release = renderAuditPage('releaseProvenance', data.releaseProvenance);
  const diagnostics = renderAuditPage('diagnostics', [{
    code: 'RETRYABLE', message: 'Retry the bounded read.', retryAfterSeconds: 5,
    retryPlan: 'Refresh status.', transportState: 'offline', reportId: 'report-1'
  }]);
  assert.match(direct, /Awaiting executor/);
  assert.doesNotMatch(direct, /<button|Submit|Approve|Execute project/i);
  assert.match(operations, /Quota/);
  assert.match(release, /audit-api-public\/v1/);
  assert.match(diagnostics, /Refresh status/);
  assert.match(diagnostics, /\/reports\/report-1/);
});

test('operator error retry and stale-refresh behavior commits only accepted states', async () => {
  const { createAuditApp } = await load('apps/audit-web/src/app.mjs');
  const { createAuditClient } = await load('apps/audit-web/src/client.mjs');
  let calls = 0;
  const client = createAuditClient({
    transport: async () => {
      calls += 1;
      if (calls === 1) return { status: 503, body: { message: 'unavailable' } };
      return { status: 200, etag: '"reports-v1"', body: [] };
    }
  });
  const states = [];
  const app = createAuditApp({ client, onState: (state) => states.push(state.kind) });
  const failed = await app.navigate('/reports');
  assert.equal(failed.kind, 'error');
  const recovered = await app.navigate('/reports');
  assert.equal(recovered.kind, 'ready');
  assert.deepEqual(states, ['loading', 'error', 'loading', 'ready']);
  const gates = [];
  const racing = createAuditApp({ client: { request: () => { const gate = deferred(); gates.push(gate); return gate.promise; } } });
  const old = racing.navigate('/reports');
  const latest = racing.navigate('/workspaces');
  gates[1].resolve([]);
  assert.equal((await latest).route.name, 'workspaces');
  gates[0].resolve([]);
  assert.equal((await old).kind, 'stale');
  assert.equal(racing.current().route.name, 'workspaces');
});

test('one-field contract mutation rejects every missing required field across the v2 registry', async () => {
  const { UI_ENTITY_KINDS_V2, UI_CONTRACTS_V2, parseUiEntity } = await load('packages/audit-ui-contracts/src/index.mjs');
  const valueFor = (key) => key === 'available' ? false : ['remaining', 'days'].includes(key) ? 1 : `${key}-value`;
  let mutations = 0;
  for (const kind of UI_ENTITY_KINDS_V2) {
    const baseline = Object.fromEntries(UI_CONTRACTS_V2[kind].required.map((key) => [key, valueFor(key)]));
    assert.doesNotThrow(() => parseUiEntity(kind, baseline), kind);
    for (const key of UI_CONTRACTS_V2[kind].required) {
      const mutated = { ...baseline };
      delete mutated[key];
      assert.throws(() => parseUiEntity(kind, mutated), { code: 'UI_CONTRACT_MISSING_KEY' });
      mutations += 1;
    }
  }
  assert.ok(mutations >= 40, mutations);
});

test('XSS, unsafe URL and visual-state substitution payloads never become active markup or false status', async () => {
  const { renderAuditPage } = await load('apps/audit-web/src/pages.mjs');
  const { toSafeUrl } = await load('packages/audit-report-view-model/src/index.mjs');
  const unsafe = [
    'javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', '//evil.test/x',
    'https://user:pass@example.test/x', '/reports/x#secret', '/reports/x?token=secret',
    'file:///etc/passwd', 'vbscript:msgbox(1)'
  ];
  for (const value of unsafe) assert.equal(toSafeUrl(value), null, value);
  const html = renderAuditPage('reportDetail', {
    id: 'report-xss', title: '<img src=x onerror=alert(1)>', status: '<span data-status="completed">completed</span>',
    summary: '<script>alert(1)</script>', sourceUrl: 'javascript:alert(1)',
    references: [{ id: 'ref', label: '<svg onload=alert(1)>', url: 'data:text/html,x' }],
    evidence: [{ id: 'e', title: '<iframe srcdoc=x>', summary: '<img onerror=x>', visible: true }]
  });
  assert.doesNotMatch(html, /<script|<img|<svg|<iframe|href="(?:javascript:|data:text\/html)/i);
  assert.doesNotMatch(html, /data-status="completed"/);
});

test('prototype, accessor, revoked proxy, sparse array, cycle and oversize mutations are bounded', async () => {
  const { createAuditClient } = await load('apps/audit-web/src/client.mjs');
  const { createCampaignViewModel, createReportViewModel } = await load('packages/audit-report-view-model/src/index.mjs');
  let getterCalls = 0;
  const hostile = JSON.parse('{"safe":1,"__proto__":{"polluted":true},"constructor":{"prototype":{"bad":true}}}');
  Object.defineProperty(hostile, 'secret', { enumerable: true, get() { getterCalls += 1; return 'secret'; } });
  hostile.self = hostile;
  const client = createAuditClient({ transport: async () => hostile });
  const output = await client.request('/api/audit/reports');
  assert.equal(getterCalls, 0);
  assert.equal(output.safe, 1);
  assert.equal(Object.hasOwn(output, 'constructor'), false);
  assert.equal(output.self, null);
  assert.equal({}.polluted, undefined);
  const { proxy, revoke } = Proxy.revocable({ id: 'r', title: 'R', status: 'published' }, {});
  revoke();
  assert.doesNotThrow(() => createReportViewModel(proxy));
  const sparse = [];
  sparse[4] = { id: 'job-4', status: 'completed' };
  sparse[999999] = { id: 'job-large', status: 'completed' };
  const campaign = createCampaignViewModel({ id: 'c', name: 'C', status: 'completed', jobs: sparse });
  assert.deepEqual(campaign.jobs.map((item) => item.id), ['job-4', 'job-large']);
  const report = createReportViewModel({
    id: 'r', title: 'T'.repeat(10_000), status: 'published', summary: 'S'.repeat(10_000),
    references: Array.from({ length: 500 }, (_, index) => ({ id: `ref-${index}` })),
    evidence: Array.from({ length: 500 }, (_, index) => ({ id: `e-${index}`, title: 'E', visible: true }))
  });
  assert.ok(report.title.length <= 240);
  assert.ok(report.summary.length <= 2000);
  assert.equal(report.references.length, 50);
  assert.equal(report.evidence.length, 50);
});

test('secret, path, stack, bidi, control and hidden-resource corpus is redacted without side channels', async () => {
  const { createDiagnosticViewModel, createCleanRoomViewModel, toSafeText } = await load('packages/audit-report-view-model/src/index.mjs');
  const diagnostic = createDiagnosticViewModel({
    code: 'ERR',
    message: 'at attacker (/root/private/app.mjs:1:2) https://private.test/x token=secret Bearer abc.def',
    details: 'C:\\Users\\secret\\key.txt api_key=hunter2'
  });
  const text = `${diagnostic.message} ${diagnostic.details}`;
  for (const forbidden of ['attacker', '/root/private', 'private.test', 'hunter2', 'abc.def', 'C:\\Users']) assert.equal(text.includes(forbidden), false, forbidden);
  assert.equal(/[\u202A-\u202E\u2066-\u2069\u0000-\u001F]/.test(toSafeText('\u202ehello\u0000world')), false);
  const clean = createCleanRoomViewModel({
    id: 'clean', name: 'Clean', status: 'review', visibleResourceIds: ['visible'],
    provenance: [
      { id: 'p1', sourceType: 'commit', sourceId: 'visible', label: 'shown', visible: true },
      { id: 'p2', sourceType: 'commit', sourceId: 'hidden', label: 'HIDDEN', visible: true }
    ],
    merges: [{ id: 'm-hidden', status: 'completed', label: 'HIDDEN-MERGE', visible: false }]
  });
  assert.deepEqual(clean.provenance.map((item) => item.label), ['shown']);
  assert.deepEqual(clean.merges, []);
  assert.equal('hiddenResourceCount' in clean, false);
});

test('static Worker 4 production boundary contains no execution, credential persistence or dynamic-code primitive', () => {
  const roots = [
    'apps/audit-web/src',
    'packages/audit-report-view-model/src',
    'packages/audit-ui-contracts/src',
    'packages/audit-web-compat/src'
  ];
  const files = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (entry.isFile() && /\.(?:mjs|js)$/.test(entry.name)) files.push(target);
    }
  };
  for (const rootName of roots) walk(file(rootName));
  const source = files.map((target) => fs.readFileSync(target, 'utf8')).join('\n');
  const forbidden = [
    /\beval\s*\(/, /\bFunction\s*\(/, /\bWebSocket\s*\(/, /\bfetch\s*\(/,
    /\blocalStorage\b/, /\bsessionStorage\b/, /\bindexedDB\b/, /document\.cookie/,
    /child_process|spawnSync|execSync|process\.env/,
    /eth_sendTransaction|eth_sendRawTransaction|personal_sign|wallet_switchEthereumChain/,
    /signTransaction|sendTransaction|broadcastTransaction|deployContract/,
    /workflow_dispatch|repository_dispatch/
  ];
  for (const pattern of forbidden) assert.doesNotMatch(source, pattern);
  assert.ok(files.length >= 20, files.length);
});

test('Round 3 release file names are versioned and changed-path roots remain allowlisted', () => {
  const allowed = [
    /^apps\/audit-web\//,
    /^packages\/audit-report-view-model\//,
    /^packages\/audit-ui-contracts\//,
    /^packages\/audit-web-/,
    /^test\/audit-round3-web-/,
    /^test\/fixtures\/audit-round3-web\//,
    /^docs\/audit\/(?:web|reviews)\//
  ];
  const paths = [
    'apps/audit-web/src/page-helpers-v1.mjs',
    'packages/audit-web-compat/src/index-v1.mjs',
    'test/audit-round3-web-e2e-adversarial-static-v1.test.mjs',
    'test/fixtures/audit-round3-web/complete-routes-v1.json',
    'docs/audit/web/2026-08-01-audit-round3-accessibility-review-v1.md'
  ];
  for (const value of paths) {
    assert.ok(allowed.some((pattern) => pattern.test(value)), value);
    assert.match(path.basename(value), /(?:-v1|\.test)\./, value);
  }
});
