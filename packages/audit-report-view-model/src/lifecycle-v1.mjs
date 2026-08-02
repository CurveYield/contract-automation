import { deepFreeze, statusText } from './safety-v1.mjs';

export function lifecycleState(status) {
  const canonical = statusText(status);
  const labels = {
    idle: 'Idle',
    pending: 'Pending',
    requested: 'Requested',
    validating: 'Validating',
    admitted: 'Admitted',
    accepted: 'Accepted — awaiting executor',
    'awaiting-executor': 'Awaiting executor',
    provisioning: 'Provisioning',
    running: 'In progress',
    'running-model-only': 'Model analysis in progress',
    'fixture-running': 'Trusted fixture running',
    'collecting-evidence': 'Collecting evidence',
    publishing: 'Publishing',
    completed: 'Completed',
    published: 'Published',
    failed: 'Failed',
    cancelled: 'Cancelled',
    timeout: 'Timed out',
    'timed-out': 'Timed out',
    'policy-rejected': 'Policy rejected',
    'resource-limit': 'Resource limit reached',
    'execution-plane-unavailable': 'Execution plane unavailable',
    creating: 'Creation pending',
    ready: 'Ready',
    checkpointing: 'Checkpoint pending',
    restoring: 'Restore pending',
    restored: 'Restored',
    deleting: 'Deletion pending',
    deleted: 'Deleted',
    tombstoning: 'Tombstone pending',
    tombstoned: 'Tombstoned',
    exporting: 'Export pending',
    exported: 'Exported',
    stale: 'Stale state',
    'offline-stale': 'Offline — cached data',
    unauthorized: 'Access unavailable',
    unavailable: 'Unavailable',
    'not-found': 'Not found',
    offline: 'Offline'
  };
  const terminal = new Set([
    'completed', 'published', 'failed', 'cancelled', 'timeout', 'timed-out',
    'policy-rejected', 'resource-limit', 'execution-plane-unavailable',
    'deleted', 'tombstoned', 'exported', 'unavailable', 'not-found'
  ]);
  return deepFreeze({ code: canonical, label: labels[canonical] ?? 'Unknown', terminal: terminal.has(canonical) });
}
