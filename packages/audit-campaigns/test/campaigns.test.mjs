import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryAuditStore } from '../../audit-r2-store/src/index.mjs';
import { profileIndexKey } from '../../audit-profile-registry/src/index.mjs';
import { workspaceSourceManifestKey } from '../../audit-workspace-protocol/src/index.mjs';
import {
  attemptKey,
  campaignCreationKey,
  campaignCurrentKey,
  campaignJobIndexKey,
  eventBatchKey,
  jobRequestKey,
  jobStatusKey,
  workspaceCampaignIndexKey
} from '../../audit-campaign-protocol/src/index.mjs';
import { CampaignService } from '../src/index.mjs';

const workspaceId = `ws_${'1'.repeat(32)}`;
const campaignId = `cmp_${'2'.repeat(32)}`;
const jobId = `ajob_${'3'.repeat(32)}`;
const attemptId = `att_${'4'.repeat(32)}`;
const profileId = 'slither-solidity-v1';

function usageDelta(after, before) {
  return { classA: after.classA - before.classA, classB: after.classB - before.classB, free: after.free - before.free };
}
function creation(overrides = {}) {
  return { schemaVersion: 'campaign-creation-v1', campaignId, workspaceId, name: 'BoostHub full audit', createdAt: '2026-07-31T12:00:00.000Z', retentionPolicy: 'free-development', ...overrides };
}
function request(overrides = {}) {
  return { schemaVersion: 'audit-job-request-v1', jobId, campaignId, workspaceId, profileId, tool: 'slither', configuration: { detectors: ['reentrancy'] }, resourceClass: 'standard-test', timeoutSeconds: 1800, expectedEvidence: ['findings.json'], idempotencyKey: 'boosthub-slither-001', submittedAt: '2026-07-31T12:05:00.000Z', ...overrides };
}
async function seedWorkspace(store) {
  await store.put(workspaceSourceManifestKey(workspaceId), JSON.stringify({ schemaVersion: 'workspace-manifest-v1', workspaceId, sourceKind: 'upload' }));
}
async function seedProfile(store) {
  await store.put(profileIndexKey(), JSON.stringify({ schemaVersion: 'profile-index-v1', profiles: [profileId], records: { [profileId]: { revoked: false } } }));
}
async function seedCampaign(store) {
  await store.put(campaignCreationKey(campaignId), JSON.stringify(creation()));
  await store.put(campaignCurrentKey(campaignId), JSON.stringify({ schemaVersion: 'campaign-current-v1', campaignId, workspaceId, state: 'active', revision: 1, updatedAt: '2026-07-31T12:00:00.000Z' }));
}

test('creates a campaign using exactly three Class A and two Class B operations', async () => {
  const store = new InMemoryAuditStore();
  await seedWorkspace(store);
  await store.put(workspaceCampaignIndexKey(workspaceId), JSON.stringify({ schemaVersion: 'workspace-campaign-index-v1', workspaceId, campaigns: [] }));
  const indexRecord = await store.get(workspaceCampaignIndexKey(workspaceId));
  const before = store.usage();
  const service = new CampaignService(store, { now: () => new Date('2026-07-31T12:00:00.000Z') });
  const result = await service.createCampaign({ creation: creation(), workspaceIndexEtag: indexRecord.etag });
  assert.deepEqual(usageDelta(store.usage(), before), { classA: 3, classB: 2, free: 0 });
  assert.equal(result.campaignId, campaignId);
  assert.ok(await store.head(campaignCreationKey(campaignId)));
  assert.ok(await store.head(campaignCurrentKey(campaignId)));
});

test('submits a public job to awaiting_executor using exactly five Class A and three Class B operations', async () => {
  const store = new InMemoryAuditStore();
  await seedWorkspace(store);
  await seedProfile(store);
  await seedCampaign(store);
  await store.put(campaignJobIndexKey(campaignId), JSON.stringify({ schemaVersion: 'campaign-job-index-v1', campaignId, jobs: [] }));
  const indexRecord = await store.get(campaignJobIndexKey(campaignId));
  const before = store.usage();
  const service = new CampaignService(store, { now: () => new Date('2026-07-31T12:05:00.000Z') });
  const result = await service.submitJob({ request: request(), jobIndexEtag: indexRecord.etag });
  assert.deepEqual(usageDelta(store.usage(), before), { classA: 5, classB: 3, free: 0 });
  assert.equal(result.status.state, 'awaiting_executor');
  assert.equal(result.status.executionEnabled, false);
  assert.equal(result.error.code, 'execution_plane_unavailable');
  assert.equal(await store.get(attemptKey(jobId, attemptId)), null);
});

test('rejects revoked profiles or mismatched workspaces before job writes', async () => {
  const store = new InMemoryAuditStore();
  await seedWorkspace(store);
  await store.put(profileIndexKey(), JSON.stringify({ schemaVersion: 'profile-index-v1', profiles: [profileId], records: { [profileId]: { revoked: true } } }));
  await seedCampaign(store);
  await store.put(campaignJobIndexKey(campaignId), JSON.stringify({ schemaVersion: 'campaign-job-index-v1', campaignId, jobs: [] }));
  const indexRecord = await store.get(campaignJobIndexKey(campaignId));
  const service = new CampaignService(store, { now: () => new Date('2026-07-31T12:05:00.000Z') });
  const before = store.usage();
  await assert.rejects(() => service.submitJob({ request: request(), jobIndexEtag: indexRecord.etag }), /revoked/i);
  assert.equal(store.usage().classA - before.classA, 0);
});

