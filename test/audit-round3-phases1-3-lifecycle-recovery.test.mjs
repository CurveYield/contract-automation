import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryAuditStore } from '../packages/audit-r2-store/src/index.mjs';
import {
  ProfileRegistry,
  profileAttestationKey,
  profileIndexKey,
  profileSbomKey
} from '../packages/audit-profile-registry/src/index.mjs';
import {
  validateWorkspaceManifest,
  workspaceSourceManifestKey
} from '../packages/audit-workspace-protocol/src/index.mjs';
import {
  campaignJobIndexKey,
  jobStatusKey,
  reportIngressKey,
  reportIndexKey,
  workspaceCampaignIndexKey
} from '../packages/audit-campaign-protocol/src/index.mjs';
import { CampaignService } from '../packages/audit-campaigns/src/index.mjs';
import { EvidenceService } from '../packages/audit-evidence/src/index.mjs';

const HEX = {
  tenant: '1'.repeat(32), workspace: '2'.repeat(32), campaign: '3'.repeat(32),
  job: '4'.repeat(32), job2: '5'.repeat(32), attempt: '6'.repeat(32),
  artifact: '7'.repeat(32), profileDigest: '8'.repeat(64), sbom: '9'.repeat(64),
  attestation: 'a'.repeat(64), source: 'b'.repeat(64), archive: 'c'.repeat(64)
};
const ID = {
  tenant: `ten_${HEX.tenant}`,
  workspace: `ws_${HEX.workspace}`,
  campaign: `cmp_${HEX.campaign}`,
  job: `ajob_${HEX.job}`,
  job2: `ajob_${HEX.job2}`,
  attempt: `att_${HEX.attempt}`,
  artifact: `art_${HEX.artifact}`,
  profile: 'foundry-test-v1'
};
const NOW = '2026-08-02T02:00:00.000Z';
const LATER = '2026-08-02T02:30:00.000Z';

