import {
  FORK_LIMITS, checkpointManifestKey, forkCheckpointIndexKey, sha256Hex, validateCheckpointManifest
} from '../../audit-fork-protocol/src/index.mjs';
import { ForkStateError, bytesOf } from './storage.mjs';
import { enterTransient, returnReady } from './lifecycle.mjs';

export async function publishCheckpointOperation(service, { manifest: manifestInput, bytes }) {
  const manifest = validateCheckpointManifest(manifestInput);
  let current = await service.readForkForTenant(manifest.tenantId, manifest.forkId);
  if (current.attemptId !== manifest.attemptId) throw new ForkStateError('attempt_mismatch', 'Attempt does not own this fork');
  if (!['ready', 'checkpointing'].includes(current.state)) throw new ForkStateError('invalid_state', 'Fork cannot publish a checkpoint in its current state');
  if (current.chainId !== manifest.chainId || manifest.blockNumber < current.blockNumber || (current.blockHash && manifest.blockHash && current.blockHash !== manifest.blockHash)) {
    throw new ForkStateError('chain_block_drift', 'Checkpoint identity drifted from fork');
  }
  const payload = bytesOf(bytes);
  if (payload.byteLength !== manifest.bytes) throw new ForkStateError('size_mismatch', 'Checkpoint byte length does not match manifest');
  if (await sha256Hex(payload) !== manifest.sha256) throw new ForkStateError('digest_mismatch', 'Checkpoint digest does not match manifest');

  const lifecycle = await enterTransient(service, {
    kind: 'checkpoint', transientState: 'checkpointing', forkId: manifest.forkId,
    tenantId: manifest.tenantId, attemptId: manifest.attemptId,
    occurredAt: manifest.createdAt, identity: manifest
  });
  if (lifecycle.completed) return manifest;
  current = lifecycle.current;

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
      checkpointId: manifest.checkpointId, objectKey: manifest.objectKey, sha256: manifest.sha256,
      bytes: manifest.bytes, blockNumber: manifest.blockNumber, createdAt: manifest.createdAt,
      expiresAt: manifest.expiresAt, updatedAt: manifest.createdAt
    },
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.checkpointId.localeCompare(b.checkpointId)
  );
  await returnReady(service, {
    transientState: 'checkpointing', forkId: manifest.forkId, tenantId: manifest.tenantId,
    attemptId: manifest.attemptId, occurredAt: manifest.createdAt, current, ids: lifecycle.ids,
    blockNumber: manifest.blockNumber, blockHash: manifest.blockHash
  });
  return manifest;
}
