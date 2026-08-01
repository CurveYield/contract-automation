import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePhase9GptRequest } from '../src/phase9-gpt.mjs';

const report = (id) => ({
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
    classification: 'findings',
    findingCount: 2,
    evidenceCount: 3,
    truncated: false
  }
});
const status = (resourceType, resourceId) => ({
  schemaVersion: 'audit-status-summary-v1',
  resourceType,
  resourceId,
  tenantId: 'tenant-a',
  workspaceId: 'workspace-a',
  state: 'completed',
  updatedAt: '2026-08-01T00:00:00.000Z',
  terminal: true,
  progress: { completed: 1, total: 1 }
});
const reportProvider = {
  async listReports() { return [report('b'), report('a')]; },
  async getReport({ reportId }) {
    return reportId === 'missing' || reportId === 'hidden' ? null : report(reportId);
  }
};
const statusProvider = {
  async getCampaignStatus({ campaignId }) {
    return campaignId === 'missing' || campaignId === 'hidden'
      ? null
      : status('campaign', campaignId);
  },
  async getJobStatus({ jobId }) {
    return jobId === 'missing' || jobId === 'hidden'
      ? null
      : status('job', jobId);
  }
};
const env = {
  AUDIT_CLIENT_API_KEY: 'client-secret',
  AUDIT_GPT_API_KEY: 'gpt-secret',
  AUDIT_READ_API_KEY: 'legacy-secret',
  AUDIT_EDGE_CONTROL_PLANE_TOKEN: 'edge-secret',
  CURVEYIELD_LITE_API_KEY: 'lite-secret',
  CORS_ORIGIN: 'https://audit.example',
  AUDIT_READ_SCOPES: {
    client: { tenantId: 'tenant-a', workspaceId: 'workspace-a' },
    gpt: { tenantId: 'tenant-a', workspaceId: 'workspace-a' }
  },
  AUDIT_REPORT_DISCOVERY: reportProvider,
  AUDIT_STATUS_DISCOVERY: statusProvider
};
const request = (path, token = 'gpt-secret', method = 'GET') => new Request(
  `https://api.example${path}`,
  { method, headers: { authorization: `Bearer ${token}` } }
);

test('GPT endpoint matrix exposes bounded read-only capabilities, catalog, reports, campaign status, and job status', async () => {
  const cases = [
    ['/audit/v1/gpt/capabilities', 200],
    ['/audit/v1/gpt/catalog?limit=2', 200],
    ['/audit/v1/gpt/catalog/solidity-compile-v1', 200],
    ['/audit/v1/gpt/reports?limit=1', 200],
    ['/audit/v1/gpt/reports/a', 200],
    ['/audit/v1/gpt/campaigns/campaign-a/status', 200],
    ['/audit/v1/gpt/jobs/job-a/status', 200]
  ];
  for (const [path, expected] of cases) {
    const response = await handlePhase9GptRequest(request(path), env);
    assert.equal(response.status, expected, path);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://audit.example');
  }
  assert.equal(
    (await handlePhase9GptRequest(request('/audit/v1/gpt/catalog', 'gpt-secret', 'POST'), env)).status,
    405
  );
  assert.equal((await handlePhase9GptRequest(new Request(
    'https://api.example/audit/v1/gpt/catalog',
    { method: 'OPTIONS' }
  ), env)).status, 204);
});

test('GPT capabilities and catalog are exact, deterministic, non-executing, paginated, and scope-cached', async () => {
  const capability = await handlePhase9GptRequest(request('/audit/v1/gpt/capabilities'), env);
  const capabilityBody = await capability.json();
  assert.equal(capabilityBody.executionEnabled, false);
  assert.equal(capabilityBody.executorState, 'unavailable');
  assert.equal(capabilityBody.phases.phase5.catalog, true);
  assert.equal(capabilityBody.phases.phase5.available, false);
  const first = await handlePhase9GptRequest(request('/audit/v1/gpt/catalog?limit=2'), env);
  const firstBody = await first.json();
  assert.equal(firstBody.profiles.length, 2);
  assert.ok(firstBody.nextCursor);
  assert.equal('total' in firstBody, false);
  const second = await handlePhase9GptRequest(request(
    `/audit/v1/gpt/catalog?limit=2&cursor=${encodeURIComponent(firstBody.nextCursor)}`
  ), env);
  const secondBody = await second.json();
  assert.notEqual(secondBody.profiles[0].profileId, firstBody.profiles[0].profileId);
  assert.match(first.headers.get('etag'), /^"sha256-/);
  assert.equal(first.headers.get('etag').includes('gpt-secret'), false);
  const otherEnv = {
    ...env,
    AUDIT_READ_SCOPES: {
      ...env.AUDIT_READ_SCOPES,
      gpt: { tenantId: 'tenant-a', workspaceId: 'workspace-b' }
    }
  };
  assert.equal((await handlePhase9GptRequest(request(
    `/audit/v1/gpt/catalog?cursor=${encodeURIComponent(firstBody.nextCursor)}`
  ), otherEnv)).status, 400);
});

test('only client and GPT identities may use GPT routes and request data cannot grant scope or capabilities', async () => {
  for (const token of ['client-secret', 'gpt-secret']) {
    assert.equal((await handlePhase9GptRequest(
      request('/audit/v1/gpt/capabilities', token),
      env
    )).status, 200);
  }
  assert.equal((await handlePhase9GptRequest(
    request('/audit/v1/gpt/capabilities', 'legacy-secret'),
    env
  )).status, 403);
  for (const token of ['edge-secret', 'lite-secret', 'wrong', '']) {
    assert.equal((await handlePhase9GptRequest(
      request('/audit/v1/gpt/capabilities', token),
      env
    )).status, 401);
  }
  assert.equal((await handlePhase9GptRequest(
    request('/audit/v1/gpt/capabilities?executionEnabled=true'),
    env
  )).status, 400);
  assert.equal((await handlePhase9GptRequest(
    request('/audit/v1/gpt/reports?tenantId=other'),
    env
  )).status, 400);
});

test('hidden and absent GPT resources are byte-identical for report, campaign, and job lookups', async () => {
  for (const base of [
    '/audit/v1/gpt/reports/',
    '/audit/v1/gpt/campaigns/',
    '/audit/v1/gpt/jobs/'
  ]) {
    const suffix = base.includes('reports') ? '' : '/status';
    const hidden = await handlePhase9GptRequest(request(`${base}hidden${suffix}`), env);
    const absent = await handlePhase9GptRequest(request(`${base}missing${suffix}`), env);
    assert.equal(hidden.status, 404);
    assert.equal(absent.status, 404);
    assert.equal(await hidden.text(), await absent.text());
  }
});

test('GPT provider failures normalize without nested secrets, URLs, paths, headers, or attacker text', async () => {
  const hostile = {
    ...env,
    AUDIT_STATUS_DISCOVERY: {
      ...statusProvider,
      async getJobStatus() {
        const error = new Error(
          'Authorization: Bearer supersecret https://evil.example /home/alice/secret TOKEN=hunter2'
        );
        error.details = { headers: { authorization: 'Bearer nested' } };
        throw error;
      }
    }
  };
  const response = await handlePhase9GptRequest(
    request('/audit/v1/gpt/jobs/job-a/status'),
    hostile
  );
  assert.equal(response.status, 500);
  const text = await response.text();
  for (const value of ['supersecret', 'evil.example', 'alice', 'hunter2', 'nested']) {
    assert.equal(text.includes(value), false);
  }
  assert.equal(JSON.parse(text).error.code, 'internal_error');
});
