import {
  FORK_LIMITS,
  canonicalJson,
  checkpointManifestKey,
  exportManifestKey,
  forkCheckpointIndexKey,
  forkExportIndexKey,
  forkRestoreManifestKey,
  forkTombstoneKey,
  sha256Hex,
  validateCheckpointManifest,
  validateExportManifest,
  validateForkTombstone,
  validateRestoreManifest
} from '../../audit-fork-protocol/src/index.mjs';
import { ForkStateError, bytesOf } from './storage.mjs';

function operationConflict(kind) {
  return new ForkStateError(`${kind}_conflict`, `${kind} retry metadata conflicts with the persisted operation`);
}

function operationIds(kind, identity) {
  return {
    start: `tr_${kind}_start_${identity}`,
    done: `tr_${kind}_done_${identity}`
  };
}

async function enterTransient(service, current, input) {
  const ids = operationIds(input.kind, input.identity);
  if (current.state === 'ready' && current.lastTransitionId === ids.done) {
    if (current.updatedAt !== input.at) throw operationConflict(input.kind);
    return { current, ids };
  }
  if (current.state === input.state) {
    if (current.lastTransitionId !== ids.start || current.updatedAt !== input.at || current.lastFromState !== 'ready') {
      throw operationConflict(input.kind);
    }
    return { current, ids };
  }
  if (current.state !== 'ready') {
    throw new ForkStateError('invalid_state', `Fork cannot enter ${input.state} from ${current.state}`);
  }
  const transitioned = await service.transitionFork({
    forkId: current.forkId,
    tenantId: input.tenantId,
    attemptId: input.attemptId,
    from: 'ready',
    to: input.state,
    expectedEtag: current.etag,
    transitionId: ids.start,
    occurredAt: input.at
  });
  return { current: transitioned, ids };
}

async function finishTransient(service, current, input) {
  return service.transitionFork({
    forkId: current.forkId,
    tenantId: input.tenantId,
    attemptId: input.attemptId,
    from: input.state,
    to: 'ready',
    expectedEtag: current.etag,
    transitionId: input.doneId,
    occurredAt: input.at,
    ...(input.blockNumber === undefined ? {} : { blockNumber: input.blockNumber }),
    ...(input.blockHash === undefined ? {} : { blockHash: input.blockHash })
  });
}

export async function publishCheckpointOperation(service, { manifest: manifestInput, bytes }) {
  const manifest = validateCheckpointManifest(manifestInput);
  let current = await service.readFork(manifest.forkId);
  if (current.tenantId !== manifest.tenantId) throw new ForkStateError('unauthorized_tenant', 'Tenant does not own this fork');
  if (current.attemptId !== manifest.attemptId) throw new ForkStateError('attempt_mismatch', 'Attempt does not own this fork');
  if (!['ready', 'checkpointing'].includes(current.state)) throw new ForkStateError('invalid_state', 'Fork cannot publish a checkpoint in its current state');
  if (current.chainId !== manifest.chainId || manifest.blockNumber < current.blockNumber || (current.blockHash && manifest.blockHash && current.blockHash !== manifest.blockHash)) {
    throw new ForkStateError('chain_block_drift', 'Checkpoint identity drifted from fork');
  }

  const payload = bytesOf(bytes);
  if (payload.byteLength !== manifest.bytes) throw new ForkStateError('size_mismatch', 'Checkpoint byte length does not match manifest');
  if (await sha256Hex(payload) !== manifest.sha256) throw new ForkStateError('digest_mismatch', 'Checkpoint digest does not match manifest');

  const indexKey = forkCheckpointIndexKey(manifest.forkId);
  const { index } = await service.storage.readIndex(indexKey, {
    schemaVersion: 'fork-checkpoint-index-v1', forkId: manifest.forkId, entries: [], updatedAt: manifest.createdAt
  });
  const existing = index.entries.find((entry) => entry.checkpointId === manifest.checkpointId);
  if (!existing && index.entries.filter((entry) => !entry.deletedAt).length >= FORK_LIMITS.maxCheckpoints) {
    throw new ForkStateError('checkpoint_quota_exceeded', 'Fork already has eight active checkpoints');
  }

  const entered = await enterTransient(service, current, {
    kind: 'checkpoint',
    identity: manifest.checkpointId,
    state: 'checkpointing',
    tenantId: manifest.tenantId,
    attemptId: manifest.attemptId,
    at: manifest.createdAt
  });
  current = entered.current;

  await service.storage.putImmutable(manifest.objectKey, payload);
  await service.storage.putImmutable(checkpointManifestKey(manifest.forkId, manifest.checkpointId), manifest);
  await service.storage.mergeIndex(
    indexKey,
    { schemaVersion: 'fork-checkpoint-index-v1', forkId: manifest.forkId, entries: [], updatedAt: manifest.createdAt },
    (item) => item.checkpointId,
    {
      checkpointId: manifest.checkpointId,
      objectKey: manifest.objectKey,
      sha256: manifest.sha256,
      bytes: manifest.bytes,
      blockNumber: manifest.blockNumber,
      createdAt: manifest.createdAt,
      expiresAt: manifest.expiresAt,
      updatedAt: manifest.createdAt
    },
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.checkpointId.localeCompare(b.checkpointId)
  );
  await finishTransient(service, current, {
    state: 'checkpointing',
    tenantId: manifest.tenantId,
    attemptId: manifest.attemptId,
    doneId: entered.ids.done,
    at: manifest.createdAt
  });
  return manifest;
}

