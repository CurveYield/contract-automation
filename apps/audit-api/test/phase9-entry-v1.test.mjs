import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/entry.mjs';

function report(id) {
  return {
    schemaVersion: 'audit-report-reference-v1',
    reportId: id,
    tenantId: 'tenant-a',
    workspaceId: 'workspace-a',
    campaignId: 'campaign-a',
    jobId: 'job-a',
    reportSchemaVersion: 'audit-report-v1',
    digest: `sha256:${id.padEnd(64, '0').slice(0, 64)}`,
    createdAt: '2026-08-01T00:00:00.000Z',
    summary: {
      classification: 'success',
      findingCount: 0,
      evidenceCount: 1,
      truncated: false
    }
  };
}

function status(resourceType, resourceId) {
  return {
    schemaVersion: 'audit-status-summary-v1',
    resourceType,
    resourceId,
    tenantId: 'tenant-a',
    workspaceId: 'workspace-a',
    state: 'completed',
    updatedAt: '2026-08-01T00:00:00.000Z',
    terminal: true,
    progress: { completed: 1, total: 1 }
  };
}

const env = {
  AUDIT_CLIENT_API_KEY: 'client',
  AUDIT_GPT_API_KEY: 'gpt',
  AUDIT_READ_API_KEY: 'read',
  AUDIT_SUBMIT_API_KEY: 'submit',
  AUDIT_ADMIN_API_KEY: 'admin',
  CORS_ORIGIN: 'https://audit.example',
  AUDIT_READ_SCOPES: {
    client: { tenantId: 'tenant-a', workspaceId: 'workspace-a' },
    gpt: { tenantId: 'tenant-a', workspaceId: 'workspace-a' }
  },
  AUDIT_REPORT_DISCOVERY: {
    async listReports() { return [report('a')]; },
    async getReport({ reportId }) { return reportId === 'a' ? report('a') : null; }
  },
  AUDIT_STATUS_DISCOVERY: {
    async getCampaignStatus({ campaignId }) { return status('campaign', campaignId); },
    async getJobStatus({ jobId }) { return status('job', jobId); }
  }
};

function request(path, token = 'gpt', method = 'GET') {
  return new Request(`https://api.example${path}`, {
    method,
    headers: { authorization: `Bearer ${token}` }
  });
}

test('real entry composes Phase 4, Phase 5, Phase 6, report, and GPT handlers before legacy fallback', async () => {
  for (const path of [
    '/audit/v1/tool-profiles',
    '/audit/v1/phase5/tool-profiles',
    '/audit/v1/phase6/tool-profiles',
    '/audit/v1/reports',
    '/audit/v1/gpt/capabilities',
    '/audit/v1/gpt/catalog',
    '/audit/v1/gpt/reports',
    '/audit/v1/gpt/campaigns/campaign-a/status',
    '/audit/v1/gpt/jobs/job-a/status'
  ]) {
    const token = path.startsWith('/audit/v1/gpt') ? 'gpt' : 'client';
    const response = await worker.fetch(request(path, token), env);
    assert.equal(response.status, 200, path);
  }
});

test('real entry preserves legacy endpoints and enriches the existing capabilities route truthfully', async () => {
  const legacy = await worker.fetch(request('/audit/v1/legacy'), env);
  assert.equal(legacy.status, 200);
  assert.equal((await legacy.json()).legacyRoute, true);

  const unknown = await worker.fetch(request('/audit/v1/unknown'), env);
  assert.equal(unknown.status, 404);

  const capabilities = await worker.fetch(request('/audit/v1/capabilities', 'read'), env);
  assert.equal(capabilities.status, 200);
  const body = await capabilities.json();
  assert.equal(body.campaigns, true);
  assert.equal(body.phases.phase4.catalog, true);
  assert.equal(body.phases.phase5.catalog, true);
  assert.equal(body.executionEnabled, false);
  assert.equal(body.executorState, 'unavailable');

  const readiness = await worker.fetch(request('/audit/v1/readiness', 'read'), env);
  assert.equal(readiness.status, 200);
  assert.equal((await readiness.json()).configuration.executionEnabled, false);
});

test('real entry rejects writes without consuming hostile bodies', async () => {
  const stream = new ReadableStream({
    start(controller) { controller.error(new Error('body must not be read')); }
  });
  const response = await worker.fetch(new Request(
    'https://api.example/audit/v1/gpt/catalog',
    {
      method: 'POST',
      headers: { authorization: 'Bearer gpt' },
      body: stream,
      duplex: 'half'
    }
  ), env);
  assert.equal(response.status, 405);
});
