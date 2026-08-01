import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryAuditStore } from '../packages/audit-r2-store/src/index.mjs';
import {
  campaignJobIndexKey,
  jobStatusKey,
  logChunkKey
} from '../packages/audit-campaign-protocol/src/index.mjs';
import { CampaignService } from '../packages/audit-campaigns/src/index.mjs';
import { EvidenceService } from '../packages/audit-evidence/src/index.mjs';

const jobId = `ajob_${'1'.repeat(32)}`;
const campaignId = `cmp_${'2'.repeat(32)}`;
const otherCampaignId = `cmp_${'3'.repeat(32)}`;
const attemptId = `att_${'4'.repeat(32)}`;
const otherAttemptId = `att_${'5'.repeat(32)}`;

function status(overrides = {}) {
  return {
    schemaVersion: 'audit-job-status-v1',
    jobId,
    campaignId,
    state: 'running',
    revision: 7,
    highestLogSequence: 0,
    updatedAt: '2026-08-01T07:00:00.000Z',
    executionEnabled: false,
    attemptId,
    ...overrides
  };
}
function parse(record) {
  return JSON.parse(typeof record.value === 'string' ? record.value : new TextDecoder().decode(record.value));
}
function delta(after, before) {
  return {
    classA: after.classA - before.classA,
    classB: after.classB - before.classB,
    free: after.free - before.free
  };
}

test('heartbeat reads authoritative status and cannot replace job identity or revision', async () => {
  const store = new InMemoryAuditStore();
  await store.put(jobStatusKey(jobId), JSON.stringify(status()));
  const before = store.usage();
  const next = await new CampaignService(store, {
    now: () => new Date('2026-08-01T07:01:00.000Z')
  }).heartbeat({ jobId, attemptId, state: 'running' });

  assert.equal(next.campaignId, campaignId);
  assert.equal(next.revision, 8);
  assert.equal(next.highestLogSequence, 0);
  assert.equal(next.updatedAt, '2026-08-01T07:01:00.000Z');
  assert.deepEqual(delta(store.usage(), before), { classA: 1, classB: 1, free: 0 });

  await assert.rejects(() => new CampaignService(store).heartbeat({
    status: status({ campaignId: otherCampaignId, revision: 999 }),
    statusEtag: 'attacker-controlled-etag'
  }), /unknown|not allowed|jobId|missing/i);
  await assert.rejects(() => new CampaignService(store).heartbeat({ jobId, attemptId: otherAttemptId, state: 'running' }), /attempt/i);
});

test('completion reads current status and index instead of trusting caller status', async () => {
  const store = new InMemoryAuditStore();
  await store.put(jobStatusKey(jobId), JSON.stringify(status({ state: 'collecting_evidence', revision: 12, highestLogSequence: 3 })));
  await store.put(campaignJobIndexKey(campaignId), JSON.stringify({
    schemaVersion: 'campaign-job-index-v1',
    campaignId,
    jobs: [jobId],
    records: { [jobId]: { state: 'collecting_evidence' } }
  }));
  const before = store.usage();
  const result = await new CampaignService(store, {
    now: () => new Date('2026-08-01T07:02:00.000Z'),
    trustedFixture: true
  }).completeJob({ jobId, attemptId, finalState: 'completed' });

  assert.equal(result.status.state, 'completed');
  assert.equal(result.status.campaignId, campaignId);
  assert.equal(result.status.revision, 13);
  assert.deepEqual(delta(store.usage(), before), { classA: 3, classB: 2, free: 0 });

  await assert.rejects(() => new CampaignService(store, { trustedFixture: true }).completeJob({
    currentStatus: status({ campaignId: otherCampaignId, state: 'collecting_evidence' }),
    statusEtag: 'forged',
    finalState: 'completed'
  }), /unknown|not allowed|jobId|missing/i);
});

test('log append validates active attempt, exact sequence, and advances status', async () => {
  const store = new InMemoryAuditStore();
  await store.put(jobStatusKey(jobId), JSON.stringify(status()));
  const service = new EvidenceService(store, {
    now: () => new Date('2026-08-01T07:03:00.000Z')
  });
  const before = store.usage();
  const result = await service.appendLogChunk({
    jobId,
    attemptId,
    sequence: 1,
    bytes: 'first log chunk'
  });

  assert.equal(result.sequence, 1);
  assert.equal(result.highestLogSequence, 1);
  assert.deepEqual(delta(store.usage(), before), { classA: 2, classB: 1, free: 0 });
  const current = parse(await store.get(jobStatusKey(jobId)));
  assert.equal(current.highestLogSequence, 1);
  assert.equal(current.revision, 8);
  assert.equal(current.updatedAt, '2026-08-01T07:03:00.000Z');

  await assert.rejects(() => service.appendLogChunk({ jobId, attemptId, sequence: 3, bytes: 'skip' }), /sequence/i);
  await assert.rejects(() => service.appendLogChunk({ jobId, attemptId: otherAttemptId, sequence: 2, bytes: 'wrong attempt' }), /attempt/i);
  assert.equal(await store.get(logChunkKey(jobId, otherAttemptId, 2)), null);
});

test('log append retries after chunk write succeeded but status update failed', async () => {
  const backing = new InMemoryAuditStore();
  await backing.put(jobStatusKey(jobId), JSON.stringify(status()));
  let failStatusOnce = true;
  const store = {
    get: (...args) => backing.get(...args),
    put: async (key, value, options) => {
      if (key === jobStatusKey(jobId) && failStatusOnce) {
        failStatusOnce = false;
        throw new Error('simulated status write failure');
      }
      return backing.put(key, value, options);
    }
  };
  const service = new EvidenceService(store, {
    now: () => new Date('2026-08-01T07:03:00.000Z')
  });
  const input = { jobId, attemptId, sequence: 1, bytes: 'recoverable log chunk' };

  await assert.rejects(() => service.appendLogChunk(input), /simulated status write failure/);
  assert.ok(await backing.get(logChunkKey(jobId, attemptId, 1)));
  assert.equal(parse(await backing.get(jobStatusKey(jobId))).highestLogSequence, 0);

  const recovered = await service.appendLogChunk(input);
  assert.equal(recovered.recoveredPartialWrite, true);
  assert.equal(parse(await backing.get(jobStatusKey(jobId))).highestLogSequence, 1);
});
