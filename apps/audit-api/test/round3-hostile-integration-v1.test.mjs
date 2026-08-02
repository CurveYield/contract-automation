import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePhase9GptRequest } from '../src/phase9-gpt.mjs';
import { handlePhase9ReportRequest } from '../src/phase9-reports.mjs';

const scope = { tenantId: 'tenant-a', workspaceId: 'workspace-a' };
const request = (path, token = 'gpt-secret') => new Request(`https://api.example${path}`, {
  headers: { authorization: `Bearer ${token}` }
});
function baseEnv(overrides = {}) {
  return {
    AUDIT_CLIENT_API_KEY: 'client-secret',
    AUDIT_GPT_API_KEY: 'gpt-secret',
    CORS_ORIGIN: 'https://audit.example',
    AUDIT_READ_SCOPES: {
      client: scope,
      gpt: scope
    },
    ...overrides
  };
}
function status(jobId = 'job-a') {
  return {
    schemaVersion: 'audit-status-summary-v1',
    resourceType: 'job',
    resourceId: jobId,
    ...scope,
    state: 'completed',
    updatedAt: '2026-08-02T02:45:00.000Z',
    terminal: true,
    progress: { completed: 1, total: 1 }
  };
}
function report(reportId = 'report-a') {
  return {
    schemaVersion: 'audit-report-reference-v1',
    reportId,
    ...scope,
    campaignId: 'campaign-a',
    jobId: 'job-a',
    reportSchemaVersion: 'audit-report-v1',
    digest: `sha256:${'a'.repeat(64)}`,
    createdAt: '2026-08-02T02:45:00.000Z',
    summary: { classification: 'success', findingCount: 0, evidenceCount: 1, truncated: false }
  };
}

async function body(response) {
  return { status: response.status, text: await response.text() };
}

test('hostile status outputs normalize class, custom prototype, accessor, sparse array, cycle, symbol, and oversized variants', async () => {
  const variants = [];
  variants.push(new (class StatusRecord { constructor() { Object.assign(this, status()); } })());
  variants.push(Object.assign(Object.create({ inherited: true }), status()));
  const accessor = status();
  Object.defineProperty(accessor, 'state', { enumerable: true, get() { throw new Error('nested-secret'); } });
  variants.push(accessor);
  const sparse = status();
  sparse.progress = [];
  sparse.progress.length = 2;
  sparse.progress[1] = 1;
  variants.push(sparse);
  const cyclic = status();
  cyclic.progress.self = cyclic;
  variants.push(cyclic);
  const symbolic = status();
  symbolic[Symbol('secret')] = true;
  variants.push(symbolic);
  const oversized = status();
  oversized.resourceId = 'x'.repeat(20_000);
  variants.push(oversized);

  for (const value of variants) {
    const response = await handlePhase9GptRequest(request('/audit/v1/gpt/jobs/job-a/status'), baseEnv({
      AUDIT_STATUS_DISCOVERY: { async getJobStatus() { return value; } }
    }));
    assert.equal(response.status, 500);
    const text = await response.text();
    assert.equal(text.includes('nested-secret'), false);
    assert.equal(text.includes('inherited'), false);
    assert.equal(text.length < 1_000, true);
  }
});

test('hostile report outputs normalize prototype pollution, accessors, cycles, unsafe numbers, and extra execution fields', async () => {
  const variants = [];
  variants.push(JSON.parse(`{"__proto__":{"polluted":true},"schemaVersion":"audit-report-reference-v1"}`));
  const accessor = report();
  Object.defineProperty(accessor, 'digest', { enumerable: true, get() { throw new Error('supersecret'); } });
  variants.push(accessor);
  const cyclic = report();
  cyclic.summary.self = cyclic;
  variants.push(cyclic);
  const unsafe = report();
  unsafe.summary.findingCount = Number.MAX_SAFE_INTEGER + 1;
  variants.push(unsafe);
  const enabled = report();
  enabled.executionEnabled = true;
  variants.push(enabled);
  const bytes = report();
  bytes.artifactBytes = new Uint8Array([1, 2, 3]);
  variants.push(bytes);

  for (const value of variants) {
    const response = await handlePhase9ReportRequest(request('/audit/v1/reports/report-a', 'client-secret'), baseEnv({
      AUDIT_REPORT_DISCOVERY: { async getReport() { return value; } }
    }));
    assert.equal(response.status, 500);
    const text = await response.text();
    assert.equal(text.includes('supersecret'), false);
    assert.equal(text.includes('polluted'), false);
    assert.equal(text.includes('artifactBytes'), false);
  }
  assert.equal(Object.prototype.polluted, undefined);
});