export async function readCheckpointOperation(service, forkId, checkpointId) {
  const record = await service.storage.get(checkpointManifestKey(forkId, checkpointId));
  if (!record) throw new ForkStateError('checkpoint_not_found', 'Checkpoint manifest does not exist');
  return validateCheckpointManifest(JSON.parse(typeof record.value === 'string' ? record.value : new TextDecoder().decode(record.value)));
}

export async function exportCheckpointOperation(service, input) {
  const manifest = validateExportManifest(input);
  let current = await service.readFork(manifest.forkId);
  if (current.tenantId !== manifest.tenantId) throw new ForkStateError('unauthorized_tenant', 'Tenant does not own this fork');
  const checkpoint = await service.readCheckpoint(manifest.forkId, manifest.checkpointId);
  if (checkpoint.tenantId !== manifest.tenantId) throw new ForkStateError('unauthorized_tenant', 'Tenant does not own this checkpoint');
  if (checkpoint.attemptId !== current.attemptId) throw new ForkStateError('attempt_mismatch', 'Checkpoint attempt does not own this fork');
  if (checkpoint.objectKey !== manifest.sourceObjectKey || checkpoint.sha256 !== manifest.sourceSha256) {
    throw new ForkStateError('checkpoint_reference_mismatch', 'Export must reference the exact checkpoint object');
  }
  const source = await service.storage.head(checkpoint.objectKey);
  if (!source || source.size !== checkpoint.bytes) throw new ForkStateError('checkpoint_object_missing', 'Checkpoint object is missing');

  const entered = await enterTransient(service, current, {
    kind: 'export',
    identity: manifest.exportId,
    state: 'exporting',
    tenantId: manifest.tenantId,
    attemptId: current.attemptId,
    at: manifest.createdAt
  });
  current = entered.current;

  await service.storage.putImmutable(exportManifestKey(manifest.forkId, manifest.exportId), manifest);
  await service.storage.mergeIndex(
    forkExportIndexKey(manifest.forkId),
    { schemaVersion: 'fork-export-index-v1', forkId: manifest.forkId, entries: [], updatedAt: manifest.createdAt },
    (item) => item.exportId,
    {
      exportId: manifest.exportId,
      checkpointId: manifest.checkpointId,
      sourceObjectKey: manifest.sourceObjectKey,
      sourceSha256: manifest.sourceSha256,
      createdAt: manifest.createdAt,
      expiresAt: manifest.expiresAt,
      updatedAt: manifest.createdAt
    },
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.exportId.localeCompare(b.exportId)
  );
  await finishTransient(service, current, {
    state: 'exporting',
    tenantId: manifest.tenantId,
    attemptId: current.attemptId,
    doneId: entered.ids.done,
    at: manifest.createdAt
  });
  return manifest;
}

