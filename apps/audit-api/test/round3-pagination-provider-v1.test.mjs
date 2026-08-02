import test from 'node:test';
import assert from 'node:assert/strict';
import { encodePageCursor } from '../../../packages/audit-api-contracts/src/index.mjs';
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
const request = (path) => new Request(`https://api.example${path}`, {
  headers: { authorization: 'Bearer client-secret' }
});

function envWithProvider(provider) {
  return { ...baseEnv, AUDIT_REPORT_DISCOVERY: provider };
}

test('provider output is canonicalized before pagination, independent of input order', async () => {
  const forward = envWithProvider({
    async listReports() { return [report('c'), report('a'), report('b')]; }
  });
  const reverse = envWithProvider({
    async listReports() { return [report('b'), report('a'), report('c')]; }
  });
  const left = await handlePhase9ReportRequest(request('/audit/v1/reports?limit=2'), forward);
  const right = await handlePhase9ReportRequest(request('/audit/v1/reports?limit=2'), reverse);
  assert.equal(left.status, 200);
  assert.equal(right.status, 200);
  assert.equal(await left.text(), await right.text());
});

test('well-formed hidden rows do not affect body, cache metadata, count class, or next cursor', async () => {
  const visibleOnly = envWithProvider({
    async listReports() { return [report('a')]; }
  });
  const withHidden = envWithProvider({
    async listReports() { return [report('hidden', 'workspace-hidden'), report('a')]; }
  });
  const absent = await handlePhase9ReportRequest(request('/audit/v1/reports'), visibleOnly);
  const hidden = await handlePhase9ReportRequest(request('/audit/v1/reports'), withHidden);
  assert.equal(hidden.status, 200);
  assert.equal(absent.status, 200);
  assert.equal(await hidden.text(), await absent.text());
  assert.equal(hidden.headers.get('etag'), absent.headers.get('etag'));
  assert.equal(hidden.headers.get('cache-control'), absent.headers.get('cache-control'));
});

test('exact duplicate rows deduplicate and byte-different duplicate identities fail closed', async () => {
  const identical = await handlePhase9ReportRequest(request('/audit/v1/reports'), envWithProvider({
    async listReports() { return [report('a'), report('a')]; }
  }));
  assert.equal(identical.status, 200);
  assert.equal((await identical.json()).reports.length, 1);

  const conflict = await handlePhase9ReportRequest(request('/audit/v1/reports'), envWithProvider({
    async listReports() { return [report('a', 'workspace-a', 'a'), report('a', 'workspace-a', 'b')]; }
  }));
  assert.equal(conflict.status, 500);
  assert.equal((await conflict.json()).error.code, 'provider_contract_error');
});

test('provider page wrapper requires exact version, snapshot, and bounded items', async () => {
  const good = await handlePhase9ReportRequest(request('/audit/v1/reports'), envWithProvider({
    async listReports() {
      return {
        schemaVersion: 'audit-report-provider-page-v1',
        snapshotVersion: 'snapshot-7',
        items: [report('a')]
      };
    }
  }));
  assert.equal(good.status, 200);

  for (const returned of [
    { schemaVersion: 'wrong', snapshotVersion: 'snapshot-7', items: [] },
    { schemaVersion: 'audit-report-provider-page-v1', snapshotVersion: '', items: [] },
    { schemaVersion: 'audit-report-provider-page-v1', snapshotVersion: 'snapshot-7', items: [], extra: true },
    { schemaVersion: 'audit-report-provider-page-v1', snapshotVersion: 'snapshot-7', items: 'not-an-array' }
  ]) {
    const response = await handlePhase9ReportRequest(request('/audit/v1/reports'), envWithProvider({
      async listReports() { return returned; }
    }));
    assert.equal(response.status, 500);
    assert.equal((await response.json()).error.code, 'provider_contract_error');
  }
});

test('stale, tampered, cross-scope, malformed, and duplicate-query cursors reject deterministically', async () => {
  const scoped = await encodePageCursor({
    scope: 'tenant-a/workspace-a',
    kind: 'reports',
    after: 'a'
  });
  const stale = await encodePageCursor({
    scope: 'tenant-a/workspace-a',
    kind: 'reports',
    after: 'deleted'
  });
  const crossScope = await encodePageCursor({
    scope: 'tenant-a/workspace-b',
    kind: 'reports',
    after: 'a'
  });
  const provider = envWithProvider({ async listReports() { return [report('a'), report('b')]; } });
  const cases = [
    [`?cursor=${encodeURIComponent(stale)}`, 'stale_cursor'],
    [`?cursor=${encodeURIComponent(`${scoped}x`)}`, 'invalid_cursor'],
    [`?cursor=${encodeURIComponent(crossScope)}`, 'invalid_cursor'],
    ['?cursor=%', 'invalid_cursor'],
    [`?cursor=${encodeURIComponent(scoped)}&cursor=${encodeURIComponent(scoped)}`, 'invalid_query'],
    ['?limit=0', 'invalid_limit'],
    ['?limit=101', 'invalid_limit']
  ];
  for (const [query, code] of cases) {
    const response = await handlePhase9ReportRequest(request(`/audit/v1/reports${query}`), provider);
    assert.equal(response.status, 400, query);
    assert.equal((await response.json()).error.code, code, query);
  }
});

test('hostile provider accessors and reflection failures are normalized without invoking getters', async () => {
  let getterCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, 'listReports', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return async () => [];
    }
  });
  const response = await handlePhase9ReportRequest(request('/audit/v1/reports'), envWithProvider(accessor));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'service_unavailable');
  assert.equal(getterCalls, 0);

  const hostile = new Proxy({}, {
    getOwnPropertyDescriptor() { throw new Error('Authorization: Bearer leaked-secret'); }
  });
  const reflected = await handlePhase9ReportRequest(request('/audit/v1/reports'), envWithProvider(hostile));
  assert.equal(reflected.status, 503);
  const text = await reflected.text();
  assert.equal(text.includes('leaked-secret'), false);
});

test('provider receives only server-owned tenant/workspace identity and cannot receive credential or request authority aliases', async () => {
  let observed;
  const response = await handlePhase9ReportRequest(request(
    '/audit/v1/reports?limit=2'
  ), envWithProvider({
    async listReports(argument) {
      observed = argument;
      return [report('a')];
    }
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(observed, { tenantId: 'tenant-a', workspaceId: 'workspace-a' });
  assert.equal(JSON.stringify(observed).includes('client-secret'), false);
});
