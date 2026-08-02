import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const pagesPath = path.join(root, 'apps/audit-web/src/pages.mjs');
const fixturePath = path.join(root, 'test/fixtures/audit-round3-web/complete-routes-v1.json');
const snapshotsPath = path.join(root, 'test/fixtures/audit-round3-web/route-dom-v1.json');
const loadPages = () => import(`${pathToFileURL(pagesPath).href}?v=${Date.now()}-${Math.random()}`);

function fixture() {
  assert.equal(fs.existsSync(fixturePath), true, 'complete Round 3 fixture must exist');
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
}

test('report views render bounded filter pagination summary evidence and immutable references', async () => {
  const pages = await loadPages();
  const reports = Array.from({ length: 25 }, (_, index) => ({
    id: `report-${String(index + 1).padStart(2, '0')}`,
    title: index === 20 ? 'Target report' : `Report ${index + 1}`,
    status: index % 2 ? 'published' : 'failed',
    createdAt: `2026-08-01T${String(index % 24).padStart(2, '0')}:00:00Z`,
    evidence: []
  }));
  const list = pages.renderReportsPage(reports, { query: 'report', sort: 'title-asc', page: 2, pageSize: 10 });
  assert.match(list, /Page 2 of 3/);
  assert.match(list, /Previous/);
  assert.match(list, /Next/);
  assert.doesNotMatch(list, /<script/i);

  const detail = pages.renderReportDetailPage({
    id: 'report-detail', title: 'Detailed report', status: 'published', summary: 'Bounded summary',
    workspaceId: 'workspace-1', campaignId: 'campaign-1', jobId: 'job-1',
    references: [
      { id: 'reference-b', label: 'Reference B' },
      { id: 'reference-a', label: 'Reference A', url: '/reports/reference-a' }
    ],
    evidence: [{ id: 'evidence-1', title: 'Evidence one', summary: 'Summary', visible: true }]
  });
  assert.match(detail, /Bounded summary/);
  assert.match(detail, /References/);
  assert.ok(detail.indexOf('Reference A') < detail.indexOf('Reference B'));
  assert.match(detail, /Workspace/);
  assert.match(detail, /Campaign/);
  assert.match(detail, /Job/);
});

test('campaign and job views truthfully render every required lifecycle state without progress invention', async () => {
  const { renderCampaignPage, renderJobPage } = await loadPages();
  const expected = new Map([
    ['pending', 'Pending'], ['admitted', 'Admitted'], ['awaiting-executor', 'Awaiting executor'],
    ['running-model-only', 'Model analysis in progress'], ['completed', 'Completed'], ['failed', 'Failed'],
    ['cancelled', 'Cancelled'], ['timeout', 'Timed out'], ['resource-limit', 'Resource limit reached']
  ]);
  for (const [status, label] of expected) {
    const html = renderJobPage({ id: `job-${status}`, status });
    assert.match(html, new RegExp(label));
    assert.doesNotMatch(html, /\b\d{1,3}%\b|estimated completion|ETA/i);
  }
  const campaign = renderCampaignPage({ id: 'campaign', name: 'Campaign', status: 'admitted', jobs: [] });
  assert.match(campaign, /Admitted/);
  assert.match(campaign, /Execution unavailable/);
});

test('persistent-fork view covers create checkpoint export restore delete and tombstone facts without mutation controls', async () => {
  const { renderForkPage } = await loadPages();
  const html = renderForkPage({
    id: 'fork-1', name: 'Fork one', status: 'restored', restoreStatus: 'restored',
    exportStatus: 'exported', deleteStatus: 'deleted', tombstoneStatus: 'tombstoned',
    checkpoints: [{ id: 'checkpoint-1', status: 'ready', label: 'Checkpoint one' }],
    exports: [{ id: 'export-1', status: 'exported', label: 'Export one', url: '/exports/one', sizeBytes: 12 }]
  });
  for (const value of ['Restored', 'Export status', 'Restore status', 'Delete status', 'Tombstone status', 'Checkpoint one', 'Export one']) assert.match(html, new RegExp(value));
  assert.doesNotMatch(html, /<button|method="post"|Execute|Run project/i);
});

test('clean-room view shows access share visible merges and allowlisted provenance without hidden-resource counts', async () => {
  const { renderCleanRoomPage } = await loadPages();
  const html = renderCleanRoomPage({
    id: 'clean-1', name: 'Clean one', status: 'review', accessStatus: 'granted', shareStatus: 'shared',
    visibleResourceIds: ['source-visible'],
    merges: [
      { id: 'merge-visible', status: 'completed', label: 'Visible merge', visible: true },
      { id: 'merge-hidden', status: 'completed', label: 'HIDDEN-MERGE', visible: false }
    ],
    provenance: [
      { id: 'p-visible', sourceType: 'commit', sourceId: 'source-visible', label: 'Visible source', visible: true },
      { id: 'p-hidden', sourceType: 'commit', sourceId: 'source-hidden', label: 'HIDDEN-SOURCE', visible: true }
    ]
  });
  assert.match(html, /Access status/);
  assert.match(html, /Share status/);
  assert.match(html, /Visible merge/);
  assert.match(html, /Visible source/);
  assert.doesNotMatch(html, /HIDDEN-MERGE|HIDDEN-SOURCE|hidden resource|hidden count/i);
});

