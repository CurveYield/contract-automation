import test from 'node:test';
import assert from 'node:assert/strict';
import auditWorker from '../src/entry.mjs';
import { signInternalRequest } from '../src/index.mjs';
import { InMemoryAuditStore } from '../../../packages/audit-r2-store/src/index.mjs';

const workspaceId = `ws_${'1'.repeat(32)}`;
const campaignId = `cmp_${'2'.repeat(32)}`;
const jobId = `ajob_${'3'.repeat(32)}`;
const resumedJobId = `ajob_${'4'.repeat(32)}`;
const attemptId = `att_${'5'.repeat(32)}`;
const artifactId = `art_${'6'.repeat(32)}`;
const profileId = 'slither-solidity-v1';
const expiresAt = '2026-08-01T13:00:00.000Z';

function request(path, init = {}) {
  return new Request(`https://api.audit.preflight.curveyield.online${path}`, init);
}
function bearer(key) { return { authorization: `Bearer ${key}` }; }
function post(path, key, body) {
  return request(path, { method: 'POST', headers: { ...bearer(key), 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
function jobRequest(id = jobId, overrides = {}) {
  return { schemaVersion: 'audit-job-request-v1', jobId: id, campaignId, workspaceId, profileId, tool: 'slither', configuration: { detectors: ['reentrancy'] }, resourceClass: 'standard-test', timeoutSeconds: 1800, expectedEvidence: ['findings.json'], idempotencyKey: `job-${id}`, submittedAt: '2026-07-31T12:05:00.000Z', ...overrides };
}
function objectRef(kind, contentType, bytes = 4) {
  const suffix = kind === 'reports' ? '.zip' : '.tar.zst';
  return {
    schemaVersion: 'audit-object-reference-v1',
    objectKey: `ingress/jobs/${jobId}/attempts/${attemptId}/${kind}/${artifactId}${suffix}`,
    sha256: 'a'.repeat(64),
    bytes,
    contentType,
    expiresAt
  };
}
function env(overrides = {}) {
  const calls = [];
  const campaignService = {
    async createCampaign(input) { calls.push(['createCampaign', input]); return { campaignId, current: { state: 'active' } }; },
    async submitJob(input) { calls.push(['submitJob', input]); return { status: { jobId: input.request.jobId, campaignId, state: 'awaiting_executor', executionEnabled: false }, error: { code: 'execution_plane_unavailable', message: 'disabled' } }; },
    async pollJob(id) { calls.push(['pollJob', id]); return { jobId: id, campaignId, state: id === jobId ? 'cancelled' : 'awaiting_executor', executionEnabled: false }; },
    async cancelJob(id, reason) { calls.push(['cancelJob', id, reason]); return { jobId: id, campaignId, state: 'cancelled', reason, executionEnabled: false }; },
    async claimAttempt(input) { calls.push(['claimAttempt', input]); return { status: { jobId: input.jobId, state: 'provisioning', attemptId: input.attemptId, executionEnabled: false } }; },
    async heartbeat(input) { calls.push(['heartbeat', input]); return { jobId: input.jobId, state: input.state, attemptId: input.attemptId, executionEnabled: false }; },
    async completeJob(input) { calls.push(['completeJob', input]); return { status: { jobId: input.jobId, state: input.finalState, attemptId: input.attemptId, executionEnabled: false } }; }
  };
  const evidenceService = {
    async appendLogChunk(input) { calls.push(['appendLogChunk', input]); return { sequence: input.sequence }; },
    async readLogs(input) { calls.push(['readLogs', input]); return { jobId: input.jobId, attemptId: input.attemptId, chunks: ['one'] }; },
    async publishRawArtifacts(input) { calls.push(['publishRawArtifacts', input]); return { artifactId: input.artifactId }; },
    async acceptEvidence(input) { calls.push(['acceptEvidence', input]); return { artifactId: input.artifactId, accepted: true }; },
    async publishReport(input) { calls.push(['publishReport', input]); return { artifactId: input.artifactId }; },
    async readReports(id) { calls.push(['readReports', id]); return { schemaVersion: 'job-report-index-v1', jobId: id, reports: [artifactId] }; }
  };
  return {
    calls,
    AUDIT_READ_API_KEY: 'audit-read-test-key',
    AUDIT_SUBMIT_API_KEY: 'audit-submit-test-key',
    AUDIT_ADMIN_API_KEY: 'audit-admin-test-key',
    AUDIT_INTERNAL_SERVICE_KEY: 'audit-internal-test-key',
    AUDIT_NONCE_STORE: new InMemoryAuditStore(),
    AUDIT_CAMPAIGN_SERVICE: campaignService,
    AUDIT_EVIDENCE_SERVICE: evidenceService,
    CORS_ORIGIN: 'https://audit.preflight.curveyield.online',
    ...overrides
  };
}

test('Phase 3 health and capabilities advertise storage features but never execution', async () => {
  const state = env();
  const health = await auditWorker.fetch(request('/audit/v1/health'), state);
  assert.deepEqual(await health.json(), { status: 'ok', service: 'curveyield-audit-api', version: '0.3.0', phase: 3 });
  const capabilities = await auditWorker.fetch(request('/audit/v1/capabilities', { headers: bearer('audit-read-test-key') }), state);
  const body = await capabilities.json();
  assert.equal(body.phase, 3);
  assert.equal(body.campaigns, true);
  assert.equal(body.jobs, true);
  assert.equal(body.evidence, true);
  assert.equal(body.executionEnabled, false);
});

test('creates campaigns and persists public jobs only through awaiting_executor', async () => {
  const state = env();
  const created = await auditWorker.fetch(post('/audit/v1/campaigns', 'audit-submit-test-key', {
    creation: { schemaVersion: 'campaign-creation-v1', campaignId, workspaceId, name: 'BoostHub audit', createdAt: '2026-07-31T12:00:00.000Z', retentionPolicy: 'free-development' },
    workspaceIndexEtag: 'etag-workspaces'
  }), state);
  assert.equal(created.status, 201);
  const submitted = await auditWorker.fetch(post(`/audit/v1/campaigns/${campaignId}/jobs`, 'audit-submit-test-key', { request: jobRequest(), jobIndexEtag: 'etag-jobs' }), state);
  assert.equal(submitted.status, 202);
  const body = await submitted.json();
  assert.equal(body.status.state, 'awaiting_executor');
  assert.equal(body.status.executionEnabled, false);
  assert.equal(body.error.code, 'execution_plane_unavailable');
  assert.deepEqual(state.calls.map((item) => item[0]), ['createCampaign', 'submitJob']);
});

test('rejects route/body campaign mismatches before service calls', async () => {
  const state = env();
  const response = await auditWorker.fetch(post(`/audit/v1/campaigns/${campaignId}/jobs`, 'audit-submit-test-key', {
    request: jobRequest(jobId, { campaignId: `cmp_${'9'.repeat(32)}` }), jobIndexEtag: 'etag'
  }), state);
  assert.equal(response.status, 400);
  assert.equal(state.calls.length, 0);
});

test('reads, cancels, and resumes by creating a new awaiting-executor job', async () => {
  const state = env();
  const read = await auditWorker.fetch(request(`/audit/v1/jobs/${jobId}`, { headers: bearer('audit-read-test-key') }), state);
  assert.equal((await read.json()).state, 'cancelled');
  const cancelled = await auditWorker.fetch(post(`/audit/v1/jobs/${jobId}/cancel`, 'audit-submit-test-key', { reason: 'user_requested' }), state);
  assert.equal((await cancelled.json()).state, 'cancelled');
  const resumed = await auditWorker.fetch(post(`/audit/v1/jobs/${jobId}/resume`, 'audit-submit-test-key', {
    request: jobRequest(resumedJobId, { configuration: { resumeOf: jobId } }), jobIndexEtag: 'etag-resume'
  }), state);
  assert.equal(resumed.status, 202);
  assert.equal((await resumed.json()).status.jobId, resumedJobId);
  assert.deepEqual(state.calls.map((item) => item[0]), ['pollJob', 'cancelJob', 'pollJob', 'submitJob']);
});

test('reads deterministic logs and reports with read scope only', async () => {
  const state = env();
  const logs = await auditWorker.fetch(request(`/audit/v1/jobs/${jobId}/logs?attemptId=${attemptId}`, { headers: bearer('audit-read-test-key') }), state);
  assert.deepEqual((await logs.json()).chunks, ['one']);
  const reports = await auditWorker.fetch(request(`/audit/v1/jobs/${jobId}/reports`, { headers: bearer('audit-read-test-key') }), state);
  assert.deepEqual((await reports.json()).reports, [artifactId]);
  assert.deepEqual(state.calls.map((item) => item[0]), ['readLogs', 'readReports']);
});

test('internal fixture routes are disabled before authentication side effects', async () => {
  const state = env();
  const response = await auditWorker.fetch(request(`/audit-internal/v1/jobs/${jobId}/attempts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ attemptId }) }), state);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'trusted_fixture_disabled');
  assert.equal(state.calls.length, 0);
  assert.deepEqual(state.AUDIT_NONCE_STORE.usage(), { classA: 0, classB: 0, free: 0, storedBytes: 0 });
});

test('signed internal fixture attempt is accepted once and replay is rejected', async () => {
  const state = env({ AUDIT_TRUSTED_FIXTURE_ENABLED: 'true' });
  const path = `/audit-internal/v1/jobs/${jobId}/attempts`;
  const body = JSON.stringify({ attemptId });
  const timestamp = Math.floor(Date.now() / 1000);
  const headers = await signInternalRequest({ key: state.AUDIT_INTERNAL_SERVICE_KEY, timestamp, nonce: 'phase3-nonce-0123456789', method: 'POST', path, body });
  const first = await auditWorker.fetch(request(path, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body }), state);
  assert.equal(first.status, 201);
  assert.equal((await first.json()).status.state, 'provisioning');
  const replay = await auditWorker.fetch(request(path, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body }), state);
  assert.equal(replay.status, 409);
  assert.equal((await replay.json()).error.code, 'replay_detected');
  assert.deepEqual(state.calls.map((item) => item[0]), ['claimAttempt']);
});

test('signed internal log, referenced artifact, evidence, report, heartbeat, and completion routes call only reviewed services', async () => {
  const state = env({ AUDIT_TRUSTED_FIXTURE_ENABLED: 'true' });
  const routes = [
    [`/audit-internal/v1/jobs/${jobId}/logs`, { attemptId, sequence: 1, chunkBase64: 'bG9n' }, 'appendLogChunk'],
    [`/audit-internal/v1/jobs/${jobId}/artifacts`, { attemptId, artifactId, objectRef: objectRef('artifacts', 'application/zstd'), manifest: { schemaVersion: 'raw-artifact-manifest-v1' } }, 'publishRawArtifacts'],
    [`/audit-internal/v1/jobs/${jobId}/evidence`, { attemptId, artifactId, objectRef: objectRef('evidence', 'application/zstd'), manifest: { schemaVersion: 'evidence-manifest-v1' } }, 'acceptEvidence'],
    [`/audit-internal/v1/jobs/${jobId}/reports`, { attemptId, artifactId, objectRef: objectRef('reports', 'application/zip', 5_000_000), manifest: { schemaVersion: 'report-manifest-v1' } }, 'publishReport'],
    [`/audit-internal/v1/jobs/${jobId}/heartbeat`, { attemptId, state: 'running', statusEtag: 'etag' }, 'heartbeat'],
    [`/audit-internal/v1/jobs/${jobId}/complete`, { attemptId, statusEtag: 'etag', finalState: 'completed' }, 'completeJob']
  ];
  let index = 0;
  for (const [path, payload, expected] of routes) {
    const body = JSON.stringify(payload);
    const headers = await signInternalRequest({ key: state.AUDIT_INTERNAL_SERVICE_KEY, timestamp: Math.floor(Date.now() / 1000), nonce: `phase3-route-${String(index).padStart(16, '0')}`, method: 'POST', path, body });
    const response = await auditWorker.fetch(request(path, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body }), state);
    assert.ok([200, 201].includes(response.status), `${path}: ${response.status}`);
    assert.equal(state.calls.at(-1)[0], expected);
    if (['publishRawArtifacts', 'acceptEvidence', 'publishReport'].includes(expected)) {
      assert.equal('bundleBytes' in state.calls.at(-1)[1], false);
      assert.equal('reportBytes' in state.calls.at(-1)[1], false);
    }
    index += 1;
  }
});
