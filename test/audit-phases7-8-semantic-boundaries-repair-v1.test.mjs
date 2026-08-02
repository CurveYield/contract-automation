import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryAuditStore } from './audit-phase7-in-memory-store-v1.mjs';
import {
  canonicalJson,
  checkpointObjectKey,
  exportManifestKey,
  forkRestoreManifestKey,
  sha256Hex,
  validateForkActionRequest
} from '../packages/audit-fork-protocol/src/index.mjs';
import { ForkService } from '../packages/audit-forks/src/index.mjs';
import { sha256 } from '../packages/audit-clean-room-protocol/src/index.mjs';
import {
  createTerminalCampaignManifest
} from '../packages/audit-clean-room-campaigns/src/index.mjs';
import {
  buildRelationMaps,
  createMergeManifest,
  createMergeRequest,
  validateConflictRelation,
  validateDuplicateRelation,
  validateMergeManifest,
  validateMergeRequest
} from '../packages/audit-controlled-merge/src/index.mjs';
import {
  createProvenanceIndex
} from '../packages/audit-provenance/src/index.mjs';

const ids = {
  tenantId: `ten_${'1'.repeat(32)}`,
  otherTenantId: `ten_${'9'.repeat(32)}`,
  workspaceId: `ws_${'2'.repeat(32)}`,
  campaignId: `cmp_${'3'.repeat(32)}`,
  forkId: `fork_${'4'.repeat(32)}`,
  attemptId: `att_${'5'.repeat(32)}`,
  checkpointId: `snap_${'6'.repeat(32)}`,
  exportId: `exp_${'7'.repeat(32)}`,
  restoreId: `rst_${'8'.repeat(32)}`
};
const readForkInput = { forkId: ids.forkId, tenantId: ids.tenantId, attemptId: ids.attemptId };

function forkRequest() {
  return {
    schemaVersion: 'fork-request-v1',
    tenantId: ids.tenantId,
    workspaceId: ids.workspaceId,
    campaignId: ids.campaignId,
    forkId: ids.forkId,
    attemptId: ids.attemptId,
    profileId: 'free-development-v1',
    policyVersion: 'fork-policy-v1',
    requesterId: 'usr',
    scopes: ['audit:read', 'audit:submit'],
    chainId: 1,
    blockNumber: 21_000_000,
    blockHash: `0x${'a'.repeat(64)}`,
    adapterKind: 'mock',
    executionGate: 'trusted_mock',
    createdAt: '2026-08-01T00:00:00.000Z',
    idempotencyKey: 'create'
  };
}

function checkpointManifest(digest, bytes) {
  return {
    schemaVersion: 'fork-checkpoint-manifest-v1',
    checkpointId: ids.checkpointId,
    forkId: ids.forkId,
    tenantId: ids.tenantId,
    attemptId: ids.attemptId,
    chainId: 1,
    blockNumber: 21_000_000,
    blockHash: `0x${'a'.repeat(64)}`,
    objectKey: checkpointObjectKey(ids.forkId, ids.checkpointId),
    sha256: digest,
    bytes,
    contentType: 'application/octet-stream',
    opaque: true,
    encryption: { mode: 'client-managed', keyReference: 'opaque' },
    createdAt: '2026-08-01T00:30:00.000Z',
    expiresAt: '2026-08-02T00:30:00.000Z'
  };
}

function exportManifest(digest) {
  return {
    schemaVersion: 'fork-export-manifest-v1',
    exportId: ids.exportId,
    forkId: ids.forkId,
    tenantId: ids.tenantId,
    checkpointId: ids.checkpointId,
    sourceObjectKey: checkpointObjectKey(ids.forkId, ids.checkpointId),
    sourceSha256: digest,
    createdAt: '2026-08-01T01:00:00.000Z',
    expiresAt: '2026-08-08T01:00:00.000Z'
  };
}

function restoreManifest(digest) {
  return {
    schemaVersion: 'fork-restore-manifest-v1',
    restoreId: ids.restoreId,
    forkId: ids.forkId,
    tenantId: ids.tenantId,
    attemptId: ids.attemptId,
    checkpointId: ids.checkpointId,
    sourceObjectKey: checkpointObjectKey(ids.forkId, ids.checkpointId),
    sourceSha256: digest,
    requestedAt: '2026-08-01T01:30:00.000Z'
  };
}

