import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const file = (value) => path.join(root, value);
async function load(value) {
  const target = file(value);
  assert.equal(fs.existsSync(target), true, `expected ${value} to exist`);
  return import(`${pathToFileURL(target).href}?v=${Date.now()}-${Math.random()}`);
}

const kinds = [
  'capability', 'catalogTool', 'workspace', 'campaign', 'job', 'evidence', 'report',
  'fork', 'checkpoint', 'export', 'cleanRoomCampaign', 'merge', 'provenance',
  'quota', 'retention', 'operationBudget', 'profile', 'parser', 'result',
  'githubDirectStatus', 'releaseProvenance', 'diagnostic'
];

test('strict Round 3 contracts have exact frozen required/optional registries and stable errors', async () => {
  const { UI_ENTITY_KINDS, UI_CONTRACTS, UI_ERROR_CODES, parseUiEntity } = await load('packages/audit-ui-contracts/src/index.mjs');
  assert.deepEqual(UI_ENTITY_KINDS, kinds);
  assert.deepEqual(Object.keys(UI_CONTRACTS), kinds);
  assert.ok(UI_ERROR_CODES.includes('UI_COMPAT_VERSION'));
  assert.ok(UI_ERROR_CODES.includes('UI_CLIENT_UNAUTHORIZED'));
  for (const kind of kinds) {
    assert.equal(Object.isFrozen(UI_CONTRACTS[kind]), true);
    assert.equal(Object.isFrozen(UI_CONTRACTS[kind].required), true);
    assert.equal(Object.isFrozen(UI_CONTRACTS[kind].optional), true);
  }
  assert.throws(() => parseUiEntity('quota', { id: 'q', remaining: 1, attacker: true }), { code: 'UI_CONTRACT_UNKNOWN_KEY' });
});

test('canonical Round 3 view-model exports are exact, recursively frozen, and execution-disabled', async () => {
  const vm = await load('packages/audit-report-view-model/src/index.mjs');
  const cases = [
    ['createExportViewModel', { id: 'e', status: 'exported' }],
    ['createMergeViewModel', { id: 'm', status: 'completed' }],
    ['createQuotaViewModel', { id: 'q', remaining: 2 }],
    ['createRetentionViewModel', { id: 'r', days: 14 }],
    ['createOperationBudgetViewModel', { id: 'b', remaining: 3 }],
    ['createProfileViewModel', { id: 'p', name: 'P', version: '1' }],
    ['createParserViewModel', { id: 'parser', name: 'Parser', version: '1' }],
    ['createResultViewModel', { id: 'result', status: 'completed' }],
    ['createGitHubDirectStatusViewModel', { id: 'g', status: 'awaiting-executor' }],
    ['createReleaseProvenanceViewModel', { id: 'release', version: 'v1' }]
  ];
  for (const [name, input] of cases) {
    assert.equal(typeof vm[name], 'function', name);
    const output = vm[name](input);
    assert.equal(Object.isFrozen(output), true, name);
    if (Object.hasOwn(output, 'executionAvailable')) assert.equal(output.executionAvailable, false, name);
  }
  const report = vm.createReportViewModel({
    id: 'report', title: 'Report', status: 'published', summary: 'Summary',
    workspaceId: 'w', campaignId: 'c', jobId: 'j',
    references: [{ id: 'ref-b', label: 'B' }, { id: 'ref-a', label: 'A', url: '/reports/a' }]
  });
  assert.deepEqual(Object.keys(report), ['id', 'title', 'status', 'createdAt', 'sourceUrl', 'summary', 'workspaceId', 'campaignId', 'jobId', 'references', 'evidence']);
  assert.deepEqual(report.references.map((item) => item.id), ['ref-a', 'ref-b']);
  assert.equal(Object.isFrozen(report.references), true);
});