async function sha256(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function profileBundle() {
  return {
    manifest: {
      schemaVersion: 'profile-v1',
      profileId: ID.profile,
      registryArtifact: {
        repository: 'ghcr.io/curveyield/audit-foundry-test',
        digest: `sha256:${HEX.profileDigest}`
      },
      tool: { name: 'forge', version: '1.7.1' },
      resourcePolicy: { cpuLimit: 2, memoryMiB: 4096, timeoutSeconds: 600 },
      evidenceContract: { schemaVersion: 'evidence-v1', requiredArtifacts: ['tool-result-v1'] },
      sbomSha256: HEX.sbom,
      attestationSha256: HEX.attestation,
      publishedAt: NOW
    },
    sbom: {
      schemaVersion: 'sbom-reference-v1',
      sha256: HEX.sbom,
      objectKey: profileSbomKey(ID.profile)
    },
    attestation: {
      schemaVersion: 'attestation-reference-v1',
      sha256: HEX.attestation,
      objectKey: profileAttestationKey(ID.profile)
    }
  };
}

function workspaceManifest() {
  return validateWorkspaceManifest({
    schemaVersion: 'workspace-manifest-v1',
    workspaceId: ID.workspace,
    tenantId: ID.tenant,
    sourceKind: 'github',
    sourceSha256: HEX.source,
    sourceBytes: 123,
    sourceObjectKey: `workspaces/${ID.workspace}/source-v1.zip`,
    sealedAt: NOW,
    canonicalArchiveSha256: HEX.archive,
    fileCount: 2
  });
}

function creation() {
  return {
    schemaVersion: 'campaign-creation-v1',
    campaignId: ID.campaign,
    workspaceId: ID.workspace,
    name: 'Round 3 lifecycle',
    createdAt: NOW,
    retentionPolicy: 'free-development'
  };
}

function request(jobId = ID.job, idempotencyKey = 'round3-job-1') {
  return {
    schemaVersion: 'audit-job-request-v1',
    jobId,
    campaignId: ID.campaign,
    workspaceId: ID.workspace,
    profileId: ID.profile,
    tool: 'forge',
    configuration: { matchPath: 'test/**/*.t.sol' },
    resourceClass: 'audit-standard-2cpu-4g-v1',
    timeoutSeconds: 600,
    expectedEvidence: ['tool-result-v1'],
    idempotencyKey,
    submittedAt: NOW
  };
}

async function seed(store) {
  await store.put(workspaceSourceManifestKey(ID.workspace), JSON.stringify(workspaceManifest()), { onlyIf: { etagDoesNotMatch: '*' } });
  const registry = new ProfileRegistry(store);
  await registry.publish(profileBundle());
  return registry;
}

class FailOnceStore {
  constructor(inner, predicate) { this.inner = inner; this.predicate = predicate; this.failed = false; }
  get(key) { return this.inner.get(key); }
  head(key) { return this.inner.head(key); }
  delete(key) { return this.inner.delete(key); }
  usage() { return this.inner.usage(); }
  async put(key, value, options) {
    if (!this.failed && this.predicate(key, value, options)) {
      this.failed = true;
      const error = new Error('injected write failure');
      error.code = 'injected_failure';
      throw error;
    }
    return this.inner.put(key, value, options);
  }
}

async function createReadyJob(store, jobId = ID.job, idempotencyKey = 'round3-job-1') {
  const campaigns = new CampaignService(store, { trustedFixture: true, now: () => new Date(NOW) });
  await campaigns.createCampaign({ creation: creation() });
  const submitted = await campaigns.submitJob({ request: request(jobId, idempotencyKey) });
  assert.equal(submitted.status.state, 'awaiting_executor');
  assert.equal(submitted.status.executionEnabled, false);
  const claimed = await campaigns.claimAttempt({ jobId, attemptId: ID.attempt });
  assert.equal(claimed.status.state, 'provisioning');
  await campaigns.heartbeat({ jobId, attemptId: ID.attempt, state: 'running' });
  await campaigns.heartbeat({ jobId, attemptId: ID.attempt, state: 'collecting_evidence' });
  return campaigns;
}

test('Phase 1-3 lifecycle publishes immutable profile/workspace/campaign/job/log/report references', async () => {
  const store = new InMemoryAuditStore();
  const registry = await seed(store);
  const campaigns = await createReadyJob(store);
  const evidence = new EvidenceService(store, { now: () => new Date(NOW) });

  const firstLog = await evidence.appendLogChunk({
    jobId: ID.job, attemptId: ID.attempt, sequence: 1,
    bytes: new TextEncoder().encode('bounded log')
  });
  assert.equal(firstLog.highestLogSequence, 1);
  const replay = await evidence.appendLogChunk({
    jobId: ID.job, attemptId: ID.attempt, sequence: 1,
    bytes: new TextEncoder().encode('bounded log')
  });
  assert.equal(replay.recoveredPartialWrite, true);

  const reportBytes = new Uint8Array([1, 2, 3, 4]);
  const reportDigest = await sha256(reportBytes);
  await store.put(reportIngressKey(ID.job, ID.attempt, ID.artifact), reportBytes, { onlyIf: { etagDoesNotMatch: '*' } });
  const published = await evidence.publishReport({
    jobId: ID.job,
    attemptId: ID.attempt,
    artifactId: ID.artifact,
    objectRef: {
      schemaVersion: 'audit-object-reference-v1',
      objectKey: reportIngressKey(ID.job, ID.attempt, ID.artifact),
      sha256: reportDigest,
      bytes: reportBytes.byteLength,
      contentType: 'application/zip',
      expiresAt: LATER
    },
    manifest: {
      schemaVersion: 'report-manifest-v1',
      jobId: ID.job,
      artifactId: ID.artifact,
      sha256: reportDigest,
      bytes: reportBytes.byteLength,
      formats: ['json'],
      createdAt: NOW
    }
  });
  assert.equal(published.artifactId, ID.artifact);

  const completed = await campaigns.completeJob({
    jobId: ID.job,
    attemptId: ID.attempt,
    finalState: 'completed'
  });
  assert.equal(completed.status.state, 'completed');
  assert.equal(completed.status.executionEnabled, false);

  const reports = await evidence.readReports(ID.job);
  assert.deepEqual(reports.reports, [ID.artifact]);
  assert.equal(Object.isFrozen(reports), true);

  const profile = await registry.read(ID.profile);
  assert.equal(profile.revoked, false);
  assert.equal(Object.isFrozen(profile), true);
  assert.equal(Object.isFrozen(profile.registryArtifact), true);

  const status = JSON.parse((await store.get(jobStatusKey(ID.job))).value);
  const jobIndex = JSON.parse((await store.get(campaignJobIndexKey(ID.campaign))).value);
  assert.equal(status.state, 'completed');
  assert.equal(jobIndex.records[ID.job].state, 'completed');
  assert.equal((await store.get(reportIndexKey(ID.job))) !== null, true);
});

test('Phase 3 rejects stale CAS and keeps cancellation index truth idempotently', async () => {
  const store = new InMemoryAuditStore();
  await seed(store);
  const campaigns = await createReadyJob(store, ID.job2, 'round3-job-2');
  const stale = '0'.repeat(64);
  await assert.rejects(
    () => campaigns.heartbeat({ jobId: ID.job2, attemptId: ID.attempt, state: 'collecting_evidence', statusEtag: stale }),
    (error) => error.code === 'stale_status'
  );
  const cancelled = await campaigns.cancelJob(ID.job2, 'operator cancellation');
  assert.equal(cancelled.state ?? cancelled.status?.state, 'cancelled');
  const replay = await campaigns.cancelJob(ID.job2, 'operator cancellation');
  assert.equal(replay.state ?? replay.status?.state, 'cancelled');
  const jobIndex = JSON.parse((await store.get(campaignJobIndexKey(ID.campaign))).value);
  assert.equal(jobIndex.records[ID.job2].state, 'cancelled');
  assert.equal(jobIndex.records[ID.job2].reason, 'operator cancellation');
});

test('campaign and job publication recover deterministic partial writes', async () => {
  const inner = new InMemoryAuditStore();
  await seed(inner);

  const campaignStore = new FailOnceStore(inner, (key) => key === workspaceCampaignIndexKey(ID.workspace));
  const campaignService = new CampaignService(campaignStore, { trustedFixture: true, now: () => new Date(NOW) });
  await assert.rejects(() => campaignService.createCampaign({ creation: creation() }), /injected write failure/);
  const recoveredCampaign = await campaignService.createCampaign({ creation: creation() });
  assert.equal(recoveredCampaign.current.state, 'active');

  const jobStore = new FailOnceStore(inner, (key) => key === campaignJobIndexKey(ID.campaign));
  const jobService = new CampaignService(jobStore, { trustedFixture: true, now: () => new Date(NOW) });
  await assert.rejects(() => jobService.submitJob({ request: request() }), /injected write failure/);
  const recoveredJob = await jobService.submitJob({ request: request() });
  assert.equal(recoveredJob.status.state, 'awaiting_executor');
});

test('profile revocation retries are immutable and conflict-safe', async () => {
  const store = new InMemoryAuditStore();
  const registry = await seed(store);
  const revocation = {
    schemaVersion: 'profile-revocation-v1',
    profileId: ID.profile,
    reason: 'superseded release',
    revokedAt: NOW
  };
  const first = await registry.revoke(ID.profile, revocation);
  assert.equal(first.revoked, true);
  const replay = await registry.revoke(ID.profile, revocation);
  assert.equal(replay.idempotent, true);
  await assert.rejects(
    () => registry.revoke(ID.profile, { ...revocation, reason: 'different reason' }),
    (error) => error.code === 'revocation_conflict'
  );
  const index = JSON.parse((await store.get(profileIndexKey())).value);
  assert.equal(index.records[ID.profile].revoked, true);
});