test('profile parser and result discovery views are linked and remain execution-disabled', async () => {
  const pages = await loadPages();
  const profiles = pages.renderProfilesPage([{ id: 'profile-solidity', name: 'Solidity audit', version: '1', available: true, parserId: 'parser-solidity' }]);
  assert.match(profiles, /href="\/profiles\/profile-solidity"/);
  const profile = pages.renderProfilePage({ id: 'profile-solidity', name: 'Solidity audit', version: '1', available: true, parserId: 'parser-solidity' });
  assert.match(profile, /href="\/parsers\/parser-solidity"/);
  const parser = pages.renderParserPage({ id: 'parser-solidity', name: 'Parser', version: '1', available: true, profileId: 'profile-solidity' });
  assert.match(parser, /href="\/profiles\/profile-solidity"/);
  const result = pages.renderResultPage({ id: 'result-1', status: 'completed', profileId: 'profile-solidity', parserId: 'parser-solidity', reportId: 'report-1', evidenceCount: 3 });
  assert.match(result, /href="\/reports\/report-1"/);
  assert.doesNotMatch(`${profiles}${profile}${parser}${result}`, /<button[^>]*>\s*(?:Run|Execute)/i);
});

test('catalog view distinguishes metadata availability from unavailable execution', async () => {
  const { renderCatalogPage } = await loadPages();
  const html = renderCatalogPage({
    capabilities: [{ id: 'cap-read', name: 'Read', available: true }, { id: 'cap-run', name: 'Run', available: false }],
    tools: [{ id: 'tool-read', name: 'Reader', available: true, capabilityIds: ['cap-read'] }]
  });
  assert.match(html, /Availability describes discovery metadata only/);
  assert.match(html, /Unavailable/);
  assert.doesNotMatch(html, /execution enabled|executor available/i);
});

test('GitHub Direct status view is bounded status-only and exposes no mutation action', async () => {
  const { renderGitHubDirectStatusPage } = await loadPages();
  const html = renderGitHubDirectStatusPage({
    id: 'direct-1', status: 'awaiting-executor', repository: 'CurveYield/contract-automation',
    targetSha: 'a'.repeat(40), checkStatus: 'queued', reportId: 'report-1'
  });
  assert.match(html, /Awaiting executor/);
  assert.match(html, /CurveYield\/contract-automation/);
  assert.match(html, /View report/);
  assert.doesNotMatch(html, /Cancel|Retry|Submit|<button/i);
});

test('operations view renders quota retention and operation-budget facts with bounded counts', async () => {
  const { renderOperationsPage } = await loadPages();
  const html = renderOperationsPage({
    quotas: [{ id: 'quota-1', remaining: 8, limit: 10, used: 2, scope: 'workspace-1' }],
    retention: [{ id: 'ret-1', days: 14, policy: 'bounded', scope: 'workspace-1' }],
    operationBudgets: [{ id: 'budget-1', remaining: 4, limit: 5, used: 1, operation: 'report-read', scope: 'workspace-1' }]
  });
  assert.match(html, /Quota/);
  assert.match(html, /Retention/);
  assert.match(html, /Operation budget/);
  assert.match(html, /8/);
  assert.match(html, /14 days/);
  assert.match(html, /report-read/);
});

test('release provenance view lists compatibility versions and exact candidate lineage', async () => {
  const { renderReleaseProvenancePage } = await loadPages();
  const html = renderReleaseProvenancePage({
    id: 'release-1', version: 'v1', status: 'candidate', candidateSha: 'c'.repeat(40), startingSha: 's'.repeat(40),
    compatibilityVersions: ['audit-service-reporting/v1', 'audit-api-public/v1']
  });
  assert.match(html, /Release provenance/);
  assert.ok(html.indexOf('audit-api-public/v1') < html.indexOf('audit-service-reporting/v1'));
  assert.match(html, /candidate/);
  assert.match(html, new RegExp('c'.repeat(40)));
});

test('complete inert fixture covers every Round 3 route payload and deterministic DOM snapshots', async () => {
  const pages = await loadPages();
  const data = fixture();
  assert.equal(data.version, 'audit-round3-web-complete/v1');
  const expected = ['reports', 'reportDetail', 'workspaces', 'workspaceDetail', 'campaignDetail', 'jobDetail', 'forkDetail', 'cleanRoomDetail', 'profiles', 'profileDetail', 'parserDetail', 'resultDetail', 'catalog', 'githubDirectStatus', 'operations', 'diagnostics', 'releaseProvenance'];
  assert.deepEqual(Object.keys(data.routes).sort(), expected.sort());
  const snapshots = {};
  for (const name of expected) {
    const html = pages.renderAuditPage(name, data.routes[name]);
    snapshots[name] = { length: html.length, sha256: createHash('sha256').update(html).digest('hex') };
  }
  assert.equal(fs.existsSync(snapshotsPath), true, 'DOM snapshot fixture must exist');
  const expectedSnapshots = JSON.parse(fs.readFileSync(snapshotsPath, 'utf8'));
  assert.deepEqual(snapshots, expectedSnapshots);
});
