import test from 'node:test';
import assert from 'node:assert/strict';
import { encodePageCursor } from '../../../packages/audit-api-contracts/src/index.mjs';
import { handlePhase9GptRequest } from '../src/phase9-gpt.mjs';

function status(resourceType, resourceId, state = 'completed', workspaceId = 'workspace-a') {
  const terminalByState = new Set([
    'archived', 'completed', 'failed', 'cancelled', 'timed_out', 'resource_exhaustion',
    'unavailable', 'deleted', 'policy_rejected'
  ]);
  return {
    schemaVersion: 'audit-status-summary-v1',
    resourceType,
    resourceId,
    tenantId: 'tenant-a',
    workspaceId,
    state,
    updatedAt: '2026-08-02T02:45:00.000Z',
    terminal: terminalByState.has(state),
    progress: { completed: terminalByState.has(state) ? 1 : 0, total: 1 }
  };
}

function evidence(jobId, workspaceId = 'workspace-a') {
  return {
    schemaVersion: 'audit-evidence-summary-v1',
    jobId,
    tenantId: 'tenant-a',
    workspaceId,
    classification: 'findings',
    findingCount: 2,
    evidenceCount: 3,
    artifactCount: 0,
    truncated: false,
    updatedAt: '2026-08-02T02:45:00.000Z'
  };
}

function report(reportId) {
  return {
    schemaVersion: 'audit-report-reference-v1',
    reportId,
    tenantId: 'tenant-a',
    workspaceId: 'workspace-a',
    campaignId: 'campaign-a',
    jobId: 'job-a',
    reportSchemaVersion: 'audit-report-v1',
    digest: `sha256:${'a'.repeat(64)}`,
    createdAt: '2026-08-02T02:45:00.000Z',
    summary: { classification: 'findings', findingCount: 2, evidenceCount: 3, truncated: false }
  };
}

const env = {
  AUDIT_CLIENT_API_KEY: 'client-secret',
  AUDIT_GPT_API_KEY: 'gpt-secret',
  AUDIT_READ_API_KEY: 'legacy-secret',
  AUDIT_SERVICE_READ_API_KEY: 'service-secret',
  AUDIT_AUTHORIZATION_NOW: '2026-08-02T02:45:00.000Z',
  CORS_ORIGIN: 'https://audit.example',
  AUDIT_READ_SCOPES: {
    client: { tenantId: 'tenant-a', workspaceId: 'workspace-a' },
    gpt: { tenantId: 'tenant-a', workspaceId: 'workspace-a' },
    'legacy-read': { tenantId: 'tenant-a', workspaceId: 'workspace-a' },
    'service-read': {
      tenantId: 'tenant-a',
      workspaceId: 'workspace-a',
      scopes: [
        'capabilities.read',
        'catalog.read',
        'clean-room.status.read',
        'evidence.summary.read',
        'fork.status.read',
        'job.status.read',
        'reports.read',
        'workspace.status.read'
      ],
      resourceBindings: [
        'clean-room:clean-room-a',
        'fork:fork-a',
        'job:job-a',
        'report:report-a',
        'workspace:workspace-a'
      ],
      expiresAt: '2026-08-02T03:00:00.000Z',
      revoked: false
    }
  },
  AUDIT_REPORT_DISCOVERY: {
    async listReports() { return [report('report-a')]; },
    async getReport({ reportId }) { return reportId === 'report-a' ? report(reportId) : null; }
  },
  AUDIT_STATUS_DISCOVERY: {
    async getWorkspaceStatus({ workspaceId }) { return workspaceId === 'missing' ? null : status('workspace', workspaceId, 'active'); },
    async getCampaignStatus({ campaignId }) { return campaignId === 'missing' ? null : status('campaign', campaignId); },
    async getJobStatus({ jobId }) { return jobId === 'missing' ? null : status('job', jobId); },
    async getForkStatus({ forkId }) { return forkId === 'missing' ? null : status('fork', forkId, 'awaiting_executor'); },
    async getCleanRoomStatus({ cleanRoomId }) { return cleanRoomId === 'missing' ? null : status('clean-room', cleanRoomId, 'active'); },
    async getEvidenceSummary({ jobId }) { return jobId === 'missing' ? null : evidence(jobId); }
  }
};

const request = (path, token = 'gpt-secret', method = 'GET', headers = {}) => new Request(
  `https://api.example${path}`,
  { method, headers: { authorization: `Bearer ${token}`, ...headers } }
);

test('expanded GPT read registry exposes exact capability, catalog, report, workspace, campaign, job, fork, clean-room, and evidence routes', async () => {
  for (const path of [
    '/audit/v1/gpt/capabilities',
    '/audit/v1/gpt/catalog',
    '/audit/v1/gpt/catalog/solidity-compile-v1',
    '/audit/v1/gpt/reports/report-a',
    '/audit/v1/gpt/workspaces/workspace-a/status',
    '/audit/v1/gpt/campaigns/campaign-a/status',
    '/audit/v1/gpt/jobs/job-a/status',
    '/audit/v1/gpt/forks/fork-a/status',
    '/audit/v1/gpt/clean-rooms/clean-room-a/status',
    '/audit/v1/gpt/jobs/job-a/evidence-summary'
  ]) {
    const response = await handlePhase9GptRequest(request(path), env);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('cache-control'), /^private,/);
    assert.match(response.headers.get('etag'), /^"sha256-/);
  }
});

