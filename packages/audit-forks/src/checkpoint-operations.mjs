import {
  FORK_LIMITS,
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

export async function publishCheckpointOperation(service, { manifest: manifestInput, bytes }) {
  const manifest = validateCheckpointManifest(manifestInput);
  const current = await service.readFork(manifest.forkId);
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
  return manifest;
}

export async function readCheckpointOperation(service, forkId, checkpointId) {
  const record = await service.storage.get(checkpointManifestKey(forkId, checkpointId));
  if (!record) throw new ForkStateError('checkpoint_not_found', 'Checkpoint manifest does not exist');
  return validateCheckpointManifest(JSON.parse(typeof record.value === 'string' ? record.value : new TextDecoder().decode(record.value)));
}

export async function exportCheckpointOperation(service, input) {
  const manifest = validateExportManifest(input);
  const checkpoint = await service.readCheckpoint(manifest.forkId, manifest.checkpointId);
  if (checkpoint.tenantId !== manifest.tenantId) throw new ForkStateError('unauthorized_tenant', 'Tenant does not own this checkpoint');
  if (checkpoint.objectKey !== manifest.sourceObjectKey || checkpoint.sha256 !== manifest.sourceSha256) {
    throw new ForkStateError('checkpoint_reference_mismatch', 'Export must reference the exact checkpoint object');
  }
  const source = await service.storage.head(checkpoint.objectKey);
  if (!source || source.size !== checkpoint.bytes) throw new ForkStateError('checkpoint_object_missing', 'Checkpoint object is missing');

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
  return manifest;
}

export async function restoreCheckpointOperation(service, input) {
  const restore = validateRestoreManifest(input);
  const current = await service.readFork(restore.forkId);
  if (current.tenantId !== restore.tenantId) throw new ForkStateError('unauthorized_tenant', 'Tenant does not own this fork');
  if (current.attemptId !== restore.attemptId) throw new ForkStateError('attempt_mismatch', 'Attempt does not own this fork');
  const checkpoint = await service.readCheckpoint(restore.forkId, restore.checkpointId);
  if (checkpoint.objectKey !== restore.sourceObjectKey || checkpoint.sha256 !== restore.sourceSha256) {
    throw new ForkStateError('checkpoint_reference_mismatch', 'Restore must reference the exact checkpoint object');
  }
  const object = await service.storage.head(checkpoint.objectKey);
  if (!object || object.size !== checkpoint.bytes) throw new ForkStateError('checkpoint_object_missing', 'Checkpoint object is missing');
  await service.storage.putImmutable(forkRestoreManifestKey(restore.forkId, restore.restoreId), restore);
  return restore;
}

export async function deleteForkOperation(service, { forkId, tenantId, attemptId, occurredAt, reason }) {
  const current = await service.readFork(forkId);
  if (current.tenantId !== tenantId) throw new ForkStateError('unauthorized_tenant', 'Tenant does not own this fork');
  if (current.attemptId !== attemptId) throw new ForkStateError('attempt_mismatch', 'Attempt does not own this fork');
  if (typeof reason !== 'string' || reason.length < 1 || reason.length > 160) throw new ForkStateError('invalid_reason', 'Deletion reason is invalid');

  const checkpointIndex = (await service.storage.readIndex(forkCheckpointIndexKey(forkId), { entries: [] })).index;
  for (const entry of checkpointIndex.entries ?? []) {
    await service.storage.delete(entry.objectKey);
    await service.storage.delete(checkpointManifestKey(forkId, entry.checkpointId));
  }
  const exportIndex = (await service.storage.readIndex(forkExportIndexKey(forkId), { entries: [] })).index;
  for (const entry of exportIndex.entries ?? []) await service.storage.delete(exportManifestKey(forkId, entry.exportId));

  const tombstone = validateForkTombstone({
    schemaVersion: 'fork-tombstone-v1',
    forkId,
    tenantId,
    attemptId,
    reason,
    deletedAt: occurredAt,
    requestDigest: current.requestDigest
  });
  await service.storage.putImmutable(forkTombstoneKey(forkId), tombstone);

  const deleting = current.state === 'deleting' ? current : await service.transitionFork({
    forkId,
    tenantId,
    attemptId,
    from: current.state,
    to: 'deleting',
    expectedEtag: current.etag,
    transitionId: `tr_delete_${current.version + 1}`,
    occurredAt
  });
  return service.transitionFork({
    forkId,
    tenantId,
    attemptId,
    from: 'deleting',
    to: 'deleted',
    expectedEtag: deleting.etag,
    transitionId: `tr_deleted_${deleting.version + 1}`,
    occurredAt
  });
}
