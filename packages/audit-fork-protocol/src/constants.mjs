export const FORK_STATES = Object.freeze([
  'requested', 'awaiting_executor', 'ready', 'checkpointing', 'restoring',
  'exporting', 'deleting', 'deleted', 'failed', 'cancelled'
]);
export const FORK_TRANSITIONS = Object.freeze({
  requested: Object.freeze(['awaiting_executor','ready','deleting','failed','cancelled']),
  awaiting_executor: Object.freeze(['deleting','failed','cancelled']),
  ready: Object.freeze(['checkpointing','restoring','exporting','deleting','failed','cancelled']),
  checkpointing: Object.freeze(['ready','deleting','failed','cancelled']),
  restoring: Object.freeze(['ready','deleting','failed','cancelled']),
  exporting: Object.freeze(['ready','deleting','failed','cancelled']),
  deleting: Object.freeze(['deleted','failed']),
  deleted: Object.freeze([]),
  failed: Object.freeze([]),
  cancelled: Object.freeze([])
});
export const FORK_ACTION_TYPES = Object.freeze([
  'read_call', 'inspect_state', 'advance_time', 'advance_blocks',
  'snapshot', 'restore', 'state_override'
]);
export const FORK_LIMITS = Object.freeze({
  checkpointTargetBytes: 250_000_000,
  checkpointMaxBytes: 1_000_000_000,
  maxCheckpoints: 8,
  activeRetentionSeconds: 86_400,
  exportedRetentionSeconds: 604_800,
  maxActionBytes: 64_000,
  maxStateOverrideSlots: 64,
  maxAdvanceSeconds: 86_400,
  maxAdvanceBlocks: 10_000,
  maxReturnBytes: 1_000_000
});
export const FREE_DEVELOPMENT_FORK_CAPABILITY = Object.freeze({
  schemaVersion: 'fork-capability-v1',
  profileId: 'free-development-v1',
  checkpointTargetBytes: FORK_LIMITS.checkpointTargetBytes,
  checkpointMaxBytes: FORK_LIMITS.checkpointMaxBytes,
  maxCheckpoints: FORK_LIMITS.maxCheckpoints,
  activeRetentionSeconds: FORK_LIMITS.activeRetentionSeconds,
  exportedRetentionSeconds: FORK_LIMITS.exportedRetentionSeconds,
  executionEnabled: false,
  realCreateState: 'awaiting_executor'
});
