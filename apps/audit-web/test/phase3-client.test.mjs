import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuditApiClient } from '../src/client.mjs';

const campaignId = `cmp_${'1'.repeat(32)}`;
const jobId = `ajob_${'2'.repeat(32)}`;
const resumedJobId = `ajob_${'3'.repeat(32)}`;
const attemptId = `att_${'4'.repeat(32)}`;

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('Phase 3 browser client uses only authenticated Audit metadata routes', async () => {
  const calls = [];
  const client = createAuditApiClient({
    apiUrl: 'https://api.audit.preflight.curveyield.online',
    apiKey: 'audit-submit-key',
    fetcher: async (url, init) => { calls.push({ url, init }); return response({ ok: true }); }
  });
  await client.createCampaign({ creation: { campaignId }, workspaceIndexEtag: 'etag' });
  await client.getCampaign(campaignId);
  await client.submitCampaignJob(campaignId, { request: { jobId }, jobIndexEtag: 'etag' });
  await client.getJob(jobId);
  await client.cancelJob(jobId, { reason: 'user_requested' });
  await client.resumeJob(jobId, { request: { jobId: resumedJobId }, jobIndexEtag: 'etag' });
  await client.getJobLogs(jobId, attemptId);
  await client.getJobReports(jobId);
  assert.equal(calls.length, 8);
  for (const call of calls) {
    const parsed = new URL(call.url);
    assert.match(parsed.pathname, /^\/audit\/v1\//);
    assert.equal(call.init.headers.get('authorization'), 'Bearer audit-submit-key');
    assert.doesNotMatch(call.url, /\/api\/v1|\/internal\/v1|r2|access_key/i);
  }
});

test('Phase 3 path identifiers are validated before fetch', async () => {
  let calls = 0;
  const client = createAuditApiClient({ apiUrl: 'https://api.audit.preflight.curveyield.online', apiKey: 'key', fetcher: async () => { calls += 1; return response({}); } });
  await assert.rejects(() => client.getCampaign('cmp_bad'), /campaign/i);
  await assert.rejects(() => client.getJob('job_bad'), /job/i);
  await assert.rejects(() => client.getJobLogs(jobId, 'att_bad'), /attempt/i);
  assert.equal(calls, 0);
});

test('browser client exposes metadata controls but no R2, fixture, command, execution, or broadcast methods', () => {
  const client = createAuditApiClient({ apiUrl: 'https://api.audit.preflight.curveyield.online', apiKey: 'key', fetcher: async () => response({}) });
  for (const method of ['createCampaign', 'submitCampaignJob', 'getJob', 'cancelJob', 'resumeJob', 'getJobLogs', 'getJobReports']) assert.equal(typeof client[method], 'function');
  for (const forbidden of ['listR2Objects', 'putR2Object', 'claimAttempt', 'appendLogChunk', 'acceptEvidence', 'executeJob', 'runCommand', 'broadcastTransaction', 'setRpcUrl']) assert.equal(forbidden in client, false);
});
