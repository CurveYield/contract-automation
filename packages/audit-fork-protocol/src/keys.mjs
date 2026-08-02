import { ACTION_ID, EXPORT_ID, RESTORE_ID, TRANSITION_ID, assertAuditId, assertCheckpointId, assertForkId, assertInteger, assertString } from './internals.mjs';

export function forkRequestKey(forkId) {
  assertForkId(forkId);
  return `forks/${forkId}/request-v1.json`;
}
export function forkCurrentKey(forkId) {
  assertForkId(forkId);
  return `forks/${forkId}/current-v1.json`;
}
export function forkEventKey(forkId, version) {
  assertForkId(forkId);
  assertInteger(version, '$.version', 1);
  return `forks/${forkId}/events/${String(version).padStart(12, '0')}.json`;
}
export function checkpointObjectKey(forkId, checkpointId) {
  assertForkId(forkId);
  assertCheckpointId(checkpointId);
  return `forks/${forkId}/checkpoints/${checkpointId}.bin`;
}
export function checkpointManifestKey(forkId, checkpointId) {
  assertForkId(forkId);
  assertCheckpointId(checkpointId);
  return `forks/${forkId}/checkpoints/${checkpointId}-manifest-v1.json`;
}
export function exportManifestKey(forkId, exportId) {
  assertForkId(forkId);
  assertString(exportId, '$.exportId', 36, EXPORT_ID);
  return `forks/${forkId}/exports/${exportId}-manifest-v1.json`;
}
export function forkRestoreManifestKey(forkId, restoreId) {
  assertForkId(forkId);
  assertString(restoreId, '$.restoreId', 36, RESTORE_ID);
  return `forks/${forkId}/restores/${restoreId}-manifest-v1.json`;
}
export function forkTombstoneKey(forkId) {
  assertForkId(forkId);
  return `forks/${forkId}/tombstone-v1.json`;
}
export function tenantForkIndexKey(tenantId) {
  assertAuditId(tenantId, 'tenant', '$.tenantId');
  return `indexes/tenant/${tenantId}/forks-v1.json`;
}
export function forkCheckpointIndexKey(forkId) {
  assertForkId(forkId);
  return `indexes/fork/${forkId}/checkpoints-v1.json`;
}
export function forkExportIndexKey(forkId) {
  assertForkId(forkId);
  return `indexes/fork/${forkId}/exports-v1.json`;
}
export function forkActionKey(forkId, actionId) {
  assertForkId(forkId);
  assertString(actionId, '$.actionId', 84, ACTION_ID);
  return `forks/${forkId}/actions/${actionId}-result-v1.json`;
}
export function assertTransitionId(value, path = '$.transitionId') {
  return assertString(value, path, 180, TRANSITION_ID);
}
