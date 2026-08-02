import { deepFreeze, statusText } from './safety-v1.mjs';

export function lifecycleState(status) {
  const canonical = statusText(status);
  const labels = {
    idle: 'Idle', pending: 'Pending', admitted: 'Admitted', 'awaiting-executor': 'Awaiting executor',
    running: 'In progress', 'running-model-only': 'Model analysis in progress', completed: 'Completed',
    published: 'Published', failed: 'Failed', cancelled: 'Cancelled', timeout: 'Timed out',
    'resource-limit': 'Resource limit reached', creating: 'Creation pending', ready: 'Ready',
    checkpointing: 'Checkpoint pending', restoring: 'Restore pending', restored: 'Restored',
    deleting: 'Deletion pending', deleted: 'Deleted', tombstoning: 'Tombstone pending',
    tombstoned: 'Tombstoned', exporting: 'Export pending', exported: 'Exported', stale: 'Stale state',
    unauthorized: 'Access unavailable', offline: 'Offline'
  };
  const terminal = new Set(['completed', 'published', 'failed', 'cancelled', 'timeout', 'resource-limit', 'deleted', 'tombstoned', 'exported']);
  return deepFreeze({ code: canonical, label: labels[canonical] ?? 'Unknown', terminal: terminal.has(canonical) });
}