class ArmedFailureStore {
  constructor() {
    this.inner = new InMemoryAuditStore();
    this.rule = null;
    this.failed = false;
  }
  arm(method, predicate) {
    this.rule = { method, predicate };
    this.failed = false;
  }
  maybeFail(method, key, value) {
    if (!this.failed && this.rule?.method === method && this.rule.predicate(key, value)) {
      this.failed = true;
      throw new Error(`simulated-${method}-failure:${key}`);
    }
  }
  async put(key, value, options) {
    this.maybeFail('put', key, value);
    return this.inner.put(key, value, options);
  }
  async get(key) { return this.inner.get(key); }
  async head(key) { return this.inner.head(key); }
  async delete(key) { return this.inner.delete(key); }
}

async function setupFork() {
  const store = new ArmedFailureStore();
  const service = new ForkService(store);
  await service.createFork(forkRequest());
  const bytes = new Uint8Array([1, 2, 3]);
  const digest = await sha256Hex(bytes);
  return { service, store, bytes, digest };
}

async function setupCheckpoint() {
  const state = await setupFork();
  await state.service.publishCheckpoint({
    manifest: checkpointManifest(state.digest, state.bytes.byteLength),
    bytes: state.bytes
  });
  return state;
}

test('Phase 7 rejects accessor-backed arrays without invoking the getter', () => {
  let invoked = 0;
  const slots = [];
  Object.defineProperty(slots, '0', {
    enumerable: true,
    configurable: true,
    get() {
      invoked += 1;
      throw new Error('must not run');
    }
  });
  slots.length = 1;
  assert.throws(() => validateForkActionRequest({
    schemaVersion: 'fork-action-request-v1',
    forkId: ids.forkId,
    attemptId: ids.attemptId,
    actionId: 'act_1',
    type: 'inspect_state',
    payload: { address: `0x${'1'.repeat(40)}`, slots },
    requestedAt: '2026-08-01T00:00:00.000Z'
  }), (error) => error?.code === 'hostile_reflection' || error?.code === 'unsafe_object');
  assert.equal(invoked, 0);
});

test('Phase 7 normalizes revoked proxies to a bounded validation error', () => {
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  assert.throws(() => canonicalJson(proxy), { code: 'hostile_reflection' });
});

test('checkpoint failure leaves a retryable checkpointing state and exact retry returns ready', async () => {
  const { service, store, bytes, digest } = await setupFork();
  const manifest = checkpointManifest(digest, bytes.byteLength);
  store.arm('put', (key) => key === manifest.objectKey);
  await assert.rejects(() => service.publishCheckpoint({ manifest, bytes }), /simulated-put-failure/);
  assert.equal((await service.readFork(readForkInput)).state, 'checkpointing');
  await service.publishCheckpoint({ manifest, bytes });
  assert.equal((await service.readFork(readForkInput)).state, 'ready');
});

test('export failure leaves a retryable exporting state and exact retry returns ready', async () => {
  const { service, store, digest } = await setupCheckpoint();
  const manifest = exportManifest(digest);
  store.arm('put', (key) => key === exportManifestKey(ids.forkId, ids.exportId));
  await assert.rejects(() => service.exportCheckpoint(manifest), /simulated-put-failure/);
  assert.equal((await service.readFork(readForkInput)).state, 'exporting');
  await service.exportCheckpoint(manifest);
  assert.equal((await service.readFork(readForkInput)).state, 'ready');
});

test('restore failure leaves a retryable restoring state and exact retry returns ready', async () => {
  const { service, store, digest } = await setupCheckpoint();
  const manifest = restoreManifest(digest);
  store.arm('put', (key) => key === forkRestoreManifestKey(ids.forkId, ids.restoreId));
  await assert.rejects(() => service.restoreCheckpoint(manifest), /simulated-put-failure/);
  assert.equal((await service.readFork(readForkInput)).state, 'restoring');
  await service.restoreCheckpoint(manifest);
  assert.equal((await service.readFork(readForkInput)).state, 'ready');
});

