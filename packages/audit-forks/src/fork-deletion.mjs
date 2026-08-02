import {
  canonicalJson, checkpointManifestKey, exportManifestKey, forkCheckpointIndexKey, forkExportIndexKey,
  forkTombstoneKey, sha256Hex, validateForkTombstone
} from '../../audit-fork-protocol/src/index.mjs';
import { ForkStateError } from './storage.mjs';

function deletionConflict(message = 'Deletion retry metadata conflicts with the persisted deletion') {
  return new ForkStateError('deletion_conflict', message);
}
async function putDeletionTombstone(service, forkId, tombstone) {
  try { await service.storage.putImmutable(forkTombstoneKey(forkId), tombstone); }
  catch (cause) { if (cause?.code === 'immutable_conflict') throw deletionConflict(); throw cause; }
}

export async function deleteForkOperation(service, { forkId, tenantId, attemptId, occurredAt, reason }) {
  let current = await service.readForkForTenant(tenantId, forkId);
  if (current.attemptId !== attemptId) throw new ForkStateError('attempt_mismatch', 'Attempt does not own this fork');
  if (typeof reason !== 'string' || reason.length < 1 || reason.length > 160) throw new ForkStateError('invalid_reason', 'Deletion reason is invalid');
  const tombstone = validateForkTombstone({ schemaVersion:'fork-tombstone-v1', forkId, tenantId, attemptId, reason, deletedAt:occurredAt, requestDigest:current.requestDigest });
  const deletionDigest = await sha256Hex(canonicalJson(tombstone));
  const deletingTransitionId = `tr_delete_${deletionDigest.slice(0,24)}`;
  const deletedTransitionId = `tr_deleted_${deletionDigest.slice(0,24)}`;
  if (current.state === 'deleted') {
    if (current.lastTransitionId !== deletedTransitionId || current.lastFromState !== 'deleting' || current.deletedAt !== occurredAt) throw deletionConflict();
    await putDeletionTombstone(service,forkId,tombstone);
    return service.transitionFork({forkId,tenantId,attemptId,from:'deleting',to:'deleted',expectedEtag:current.etag,transitionId:deletedTransitionId,occurredAt});
  }
  if (current.state === 'deleting') {
    if (current.lastTransitionId !== deletingTransitionId || current.updatedAt !== occurredAt) throw deletionConflict();
    current = await service.transitionFork({forkId,tenantId,attemptId,from:current.lastFromState,to:'deleting',expectedEtag:current.etag,transitionId:deletingTransitionId,occurredAt});
  } else current = await service.transitionFork({forkId,tenantId,attemptId,from:current.state,to:'deleting',expectedEtag:current.etag,transitionId:deletingTransitionId,occurredAt});
  const checkpointIndex=(await service.storage.readIndex(forkCheckpointIndexKey(forkId),{entries:[]})).index;
  for(const entry of checkpointIndex.entries??[]){await service.storage.delete(entry.objectKey);await service.storage.delete(checkpointManifestKey(forkId,entry.checkpointId));}
  const exportIndex=(await service.storage.readIndex(forkExportIndexKey(forkId),{entries:[]})).index;
  for(const entry of exportIndex.entries??[])await service.storage.delete(exportManifestKey(forkId,entry.exportId));
  await putDeletionTombstone(service,forkId,tombstone);
  return service.transitionFork({forkId,tenantId,attemptId,from:'deleting',to:'deleted',expectedEtag:current.etag,transitionId:deletedTransitionId,occurredAt});
}
