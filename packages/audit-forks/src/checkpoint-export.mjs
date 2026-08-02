import { exportManifestKey, forkExportIndexKey, validateExportManifest } from '../../audit-fork-protocol/src/index.mjs';
import { ForkStateError } from './storage.mjs';
import { enterTransient, returnReady } from './lifecycle.mjs';

export async function exportCheckpointOperation(service, input) {
  const manifest = validateExportManifest(input);
  const initial = await service.readForkForTenant(manifest.tenantId, manifest.forkId);
  const checkpoint = await service.readCheckpointForTenant(manifest.tenantId, initial.attemptId, manifest.forkId, manifest.checkpointId);
  if (checkpoint.objectKey !== manifest.sourceObjectKey || checkpoint.sha256 !== manifest.sourceSha256) {
    throw new ForkStateError('checkpoint_reference_mismatch', 'Export must reference the exact checkpoint object');
  }
  const source = await service.storage.head(checkpoint.objectKey);
  if (!source || source.size !== checkpoint.bytes) throw new ForkStateError('checkpoint_object_missing', 'Checkpoint object is missing');
  const lifecycle = await enterTransient(service, {
    kind: 'export', transientState: 'exporting', forkId: manifest.forkId,
    tenantId: manifest.tenantId, attemptId: initial.attemptId,
    occurredAt: manifest.createdAt, identity: manifest
  });
  if (lifecycle.completed) return manifest;
  await service.storage.putImmutable(exportManifestKey(manifest.forkId, manifest.exportId), manifest);
  await service.storage.mergeIndex(
    forkExportIndexKey(manifest.forkId),
    { schemaVersion: 'fork-export-index-v1', forkId: manifest.forkId, entries: [], updatedAt: manifest.createdAt },
    (item) => item.exportId,
    {
      exportId: manifest.exportId, checkpointId: manifest.checkpointId,
      sourceObjectKey: manifest.sourceObjectKey, sourceSha256: manifest.sourceSha256,
      createdAt: manifest.createdAt, expiresAt: manifest.expiresAt, updatedAt: manifest.createdAt
    },
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.exportId.localeCompare(b.exportId)
  );
  await returnReady(service, {
    transientState: 'exporting', forkId: manifest.forkId, tenantId: manifest.tenantId,
    attemptId: initial.attemptId, occurredAt: manifest.createdAt, current: lifecycle.current, ids: lifecycle.ids
  });
  return manifest;
}
