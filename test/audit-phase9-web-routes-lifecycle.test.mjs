import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const pagesPath = path.join(root, 'apps/audit-web/src/pages.mjs');
const viewModelsPath = path.join(root, 'packages/audit-report-view-model/src/index.mjs');
const snapshotsPath = path.join(root, 'test/fixtures/audit-phase9-web/dom-snapshots-v1.json');

async function load(file) {
  assert.equal(fs.existsSync(file), true, `expected ${path.relative(root, file)} to exist`);
  return import(`${pathToFileURL(file).href}?v=${Date.now()}-${Math.random()}`);
}

const reports = [
  { id: 'r-3', title: 'Zulu', status: 'failed', createdAt: '2026-08-03T00:00:00Z', evidence: [] },
  { id: 'r-1', title: 'Alpha', status: 'published', createdAt: '2026-08-01T00:00:00Z', evidence: [] },
  { id: 'r-2', title: 'Beta', status: 'published', createdAt: '2026-08-02T00:00:00Z', evidence: [] }
];

test('report list filters, sorts, and paginates deterministically', async () => {
  const { createReportListViewModel } = await load(viewModelsPath);
  const page = createReportListViewModel(reports, { status: 'published', sort: 'title-desc', page: 1, pageSize: 1 });
  assert.equal(page.total, 2);
  assert.equal(page.pageCount, 2);
  assert.deepEqual(page.items.map((item) => item.id), ['r-2']);
  const second = createReportListViewModel(reports, { query: 'alpha', page: 99, pageSize: 10 });
  assert.equal(second.page, 1);
  assert.deepEqual(second.items.map((item) => item.id), ['r-1']);
  assert.equal(Object.isFrozen(page.items), true);
});

test('report list and detail pages expose filter, pagination, immutable evidence, and safe links', async () => {
  const { renderReportsPage, renderReportDetailPage } = await load(pagesPath);
  const listHtml = renderReportsPage(reports, { sort: 'created-desc', pageSize: 2 });
  assert.match(listHtml, /<form[^>]*aria-label="Filter reports"/);
  assert.match(listHtml, /<table>/);
  assert.match(listHtml, /aria-label="Report pagination"/);
  assert.ok(listHtml.indexOf('r-3') < listHtml.indexOf('r-2'));
  const detailHtml = renderReportDetailPage({
    id: 'r-1', title: 'Alpha', status: 'published', createdAt: '2026-08-01T00:00:00Z',
    sourceUrl: 'https://example.test/report',
    evidence: [{ id: 'e-1', title: 'Finding', severity: 'high', summary: 'Bounded evidence', url: '/evidence/e-1' }]
  });
  assert.match(detailHtml, /Evidence summary/);
  assert.match(detailHtml, /href="\/evidence\/e-1"/);
  assert.match(detailHtml, /rel="noopener noreferrer"/);
  assert.match(detailHtml, /Finding/);
});

test('workspace, campaign, and job pages render truthful lifecycle states', async () => {
  const { renderWorkspacePage, renderCampaignPage, renderJobPage } = await load(pagesPath);
  const statuses = [
    ['pending', 'Pending'],
    ['awaiting-executor', 'Awaiting executor'],
    ['failed', 'Failed'],
    ['cancelled', 'Cancelled'],
    ['resource-limit', 'Resource limit reached']
  ];
  for (const [status, label] of statuses) {
    const html = renderJobPage({ id: `job-${status}`, title: status, status });
    assert.match(html, new RegExp(label));
    assert.match(html, /Execution unavailable/);
    assert.doesNotMatch(html, /<button[^>]*>\s*(Run|Retry|Execute)/i);
  }
  const campaign = renderCampaignPage({
    id: 'c-1', name: 'Campaign', status: 'running',
    jobs: statuses.map(([status], index) => ({ id: `job-${index}`, title: status, status }))
  });
  for (const [, label] of statuses) assert.match(campaign, new RegExp(label));
  const workspace = renderWorkspacePage({
    id: 'w-1', name: 'Workspace', status: 'active',
    campaigns: [{ id: 'c-1', name: 'Campaign', status: 'running', jobs: [] }]
  });
  assert.match(workspace, /Campaign/);
  assert.match(workspace, /href="\/campaigns\/c-1"/);
});