test('Phase 7 exposes tenant-bound fork and checkpoint reads', async () => {
  const { service } = await setupCheckpoint();
  assert.equal(typeof service.readForkForTenant, 'function');
  assert.equal(typeof service.readCheckpointForTenant, 'function');
  assert.equal((await service.readForkForTenant({ forkId: ids.forkId, tenantId: ids.tenantId })).forkId, ids.forkId);
  await assert.rejects(() => service.readFork(ids.forkId), { code: 'invalid_type' });
  await assert.rejects(
    () => service.readForkForTenant({ forkId: ids.forkId, tenantId: ids.otherTenantId }),
    { code: 'fork_not_found' }
  );
  assert.equal((await service.readCheckpointForTenant({
    forkId: ids.forkId,
    checkpointId: ids.checkpointId,
    tenantId: ids.tenantId,
    attemptId: ids.attemptId
  })).checkpointId, ids.checkpointId);
  await assert.rejects(
    () => service.readCheckpointForTenant({
      forkId: ids.forkId,
      checkpointId: ids.checkpointId,
      tenantId: ids.otherTenantId,
      attemptId: ids.attemptId
    }),
    { code: 'checkpoint_not_found' }
  );
});

function ref(id, character) {
  return { id, digest: `sha256:${character.repeat(64)}` };
}

function terminal(campaignId, findingId, severity = 'high') {
  return createTerminalCampaignManifest({
    tenantId: 'tenant-1',
    workspaceId: 'workspace-1',
    campaignId,
    workspaceSourceDigest: `sha256:${'1'.repeat(64)}`,
    baseArtifactDigest: `sha256:${'2'.repeat(64)}`,
    terminalState: 'completed',
    completionKind: 'findings',
    partialEvidence: false,
    truncated: false,
    policyId: 'policy-v1',
    profileVersions: ['profile-v1'],
    layerRefs: [ref(`layer-${campaignId}`, '3')],
    jobRefs: [ref(`job-${campaignId}`, '4')],
    attemptRefs: [ref(`attempt-${campaignId}`, '5')],
    evidenceRefs: [ref(`evidence-${campaignId}`, '6')],
    reportRefs: [ref(`report-${campaignId}`, '7')],
    findings: [{
      findingId,
      identityKey: 'shared-finding',
      severity,
      status: 'open',
      remediation: 'upgrade',
      location: 'contract-a',
      materialDigest: `sha256:${severity === 'high' ? '8'.repeat(64) : '9'.repeat(64)}`,
      evidenceRefs: [ref(`evidence-${campaignId}`, '6')]
    }],
    completedAt: '2026-08-01T02:00:00.000Z'
  });
}

function rehashMergeRequest(value) {
  const body = {
    schemaVersion: value.schemaVersion,
    tenantId: value.tenantId,
    workspaceId: value.workspaceId,
    workspaceSourceDigest: value.workspaceSourceDigest,
    campaignManifestRefs: value.campaignManifestRefs,
    policyId: value.policyId,
    requestedBy: value.requestedBy,
    requestedAt: value.requestedAt,
    idempotencyKey: value.idempotencyKey,
    expectedCurrentEtag: value.expectedCurrentEtag
  };
  value.requestDigest = sha256(body);
  value.mergeId = `merge-${value.requestDigest.slice(7, 31)}`;
  return value;
}

function validMergeRequest() {
  return createMergeRequest({
    terminalManifests: [terminal('campaign-1', 'finding-1'), terminal('campaign-2', 'finding-2')],
    policyId: 'policy-v1',
    requestedBy: 'user-1',
    requestedAt: '2026-08-01T03:00:00.000Z',
    idempotencyKey: 'merge-request-1',
    expectedCurrentEtag: `sha256:${'a'.repeat(64)}`
  });
}

test('merge request validator rejects self-hashed one-input and duplicate-input requests', () => {
  const valid = validMergeRequest();
  const one = rehashMergeRequest({ ...valid, campaignManifestRefs: [valid.campaignManifestRefs[0]] });
  assert.throws(() => validateMergeRequest(one), { code: 'insufficient_inputs' });
  const duplicate = rehashMergeRequest({
    ...valid,
    campaignManifestRefs: [valid.campaignManifestRefs[0], valid.campaignManifestRefs[0]]
  });
  assert.throws(() => validateMergeRequest(duplicate), { code: 'duplicate_identity' });
});