test('claims a trusted fixture attempt using exactly three Class A and three Class B operations', async () => {
  const store = new InMemoryAuditStore();
  await seedProfile(store);
  await seedCampaign(store);
  await store.put(jobRequestKey(jobId), JSON.stringify(request()));
  await store.put(jobStatusKey(jobId), JSON.stringify({ schemaVersion: 'audit-job-status-v1', jobId, campaignId, state: 'awaiting_executor', revision: 5, highestLogSequence: 0, updatedAt: '2026-07-31T12:05:00.000Z', executionEnabled: false }));
  const before = store.usage();
  const service = new CampaignService(store, { now: () => new Date('2026-07-31T12:06:00.000Z'), trustedFixture: true });
  const result = await service.claimAttempt({ jobId, attemptId });
  assert.deepEqual(usageDelta(store.usage(), before), { classA: 3, classB: 3, free: 0 });
  assert.equal(result.status.state, 'provisioning');
  assert.equal(result.status.attemptId, attemptId);
});

test('refuses attempt claims without explicit trusted-fixture authorization', async () => {
  const store = new InMemoryAuditStore();
  const service = new CampaignService(store);
  await assert.rejects(() => service.claimAttempt({ jobId, attemptId }), /trusted fixture/i);
  assert.deepEqual(store.usage(), { classA: 0, classB: 0, free: 0, storedBytes: 0 });
});

test('heartbeat overwrites status with one Class A operation and an ETag precondition', async () => {
  const store = new InMemoryAuditStore();
  const initial = await store.put(jobStatusKey(jobId), JSON.stringify({ schemaVersion: 'audit-job-status-v1', jobId, campaignId, state: 'running', revision: 7, highestLogSequence: 2, updatedAt: '2026-07-31T12:07:00.000Z', executionEnabled: false, attemptId }));
  const before = store.usage();
  const service = new CampaignService(store);
  const status = { schemaVersion: 'audit-job-status-v1', jobId, campaignId, state: 'running', revision: 8, highestLogSequence: 3, updatedAt: '2026-07-31T12:08:00.000Z', executionEnabled: false, attemptId };
  await service.heartbeat({ status, statusEtag: initial.etag });
  assert.deepEqual(usageDelta(store.usage(), before), { classA: 1, classB: 0, free: 0 });
  await assert.rejects(() => service.heartbeat({ status: { ...status, revision: 9 }, statusEtag: initial.etag }), /precondition/i);
});

test('appends one immutable event batch with one Class A operation', async () => {
  const store = new InMemoryAuditStore();
  const service = new CampaignService(store);
  const batch = { schemaVersion: 'audit-event-batch-v1', jobId, batchId: '00000009', createdAt: '2026-07-31T12:09:00.000Z', events: [{ type: 'heartbeat', at: '2026-07-31T12:09:00.000Z' }] };
  const before = store.usage();
  await service.appendEventBatch(batch);
  assert.deepEqual(usageDelta(store.usage(), before), { classA: 1, classB: 0, free: 0 });
  await assert.rejects(() => service.appendEventBatch(batch), /precondition/i);
});

test('polls a job with one Class B operation', async () => {
  const store = new InMemoryAuditStore();
  await store.put(jobStatusKey(jobId), JSON.stringify({ schemaVersion: 'audit-job-status-v1', jobId, campaignId, state: 'awaiting_executor', revision: 5, highestLogSequence: 0, updatedAt: '2026-07-31T12:05:00.000Z', executionEnabled: false }));
  const before = store.usage();
  const service = new CampaignService(store);
  const status = await service.pollJob(jobId);
  assert.equal(status.state, 'awaiting_executor');
  assert.deepEqual(usageDelta(store.usage(), before), { classA: 0, classB: 1, free: 0 });
});

test('completes a fixture job using three Class A and one Class B operations', async () => {
  const store = new InMemoryAuditStore();
  await store.put(jobStatusKey(jobId), JSON.stringify({ schemaVersion: 'audit-job-status-v1', jobId, campaignId, state: 'collecting_evidence', revision: 12, highestLogSequence: 8, updatedAt: '2026-07-31T12:20:00.000Z', executionEnabled: false, attemptId }));
  await store.put(campaignJobIndexKey(campaignId), JSON.stringify({ schemaVersion: 'campaign-job-index-v1', campaignId, jobs: [jobId], records: { [jobId]: { state: 'collecting_evidence' } } }));
  const indexRecord = await store.get(campaignJobIndexKey(campaignId));
  const before = store.usage();
  const service = new CampaignService(store, { now: () => new Date('2026-07-31T12:21:00.000Z'), trustedFixture: true });
  const result = await service.completeJob({ jobId, finalState: 'completed', jobIndexEtag: indexRecord.etag });
  assert.deepEqual(usageDelta(store.usage(), before), { classA: 3, classB: 1, free: 0 });
  assert.equal(result.status.state, 'completed');
});

test('cancellation is durable and resume creates a new public job rather than leaving a terminal state', async () => {
  const store = new InMemoryAuditStore();
  await store.put(jobStatusKey(jobId), JSON.stringify({ schemaVersion: 'audit-job-status-v1', jobId, campaignId, state: 'awaiting_executor', revision: 5, highestLogSequence: 0, updatedAt: '2026-07-31T12:05:00.000Z', executionEnabled: false }));
  const service = new CampaignService(store, { now: () => new Date('2026-07-31T12:10:00.000Z') });
  const cancelled = await service.cancelJob(jobId, 'user_requested');
  assert.equal(cancelled.state, 'cancelled');
  await assert.rejects(() => service.transitionJob(jobId, 'awaiting_executor'), /terminal/i);
});
