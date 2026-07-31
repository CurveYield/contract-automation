import test from 'node:test';
import assert from 'node:assert/strict';
import auditWorker from '../src/entry.mjs';
import { InMemoryAuditStore } from '../../../packages/audit-r2-store/src/index.mjs';

const campaignId = `cmp_${'1'.repeat(32)}`;
const workspaceId = `ws_${'2'.repeat(32)}`;
const jobId = `ajob_${'3'.repeat(32)}`;

function request(path, init = {}) {
  return new Request(`https://api.audit.preflight.curveyield.online${path}`, init);
}
function bearer(key) { return { authorization: `Bearer ${key}` }; }
function post(path, key, body) {
  return request(path, { method: 'POST', headers: { ...bearer(key), 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
function env(overrides = {}) {
  const calls = [];
  return {
    calls,
    AUDIT_READ_API_KEY: 'audit-read-test-key',
    AUDIT_SUBMIT_API_KEY: 'audit-submit-test-key',
    AUDIT_ADMIN_API_KEY: 'audit-admin-test-key',
    AUDIT_INTERNAL_SERVICE_KEY: 'audit-internal-test-key',
    AUDIT_NONCE_STORE: new InMemoryAuditStore(),
    AUDIT_CAMPAIGN_SERVICE: {
      async submitJob(input) {
        calls.push(['submitJob', input]);
        return {
          status: { jobId: input.request.jobId, campaignId, state: 'awaiting_executor', executionEnabled: false },
          error: { code: 'execution_plane_unavailable', message: 'disabled' }
        };
      }
    },
    CORS_ORIGIN: 'https://audit.preflight.curveyield.online',
    ...overrides
  };
}

test('Phase 4 health and capabilities advertise contracts/parsers while execution stays disabled', async () => {
  const state = env();
  const health = await auditWorker.fetch(request('/audit/v1/health'), state);
  assert.deepEqual(await health.json(), { status: 'ok', service: 'curveyield-audit-api', version: '0.4.0', phase: 4 });
  const capabilities = await auditWorker.fetch(request('/audit/v1/capabilities', { headers: bearer('audit-read-test-key') }), state);
  const body = await capabilities.json();
  assert.equal(body.phase, 4);
  assert.equal(body.toolProfileContracts, true);
  assert.equal(body.outputParsers, true);
  assert.equal(body.adapterPlans, true);
  assert.equal(body.executionEnabled, false);
  assert.equal(body.executionState, 'awaiting_executor');
});

test('tool catalog requires Audit read scope and rejects Lite credentials', async () => {
  assert.equal((await auditWorker.fetch(request('/audit/v1/tool-profiles'), env())).status, 401);
  assert.equal((await auditWorker.fetch(request('/audit/v1/tool-profiles', { headers: bearer('lite-client-key') }), env())).status, 401);
  const response = await auditWorker.fetch(request('/audit/v1/tool-profiles', { headers: bearer('audit-read-test-key') }), env());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.profiles.map((item) => item.profileId), ['solidity-compile-v1','foundry-test-v1','foundry-fuzz-v1','foundry-invariant-v1','slither-v1','coverage-forge-v1']);
  assert.ok(body.profiles.every((item) => item.executionEnabled === false && item.publicationState === 'unpublished'));
});

test('reads one tool profile and normalizes unknown profiles to not_found', async () => {
  const response = await auditWorker.fetch(request('/audit/v1/tool-profiles/foundry-fuzz-v1', { headers: bearer('audit-read-test-key') }), env());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.profileId, 'foundry-fuzz-v1');
  assert.equal(body.tool.version, '1.7.1');
  assert.equal(body.parserVersion, 'foundry-fuzz-parser-v1');
  assert.equal(body.configurationSchema.fields[1].name, 'seed');

  const missing = await auditWorker.fetch(request('/audit/v1/tool-profiles/unknown-v1', { headers: bearer('audit-read-test-key') }), env());
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, 'not_found');
});

test('catalog routes are read-only and invoke no R2 or adapter transport', async () => {
  const state = env();
  const response = await auditWorker.fetch(request('/audit/v1/tool-profiles', { method: 'POST', headers: { ...bearer('audit-admin-test-key'), 'content-type': 'application/json' }, body: '{}' }), state);
  assert.equal(response.status, 404);
  assert.equal(state.calls.length, 0);
  assert.deepEqual(state.AUDIT_NONCE_STORE.usage(), { classA: 0, classB: 0, free: 0, storedBytes: 0 });
});

test('Phase 3 public job submission remains awaiting_executor through the Phase 4 composition', async () => {
  const state = env();
  const response = await auditWorker.fetch(post(`/audit/v1/campaigns/${campaignId}/jobs`, 'audit-submit-test-key', {
    request: {
      schemaVersion: 'audit-job-request-v1', jobId, campaignId, workspaceId,
      profileId: 'slither-solidity-v1', tool: 'slither', configuration: { detectors: ['reentrancy-eth'] },
      resourceClass: 'standard-test', timeoutSeconds: 1800, expectedEvidence: ['findings.json'],
      idempotencyKey: 'phase4-regression', submittedAt: '2026-07-31T12:00:00.000Z'
    },
    jobIndexEtag: 'etag-jobs'
  }), state);
  assert.equal(response.status, 202);
  const body = await response.json();
  assert.equal(body.status.state, 'awaiting_executor');
  assert.equal(body.status.executionEnabled, false);
  assert.equal(body.error.code, 'execution_plane_unavailable');
  assert.deepEqual(state.calls.map((item) => item[0]), ['submitJob']);
});
