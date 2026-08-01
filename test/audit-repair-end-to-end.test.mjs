import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryAuditStore } from '../packages/audit-r2-store/src/index.mjs';
import {
  createUploadGrant,
  WorkspaceService,
  workspaceSourceArchiveKey
} from '../packages/audit-workspaces/src/index.mjs';
import {
  ingressKey,
  layerArchiveKey
} from '../packages/audit-workspace-protocol/src/index.mjs';
import { ProfileRegistry } from '../packages/audit-profile-registry/src/index.mjs';
import { CampaignService } from '../packages/audit-campaigns/src/index.mjs';
import { EvidenceService } from '../packages/audit-evidence/src/index.mjs';
import {
  evidenceIngressKey,
  rawArtifactIngressKey,
  reportIngressKey
} from '../packages/audit-campaign-protocol/src/index.mjs';

const tenantId = `ten_${'1'.repeat(32)}`;
const workspaceId = `ws_${'2'.repeat(32)}`;
const layerId = `lyr_${'3'.repeat(32)}`;
const campaignId = `cmp_${'4'.repeat(32)}`;
const jobId = `ajob_${'5'.repeat(32)}`;
const attemptId = `att_${'6'.repeat(32)}`;
const rawArtifactId = `art_${'7'.repeat(32)}`;
const evidenceArtifactId = `art_${'8'.repeat(32)}`;
const reportArtifactId = `art_${'9'.repeat(32)}`;
const profileId = 'slither-solidity-v1';

