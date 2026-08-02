import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authenticateAuditRead,
  createJsonResponse,
  encodePageCursor
} from '../../../packages/audit-api-contracts/src/index.mjs';
import {
  createAcceptedPhase6Catalog,
  createAggregateAuditCapabilities,
  createAuditCatalogComposition
} from '../../../packages/audit-catalog-composition/src/index.mjs';
import { PHASE4_PROFILE_CATALOG } from '../../../packages/audit-tool-catalog/src/index.mjs';
import { handlePhase9GptRequest } from '../src/phase9-gpt.mjs';
import { handlePhase9ReportRequest } from '../src/phase9-reports.mjs';

const request = (path, token = 'shared-key') => new Request(`https://api.example${path}`, {
  headers: { authorization: `Bearer ${token}` }
});

const scope = { tenantId: 'tenant-a', workspaceId: 'workspace-a' };
const baseEnv = {
  AUDIT_CLIENT_API_KEY: 'client-key',
  AUDIT_GPT_API_KEY: 'gpt-key',
  AUDIT_READ_SCOPES: {
    client: scope,
    gpt: scope
  },
  CORS_ORIGIN: 'https://audit.example'
};

function report(reportId, workspaceId = 'workspace-a') {
  return {
    schemaVersion: 'audit-report-reference-v1',
    reportId,
    tenantId: 'tenant-a',
    workspaceId,
    campaignId: 'campaign-a',
    jobId: 'job-a',
    reportSchemaVersion: 'audit-report-v1',
    digest: `sha256:${'a'.repeat(64)}`,
    createdAt: '2026-08-01T00:00:00.000Z',
    summary: {
      classification: 'success',
      findingCount: 0,
      evidenceCount: 1,
      truncated: false
    }
  };
}

test('duplicate configured credentials fail closed instead of selecting the first identity', async () => {
  const env = {
    AUDIT_CLIENT_API_KEY: 'shared-key',
    AUDIT_GPT_API_KEY: 'shared-key'
  };
  await assert.rejects(
    () => authenticateAuditRead(request('/audit/v1/gpt/capabilities'), env),
    (error) => error.code === 'credential_configuration_conflict'
  );
});

test('public capability composition cannot fabricate Phase 7 or Phase 8 availability from booleans', () => {
  const catalog = createAuditCatalogComposition({
    phase4Profiles: PHASE4_PROFILE_CATALOG.profiles
  });
  const capabilities = createAggregateAuditCapabilities({
    catalog,
    basePhases: { phase1: true, phase2: true, phase3: true },
    phase7Available: true,
    phase8Available: true
  });
  assert.equal(capabilities.phases.phase7.available, false);
  assert.equal(capabilities.phases.phase8.available, false);
});

test('Phase 6 catalog projection carries exact parser function and result-contract identities', () => {
  for (const entry of createAcceptedPhase6Catalog()) {
    assert.equal(typeof entry.parserFunction, 'string');
    assert.equal(typeof entry.captureSchemaVersion, 'string');
    assert.equal(entry.resultSchemaVersion, 'formal-result-v1');
    assert.equal(entry.trustedProducer, 'curveyield-formal-capture-producer-v1');
  }
});

test('cross-scope report rows are non-interfering rather than changing list status or body class', async () => {
  const env = {
    ...baseEnv,
    AUDIT_REPORT_DISCOVERY: {
      async listReports() { return [report('hidden', 'workspace-hidden')]; }
    }
  };
  const hidden = await handlePhase9ReportRequest(request('/audit/v1/reports', 'client-key'), env);
  const absent = await handlePhase9ReportRequest(request('/audit/v1/reports', 'client-key'), {
    ...env,
    AUDIT_REPORT_DISCOVERY: { async listReports() { return []; } }
  });
  assert.equal(hidden.status, 200);
  assert.equal(await hidden.text(), await absent.text());
});

test('stale report cursors fail deterministically instead of silently returning an empty page', async () => {
  const cursor = await encodePageCursor({
    scope: 'tenant-a/workspace-a',
    kind: 'reports',
    after: 'report-deleted'
  });
  const response = await handlePhase9ReportRequest(request(
    `/audit/v1/reports?cursor=${encodeURIComponent(cursor)}`,
    'client-key'
  ), {
    ...baseEnv,
    AUDIT_REPORT_DISCOVERY: {
      async listReports() { return []; }
    }
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'stale_cursor');
});

test('configured CORS origins with controls fail closed to null without throwing', async () => {
  const response = await createJsonResponse({ ok: true }, {
    env: { CORS_ORIGIN: 'https://audit.example\r\nx-attacker: injected' }
  });
  assert.equal(response.headers.get('access-control-allow-origin'), 'null');
});

test('Round 3 GPT route registry includes workspace, fork, clean-room, and evidence summaries', async () => {
  const env = {
    ...baseEnv,
    AUDIT_STATUS_DISCOVERY: {
      async getWorkspaceStatus() { return null; },
      async getForkStatus() { return null; },
      async getCleanRoomStatus() { return null; },
      async getEvidenceSummary() { return null; }
    }
  };
  for (const path of [
    '/audit/v1/gpt/workspaces/workspace-a/status',
    '/audit/v1/gpt/forks/fork-a/status',
    '/audit/v1/gpt/clean-rooms/clean-room-a/status',
    '/audit/v1/gpt/jobs/job-a/evidence-summary'
  ]) {
    const response = await handlePhase9GptRequest(request(path, 'gpt-key'), env);
    assert.equal(response?.status, 404, path);
  }
});
