import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { InMemoryAuditStore } from '../packages/audit-r2-store/src/index.mjs';
import { jobStatusKey, evidenceAttestationKey } from '../packages/audit-campaign-protocol/src/index.mjs';
import { EvidenceService } from '../packages/audit-evidence/src/index.mjs';
import auditWorker from '../apps/audit-api/src/entry.mjs';
import { signInternalRequest } from '../apps/audit-api/src/index.mjs';

const jobId = `ajob_${'1'.repeat(32)}`;
const campaignId = `cmp_${'2'.repeat(32)}`;
const attemptId = `att_${'3'.repeat(32)}`;
const artifactId = `art_${'4'.repeat(32)}`;
const expiresAt = '2026-08-01T08:30:00.000Z';
const now = () => new Date('2026-08-01T08:00:00.000Z');

function rawIngressKey() {
  return `ingress/jobs/${jobId}/attempts/${attemptId}/artifacts/${artifactId}.tar.zst`;
}
function evidenceIngressKey() {
  return `ingress/jobs/${jobId}/attempts/${attemptId}/evidence/${artifactId}.tar.zst`;
}
function reportIngressKey() {
  return `ingress/jobs/${jobId}/attempts/${attemptId}/reports/${artifactId}.zip`;
}
function status(state = 'running') {
  return {
    schemaVersion: 'audit-job-status-v1', jobId, campaignId, state, revision: 7,
    highestLogSequence: 0, updatedAt: '2026-08-01T07:59:00.000Z',
    executionEnabled: false, attemptId
  };
}
async function digest(bytes) {
  const value = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...value].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function ref(objectKey, sha256, bytes, contentType) {
  return { schemaVersion: 'audit-object-reference-v1', objectKey, sha256, bytes, contentType, expiresAt };
}
function request(path, init = {}) {
  return new Request(`https://api.audit.preflight.curveyield.online${path}`, init);
}

async function signedPost(path, payload, env, nonce) {
  const body = JSON.stringify(payload);
  const headers = await signInternalRequest({
    key: env.AUDIT_INTERNAL_SERVICE_KEY,
    timestamp: Math.floor(Date.now() / 1000),
    nonce,
    method: 'POST',
    path,
    body
  });
  return auditWorker.fetch(request(path, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body }), env);
}

test('raw artifacts larger than the Worker body limit are ingested by deterministic R2 reference', async () => {
  const store = new InMemoryAuditStore();
  const bundle = new Uint8Array(1_100_000);
  bundle[0] = 17; bundle[bundle.length - 1] = 29;
  const sha256 = await digest(bundle);
  await store.put(jobStatusKey(jobId), JSON.stringify(status()));
  await store.put(rawIngressKey(), bundle);
  const service = new EvidenceService(store, { now });
  const result = await service.publishRawArtifacts({
    jobId, attemptId, artifactId,
    objectRef: ref(rawIngressKey(), sha256, bundle.byteLength, 'application/zstd'),
    manifest: { schemaVersion: 'raw-artifact-manifest-v1', jobId, artifactId, sha256, bytes: bundle.byteLength, contentType: 'application/zstd', createdAt: '2026-08-01T08:00:00.000Z' }
  });
  assert.equal(result.artifactId, artifactId);
});

test('evidence callback cannot supply an attestation and the control plane signs one after validation', async () => {
  const store = new InMemoryAuditStore();
  const bundle = new TextEncoder().encode('validated evidence object');
  const sha256 = await digest(bundle);
  await store.put(jobStatusKey(jobId), JSON.stringify(status('collecting_evidence')));
  await store.put(evidenceIngressKey(), bundle);
  let signedPayload;
  const service = new EvidenceService(store, {
    now,
    validateEvidence: async () => ({ accepted: true, validator: 'fixture-validator-v1' }),
    signAttestation: async (payload) => {
      signedPayload = payload;
      return { algorithm: 'Ed25519', keyId: 'attestation-test-v1', signature: 'A'.repeat(86) };
    }
  });
  const input = {
    jobId, attemptId, artifactId,
    objectRef: ref(evidenceIngressKey(), sha256, bundle.byteLength, 'application/zstd'),
    manifest: { schemaVersion: 'evidence-manifest-v1', jobId, artifactId, sha256, bytes: bundle.byteLength, evidenceContract: 'evidence-v1', acceptedAt: '2026-08-01T08:00:00.000Z' }
  };
  await assert.rejects(() => service.acceptEvidence({ ...input, attestation: { schemaVersion: 'evidence-attestation-v1', signature: 'forged' } }), /attestation|not allowed/i);
  const accepted = await service.acceptEvidence(input);
  assert.equal(accepted.accepted, true);
  assert.equal(signedPayload.jobId, jobId);
  assert.equal(signedPayload.sha256, sha256);
  const record = await store.get(evidenceAttestationKey(jobId, artifactId));
  const attestation = JSON.parse(typeof record.value === 'string' ? record.value : new TextDecoder().decode(record.value));
  assert.equal(attestation.algorithm, 'Ed25519');
  assert.equal(attestation.keyId, 'attestation-test-v1');
  assert.equal(attestation.signature, 'A'.repeat(86));
  assert.equal(attestation.validator, 'fixture-validator-v1');
});

test('report callbacks accept a small object reference body for a bundle larger than one MiB', async () => {
  const calls = [];
  const env = {
    AUDIT_TEST_MODE: 'true',
    AUDIT_TRUSTED_FIXTURE_ENABLED: 'true',
    AUDIT_INTERNAL_SERVICE_KEY: 'audit-internal-test-key',
    AUDIT_NONCE_STORE: new InMemoryAuditStore(),
    AUDIT_EVIDENCE_SERVICE: {
      async publishReport(input) { calls.push(input); return { jobId, artifactId }; }
    },
    CORS_ORIGIN: 'https://audit.preflight.curveyield.online'
  };
  const sha256 = 'b'.repeat(64);
  const payload = {
    attemptId,
    artifactId,
    objectRef: ref(reportIngressKey(), sha256, 5_000_000, 'application/zip'),
    manifest: { schemaVersion: 'report-manifest-v1', jobId, artifactId, sha256, bytes: 5_000_000, formats: ['html', 'pdf'], createdAt: '2026-08-01T08:00:00.000Z' }
  };
  const path = `/audit-internal/v1/jobs/${jobId}/reports`;
  assert.ok(JSON.stringify(payload).length < 10_000);
  const response = await signedPost(path, payload, env, 'large-report-ref-00000001');
  assert.equal(response.status, 201);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].objectRef.bytes, 5_000_000);
  assert.equal('reportBytes' in calls[0], false);
});

test('deployed Phase 3 routes contain no base64 fields for large artifact, evidence, or report bundles', async () => {
  const source = await fs.readFile(new URL('../apps/audit-api/src/phase3.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /bundleBase64|reportBase64/);
  assert.match(source, /objectRef/);
  assert.match(source, /AUDIT_ATTESTATION_PRIVATE_KEY/);
});
