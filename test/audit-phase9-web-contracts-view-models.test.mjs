import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const contractsPath = path.join(root, 'packages/audit-ui-contracts/src/index.mjs');
const viewModelsPath = path.join(root, 'packages/audit-report-view-model/src/index.mjs');
const routesPath = path.join(root, 'apps/audit-web/src/routes.mjs');
const renderPath = path.join(root, 'apps/audit-web/src/render.mjs');

async function load(file) {
  assert.equal(fs.existsSync(file), true, `expected ${path.relative(root, file)} to exist`);
  return import(`${pathToFileURL(file).href}?v=${Date.now()}-${Math.random()}`);
}

const expectedKinds = [
  'capability', 'catalogTool', 'workspace', 'campaign', 'job', 'evidence',
  'report', 'fork', 'checkpoint', 'cleanRoomCampaign', 'provenance', 'diagnostic'
];

test('exports strict contracts for every Phase 9 UI entity', async () => {
  const { UI_CONTRACTS, UI_ENTITY_KINDS } = await load(contractsPath);
  assert.deepEqual(UI_ENTITY_KINDS, expectedKinds);
  assert.deepEqual(Object.keys(UI_CONTRACTS).sort(), expectedKinds.slice().sort());
  for (const kind of expectedKinds) {
    assert.equal(Object.isFrozen(UI_CONTRACTS[kind]), true);
    assert.equal(Array.isArray(UI_CONTRACTS[kind].required), true);
    assert.equal(Array.isArray(UI_CONTRACTS[kind].optional), true);
  }
});

test('contract parser accepts only own enumerable data keys and rejects unknown fields', async () => {
  const { parseUiEntity, UiContractError } = await load(contractsPath);
  const input = Object.create({ inherited: 'ignore me' });
  Object.assign(input, { id: 'report-1', title: 'Report', status: 'published', evidence: [] });
  const parsed = parseUiEntity('report', input);
  assert.deepEqual(parsed, { id: 'report-1', title: 'Report', status: 'published', evidence: [] });
  assert.throws(
    () => parseUiEntity('report', { ...input, unexpected: true }),
    (error) => error instanceof UiContractError && error.code === 'UI_CONTRACT_UNKNOWN_KEY'
  );
});

test('contract parser never invokes hostile accessors', async () => {
  const { parseUiEntity } = await load(contractsPath);
  let invoked = 0;
  const hostile = { id: 'job-1', status: 'failed' };
  Object.defineProperty(hostile, 'error', {
    enumerable: true,
    get() {
      invoked += 1;
      throw new Error('getter executed');
    }
  });
  const parsed = parseUiEntity('job', hostile);
  assert.equal(invoked, 0);
  assert.deepEqual(parsed, { id: 'job-1', status: 'failed' });
});

test('canonical report view model is bounded, deterministic, safe, and recursively frozen', async () => {
  const { createReportViewModel } = await load(viewModelsPath);
  const model = createReportViewModel({
    id: ' report-1 ',
    title: '<img src=x onerror=alert(1)>' + 'x'.repeat(600),
    status: 'published',
    createdAt: '2026-08-01T00:00:00Z',
    sourceUrl: 'javascript:alert(1)',
    evidence: [
      { id: 'e-2', title: 'Second', severity: 'low', url: 'https://example.test/e-2' },
      { id: 'e-1', title: 'First', severity: 'high', url: '/reports/e-1' }
    ]
  });
  assert.deepEqual(Object.keys(model), ['id', 'title', 'status', 'createdAt', 'sourceUrl', 'evidence']);
  assert.equal(model.id, 'report-1');
  assert.equal(model.title.includes('<'), false);
  assert.ok(model.title.length <= 240);
  assert.equal(model.sourceUrl, null);
  assert.deepEqual(model.evidence.map((item) => item.id), ['e-1', 'e-2']);
  assert.equal(Object.isFrozen(model), true);
  assert.equal(Object.isFrozen(model.evidence), true);
  assert.equal(Object.isFrozen(model.evidence[0]), true);
});

test('canonical view models tolerate cycles, sparse arrays, and extreme collections', async () => {
  const { createCampaignViewModel } = await load(viewModelsPath);
  const campaign = { id: 'campaign-1', name: 'Campaign', status: 'running', jobs: [] };
  campaign.self = campaign;
  campaign.jobs.length = 5000;
  campaign.jobs[4] = { id: 'job-4', status: 'pending' };
  campaign.jobs[999] = { id: 'job-999', status: 'failed' };
  const model = createCampaignViewModel(campaign);
  assert.equal(model.jobs.length, 2);
  assert.deepEqual(model.jobs.map((job) => job.id), ['job-4', 'job-999']);
  assert.equal('self' in model, false);
});

test('safe URLs allow bounded internal paths and http(s) links only', async () => {
  const { toSafeUrl } = await load(viewModelsPath);
  assert.equal(toSafeUrl('/reports/report-1'), '/reports/report-1');
  assert.equal(toSafeUrl('https://example.test/a'), 'https://example.test/a');
  assert.equal(toSafeUrl('http://example.test/a'), 'http://example.test/a');
  assert.equal(toSafeUrl('//evil.test/a'), null);
  assert.equal(toSafeUrl('data:text/html,boom'), null);
  assert.equal(toSafeUrl('https://example.test/a?token=secret'), null);
  assert.equal(toSafeUrl('x'.repeat(3000)), null);
});

test('route map covers every required Phase 9 page with keyboard focus targets', async () => {
  const { AUDIT_ROUTES, resolveAuditRoute } = await load(routesPath);
  const names = AUDIT_ROUTES.map((route) => route.name);
  assert.deepEqual(names, [
    'reports', 'reportDetail', 'workspaces', 'workspaceDetail', 'campaignDetail',
    'jobDetail', 'forkDetail', 'cleanRoomDetail', 'catalog', 'diagnostics'
  ]);
  for (const route of AUDIT_ROUTES) {
    assert.equal(route.focusTarget, 'main-heading');
    assert.equal(route.executionAvailable, false);
  }
  assert.equal(resolveAuditRoute('/reports/report-1').name, 'reportDetail');
  assert.equal(resolveAuditRoute('/unknown').name, 'notFound');
});

test('application shell renders semantic loading, empty, and error states without HTML injection', async () => {
  const { renderShell, renderState } = await load(renderPath);
  const shell = renderShell({
    title: '<script>alert(1)</script>',
    activeRoute: 'reports',
    body: renderState({ kind: 'error', message: '<img src=x onerror=alert(1)>' })
  });
  assert.match(shell, /href="#main-content"/);
  assert.match(shell, /<nav aria-label="Primary">/);
  assert.match(shell, /<main id="main-content" tabindex="-1">/);
  assert.match(shell, /role="alert"/);
  assert.doesNotMatch(shell, /<script>/);
  assert.doesNotMatch(shell, /<img src=x/);
  assert.match(renderState({ kind: 'loading' }), /aria-busy="true"/);
  assert.match(renderState({ kind: 'empty', message: 'No reports' }), /No reports/);
});