function validMergeManifest() {
  const request = validMergeRequest();
  return createMergeManifest({
    mergeRequest: request,
    finalState: 'completed',
    terminalManifestDigests: request.campaignManifestRefs.map((item) => item.manifestDigest),
    duplicateMapDigest: `sha256:${'b'.repeat(64)}`,
    conflictMapDigest: `sha256:${'c'.repeat(64)}`,
    provenanceIndexDigest: `sha256:${'d'.repeat(64)}`,
    mergedReportRefs: [{ referenceId: 'merged-report-1', referenceDigest: `sha256:${'e'.repeat(64)}` }],
    policyId: 'policy-v1',
    operationSummary: { classA: 4, classB: 4, retainedBytes: 2_000_000, retentionDays: 90, variant: 'typical' },
    publishedAt: '2026-08-01T04:00:00.000Z'
  });
}

function rehashMergeManifest(value) {
  const body = {
    schemaVersion: value.schemaVersion,
    mergeId: value.mergeId,
    requestDigest: value.requestDigest,
    finalState: value.finalState,
    terminalManifestDigests: value.terminalManifestDigests,
    duplicateMapDigest: value.duplicateMapDigest,
    conflictMapDigest: value.conflictMapDigest,
    provenanceIndexDigest: value.provenanceIndexDigest,
    mergedReportRefs: value.mergedReportRefs,
    policyId: value.policyId,
    operationSummary: value.operationSummary,
    publishedAt: value.publishedAt
  };
  value.manifestDigest = sha256(body);
  value.manifestId = `merge-manifest-${value.manifestDigest.slice(7, 31)}`;
  return value;
}

test('merge manifest validator rejects self-hashed malformed operation and report-reference records', () => {
  const valid = validMergeManifest();
  assert.throws(
    () => validateMergeManifest(rehashMergeManifest({
      ...valid,
      operationSummary: { ...valid.operationSummary, classA: -1 }
    })),
    { code: 'invalid_integer' }
  );
  assert.throws(
    () => validateMergeManifest(rehashMergeManifest({
      ...valid,
      mergedReportRefs: [{ referenceId: 'merged-report-1', referenceDigest: 'not-a-digest' }]
    })),
    { code: 'invalid_digest' }
  );
});

function relationFinding(campaignId, findingId, severity, materialCharacter) {
  return {
    findingId,
    campaignId,
    identityKey: 'shared-finding',
    severity,
    status: 'open',
    remediation: 'upgrade',
    location: 'contract-a',
    materialDigest: `sha256:${materialCharacter.repeat(64)}`,
    evidenceRefs: [ref(`evidence-${campaignId}`, '6')]
  };
}

test('duplicate relation validator proves member material consistency and uniqueness', () => {
  const relation = buildRelationMaps([
    relationFinding('campaign-1', 'finding-1', 'high', '8'),
    relationFinding('campaign-2', 'finding-2', 'high', '8')
  ]).duplicateRelations[0];
  const invalidMembers = relation.members.map((item, index) => index === 1
    ? { ...item, materialDigest: `sha256:${'9'.repeat(64)}` }
    : item);
  const core = {
    schemaVersion: relation.schemaVersion,
    identityKey: relation.identityKey,
    material: relation.material,
    members: invalidMembers
  };
  const relationDigest = sha256(core);
  assert.throws(() => validateDuplicateRelation({
    ...core,
    relationId: `duplicate-${relationDigest.slice(7, 31)}`,
    relationDigest
  }), { code: 'relation_semantic_mismatch' });
});

test('conflict relation validator proves the stated conflict fields', () => {
  const relation = buildRelationMaps([
    relationFinding('campaign-1', 'finding-1', 'high', '8'),
    relationFinding('campaign-2', 'finding-2', 'low', '9')
  ]).conflictRelations[0];
  const core = { ...relation, conflictFields: ['location'] };
  delete core.relationId;
  delete core.relationDigest;
  const relationDigest = sha256(core);
  assert.throws(() => validateConflictRelation({
    ...core,
    relationId: `conflict-${relationDigest.slice(7, 31)}`,
    relationDigest
  }), { code: 'relation_semantic_mismatch' });
});

test('provenance classification rejects accessor-backed nodes without invoking getters', () => {
  let invoked = 0;
  const hostile = {};
  Object.defineProperty(hostile, 'schemaVersion', {
    enumerable: true,
    get() {
      invoked += 1;
      throw new Error('must not run');
    }
  });
  assert.throws(() => createProvenanceIndex({
    tenantId: 'tenant-1',
    workspaceId: 'workspace-1',
    mergeId: 'merge-1',
    nodes: [hostile],
    edges: [],
    createdAt: '2026-08-01T05:00:00.000Z'
  }), { code: 'accessor_field' });
  assert.equal(invoked, 0);
});