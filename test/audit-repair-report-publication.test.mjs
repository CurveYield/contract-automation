import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryAuditStore } from '../packages/audit-r2-store/src/index.mjs';
import {
  jobStatusKey,
  reportBundleKey,
  reportIndexKey,
  reportIngressKey,
  reportManifestKey
} from '../packages/audit-campaign-protocol/src/index.mjs';
import { EvidenceService } from '../packages/audit-evidence/src/index.mjs';

const jobId = `ajob_${'1'.repeat(32)}`;
const campaignId = `cmp_${'4'.repeat(32)}`;
const attemptId = `att_${'5'.repeat(32)}`;
const firstArtifactId = `art_${'2'.repeat(32)}`;
const secondArtifactId = `art_${'3'.repeat(32)}`;
const expiresAt = '2026-08-01T08:00:00.000Z';

async function digest(bytes) {
  const result = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...result].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
async function seedStatus(store) {
  await store.put(jobStatusKey(jobId), JSON.stringify({
    schemaVersion: 'audit-job-status-v1', jobId, campaignId, state: 'collecting_evidence', revision: 7,
    highestLogSequence: 0, updatedAt: '2026-08-01T07:29:00.000Z', executionEnabled: false, attemptId
  }));
}
async function reportInput(store, artifactId, text, createdAt, extras = {}) {
  const reportBytes = new TextEncoder().encode(text);
  const sha256 = await digest(reportBytes);
  const objectKey = reportIngressKey(jobId, attemptId, artifactId);
  await store.put(objectKey, reportBytes);
  return {
    jobId,
    attemptId,
    artifactId,
    objectRef: { schemaVersion: 'audit-object-reference-v1', objectKey, sha256, bytes: reportBytes.byteLength, contentType: 'application/zip', expiresAt },
    manifest: {
      schemaVersion: 'report-manifest-v1', jobId, artifactId, sha256,
      bytes: reportBytes.byteLength, formats: ['html', 'pdf'], createdAt
    },
    ...extras
  };
}
function service(store) {
  return new EvidenceService(store, { now: () => new Date('2026-08-01T07:30:00.000Z') });
}

test('report publication merges the server-owned index and preserves prior reports', async () => {
  const store = new InMemoryAuditStore();
  await seedStatus(store);
  const registry = service(store);
  await registry.publishReport(await reportInput(store, firstArtifactId, 'first report', '2026-08-01T07:30:00.000Z'));

  const indexRecord = await store.get(reportIndexKey(jobId));
  await registry.publishReport(await reportInput(store, secondArtifactId, 'second report', '2026-08-01T07:31:00.000Z', {
    indexEtag: indexRecord.etag,
    index: {
      schemaVersion: 'job-report-index-v1', jobId, reports: [secondArtifactId],
      records: { [secondArtifactId]: { sha256: 'f'.repeat(64) } }
    }
  }));

  const index = await registry.readReports(jobId);
  assert.deepEqual(index.reports, [firstArtifactId, secondArtifactId]);
  assert.ok(index.records[firstArtifactId]);
  assert.ok(index.records[secondArtifactId]);
});

test('report publication retries after bundle and manifest writes succeeded but index write failed', async () => {
  const backing = new InMemoryAuditStore();
  await seedStatus(backing);
  let failIndexOnce = true;
  const store = {
    get: (...args) => backing.get(...args),
    put: async (key, value, options) => {
      if (key === reportIndexKey(jobId) && failIndexOnce) {
        failIndexOnce = false;
        throw new Error('simulated report index failure');
      }
      return backing.put(key, value, options);
    }
  };
  const registry = service(store);
  const input = await reportInput(backing, firstArtifactId, 'recoverable report', '2026-08-01T07:30:00.000Z');

  await assert.rejects(() => registry.publishReport(input), /simulated report index failure/);
  assert.ok(await backing.get(reportBundleKey(jobId, firstArtifactId)));
  assert.ok(await backing.get(reportManifestKey(jobId, firstArtifactId)));
  assert.equal(await backing.get(reportIndexKey(jobId)), null);

  const recovered = await registry.publishReport(input);
  assert.equal(recovered.recoveredPartialPublication, true);
  assert.deepEqual((await registry.readReports(jobId)).reports, [firstArtifactId]);
});

test('completed report publication rejects conflicting duplicate bytes', async () => {
  const store = new InMemoryAuditStore();
  await seedStatus(store);
  const registry = service(store);
  await registry.publishReport(await reportInput(store, firstArtifactId, 'original report', '2026-08-01T07:30:00.000Z'));
  const conflicting = await reportInput(store, firstArtifactId, 'different report', '2026-08-01T07:30:00.000Z');
  await assert.rejects(() => registry.publishReport(conflicting), /exists|conflict|precondition/i);
});
