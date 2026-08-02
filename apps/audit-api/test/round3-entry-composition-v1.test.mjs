import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/entry.mjs';

function report(id, workspaceId = 'workspace-a') {
  return {
    schemaVersion: 'audit-report-reference-v1',
    reportId: id,
    tenantId: 'tenant-a',
    workspaceId,
    campaignId: 'campaign-a',
    jobId: 'job-a',
    reportSchemaVersion: 'audit-report-v1',
    digest: `sha256:${id.padEnd(64, '0').slice(0, 64)}`,
    createdAt: '2026-08-02T02:45:00.000Z',
    summary: { classification: 'success', findingCount: 0, evidenceCount: 1, truncated: false }
  };
}
function status(resourceType, resourceId, state = 'completed') {
  const terminal = !['active', 'running', 'awaiting_executor'].includes(state);
  return {
    schemaVersion: 'audit-status-summary-v1',
    resourceType,
    resourceId,
    tenantId: 'tenant-a',
    workspaceId: 'workspace-a',
    state,
    updatedAt: '2026-08-02T02:45:00.000Z',
    terminal,
    progress: { completed: terminal ? 1 : 0, total: 1 }
  };
}
function evidence(jobId) {
  return {
    schemaVersion: 'audit-evidence-summary-v1',
    jobId,
    tenantId: 'tenant-a',
    workspaceId: 'workspace-a',
    classification: 'success',
    findingCount: 0,
    evidenceCount: 1,
    artifactCount: 0,
    truncated: false,
    updatedAt: '2026-08-02T02:45:00.000Z'
  };
}

function environment(overrides = {}) {
  return {
    AUDIT_CLIENT_API_KEY: 'client',
    AUDIT_GPT_API_KEY: 'gpt',
    AUDIT_READ_API_KEY: 'read',
    AUDIT_SUBMIT_API_KEY: 'submit',
    AUDIT_ADMIN_API_KEY: 'admin',
    CORS_ORIGIN: 'https://audit.example',
    AUDIT_READ_SCOPES: {
      client: { tenantId: 'tenant-a', workspaceId: 'workspace-a' },
      gpt: { tenantId: 'tenant-a', workspaceId: 'workspace-a' },
      'legacy-read': { tenantId: 'tenant-a', workspaceId: 'workspace-a' },
      'legacy-submit': { tenantId: 'tenant-a', workspaceId: 'workspace-a' },
      'legacy-admin': { tenantId: 'tenant-a', workspaceId: 'workspace-a' }
    },
    AUDIT_REPORT_DISCOVERY: {
      async listReports() { return [report('a')]; },
      async getReport({ reportId }) { return reportId === 'a' ? report('a') : null; }
    },
    AUDIT_STATUS_DISCOVERY: {
      async getWorkspaceStatus({ workspaceId }) { return status('workspace', workspaceId, 'active'); },
      async getCampaignStatus({ campaignId }) { return status('campaign', campaignId); },
      async getJobStatus({ jobId }) { return status('job', jobId); },
      async getForkStatus({ forkId }) { return status('fork', forkId, 'awaiting_executor'); },
      async getCleanRoomStatus({ cleanRoomId }) { return status('clean-room', cleanRoomId, 'active'); },
      async getEvidenceSummary({ jobId }) { return evidence(jobId); }
    },
    ...overrides
  };
}

