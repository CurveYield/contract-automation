import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryAuditStore } from '../packages/audit-r2-store/src/index.mjs';
import {
  reportBundleKey,
  reportIndexKey,
  reportManifestKey
} from '../packages/audit-campaign-protocol/src/index.mjs';
import { EvidenceService } from '../packages/audit-evidence/src/index.mjs';

const jobId = `ajob_${'1'.repeat(32)}`;
const firstArtifactId = `art_${'2'.repeat(32)}`;
const secondArtifactId = `art_${'3'.repeat(32)}`;

async function digest(bytes) {
  const result = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...result].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
async function reportInput(artifactId, text, createdAt, extras = {}) {
  const reportBytes = new TextEncoder().encode(text);
  const sha256 = await digest(reportBytes);
  return {
    jobId,
    artifactId,
    reportBytes,
    manifest: {
      schemaVersion: 'report-manifest-v1',
      jobId,
      artifactId,
      sha256,
      bytes: reportBytes.byteLength,
      formats: ['html', 'pdf'],
      createdAt
    },
    ...extras
  };
}

test('report publication merges the server-owned index and preserves prior reports', async () => {
  const store = new InMemoryAuditStore();
  const service = new EvidenceService(store);
  await service.publishReport(await reportInput(firstArtifactId, 'first report', '2026-08-01T07:30:00.000Z'));

  const indexRecord = await store.get(reportIndexKey(jobId));
  await service.publishReport(await reportInput(secondArtifactId, 'second report', '2026-08-01T07:31:00.000Z', {
    indexEtag: indexRecord.etag,
    index: {
      schemaVersion: 'job-report-index-v1',
      jobId,
      reports: [secondArtifactId],
      records: { [secondArtifactId]: { sha256: 'f'.repeat(64) } }
    }
  }));

  const index = await service.readReports(jobId);
  assert.deepEqual(index.reports, [firstArtifactId, secondArtifactId]);
  assert.ok(index.records[firstArtifactId]);
  assert.ok(index.records[secondArtifactId]);
});

test('report publication retries after bundle and manifest writes succeeded but index write failed', async () => {
  const backing = new InMemoryAuditStore();
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
  const service = new EvidenceService(store);
  const input = await reportInput(firstArtifactId, 'recoverable report', '2026-08-01T07:30:00.000Z');

  await assert.rejects(() => service.publishReport(input), /simulated report index failure/);
  assert.ok(await backing.get(reportBundleKey(jobId, firstArtifactId)));
  assert.ok(await backing.get(reportManifestKey(jobId, firstArtifactId)));
  assert.equal(await backing.get(reportIndexKey(jobId)), null);

  const recovered = await service.publishReport(input);
  assert.equal(recovered.recoveredPartialPublication, true);
  assert.deepEqual((await service.readReports(jobId)).reports, [firstArtifactId]);
});

test('completed report publication rejects conflicting duplicate bytes', async () => {
  const store = new InMemoryAuditStore();
  const service = new EvidenceService(store);
  await service.publishReport(await reportInput(firstArtifactId, 'original report', '2026-08-01T07:30:00.000Z'));
  const conflicting = await reportInput(firstArtifactId, 'different report', '2026-08-01T07:30:00.000Z');
  await assert.rejects(() => service.publishReport(conflicting), /exists|conflict|precondition/i);
});