export async function restoreCheckpointOperation(service, input) {
  const restore = validateRestoreManifest(input);
  let current = await service.readFork(restore.forkId);
  if (current.tenantId !== restore.tenantId) throw new ForkStateError('unauthorized_tenant', 'Tenant does not own this fork');
  if (current.attemptId !== restore.attemptId) throw new ForkStateError('attempt_mismatch', 'Attempt does not own this fork');
  const checkpoint = await service.readCheckpoint(restore.forkId, restore.checkpointId);
  if (checkpoint.tenantId !== restore.tenantId || checkpoint.attemptId !== restore.attemptId) {
    throw new ForkStateError('checkpoint_not_found', 'Checkpoint manifest does not exist');
  }
  if (checkpoint.objectKey !== restore.sourceObjectKey || checkpoint.sha256 !== restore.sourceSha256) {
    throw new ForkStateError('checkpoint_reference_mismatch', 'Restore must reference the exact checkpoint object');
  }
  const object = await service.storage.head(checkpoint.objectKey);
  if (!object || object.size !== checkpoint.bytes) throw new ForkStateError('checkpoint_object_missing', 'Checkpoint object is missing');

  const entered = await enterTransient(service, current, {
    kind: 'restore',
    identity: restore.restoreId,
    state: 'restoring',
    tenantId: restore.tenantId,
    attemptId: restore.attemptId,
    at: restore.requestedAt
  });
  current = entered.current;

  await service.storage.putImmutable(forkRestoreManifestKey(restore.forkId, restore.restoreId), restore);
  await finishTransient(service, current, {
    state: 'restoring',
    tenantId: restore.tenantId,
    attemptId: restore.attemptId,
    doneId: entered.ids.done,
    at: restore.requestedAt,
    blockNumber: checkpoint.blockNumber,
    blockHash: checkpoint.blockHash
  });
  return restore;
}

function deletionConflict(message = 'Deletion retry metadata conflicts with the persisted deletion') {
  return new ForkStateError('deletion_conflict', message);
}

async function putDeletionTombstone(service, forkId, tombstone) {
  try {
    await service.storage.putImmutable(forkTombstoneKey(forkId), tombstone);
  } catch (cause) {
    if (cause?.code === 'immutable_conflict') throw deletionConflict();
    throw cause;
  }
}

export async function deleteForkOperation(service, { forkId, tenantId, attemptId, occurredAt, reason }) {
  let current = await service.readFork(forkId);
  if (current.tenantId !== tenantId) throw new ForkStateError('unauthorized_tenant', 'Tenant does not own this fork');
  if (current.attemptId !== attemptId) throw new ForkStateError('attempt_mismatch', 'Attempt does not own this fork');
  if (typeof reason !== 'string' || reason.length < 1 || reason.length > 160) throw new ForkStateError('invalid_reason', 'Deletion reason is invalid');

  const tombstone = validateForkTombstone({
    schemaVersion: 'fork-tombstone-v1',
    forkId,
    tenantId,
    attemptId,
    reason,
    deletedAt: occurredAt,
    requestDigest: current.requestDigest
  });
  const deletionDigest = await sha256Hex(canonicalJson(tombstone));
  const deletingTransitionId = `tr_delete_${deletionDigest.slice(0, 24)}`;
  const deletedTransitionId = `tr_deleted_${deletionDigest.slice(0, 24)}`;

  if (current.state === 'deleted') {
    if (current.lastTransitionId !== deletedTransitionId || current.lastFromState !== 'deleting' || current.deletedAt !== occurredAt) {
      throw deletionConflict();
    }
    await putDeletionTombstone(service, forkId, tombstone);
    return service.transitionFork({
      forkId,
      tenantId,
      attemptId,
      from: 'deleting',
      to: 'deleted',
      expectedEtag: current.etag,
      transitionId: deletedTransitionId,
      occurredAt
    });
  }

  if (current.state === 'deleting') {
    if (current.lastTransitionId !== deletingTransitionId || current.updatedAt !== occurredAt) throw deletionConflict();
    current = await service.transitionFork({
      forkId,
      tenantId,
      attemptId,
      from: current.lastFromState,
      to: 'deleting',
      expectedEtag: current.etag,
      transitionId: deletingTransitionId,
      occurredAt
    });
  } else {
    current = await service.transitionFork({
      forkId,
      tenantId,
      attemptId,
      from: current.state,
      to: 'deleting',
      expectedEtag: current.etag,
      transitionId: deletingTransitionId,
      occurredAt
    });
  }

  const checkpointIndex = (await service.storage.readIndex(forkCheckpointIndexKey(forkId), { entries: [] })).index;
  for (const entry of checkpointIndex.entries ?? []) {
    await service.storage.delete(entry.objectKey);
    await service.storage.delete(checkpointManifestKey(forkId, entry.checkpointId));
  }
  const exportIndex = (await service.storage.readIndex(forkExportIndexKey(forkId), { entries: [] })).index;
  for (const entry of exportIndex.entries ?? []) await service.storage.delete(exportManifestKey(forkId, entry.exportId));

  await putDeletionTombstone(service, forkId, tombstone);
  return service.transitionFork({
    forkId,
    tenantId,
    attemptId,
    from: 'deleting',
    to: 'deleted',
    expectedEtag: current.etag,
    transitionId: deletedTransitionId,
    occurredAt
  });
}