function request(path, token = 'gpt', method = 'GET', init = {}) {
  return new Request(`https://api.example${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    ...(init.body ? { body: init.body, duplex: 'half' } : {}),
    ...(init.signal ? { signal: init.signal } : {})
  });
}

const readRoutes = Object.freeze([
  ['/audit/v1/tool-profiles', 'client'],
  ['/audit/v1/phase5/tool-profiles', 'client'],
  ['/audit/v1/phase6/tool-profiles', 'client'],
  ['/audit/v1/reports', 'client'],
  ['/audit/v1/reports/a', 'client'],
  ['/audit/v1/gpt/capabilities', 'gpt'],
  ['/audit/v1/gpt/catalog', 'gpt'],
  ['/audit/v1/gpt/catalog/solidity-compile-v1', 'gpt'],
  ['/audit/v1/gpt/reports/a', 'gpt'],
  ['/audit/v1/gpt/workspaces/workspace-a/status', 'gpt'],
  ['/audit/v1/gpt/campaigns/campaign-a/status', 'gpt'],
  ['/audit/v1/gpt/jobs/job-a/status', 'gpt'],
  ['/audit/v1/gpt/forks/fork-a/status', 'gpt'],
  ['/audit/v1/gpt/clean-rooms/clean-room-a/status', 'gpt'],
  ['/audit/v1/gpt/jobs/job-a/evidence-summary', 'gpt']
]);

test('real exported entry routes the complete Round 3 read registry before legacy fallback', async () => {
  const env = environment();
  for (const [path, token] of readRoutes) {
    const response = await worker.fetch(request(path, token), env);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  }
});

test('real entry preserves legacy fallback, readiness, and truthfully enriched capabilities', async () => {
  const env = environment();
  const legacy = await worker.fetch(request('/audit/v1/legacy', 'read'), env);
  assert.equal(legacy.status, 200);
  assert.equal((await legacy.json()).legacyRoute, true);

  const unknown = await worker.fetch(request('/audit/v1/unknown', 'read'), env);
  assert.equal(unknown.status, 404);

  const capabilities = await worker.fetch(request('/audit/v1/capabilities', 'read'), env);
  assert.equal(capabilities.status, 200);
  const body = await capabilities.json();
  assert.equal(body.phases.phase4.catalog, true);
  assert.equal(body.phases.phase5.catalog, true);
  assert.equal(body.phases.phase6.catalog, true);
  assert.equal(body.phases.phase7.available, false);
  assert.equal(body.phases.phase8.available, false);
  assert.equal(body.phases.phase7.serviceDiscovery, true);
  assert.equal(body.executionEnabled, false);
  assert.equal(body.executorState, 'unavailable');

  const readiness = await worker.fetch(request('/audit/v1/readiness', 'read'), env);
  assert.equal(readiness.status, 200);
  assert.equal((await readiness.json()).configuration.executionEnabled, false);
});

test('OPTIONS and malformed route behavior is deterministic across the real entry', async () => {
  const env = environment();
  for (const [path] of readRoutes) {
    const response = await worker.fetch(request(path, 'unrelated', 'OPTIONS'), env);
    assert.equal(response.status, 204, path);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://audit.example');
  }
  for (const path of [
    '/audit/v1/tool-profiles/%',
    '/audit/v1/phase5/tool-profiles/%2F',
    '/audit/v1/gpt/jobs/%/status',
    '/audit/v1/reports/a/extra'
  ]) {
    const response = await worker.fetch(request(path), env);
    assert.equal(response.status, 400, path);
  }
});

test('every Round 3 read route rejects writes without consuming hostile request bodies', async () => {
  const env = environment();
  for (const [path, token] of readRoutes) {
    const stream = new ReadableStream({ start(controller) { controller.error(new Error('body must not be read')); } });
    const response = await worker.fetch(request(path, token, 'POST', { body: stream }), env);
    assert.equal(response.status, 405, path);
  }
});

test('concurrent real-entry requests remain deterministic and do not cross workspace cache scope', async () => {
  const envA = environment();
  const envB = environment({
    AUDIT_READ_SCOPES: {
      ...environment().AUDIT_READ_SCOPES,
      gpt: { tenantId: 'tenant-a', workspaceId: 'workspace-b' }
    }
  });
  const requests = [];
  for (let index = 0; index < 20; index += 1) {
    requests.push(worker.fetch(request('/audit/v1/gpt/capabilities'), index % 2 === 0 ? envA : envB));
  }
  const responses = await Promise.all(requests);
  const etagsA = new Set();
  const etagsB = new Set();
  for (let index = 0; index < responses.length; index += 1) {
    assert.equal(responses[index].status, 200);
    (index % 2 === 0 ? etagsA : etagsB).add(responses[index].headers.get('etag'));
  }
  assert.equal(etagsA.size, 1);
  assert.equal(etagsB.size, 1);
  assert.notEqual([...etagsA][0], [...etagsB][0]);
});

test('already-aborted and mid-provider-aborted reads return a stable cancellation response without leaking provider data', async () => {
  const already = new AbortController();
  already.abort('provider-controlled-marker');
  const first = await worker.fetch(request('/audit/v1/gpt/capabilities', 'gpt', 'GET', { signal: already.signal }), environment());
  assert.equal(first.status, 499);
  assert.equal((await first.json()).error.code, 'request_cancelled');

  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const env = environment({
    AUDIT_STATUS_DISCOVERY: {
      ...environment().AUDIT_STATUS_DISCOVERY,
      async getJobStatus({ jobId }) {
        await gate;
        return status('job', jobId);
      }
    }
  });
  const controller = new AbortController();
  const pending = worker.fetch(request('/audit/v1/gpt/jobs/job-a/status', 'gpt', 'GET', { signal: controller.signal }), env);
  controller.abort('nested-secret');
  release();
  const second = await pending;
  assert.equal(second.status, 499);
  const text = await second.text();
  assert.equal(text.includes('nested-secret'), false);
  assert.equal(JSON.parse(text).error.code, 'request_cancelled');
});