function concat(parts) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
function u16(value) { return Uint8Array.of(value & 255, (value >>> 8) & 255); }
function u32(value) { return Uint8Array.of(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255); }
function zip(entries) {
  const encoder = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = encoder.encode(entry.data);
    const local = concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(0),
      u32(data.length), u32(data.length), u16(name.length), u16(0), name, data
    ]);
    const central = concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(0),
      u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(offset), name
    ]);
    locals.push(local); centrals.push(central); offset += local.length;
  }
  const directory = concat(centrals);
  return concat([
    ...locals,
    directory,
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(directory.length), u32(offset), u16(0)
  ]);
}
async function sha256(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function objectRef(objectKey, digest, bytes, contentType) {
  return {
    schemaVersion: 'audit-object-reference-v1', objectKey, sha256: digest,
    bytes, contentType, expiresAt: '2026-08-01T09:00:00.000Z'
  };
}
function operationCounts(usage) {
  return { classA: usage.classA, classB: usage.classB, free: usage.free };
}

test('empty-store connected-stack workflow completes inertly with measured R2 usage', async () => {
  const store = new InMemoryAuditStore();
  let clock = '2026-08-01T08:00:00.000Z';
  const now = () => new Date(clock);

  const source = zip([
    { name: 'contracts/BoostHub.sol', data: 'contract BoostHub {}' },
    { name: 'contracts/Vault.sol', data: 'contract Vault {}' },
    { name: 'contracts/Strategy.sol', data: 'contract Strategy {}' }
  ]);
  const sourceDigest = await sha256(source);
  const grant = await createUploadGrant({
    tenantId, sha256: sourceDigest, bytes: source.byteLength,
    contentType: 'application/zip', expiresAt: '2026-08-01T08:30:00.000Z'
  }, { now, sign: async () => 'signed-upload-grant' });
  await store.put(ingressKey(tenantId, sourceDigest), source);

  const workspaces = new WorkspaceService(store, { now, verifyGrant: async () => true });
  clock = '2026-08-01T08:01:00.000Z';
  const sealed = await workspaces.sealUploadedWorkspace({
    workspaceId,
    grant,
    tenantIndex: { schemaVersion: 'tenant-workspaces-v1', tenantId, workspaces: [workspaceId] }
  });
  assert.equal(sealed.manifest.sourceObjectKey, workspaceSourceArchiveKey(workspaceId));
  assert.equal(sealed.manifest.fileCount, 3);

  const layerBytes = new TextEncoder().encode('trusted generated test and specification layer');
  const layerDigest = await sha256(layerBytes);
  clock = '2026-08-01T08:02:00.000Z';
  await workspaces.attachLayer({
    archiveBytes: layerBytes,
    manifest: {
      schemaVersion: 'layer-manifest-v1', layerId, workspaceId,
      archiveSha256: layerDigest, archiveBytes: layerBytes.byteLength,
      archiveObjectKey: layerArchiveKey(workspaceId, layerId),
      createdAt: clock, generator: 'curveyield-audit-spec-layer-v1', fileCount: 2
    },
    layerIndex: { schemaVersion: 'workspace-layer-index-v1', workspaceId, layers: [layerId] },
    eventBatch: {
      schemaVersion: 'workspace-event-batch-v1', batchId: '00000001', workspaceId,
      events: [{ type: 'layer_attached', layerId }]
    }
  });

  const profiles = new ProfileRegistry(store);
  await profiles.publish({
    manifest: {
      schemaVersion: 'profile-v1', profileId,
      registryArtifact: { repository: 'ghcr.io/curveyield/audit-slither', digest: `sha256:${'a'.repeat(64)}` },
      tool: { name: 'slither', version: '0.11.5' },
      resourcePolicy: { cpuLimit: 2, memoryMiB: 4096, timeoutSeconds: 1800 },
      evidenceContract: { schemaVersion: 'evidence-v1', requiredArtifacts: ['findings.json'] },
      sbomSha256: 'b'.repeat(64), attestationSha256: 'c'.repeat(64), publishedAt: '2026-08-01T08:03:00.000Z'
    },
    sbom: { schemaVersion: 'sbom-reference-v1', sha256: 'b'.repeat(64), objectKey: `profiles/${profileId}/sbom.spdx.json` },
    attestation: { schemaVersion: 'attestation-reference-v1', sha256: 'c'.repeat(64), objectKey: `profiles/${profileId}/attestation.json` }
  });

  const campaigns = new CampaignService(store, { now, trustedFixture: true });
  clock = '2026-08-01T08:04:00.000Z';
  await campaigns.createCampaign({
    creation: {
      schemaVersion: 'campaign-creation-v1', campaignId, workspaceId,
      name: 'BoostHub connected-stack audit', createdAt: clock, retentionPolicy: 'free-development'
    }
  });
  clock = '2026-08-01T08:05:00.000Z';
  const submitted = await campaigns.submitJob({
    request: {
      schemaVersion: 'audit-job-request-v1', jobId, campaignId, workspaceId, profileId,
      tool: 'slither', configuration: { detectors: ['reentrancy'] }, resourceClass: 'standard-test',
      timeoutSeconds: 1800, expectedEvidence: ['findings.json'],
      idempotencyKey: 'boosthub-connected-stack-001', submittedAt: clock
    }
  });
  assert.equal(submitted.status.state, 'awaiting_executor');
  assert.equal(submitted.status.executionEnabled, false);

  clock = '2026-08-01T08:06:00.000Z';
  await campaigns.claimAttempt({ jobId, attemptId });
  clock = '2026-08-01T08:07:00.000Z';
  await campaigns.heartbeat({ jobId, attemptId, state: 'running' });

  const evidence = new EvidenceService(store, {
    now,
    validateEvidence: async () => ({ accepted: true, validator: 'fixture-validator-v1' }),
    signAttestation: async () => ({ algorithm: 'Ed25519', keyId: 'fixture-attestation-v1', signature: 'A'.repeat(86) })
  });
  clock = '2026-08-01T08:08:00.000Z';
  await evidence.appendLogChunk({ jobId, attemptId, sequence: 1, bytes: 'trusted fixture log' });

  const rawBytes = new TextEncoder().encode('raw static-analysis artifact bundle');
  const rawDigest = await sha256(rawBytes);
  const rawIngress = rawArtifactIngressKey(jobId, attemptId, rawArtifactId);
  await store.put(rawIngress, rawBytes);
  clock = '2026-08-01T08:09:00.000Z';
  await evidence.publishRawArtifacts({
    jobId, attemptId, artifactId: rawArtifactId,
    objectRef: objectRef(rawIngress, rawDigest, rawBytes.byteLength, 'application/zstd'),
    manifest: {
      schemaVersion: 'raw-artifact-manifest-v1', jobId, artifactId: rawArtifactId,
      sha256: rawDigest, bytes: rawBytes.byteLength, contentType: 'application/zstd', createdAt: clock
    }
  });

  clock = '2026-08-01T08:10:00.000Z';
  await campaigns.heartbeat({ jobId, attemptId, state: 'collecting_evidence' });

  const evidenceBytes = new TextEncoder().encode('accepted evidence bundle');
  const evidenceDigest = await sha256(evidenceBytes);
  const evidenceIngress = evidenceIngressKey(jobId, attemptId, evidenceArtifactId);
  await store.put(evidenceIngress, evidenceBytes);
  clock = '2026-08-01T08:11:00.000Z';
  await evidence.acceptEvidence({
    jobId, attemptId, artifactId: evidenceArtifactId,
    objectRef: objectRef(evidenceIngress, evidenceDigest, evidenceBytes.byteLength, 'application/zstd'),
    manifest: {
      schemaVersion: 'evidence-manifest-v1', jobId, artifactId: evidenceArtifactId,
      sha256: evidenceDigest, bytes: evidenceBytes.byteLength,
      evidenceContract: 'evidence-v1', acceptedAt: clock
    }
  });

  const reportBytes = new TextEncoder().encode('html/pdf/json report bundle');
  const reportDigest = await sha256(reportBytes);
  const reportIngress = reportIngressKey(jobId, attemptId, reportArtifactId);
  await store.put(reportIngress, reportBytes);
  clock = '2026-08-01T08:12:00.000Z';
  await evidence.publishReport({
    jobId, attemptId, artifactId: reportArtifactId,
    objectRef: objectRef(reportIngress, reportDigest, reportBytes.byteLength, 'application/zip'),
    manifest: {
      schemaVersion: 'report-manifest-v1', jobId, artifactId: reportArtifactId,
      sha256: reportDigest, bytes: reportBytes.byteLength,
      formats: ['html', 'pdf', 'json'], createdAt: clock
    }
  });

  clock = '2026-08-01T08:13:00.000Z';
  const completed = await campaigns.completeJob({ jobId, attemptId, finalState: 'completed' });
  assert.equal(completed.status.state, 'completed');
  assert.equal(completed.status.executionEnabled, false);

  const [workspace, finalStatus, logs, reports] = await Promise.all([
    workspaces.readWorkspace(workspaceId),
    campaigns.pollJob(jobId),
    evidence.readLogs({ jobId, attemptId }),
    evidence.readReports(jobId)
  ]);
  assert.equal(workspace.fileCount, 3);
  assert.equal(finalStatus.state, 'completed');
  assert.deepEqual(logs.chunks.map((chunk) => new TextDecoder().decode(chunk)), ['trusted fixture log']);
  assert.deepEqual(reports.reports, [reportArtifactId]);
  assert.deepEqual(operationCounts(store.usage()), { classA: 43, classB: 29, free: 0 });
});