test('version-locked compatibility adapter composes inert API and service fixtures without foreign imports', async () => {
  const compat = await load('packages/audit-web-compat/src/index-v1.mjs');
  assert.deepEqual(compat.COMPATIBILITY_VERSIONS, {
    api: 'audit-api-public/v1', service: 'audit-service-reporting/v1', output: 'audit-web-compat/v1'
  });
  const output = compat.composeWebCompatibility({
    api: {
      version: 'audit-api-public/v1',
      capabilities: [{ id: 'cap-read', name: 'Read', available: true }],
      profiles: [{ id: 'profile-a', name: 'Profile A', version: '1' }],
      parsers: [{ id: 'parser-a', name: 'Parser A', version: '1' }],
      githubDirect: { id: 'direct', status: 'awaiting-executor' }
    },
    service: {
      version: 'audit-service-reporting/v1',
      reports: [{ id: 'report-a', title: 'Report A', status: 'published' }],
      quotas: [{ id: 'quota-a', remaining: 9 }],
      retention: [{ id: 'ret-a', days: 14 }],
      operationBudgets: [{ id: 'budget-a', remaining: 3 }],
      release: { id: 'release-a', version: 'v1' }
    }
  });
  assert.equal(output.version, 'audit-web-compat/v1');
  assert.deepEqual(output.capabilities.map((item) => item.id), ['cap-read']);
  assert.deepEqual(output.reports.map((item) => item.id), ['report-a']);
  assert.equal(output.executionAvailable, false);
  assert.equal(Object.isFrozen(output), true);
  assert.equal(Object.isFrozen(output.reports), true);
  const source = fs.readFileSync(file('packages/audit-web-compat/src/index-v1.mjs'), 'utf8');
  assert.doesNotMatch(source, /apps\/audit-api|audit-phase78-service|github-direct|\.\.\/\.\.\/.*(?:apps|packages)\//);
});

test('compatibility adapter rejects missing, skewed, accessor, and oversized inputs with stable codes', async () => {
  const { composeWebCompatibility, AuditWebCompatibilityError } = await load('packages/audit-web-compat/src/index-v1.mjs');
  const service = { version: 'audit-service-reporting/v1', reports: [] };
  for (const api of [null, {}, { version: 'audit-api-public/v2' }]) {
    assert.throws(() => composeWebCompatibility({ api, service }), (error) => error instanceof AuditWebCompatibilityError && ['UI_COMPAT_INPUT', 'UI_COMPAT_VERSION'].includes(error.code));
  }
  let calls = 0;
  const hostile = { version: 'audit-api-public/v1' };
  Object.defineProperty(hostile, 'profiles', { enumerable: true, get() { calls += 1; throw new Error('getter'); } });
  const output = composeWebCompatibility({ api: hostile, service });
  assert.equal(calls, 0);
  assert.deepEqual(output.profiles, []);
});

test('compatibility fixtures are versioned inert JSON and produce deterministic IDs', async () => {
  const compat = await load('packages/audit-web-compat/src/index-v1.mjs');
  const api = JSON.parse(fs.readFileSync(file('test/fixtures/audit-round3-web/worker1-api-contract-v1.json'), 'utf8'));
  const service = JSON.parse(fs.readFileSync(file('test/fixtures/audit-round3-web/worker0-service-report-v1.json'), 'utf8'));
  const output = compat.composeWebCompatibility({ api, service });
  assert.equal(api.version, 'audit-api-public/v1');
  assert.equal(service.version, 'audit-service-reporting/v1');
  assert.deepEqual(output.profiles.map((item) => item.id), ['profile-solidity']);
  assert.deepEqual(output.reports.map((item) => item.id), ['report-compat-1']);
  assert.deepEqual(output.quotas.map((item) => item.id), ['quota-workspace']);
});

test('expanded routing and state rendering are deterministic, bounded, and execution-disabled', async () => {
  const { AUDIT_ROUTES, resolveAuditRoute } = await load('apps/audit-web/src/routes.mjs');
  const { renderState, renderShell } = await load('apps/audit-web/src/render.mjs');
  assert.equal(AUDIT_ROUTES.length, 17);
  for (const route of AUDIT_ROUTES) assert.equal(route.executionAvailable, false);
  assert.equal(resolveAuditRoute('/profiles/profile-solidity').name, 'profileDetail');
  assert.equal(resolveAuditRoute('/release').name, 'releaseProvenance');
  assert.equal(resolveAuditRoute('/reports?token=secret').query.token, undefined);
  assert.match(renderState({ kind: 'unauthorized' }), /Access unavailable/);
  assert.match(renderState({ kind: 'notFound' }), /Page not found/);
  assert.match(renderState({ kind: 'offline' }), /offline-stale/);
  const shell = renderShell({ title: 'Profiles', activeRoute: 'profiles', body: '', state: 'ready' });
  assert.match(shell, /href="\/profiles" aria-current="page"/);
  assert.match(shell, /Execution is unavailable/);
});

test('application publishes loading/ready/not-found/unauthorized state and history exactly once', async () => {
  const { createAuditApp } = await load('apps/audit-web/src/app.mjs');
  const events = [];
  const history = [];
  const client = { request: async (resource) => {
    if (resource === '/api/audit/workspaces') throw Object.assign(new Error('denied'), { code: 'UI_CLIENT_UNAUTHORIZED' });
    return [];
  } };
  const app = createAuditApp({
    client,
    onState: (state) => events.push(state.kind),
    history: { push: (value) => history.push(['push', value]), replace: (value) => history.push(['replace', value]) }
  });
  const ready = await app.navigate('/reports?page=2', { replaceHistory: true });
  assert.equal(ready.kind, 'ready');
  const denied = await app.navigate('/workspaces');
  assert.equal(denied.kind, 'unauthorized');
  const missing = await app.navigate('/missing');
  assert.equal(missing.kind, 'notFound');
  assert.deepEqual(events, ['loading', 'ready', 'loading', 'unauthorized', 'notFound']);
  assert.deepEqual(history, [['replace', '/reports?page=2'], ['push', '/missing']]);
});
