import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { InMemoryAuditStore } from '../packages/audit-r2-store/src/index.mjs';
import {
  evidenceAttestationKey,
  evidenceIngressKey,
  evidenceQuarantineKey,
  jobStatusKey,
  logChunkKey,
  rawArtifactBundleKey,
  rawArtifactManifestKey
} from '../packages/audit-campaign-protocol/src/index.mjs';
import { EvidenceService } from '../packages/audit-evidence/src/index.mjs';

const jobId = `ajob_${'1'.repeat(32)}`;
const campaignId = `cmp_${'2'.repeat(32)}`;
const attemptId = `att_${'3'.repeat(32)}`;
const artifactId = `art_${'4'.repeat(32)}`;

async function digest(bytes) {
  const value = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...value].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

test('log and raw-artifact keys use lifecycle-addressable seven-day prefixes', async () => {
  assert.equal(logChunkKey(jobId, attemptId, 1), `job-logs/${jobId}/attempts/${attemptId}/00000001.log`);
  assert.equal(rawArtifactBundleKey(jobId, artifactId), `job-artifacts/${jobId}/${artifactId}.tar.zst`);
  assert.equal(rawArtifactManifestKey(jobId, artifactId), `job-artifacts/${jobId}/${artifactId}-manifest-v1.json`);

  const lifecycle = JSON.parse(await fs.readFile(new URL('../infra/audit-cloudflare/r2-lifecycle.json', import.meta.url), 'utf8'));
  const byPrefix = new Map(lifecycle.Rules.map((rule) => [rule.Filter.Prefix, rule.Expiration.Days]));
  assert.equal(byPrefix.get('job-logs/'), 7);
  assert.equal(byPrefix.get('job-artifacts/'), 7);
  assert.equal(byPrefix.get('jobs/'), 30);
});

test('accepted evidence removes the redundant quarantine copy without changing billed operation counts', async () => {
  const store = new InMemoryAuditStore();
  const bytes = new TextEncoder().encode('accepted evidence bundle');
  const sha256 = await digest(bytes);
  const ingressKey = evidenceIngressKey(jobId, attemptId, artifactId);
  await store.put(jobStatusKey(jobId), JSON.stringify({
    schemaVersion: 'audit-job-status-v1', jobId, campaignId, state: 'collecting_evidence', revision: 7,
    highestLogSequence: 0, updatedAt: '2026-08-01T08:00:00.000Z', executionEnabled: false, attemptId
  }));
  await store.put(ingressKey, bytes);
  const service = new EvidenceService(store, {
    now: () => new Date('2026-08-01T08:01:00.000Z'),
    validateEvidence: async () => ({ accepted: true, validator: 'fixture-validator-v1' }),
    signAttestation: async () => ({ algorithm: 'Ed25519', keyId: 'fixture-key-v1', signature: 'A'.repeat(86) })
  });
  const before = store.usage();
  await service.acceptEvidence({
    jobId, attemptId, artifactId,
    objectRef: {
      schemaVersion: 'audit-object-reference-v1', objectKey: ingressKey, sha256, bytes: bytes.byteLength,
      contentType: 'application/zstd', expiresAt: '2026-08-01T08:30:00.000Z'
    },
    manifest: {
      schemaVersion: 'evidence-manifest-v1', jobId, artifactId, sha256, bytes: bytes.byteLength,
      evidenceContract: 'evidence-v1', acceptedAt: '2026-08-01T08:01:00.000Z'
    }
  });
  const after = store.usage();
  assert.deepEqual({ classA: after.classA - before.classA, classB: after.classB - before.classB }, { classA: 4, classB: 2 });
  assert.equal(await store.get(evidenceQuarantineKey(jobId, artifactId)), null);
  assert.ok(await store.get(evidenceAttestationKey(jobId, artifactId)));
});