test('legacy identity is forbidden from every GPT namespace route while client and GPT remain allowed', async () => {
  for (const path of [
    '/audit/v1/gpt/capabilities',
    '/audit/v1/gpt/catalog',
    '/audit/v1/gpt/reports/report-a',
    '/audit/v1/gpt/jobs/job-a/status'
  ]) {
    assert.equal((await handlePhase9GptRequest(request(path, 'legacy-secret'), env)).status, 403, path);
    assert.equal((await handlePhase9GptRequest(request(path, 'client-secret'), env)).status, 200, path);
    assert.equal((await handlePhase9GptRequest(request(path, 'gpt-secret'), env)).status, 200, path);
  }
});

test('service identity is constrained by exact route and resource bindings', async () => {
  for (const path of [
    '/audit/v1/gpt/capabilities',
    '/audit/v1/gpt/catalog',
    '/audit/v1/gpt/reports/report-a',
    '/audit/v1/gpt/workspaces/workspace-a/status',
    '/audit/v1/gpt/jobs/job-a/status',
    '/audit/v1/gpt/forks/fork-a/status',
    '/audit/v1/gpt/clean-rooms/clean-room-a/status',
    '/audit/v1/gpt/jobs/job-a/evidence-summary'
  ]) assert.equal((await handlePhase9GptRequest(request(path, 'service-secret'), env)).status, 200, path);
  for (const path of [
    '/audit/v1/gpt/reports/report-b',
    '/audit/v1/gpt/jobs/job-b/status',
    '/audit/v1/gpt/forks/fork-b/status'
  ]) assert.equal((await handlePhase9GptRequest(request(path, 'service-secret'), env)).status, 404, path);
});

test('hidden, cross-scope, and absent resources are byte-identical', async () => {
  const crossScopeEnv = {
    ...env,
    AUDIT_STATUS_DISCOVERY: {
      ...env.AUDIT_STATUS_DISCOVERY,
      async getJobStatus({ jobId }) { return status('job', jobId, 'completed', 'workspace-hidden'); }
    }
  };
  const hidden = await handlePhase9GptRequest(request('/audit/v1/gpt/jobs/hidden/status'), crossScopeEnv);
  const absent = await handlePhase9GptRequest(request('/audit/v1/gpt/jobs/missing/status'), env);
  assert.equal(hidden.status, 404);
  assert.equal(absent.status, 404);
  assert.equal(await hidden.text(), await absent.text());
});

test('malformed paths, unknown queries, duplicated queries, writes, and request authority substitution fail deterministically without body parsing', async () => {
  for (const path of [
    '/audit/v1/gpt/jobs/%/status',
    '/audit/v1/gpt/jobs/job-a/extra',
    '/audit/v1/gpt/jobs/job-a/status?tenantId=tenant-b',
    '/audit/v1/gpt/catalog?limit=1&limit=2'
  ]) assert.equal((await handlePhase9GptRequest(request(path), env)).status, 400, path);
  const stream = new ReadableStream({ start(controller) { controller.error(new Error('must not read')); } });
  const write = new Request('https://api.example/audit/v1/gpt/jobs/job-a/status', {
    method: 'POST',
    headers: {
      authorization: 'Bearer gpt-secret',
      'x-audit-tenant': 'tenant-b',
      'x-audit-scope': 'job.status.read'
    },
    body: stream,
    duplex: 'half'
  });
  assert.equal((await handlePhase9GptRequest(write, env)).status, 405);
});

test('catalog cursor anchors are scope-bound and stale anchors reject', async () => {
  const stale = await encodePageCursor({
    scope: 'tenant-a/workspace-a',
    kind: 'gpt-catalog',
    after: 'deleted-profile-v1'
  });
  const response = await handlePhase9GptRequest(request(
    `/audit/v1/gpt/catalog?cursor=${encodeURIComponent(stale)}`
  ), env);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'stale_cursor');
});

test('cache metadata cannot cross workspace scope or include credentials', async () => {
  const other = {
    ...env,
    AUDIT_READ_SCOPES: {
      ...env.AUDIT_READ_SCOPES,
      gpt: { tenantId: 'tenant-a', workspaceId: 'workspace-b' }
    }
  };
  const one = await handlePhase9GptRequest(request('/audit/v1/gpt/capabilities'), env);
  const two = await handlePhase9GptRequest(request('/audit/v1/gpt/capabilities'), other);
  assert.notEqual(one.headers.get('etag'), two.headers.get('etag'));
  assert.equal(one.headers.get('etag').includes('gpt-secret'), false);
  assert.equal(two.headers.get('etag').includes('gpt-secret'), false);
});
