import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePhase9ReportRequest } from '../src/phase9-reports.mjs';

const report = (id, workspaceId = 'workspace-a') => ({
  schemaVersion: 'audit-report-reference-v1',
  reportId: id,
  tenantId: 'tenant-a',
  workspaceId,
  campaignId: 'campaign-a',
  jobId: 'job-a',
  reportSchemaVersion: 'audit-report-v1',
  digest: `sha256:${id.padEnd(64, '0').slice(0, 64)}`,
  createdAt: '2026-08-01T00:00:00.000Z',
  summary: {
    classification: 'findings',
    findingCount: 2,
    evidenceCount: 3,
    truncated: false
  }
});
const provider = {
  async listReports({ tenantId, workspaceId }) {
    return [report('b'), report('a'), report('hidden', 'workspace-hidden')]
      .filter((value) => value.tenantId === tenantId && value.workspaceId === workspaceId);
  },
  async getReport({ reportId, tenantId, workspaceId }) {
    const value = reportId === 'missing' || reportId === 'hidden' ? null : report(reportId);
    return value?.tenantId === tenantId && value?.workspaceId === workspaceId ? value : null;
  }
};
const env = {
  AUDIT_CLIENT_API_KEY: 'client',
  AUDIT_GPT_API_KEY: 'gpt',
  CORS_ORIGIN: 'https://audit.example',
  AUDIT_READ_SCOPES: {
    client: { tenantId: 'tenant-a', workspaceId: 'workspace-a' },
    gpt: { tenantId: 'tenant-a', workspaceId: 'workspace-a' }
  },
  AUDIT_REPORT_DISCOVERY: provider
};
const request = (path, token = 'client', method = 'GET') => new Request(
  `https://api.example${path}`,
  { method, headers: { authorization: `Bearer ${token}` } }
);

test('report list and item contracts expose immutable references without bytes, URLs, or totals', async () => {
  const response = await handlePhase9ReportRequest(request('/audit/v1/reports?limit=1'), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.reports.length, 1);
  assert.equal(body.reports[0].reportId, 'a');
  assert.ok(body.nextCursor);
  assert.equal('total' in body, false);
  const serialized = JSON.stringify(body);
  assert.equal(/https?:|artifactBytes|signedUrl/.test(serialized), false);
  const item = await handlePhase9ReportRequest(request('/audit/v1/reports/a'), env);
  assert.equal(item.status, 200);
  assert.equal((await item.json()).reportId, 'a');
});

test('hidden and absent reports are byte-identical and do not leak counts', async () => {
  const hidden = await handlePhase9ReportRequest(request('/audit/v1/reports/hidden'), env);
  const absent = await handlePhase9ReportRequest(request('/audit/v1/reports/missing'), env);
  assert.equal(hidden.status, 404);
  assert.equal(absent.status, 404);
  assert.equal(await hidden.text(), await absent.text());
});

test('report discovery uses approved server-owned scopes and rejects request-supplied authority', async () => {
  for (const token of ['client', 'gpt']) {
    assert.equal((await handlePhase9ReportRequest(request('/audit/v1/reports', token), env)).status, 200);
  }
  for (const token of ['edge', 'lite', '']) {
    assert.equal((await handlePhase9ReportRequest(request('/audit/v1/reports', token), env)).status, 401);
  }
  const query = await handlePhase9ReportRequest(
    request('/audit/v1/reports?tenantId=other&workspaceId=other'),
    env
  );
  assert.equal(query.status, 400);
});
