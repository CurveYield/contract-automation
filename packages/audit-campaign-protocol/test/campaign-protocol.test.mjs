import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPAIGN_OPERATION_BUDGETS,
  JOB_STATES,
  TERMINAL_JOB_STATES,
  assertJobTransition,
  attemptKey,
  campaignCreationKey,
  campaignCurrentKey,
  campaignJobIndexKey,
  eventBatchKey,
  evidenceAcceptedKey,
  evidenceAttestationKey,
  evidenceManifestKey,
  evidenceQuarantineKey,
  jobRequestKey,
  jobStatusKey,
  logChunkKey,
  logIndexKey,
  rawArtifactBundleKey,
  rawArtifactManifestKey,
  reportBundleKey,
  reportIndexKey,
  reportManifestKey,
  validateCampaignCreation,
  validateEventBatch,
  validateJobRequest,
  validateJobStatus,
  workspaceCampaignIndexKey
} from '../src/index.mjs';

const workspaceId = `ws_${'1'.repeat(32)}`;
const campaignId = `cmp_${'2'.repeat(32)}`;
const jobId = `ajob_${'3'.repeat(32)}`;
const attemptId = `att_${'4'.repeat(32)}`;
const artifactId = `art_${'5'.repeat(32)}`;

function campaign(overrides = {}) {
  return { schemaVersion: 'campaign-creation-v1', campaignId, workspaceId, name: 'BoostHub full audit', createdAt: '2026-07-31T12:00:00.000Z', retentionPolicy: 'free-development', ...overrides };
}
function job(overrides = {}) {
  return { schemaVersion: 'audit-job-request-v1', jobId, campaignId, workspaceId, profileId: 'slither-solidity-v1', tool: 'slither', configuration: { detectors: ['reentrancy'] }, resourceClass: 'standard-test', timeoutSeconds: 1800, expectedEvidence: ['findings.json'], idempotencyKey: 'boosthub-slither-001', submittedAt: '2026-07-31T12:05:00.000Z', ...overrides };
}

test('publishes the exact Phase 3 lifecycle and approved operation budgets', () => {
  assert.deepEqual(JOB_STATES, ['submitted','validating','admitted','queued','awaiting_executor','provisioning','running','collecting_evidence','completed','failed','cancelled','timed_out','policy_rejected']);
  assert.deepEqual(TERMINAL_JOB_STATES, ['completed','failed','cancelled','timed_out','policy_rejected']);
  assert.deepEqual(CAMPAIGN_OPERATION_BUDGETS, {
    createCampaign: { classA: 3, classB: 2, storageBytes: 64_000 },
    submitJob: { classA: 5, classB: 3, storageBytes: 128_000 },
    claimAttempt: { classA: 3, classB: 3, storageBytes: 64_000 },
    heartbeat: { classA: 1, classB: 1, storageBytes: 0 },
    eventBatch: { classA: 1, classB: 0, storageBytes: 256_000 },
    logChunk: { classA: 2, classB: 1, storageBytes: 1_000_000 },
    readTypicalLogs: { classA: 0, classB: 9, storageBytes: 0 },
    rawArtifacts: { classA: 2, classB: 0, storageBytes: 15_000_000 },
    acceptEvidence: { classA: 4, classB: 1, storageBytes: 10_000_000 },
    publishReport: { classA: 3, classB: 0, storageBytes: 1_000_000 },
    completeJob: { classA: 3, classB: 2, storageBytes: 32_000 },
    pollJob: { classA: 0, classB: 1, storageBytes: 0 }
  });
});

test('enforces allowed job transitions and executor boundary', () => {
  assert.equal(assertJobTransition('submitted', 'validating'), true);
  assert.equal(assertJobTransition('queued', 'awaiting_executor'), true);
  assert.throws(() => assertJobTransition('awaiting_executor', 'provisioning'), /trusted fixture/i);
  assert.equal(assertJobTransition('awaiting_executor', 'provisioning', { trustedFixture: true }), true);
  assert.equal(assertJobTransition('running', 'cancelled'), true);
  assert.throws(() => assertJobTransition('completed', 'running'), /terminal/i);
});