test('provider throws, rejected promises, hostile reflection, and partial output converge on bounded stable error classes', async () => {
  const errors = [
    () => { throw new Error('Authorization: Bearer supersecret https://attacker.example'); },
    async () => Promise.reject(new Error('/home/alice/private nested-secret')),
    () => new Proxy({}, { ownKeys() { throw new Error('provider-controlled-marker'); } }),
    () => ({ ...status(), progress: { completed: 1 } })
  ];
  const outputs = [];
  for (const getJobStatus of errors) {
    const response = await handlePhase9GptRequest(request('/audit/v1/gpt/jobs/job-a/status'), baseEnv({
      AUDIT_STATUS_DISCOVERY: { getJobStatus }
    }));
    outputs.push(await body(response));
  }
  for (const output of outputs) {
    assert.equal(output.status, 500);
    assert.equal(output.text.includes('supersecret'), false);
    assert.equal(output.text.includes('attacker.example'), false);
    assert.equal(output.text.includes('/home/'), false);
    assert.equal(output.text.includes('provider-controlled-marker'), false);
    assert.equal(output.text.length < 1_000, true);
  }
});

test('concurrent tenant/workspace scopes remain isolated across provider arguments, bodies, cursors, and cache keys', async () => {
  const observed = [];
  const makeEnv = (tenantId, workspaceId, token) => ({
    AUDIT_GPT_API_KEY: token,
    CORS_ORIGIN: 'https://audit.example',
    AUDIT_READ_SCOPES: { gpt: { tenantId, workspaceId } },
    AUDIT_STATUS_DISCOVERY: {
      async getJobStatus(argument) {
        observed.push(argument);
        return {
          ...status('job-a'),
          tenantId,
          workspaceId
        };
      }
    }
  });
  const cases = [
    ['tenant-a', 'workspace-a', 'token-a'],
    ['tenant-b', 'workspace-b', 'token-b'],
    ['tenant-c', 'workspace-c', 'token-c']
  ];
  const responses = await Promise.all(cases.flatMap(([tenantId, workspaceId, token]) => (
    Array.from({ length: 8 }, () => handlePhase9GptRequest(
      request('/audit/v1/gpt/jobs/job-a/status', token),
      makeEnv(tenantId, workspaceId, token)
    ))
  )));
  const etags = new Set(responses.map((response) => response.headers.get('etag')));
  assert.equal(responses.every((response) => response.status === 200), true);
  assert.equal(etags.size, 3);
  assert.equal(observed.length, 24);
  for (const [index, argument] of observed.entries()) {
    const expected = cases[Math.floor(index / 8)];
    assert.equal(argument.tenantId, expected[0]);
    assert.equal(argument.workspaceId, expected[1]);
    assert.equal('token' in argument, false);
    assert.equal('authorization' in argument, false);
  }
});

test('request-supplied capability, execution, scope, and identity fields never alter the server-owned response', async () => {
  const clean = await handlePhase9GptRequest(request('/audit/v1/gpt/capabilities'), baseEnv());
  const hostile = await handlePhase9GptRequest(request(
    '/audit/v1/gpt/capabilities?executionEnabled=true&phase7Available=true&tenantId=tenant-b&scope=admin'
  ), baseEnv());
  assert.equal(clean.status, 200);
  assert.equal(hostile.status, 400);
  const bodyValue = await clean.json();
  assert.equal(bodyValue.executionEnabled, false);
  assert.equal(bodyValue.phases.phase7.available, false);
  assert.equal(bodyValue.phases.phase8.available, false);
});
