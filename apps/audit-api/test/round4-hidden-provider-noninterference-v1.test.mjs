import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePhase9ReportRequest } from '../src/phase9-reports.mjs';

function report(reportId, workspaceId = 'workspace-a', digestCharacter = 'a') {
  return {
    schemaVersion: 'audit-report-reference-v1',
    reportId,
    tenantId: 'tenant-a',
    workspaceId,
    campaignId: 'campaign-a',
    jobId: 'job-a',
    reportSchemaVersion: 'audit-report-v1',
    digest: `sha256:${digestCharacter.repeat(64)}`,
    createdAt: '2026-08-02T02:45:00.000Z',
    summary: {
      classification: 'findings',
      findingCount: 2,
      evidenceCount: 3,
      truncated: false
    }
  };
}

const baseEnv = {
  AUDIT_CLIENT_API_KEY: 'client-secret',
  CORS_ORIGIN: 'https://audit.example',
  AUDIT_READ_SCOPES: {
    client: { tenantId: 'tenant-a', workspaceId: 'workspace-a' }
  }
};
const request = () => new Request('https://api.example/audit/v1/reports', {
  headers: { authorization: 'Bearer client-secret' }
});
const envWith = (items) => ({
  ...baseEnv,
  AUDIT_REPORT_DISCOVERY: {
    async listReports() { return items; }
  }
});

async function responseSnapshot(response) {
  return {
    status: response.status,
    body: await response.text(),
    etag: response.headers.get('etag'),
    cacheControl: response.headers.get('cache-control')
  };
}

test('hidden accessor-bearing report row is indistinguishable from absence without invoking getter', async () => {
  let getterCalls = 0;
  const hidden = { tenantId: 'tenant-b', workspaceId: 'workspace-b' };
  Object.defineProperty(hidden, 'reportId', {
    enumerable: true,
    get() {
      getterCalls += 1;
      throw new Error('Authorization: Bearer hidden-secret');
    }
  });
  const absent = await responseSnapshot(await handlePhase9ReportRequest(request(), envWith([])));
  const withHidden = await responseSnapshot(await handlePhase9ReportRequest(request(), envWith([hidden])));
  assert.deepEqual(withHidden, absent);
  assert.equal(getterCalls, 0);
});

test('hidden cyclic and oversized report bodies do not affect visible response', async () => {
  const cyclic = { tenantId: 'tenant-b', workspaceId: 'workspace-b' };
  cyclic.self = cyclic;
  const oversized = {
    tenantId: 'tenant-b',
    workspaceId: 'workspace-b',
    reportId: 'hidden',
    padding: 'x'.repeat(9_000)
  };
  const absent = await responseSnapshot(await handlePhase9ReportRequest(request(), envWith([])));
  for (const hidden of [cyclic, oversized]) {
    const observed = await responseSnapshot(await handlePhase9ReportRequest(request(), envWith([hidden])));
    assert.deepEqual(observed, absent);
  }
});

test('visible accessor-bearing report still fails closed without invoking getter', async () => {
  let getterCalls = 0;
  const visible = { tenantId: 'tenant-a', workspaceId: 'workspace-a' };
  Object.defineProperty(visible, 'reportId', {
    enumerable: true,
    get() {
      getterCalls += 1;
      throw new Error('secret');
    }
  });
  const response = await handlePhase9ReportRequest(request(), envWith([visible]));
  assert.equal(response.status, 500);
  assert.equal((await response.json()).error.code, 'provider_contract_error');
  assert.equal(getterCalls, 0);
});

test('valid visible report still renders after shallow scope inspection', async () => {
  const response = await handlePhase9ReportRequest(request(), envWith([report('a')]));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.reports.length, 1);
  assert.equal(body.reports[0].reportId, 'a');
});

test('conflicting visible duplicate identities still fail closed', async () => {
  const response = await handlePhase9ReportRequest(request(), envWith([
    report('a', 'workspace-a', 'a'),
    report('a', 'workspace-a', 'b')
  ]));
  assert.equal(response.status, 500);
  assert.equal((await response.json()).error.code, 'provider_contract_error');
});