test('persistent fork page reports checkpoint, export, delete, and retention states without actions', async () => {
  const { renderForkPage } = await load(pagesPath);
  const html = renderForkPage({
    id: 'fork-1', name: 'Fork one', status: 'ready', exportStatus: 'exporting', deleteStatus: 'not-requested',
    retentionExpiresAt: '2026-08-08T00:00:00Z',
    checkpoints: [
      { id: 'cp-2', label: 'Second', status: 'ready', createdAt: '2026-08-02T00:00:00Z', exportUrl: 'https://example.test/cp-2' },
      { id: 'cp-1', label: 'First', status: 'ready', createdAt: '2026-08-01T00:00:00Z' }
    ]
  });
  assert.match(html, /Export status/);
  assert.match(html, /exporting/);
  assert.match(html, /Delete status/);
  assert.match(html, /Retention expires/);
  assert.ok(html.indexOf('cp-1') < html.indexOf('cp-2'));
  assert.doesNotMatch(html, /<button/);
});

test('clean-room provenance excludes hidden and non-visible resources', async () => {
  const { renderCleanRoomPage } = await load(pagesPath);
  const html = renderCleanRoomPage({
    id: 'clean-1', name: 'Clean room', status: 'review', merges: ['merge-b', 'merge-a'],
    visibleResourceIds: ['public-source'],
    provenance: [
      { id: 'p-public', sourceType: 'commit', sourceId: 'public-source', label: 'Public evidence', commitSha: 'abc123', visible: true },
      { id: 'p-hidden', sourceType: 'commit', sourceId: 'hidden-source', label: 'TOP-SECRET-RESOURCE', commitSha: 'def456', visible: false },
      { id: 'p-not-allowed', sourceType: 'commit', sourceId: 'other-source', label: 'OTHER-HIDDEN-RESOURCE', commitSha: 'ghi789', visible: true }
    ]
  });
  assert.match(html, /Public evidence/);
  assert.doesNotMatch(html, /TOP-SECRET-RESOURCE/);
  assert.doesNotMatch(html, /OTHER-HIDDEN-RESOURCE/);
  assert.ok(html.indexOf('merge-a') < html.indexOf('merge-b'));
});

test('capability and catalog views never imply unavailable execution is enabled', async () => {
  const { renderCatalogPage } = await load(pagesPath);
  const html = renderCatalogPage({
    capabilities: [
      { id: 'cap-read', name: 'Read reports', available: true, summary: 'Read-only data' },
      { id: 'cap-run', name: 'Project execution', available: false, reason: 'Disabled in this surface' }
    ],
    tools: [
      { id: 'tool-report', name: 'Report browser', available: true, capabilityIds: ['cap-read'], tags: ['read-only'] },
      { id: 'tool-run', name: 'Execution adapter', available: false, capabilityIds: ['cap-run'], tags: ['unavailable'] }
    ]
  });
  assert.match(html, /Available for discovery/);
  assert.match(html, /Unavailable/);
  assert.match(html, /Execution is not enabled by this catalog/);
  assert.doesNotMatch(html, /<button/);
});

test('route dispatcher renders all section 5–8 pages in the semantic shell', async () => {
  const { renderAuditPage } = await load(pagesPath);
  const cases = [
    ['reports', reports],
    ['reportDetail', reports[0]],
    ['workspaces', [{ id: 'w-1', name: 'W', status: 'active', campaigns: [] }]],
    ['workspaceDetail', { id: 'w-1', name: 'W', status: 'active', campaigns: [] }],
    ['campaignDetail', { id: 'c-1', name: 'C', status: 'pending', jobs: [] }],
    ['jobDetail', { id: 'j-1', status: 'pending' }],
    ['forkDetail', { id: 'f-1', status: 'ready', checkpoints: [] }],
    ['cleanRoomDetail', { id: 'cr-1', name: 'CR', status: 'review', provenance: [] }],
    ['catalog', { capabilities: [], tools: [] }]
  ];
  for (const [name, payload] of cases) {
    const html = renderAuditPage(name, payload);
    assert.match(html, /<!doctype html>/);
    assert.match(html, /id="main-heading"/);
    assert.match(html, /Execution is unavailable/);
  }
});

test('deterministic DOM fixture snapshots match representative route outputs', async () => {
  const { renderAuditPage } = await load(pagesPath);
  assert.equal(fs.existsSync(snapshotsPath), true, 'expected deterministic DOM fixture file');
  const snapshots = JSON.parse(fs.readFileSync(snapshotsPath, 'utf8'));
  const actual = {
    reportsEmpty: renderAuditPage('reports', []),
    jobPending: renderAuditPage('jobDetail', { id: 'job-1', title: 'Job one', status: 'pending' }),
    catalogEmpty: renderAuditPage('catalog', { capabilities: [], tools: [] })
  };
  assert.deepEqual(actual, snapshots);
});
