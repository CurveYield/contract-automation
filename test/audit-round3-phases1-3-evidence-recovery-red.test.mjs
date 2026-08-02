import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryAuditStore } from '../packages/audit-r2-store/src/index.mjs';
import {
  jobStatusKey,
  rawArtifactIngressKey,
  rawArtifactManifestKey,
  reportIndexKey
} from '../packages/audit-campaign-protocol/src/index.mjs';
import { EvidenceService } from '../packages/audit-evidence/src/index.mjs';

const ID = {
  job: `ajob_${'1'.repeat(32)}`,
  campaign: `cmp_${'2'.repeat(32)}`,
  attempt: `att_${'3'.repeat(32)}`,
  artifact: `art_${'4'.repeat(32)}`
};
const NOW = '2026-08-02T02:00:00.000Z';
const LATER = '2026-08-02T02:30:00.000Z';

async function sha256(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map((value) => value.toString(16).padStart(2, '0')).join('');
}

class FailOnceStore {
  constructor(inner, failKey) { this.inner = inner; this.failKey = failKey; this.failed = false; }
  get(key) { return this.inner.get(key); }
  head(key) { return this.inner.head(key); }
  delete(key) { return this.inner.delete(key); }
  async put(key, value, options) {
    if (!this.failed && key === this.failKey) {
      this.failed = true;
      throw Object.assign(new Error('injected failure'), { code: 'injected_failure' });
    }
    return this.inner.put(key, value, options);
  }
}

async function activeStore() {
  const store = new InMemoryAuditStore();
  await store.put(jobStatusKey(ID.job), JSON.stringify({
    schemaVersion: 'audit-job-status-v1',
    jobId: ID.job,
    campaignId: ID.campaign,
    state: 'collecting_evidence',
    revision: 8,
    highestLogSequence: 0,
    updatedAt: NOW,
    executionEnabled: false,
    attemptId: ID.attempt
  }), { onlyIf: { etagDoesNotMatch: '*' } });
  return store;
}

test('raw artifact publication recovers when bundle succeeded and manifest failed', async () => {
  const inner = await activeStore();
  const bytes = new Uint8Array([9, 8, 7]);
  const digest = await sha256(bytes);
  await inner.put(rawArtifactIngressKey(ID.job, ID.attempt, ID.artifact), bytes, { onlyIf: { etagDoesNotMatch: '*' } });
  const service = new EvidenceService(new FailOnceStore(inner, rawArtifactManifestKey(ID.job, ID.artifact)), { now: () => new Date(NOW) });
  const input = {
    jobId: ID.job,
    attemptId: ID.attempt,
    artifactId: ID.artifact,
    objectRef: {
      schemaVersion: 'audit-object-reference-v1',
      objectKey: rawArtifactIngressKey(ID.job, ID.attempt, ID.artifact),
      sha256: digest,
      bytes: bytes.byteLength,
      contentType: 'application/zstd',
      expiresAt: LATER
    },
    manifest: {
      schemaVersion: 'raw-artifact-manifest-v1',
      jobId: ID.job,
      artifactId: ID.artifact,
      sha256: digest,
      bytes: bytes.byteLength,
      contentType: 'application/zstd',
      createdAt: NOW
    }
  };
  await assert.rejects(() => service.publishRawArtifacts(input), /injected failure/);
  const recovered = await service.publishRawArtifacts(input);
  assert.equal(recovered.artifactId, ID.artifact);
  assert.equal(recovered.recoveredPartialPublication, true);
});

test('report index reads are recursively frozen defensive values', async () => {
  const store = await activeStore();
  await store.put(reportIndexKey(ID.job), JSON.stringify({
    schemaVersion: 'job-report-index-v1',
    jobId: ID.job,
    reports: [ID.artifact],
    records: {
      [ID.artifact]: {
        sha256: 'a'.repeat(64),
        bytes: 3,
        formats: ['json'],
        createdAt: NOW
      }
    }
  }), { onlyIf: { etagDoesNotMatch: '*' } });
  const service = new EvidenceService(store);
  const index = await service.readReports(ID.job);
  assert.equal(Object.isFrozen(index), true);
  assert.equal(Object.isFrozen(index.reports), true);
  assert.equal(Object.isFrozen(index.records), true);
  assert.equal(Object.isFrozen(index.records[ID.artifact]), true);
  assert.equal(Object.isFrozen(index.records[ID.artifact].formats), true);
});
