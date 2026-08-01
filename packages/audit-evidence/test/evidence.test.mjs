import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryAuditStore } from '../../audit-r2-store/src/index.mjs';
import {
  evidenceAcceptedKey,
  evidenceAttestationKey,
  evidenceIngressKey,
  evidenceManifestKey,
  evidenceQuarantineKey,
  jobStatusKey,
  logChunkKey,
  rawArtifactBundleKey,
  rawArtifactIngressKey,
  rawArtifactManifestKey,
  reportBundleKey,
  reportIndexKey,
  reportIngressKey,
  reportManifestKey
} from '../../audit-campaign-protocol/src/index.mjs';
import { EvidenceService } from '../src/index.mjs';

const jobId = `ajob_${'1'.repeat(32)}`;
const campaignId = `cmp_${'2'.repeat(32)}`;
const attemptId = `att_${'3'.repeat(32)}`;
const artifactId = `art_${'4'.repeat(32)}`;
const expiresAt = '2026-07-31T13:00:00.000Z';

function delta(after, before) {
  return { classA: after.classA - before.classA, classB: after.classB - before.classB, free: after.free - before.free };
}
async function digest(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new TextEncoder().encode(bytes);
  const result = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return [...result].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function runningStatus(overrides = {}) {
  return {
    schemaVersion: 'audit-job-status-v1',
    jobId,
    campaignId,
    state: 'running',
    revision: 7,
    highestLogSequence: 0,
    updatedAt: '2026-07-31T12:19:00.000Z',
    executionEnabled: false,
    attemptId,
    ...overrides
  };
}
function objectRef(objectKey, sha256, bytes, contentType) {
  return { schemaVersion: 'audit-object-reference-v1', objectKey, sha256, bytes, contentType, expiresAt };
}
function signer() {
  return async () => ({ algorithm: 'Ed25519', keyId: 'attestation-test-v1', signature: 'A'.repeat(86) });
}

test('writes one bound log chunk with two Class A and one Class B operations', async () => {
  const store = new InMemoryAuditStore();
  await store.put(jobStatusKey(jobId), JSON.stringify(runningStatus()));
  const service = new EvidenceService(store, { now: () => new Date('2026-07-31T12:20:00.000Z') });
  const bytes = new TextEncoder().encode('slither output');
  const before = store.usage();
  const result = await service.appendLogChunk({ jobId, attemptId, sequence: 1, bytes });
  assert.equal(result.highestLogSequence, 1);
  assert.deepEqual(delta(store.usage(), before), { classA: 2, classB: 1, free: 0 });
  assert.ok(await store.head(logChunkKey(jobId, attemptId, 1)));
  const retried = await service.appendLogChunk({ jobId, attemptId, sequence: 1, bytes });
  assert.equal(retried.recoveredPartialWrite, true);
  await assert.rejects(() => service.appendLogChunk({ jobId, attemptId, sequence: 65, bytes }), /64/);
  await assert.rejects(() => service.appendLogChunk({ jobId, attemptId, sequence: 2, bytes: new Uint8Array(1_000_001) }), /1000000/);
  await assert.rejects(() => service.appendLogChunk({ jobId, attemptId, sequence: 1, bytes: 'conflicting bytes' }), /conflict|match/i);
});

test('reads a typical eight-chunk log set with exactly nine Class B operations', async () => {
  const store = new InMemoryAuditStore();
  const status = { schemaVersion: 'audit-job-status-v1', jobId, campaignId, state: 'running', revision: 12, highestLogSequence: 8, updatedAt: '2026-07-31T12:20:00.000Z', executionEnabled: false, attemptId };
  await store.put(jobStatusKey(jobId), JSON.stringify(status));
  for (let sequence = 1; sequence <= 8; sequence += 1) await store.put(logChunkKey(jobId, attemptId, sequence), `chunk-${sequence}`);
  const before = store.usage();
  const service = new EvidenceService(store);
  const logs = await service.readLogs({ jobId, attemptId });
  assert.equal(logs.chunks.length, 8);
  assert.deepEqual(delta(store.usage(), before), { classA: 0, classB: 9, free: 0 });
});

test('publishes a referenced raw artifact and manifest with two Class A and two Class B operations', async () => {
  const store = new InMemoryAuditStore();
  const bundleBytes = new TextEncoder().encode('trusted fixture raw artifact bundle');
  const sha256 = await digest(bundleBytes);
  const ingressKey = rawArtifactIngressKey(jobId, attemptId, artifactId);
  await store.put(jobStatusKey(jobId), JSON.stringify(runningStatus()));
  await store.put(ingressKey, bundleBytes);
  const service = new EvidenceService(store, { now: () => new Date('2026-07-31T12:20:00.000Z') });
  const manifest = { schemaVersion: 'raw-artifact-manifest-v1', jobId, artifactId, sha256, bytes: bundleBytes.length, contentType: 'application/zstd', createdAt: '2026-07-31T12:21:00.000Z' };
  const before = store.usage();
  await service.publishRawArtifacts({ jobId, attemptId, artifactId, objectRef: objectRef(ingressKey, sha256, bundleBytes.length, 'application/zstd'), manifest });
  assert.deepEqual(delta(store.usage(), before), { classA: 2, classB: 2, free: 0 });
  assert.ok(await store.head(rawArtifactBundleKey(jobId, artifactId)));
  assert.ok(await store.head(rawArtifactManifestKey(jobId, artifactId)));
});

test('quarantines, verifies, accepts, and signs evidence using four Class A and two Class B operations', async () => {
  const store = new InMemoryAuditStore();
  const bundleBytes = new TextEncoder().encode('trusted fixture evidence bundle');
  const sha256 = await digest(bundleBytes);
  const ingressKey = evidenceIngressKey(jobId, attemptId, artifactId);
  await store.put(jobStatusKey(jobId), JSON.stringify(runningStatus({ state: 'collecting_evidence' })));
  await store.put(ingressKey, bundleBytes);
  let validations = 0;
  const service = new EvidenceService(store, {
    now: () => new Date('2026-07-31T12:22:00.000Z'),
    validateEvidence: async (input) => { validations += 1; assert.equal(input.sha256, sha256); return { accepted: true, validator: 'fixture-validator-v1' }; },
    signAttestation: signer()
  });
  const manifest = { schemaVersion: 'evidence-manifest-v1', jobId, artifactId, sha256, bytes: bundleBytes.length, evidenceContract: 'evidence-v1', acceptedAt: '2026-07-31T12:22:00.000Z' };
  const before = store.usage();
  await service.acceptEvidence({ jobId, attemptId, artifactId, objectRef: objectRef(ingressKey, sha256, bundleBytes.length, 'application/zstd'), manifest });
  assert.equal(validations, 1);
  assert.deepEqual(delta(store.usage(), before), { classA: 4, classB: 2, free: 1 });
  assert.equal(await store.get(evidenceQuarantineKey(jobId, artifactId)), null);
  assert.ok(await store.head(evidenceAcceptedKey(jobId, artifactId)));
  assert.ok(await store.head(evidenceManifestKey(jobId, artifactId)));
  const attestationRecord = await store.get(evidenceAttestationKey(jobId, artifactId));
  const attestation = JSON.parse(typeof attestationRecord.value === 'string' ? attestationRecord.value : new TextDecoder().decode(attestationRecord.value));
  assert.equal(attestation.algorithm, 'Ed25519');
  assert.equal(attestation.signature, 'A'.repeat(86));
});

test('rejects evidence when the injected validator declines it before accepted writes', async () => {
  const store = new InMemoryAuditStore();
  const bundleBytes = new TextEncoder().encode('invalid evidence bundle');
  const sha256 = await digest(bundleBytes);
  const ingressKey = evidenceIngressKey(jobId, attemptId, artifactId);
  await store.put(jobStatusKey(jobId), JSON.stringify(runningStatus({ state: 'collecting_evidence' })));
  await store.put(ingressKey, bundleBytes);
  const service = new EvidenceService(store, { now: () => new Date('2026-07-31T12:22:00.000Z'), validateEvidence: async () => ({ accepted: false, reason: 'schema_mismatch' }) });
  const manifest = { schemaVersion: 'evidence-manifest-v1', jobId, artifactId, sha256, bytes: bundleBytes.length, evidenceContract: 'evidence-v1', acceptedAt: '2026-07-31T12:22:00.000Z' };
  await assert.rejects(() => service.acceptEvidence({ jobId, attemptId, artifactId, objectRef: objectRef(ingressKey, sha256, bundleBytes.length, 'application/zstd'), manifest }), /schema_mismatch/);
  assert.equal(await store.get(evidenceAcceptedKey(jobId, artifactId)), null);
});

test('publishes a referenced report and server-owned index using three Class A and three Class B operations', async () => {
  const store = new InMemoryAuditStore();
  const reportBytes = new TextEncoder().encode('report bundle');
  const sha256 = await digest(reportBytes);
  const ingressKey = reportIngressKey(jobId, attemptId, artifactId);
  await store.put(jobStatusKey(jobId), JSON.stringify(runningStatus({ state: 'collecting_evidence' })));
  await store.put(ingressKey, reportBytes);
  const service = new EvidenceService(store, { now: () => new Date('2026-07-31T12:23:00.000Z') });
  const manifest = { schemaVersion: 'report-manifest-v1', jobId, artifactId, sha256, bytes: reportBytes.length, formats: ['html', 'pdf'], createdAt: '2026-07-31T12:23:00.000Z' };
  const before = store.usage();
  const input = { jobId, attemptId, artifactId, objectRef: objectRef(ingressKey, sha256, reportBytes.length, 'application/zip'), manifest };
  await service.publishReport(input);
  assert.deepEqual(delta(store.usage(), before), { classA: 3, classB: 3, free: 0 });
  assert.ok(await store.head(reportBundleKey(jobId, artifactId)));
  assert.ok(await store.head(reportManifestKey(jobId, artifactId)));
  assert.ok(await store.head(reportIndexKey(jobId)));
  await assert.rejects(() => service.publishReport(input), /exists|conflict|precondition/i);
});

test('reads the deterministic report index with one Class B operation and exposes no list API', async () => {
  const store = new InMemoryAuditStore();
  await store.put(reportIndexKey(jobId), JSON.stringify({ schemaVersion: 'job-report-index-v1', jobId, reports: [] }));
  const before = store.usage();
  const service = new EvidenceService(store);
  assert.deepEqual(await service.readReports(jobId), { schemaVersion: 'job-report-index-v1', jobId, reports: [] });
  assert.deepEqual(delta(store.usage(), before), { classA: 0, classB: 1, free: 0 });
  assert.equal('list' in service, false);
});
