import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (relative) => import(`${pathToFileURL(path.join(root, relative)).href}?v=${Date.now()}-${Math.random()}`);
const target = 'a'.repeat(40);
const resultDigest = `sha256:${'b'.repeat(64)}`;

function result(data, overrides = {}) {
  return {
    schemaVersion: 'github-direct-service-result-v2', modeId: 'github-direct-audit-v1', commandKind: 'report',
    jobId: 'job-hostile', targetCommitSha: target, state: 'completed', data,
    completedAt: '2026-08-02T10:00:00.000Z', cloudflareFallback: false,
    resultId: `direct-service-result-${'b'.repeat(24)}`, resultDigest, ...overrides
  };
}
function completedData(overrides = {}) {
  return {
    currentState: { jobId: 'job-hostile', targetCommitSha: target, repositoryFullName: 'CurveYield/contract-automation', state: 'completed' },
    bundle: {
      schemaVersion: 'github-direct-terminal-reporting-v1', jobId: 'job-hostile', targetCommitSha: target,
      resultManifest: { jobId: 'job-hostile', targetCommitSha: target, executionState: 'fixture_modeled', outcome: 'modeled_fixture' },
      reportIndex: { jobId: 'job-hostile', targetCommitSha: target, entries: [] }
    },
    ...overrides
  };
}

test('adapter rejects unrecognized reporting bundle, execution state, and outcome', async () => {
  const { adaptGitHubDirectResultV2, AuditWebCompatibilityError } = await load('packages/audit-web-compat/src/index-v1.mjs');
  const cases = [
    result(completedData({ bundle: { schemaVersion: 'attacker-bundle', jobId: 'job-hostile', targetCommitSha: target } })),
    result(completedData({ bundle: { ...completedData().bundle, resultManifest: { jobId: 'job-hostile', targetCommitSha: target, executionState: 'submitted_execution_performed', outcome: 'modeled_fixture' } } })),
    result(completedData({ bundle: { ...completedData().bundle, resultManifest: { jobId: 'job-hostile', targetCommitSha: target, executionState: 'fixture_modeled', outcome: 'attacker_outcome' } } }))
  ];
  for (const value of cases) assert.throws(() => adaptGitHubDirectResultV2(value), (error) => error instanceof AuditWebCompatibilityError);
});

test('revoked proxies and hostile accessors fail closed without invocation', async () => {
  const { adaptGitHubDirectResultV2, AuditWebCompatibilityError } = await load('packages/audit-web-compat/src/index-v1.mjs');
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  assert.throws(() => adaptGitHubDirectResultV2(proxy), (error) => error instanceof AuditWebCompatibilityError);
  let calls = 0;
  const data = completedData();
  Object.defineProperty(data, 'authorization', { enumerable: true, get() { calls += 1; throw new Error('getter'); } });
  const model = adaptGitHubDirectResultV2(result(data));
  assert.equal(calls, 0);
  assert.equal(model.status, 'completed');
});

test('cycles and oversized hostile records fail safely', async () => {
  const { adaptGitHubDirectResultV2, AuditWebCompatibilityError } = await load('packages/audit-web-compat/src/index-v1.mjs');
  const cyclic = completedData();
  cyclic.self = cyclic;
  assert.doesNotThrow(() => adaptGitHubDirectResultV2(result(cyclic)));
  const oversized = completedData();
  for (let index = 0; index < 501; index += 1) oversized[`field${index}`] = index;
  assert.throws(() => adaptGitHubDirectResultV2(result(oversized)), (error) => error instanceof AuditWebCompatibilityError);
});

test('rendered Direct output neutralizes XSS, bidi controls, unsafe URLs and false progress', async () => {
  const { renderGitHubDirectStatusPage } = await load('apps/audit-web/src/pages-round3-v1.mjs');
  const html = renderGitHubDirectStatusPage({
    id: '<svg onload=alert(1)>direct\u202E', status: 'awaiting_executor',
    repository: '<img src=x onerror=alert(2)>', targetSha: target,
    checkStatus: 'queued', reportId: 'javascript:alert(3)', updatedAt: '2026-08-02T10:00:00Z',
    sourceSchema: 'github-direct-service-result-v2', commandKind: 'submit', serviceState: 'accepted',
    resultId: '<script>alert(4)</script>', resultDigest, executionState: 'not_executed',
    retryable: false, errorCode: ''
  });
  assert.doesNotMatch(html, /<(?:script|svg|img)\b|javascript:/i);
  assert.doesNotMatch(html, /[\u202A-\u202E\u2066-\u2069]/);
  assert.doesNotMatch(html, /\b(?:[1-9]\d?%|ETA|estimated completion|running submitted)\b/i);
  assert.match(html, /Awaiting executor/);
  assert.match(html, /Execution unavailable/);
});

test('hidden resources and conflicting references produce no observable count or destination drift', async () => {
  const { createReportListViewModel, createReportViewModel } = await load('packages/audit-report-view-model/src/index.mjs');
  const baseline = createReportListViewModel([{ id: 'visible', title: 'Visible', status: 'published' }]);
  const attacked = createReportListViewModel([
    { id: 'visible', title: 'Visible', status: 'published' },
    { id: 'hidden', title: '<script>secret</script>', status: 'published', visible: false }
  ]);
  assert.deepEqual(attacked, baseline);
  const report = createReportViewModel({
    id: 'r', title: 'R', status: 'published',
    references: [
      { id: 'same', label: 'A', url: '/reports/a' },
      { id: 'same', label: 'B', url: 'https://evil.test/' }
    ]
  });
  assert.deepEqual(report.references, []);
});
