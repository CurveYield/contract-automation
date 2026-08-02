import { forkRestoreManifestKey, validateRestoreManifest } from '../../audit-fork-protocol/src/index.mjs';
import { ForkStateError } from './storage.mjs';
import { enterTransient, returnReady } from './lifecycle.mjs';

export async function restoreCheckpointOperation(service, input) {
  const restore = validateRestoreManifest(input);
  const initial = await service.readForkForTenant(restore.tenantId, restore.forkId);
  if (initial.attemptId !== restore.attemptId) throw new ForkStateError('attempt_mismatch', 'Attempt does not own this fork');
  const checkpoint = await service.readCheckpointForTenant(restore.tenantId, restore.attemptId, restore.forkId, restore.checkpointId);
  if (checkpoint.objectKey !== restore.sourceObjectKey || checkpoint.sha256 !== restore.sourceSha256) {
    throw new ForkStateError('checkpoint_reference_mismatch', 'Restore must reference the exact checkpoint object');
  }
  const object = await service.storage.head(checkpoint.objectKey);
  if (!object || object.size !== checkpoint.bytes) throw new ForkStateError('checkpoint_object_missing', 'Checkpoint object is missing');
  const lifecycle = await enterTransient(service, {
    kind: 'restore', transientState: 'restoring', forkId: restore.forkId,
    tenantId: restore.tenantId, attemptId: restore.attemptId,
    occurredAt: restore.requestedAt, identity: restore
  });
  if (lifecycle.completed) return restore;
  await service.storage.putImmutable(forkRestoreManifestKey(restore.forkId, restore.restoreId), restore);
  await returnReady(service, {
    transientState: 'restoring', forkId: restore.forkId, tenantId: restore.tenantId,
    attemptId: restore.attemptId, occurredAt: restore.requestedAt, current: lifecycle.current, ids: lifecycle.ids,
    blockNumber: checkpoint.blockNumber, blockHash: checkpoint.blockHash
  });
  return restore;
}