test('validates strict campaign, job, status, and event records', () => {
  assert.deepEqual(validateCampaignCreation(campaign()), campaign());
  assert.throws(() => validateCampaignCreation({ ...campaign(), command: 'forge test' }), /command/);
  assert.deepEqual(validateJobRequest(job()), job());
  assert.throws(() => validateJobRequest({ ...job(), rpcUrl: 'https://rpc.invalid' }), /rpcUrl/);
  const status = { schemaVersion: 'audit-job-status-v1', jobId, campaignId, state: 'awaiting_executor', revision: 5, highestLogSequence: 0, updatedAt: '2026-07-31T12:06:00.000Z', executionEnabled: false };
  assert.deepEqual(validateJobStatus(status), status);
  assert.throws(() => validateJobStatus({ ...status, executionEnabled: true }), /executionEnabled/);
  const batch = { schemaVersion: 'audit-event-batch-v1', jobId, batchId: '00000001', createdAt: '2026-07-31T12:06:00.000Z', events: [{ type: 'job_awaiting_executor', at: '2026-07-31T12:06:00.000Z' }] };
  assert.deepEqual(validateEventBatch(batch), batch);
  assert.throws(() => validateEventBatch({ ...batch, events: Array.from({ length: 33 }, () => ({ type: 'x', at: '2026-07-31T12:06:00.000Z' })) }), /32/);
});

test('generates deterministic keys for every Phase 3 object family', () => {
  assert.equal(campaignCreationKey(campaignId), `campaigns/${campaignId}/creation-v1.json`);
  assert.equal(campaignCurrentKey(campaignId), `campaigns/${campaignId}/current-v1.json`);
  assert.equal(workspaceCampaignIndexKey(workspaceId), `indexes/workspace/${workspaceId}/campaigns-v1.json`);
  assert.equal(jobRequestKey(jobId), `jobs/${jobId}/request-v1.json`);
  assert.equal(jobStatusKey(jobId), `jobs/${jobId}/status-v1.json`);
  assert.equal(campaignJobIndexKey(campaignId), `indexes/campaign/${campaignId}/jobs-v1.json`);
  assert.equal(attemptKey(jobId, attemptId), `jobs/${jobId}/attempts/${attemptId}-v1.json`);
  assert.equal(eventBatchKey(jobId, '00000001'), `jobs/${jobId}/events/00000001.jsonl`);
  assert.equal(logChunkKey(jobId, attemptId, 7), `jobs/${jobId}/attempts/${attemptId}/logs/00000007.log`);
  assert.equal(logIndexKey(jobId, attemptId), `jobs/${jobId}/attempts/${attemptId}/logs/index-v1.json`);
  assert.equal(rawArtifactBundleKey(jobId, artifactId), `jobs/${jobId}/artifacts/${artifactId}.tar.zst`);
  assert.equal(rawArtifactManifestKey(jobId, artifactId), `jobs/${jobId}/artifacts/${artifactId}-manifest-v1.json`);
  assert.equal(evidenceQuarantineKey(jobId, artifactId), `jobs/${jobId}/evidence/quarantine/${artifactId}.tar.zst`);
  assert.equal(evidenceAcceptedKey(jobId, artifactId), `jobs/${jobId}/evidence/accepted/${artifactId}.tar.zst`);
  assert.equal(evidenceManifestKey(jobId, artifactId), `jobs/${jobId}/evidence/${artifactId}-manifest-v1.json`);
  assert.equal(evidenceAttestationKey(jobId, artifactId), `jobs/${jobId}/evidence/${artifactId}-attestation-v1.json`);
  assert.equal(reportBundleKey(jobId, artifactId), `jobs/${jobId}/reports/${artifactId}.zip`);
  assert.equal(reportManifestKey(jobId, artifactId), `jobs/${jobId}/reports/${artifactId}-manifest-v1.json`);
  assert.equal(reportIndexKey(jobId), `indexes/job/${jobId}/reports-v1.json`);
});
