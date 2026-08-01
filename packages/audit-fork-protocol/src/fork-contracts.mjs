import { FORK_ACTION_TYPES, FORK_LIMITS, FORK_STATES } from './constants.mjs';
import {
  ACTION_ID, ENCODER, TRANSITION_ID, assertAddress, assertAttemptId,
  assertAuditId, assertBlockHash, assertBytes32, assertCheckpointId,
  assertEnum, assertForkId, assertInteger, assertIso, assertLimit,
  assertPlainObject, assertProfileId, assertRequester, assertScopes,
  assertSha, assertString, canonicalJson, clone, fail, sha256Hex, strictObject
} from './internals.mjs';

export async function digestForkRequest(value) { return sha256Hex(canonicalJson(validateForkRequest(value))); }

export function validateForkRequest(value) {
  const keys = new Set(['schemaVersion','tenantId','workspaceId','campaignId','forkId','attemptId','profileId','policyVersion','requesterId','scopes','chainId','blockNumber','blockHash','adapterKind','executionGate','createdAt','idempotencyKey']);
  strictObject(value, keys, new Set([...keys].filter((key) => key !== 'blockHash')));
  if (value.schemaVersion !== 'fork-request-v1') fail('invalid_schema_version', '$.schemaVersion must be fork-request-v1', '$.schemaVersion');
  assertAuditId(value.tenantId, 'tenant', '$.tenantId');
  assertAuditId(value.workspaceId, 'workspace', '$.workspaceId');
  assertAuditId(value.campaignId, 'campaign', '$.campaignId');
  assertForkId(value.forkId);
  assertAttemptId(value.attemptId);
  assertProfileId(value.profileId);
  assertString(value.policyVersion, '$.policyVersion', 80, /^[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]*$/);
  assertRequester(value.requesterId, '$.requesterId');
  assertScopes(value.scopes, '$.scopes');
  if (!value.scopes.includes('audit:submit')) fail('insufficient_scope', '$.scopes must include audit:submit', '$.scopes');
  assertInteger(value.chainId, '$.chainId', 1, 4_294_967_295);
  assertInteger(value.blockNumber, '$.blockNumber', 0);
  if ('blockHash' in value) assertBlockHash(value.blockHash, '$.blockHash');
  assertEnum(value.adapterKind, ['external','mock'], '$.adapterKind');
  assertEnum(value.executionGate, ['awaiting_executor','trusted_mock'], '$.executionGate');
  if (value.adapterKind === 'external' && value.executionGate !== 'awaiting_executor') fail('invalid_execution_gate', 'External adapters must remain awaiting_executor', '$.executionGate');
  if (value.adapterKind === 'mock' && value.executionGate !== 'trusted_mock') fail('invalid_execution_gate', 'Mock adapters require trusted_mock', '$.executionGate');
  assertIso(value.createdAt, '$.createdAt');
  assertString(value.idempotencyKey, '$.idempotencyKey', 160, /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/);
  return clone(value);
}

export function validateForkState(value) {
  const allowed = new Set(['schemaVersion','forkId','tenantId','attemptId','requestDigest','state','version','executionGate','adapterKind','chainId','blockNumber','blockHash','createdAt','updatedAt','lastTransitionId','lastFromState','deletedAt','tombstone']);
  const required = new Set(['schemaVersion','forkId','tenantId','attemptId','requestDigest','state','version','executionGate','adapterKind','chainId','blockNumber','blockHash','createdAt','updatedAt','lastTransitionId','lastFromState']);
  strictObject(value, allowed, required);
  if (value.schemaVersion !== 'fork-state-v1') fail('invalid_schema_version', '$.schemaVersion must be fork-state-v1', '$.schemaVersion');
  assertForkId(value.forkId);
  assertAuditId(value.tenantId, 'tenant', '$.tenantId');
  assertAttemptId(value.attemptId);
  assertSha(value.requestDigest, '$.requestDigest');
  assertEnum(value.state, FORK_STATES, '$.state');
  assertInteger(value.version, '$.version', 1);
  assertEnum(value.executionGate, ['awaiting_executor','trusted_mock'], '$.executionGate');
  assertEnum(value.adapterKind, ['external','mock'], '$.adapterKind');
  assertInteger(value.chainId, '$.chainId', 1, 4_294_967_295);
  assertInteger(value.blockNumber, '$.blockNumber', 0);
  if (value.blockHash !== null) assertBlockHash(value.blockHash, '$.blockHash');
  assertIso(value.createdAt, '$.createdAt');
  assertIso(value.updatedAt, '$.updatedAt');
  assertString(value.lastTransitionId, '$.lastTransitionId', 180, TRANSITION_ID);
  assertEnum(value.lastFromState, ['none', ...FORK_STATES], '$.lastFromState');
  if ('deletedAt' in value) assertIso(value.deletedAt, '$.deletedAt');
  if ('tombstone' in value && value.tombstone !== true) fail('invalid_tombstone', '$.tombstone must be true', '$.tombstone');
  if (value.state === 'deleted' && (!value.deletedAt || value.tombstone !== true)) fail('invalid_tombstone', 'Deleted state requires tombstone metadata', '$');
  return clone(value);
}

export function validateForkEvent(value) {
  const keys = new Set(['schemaVersion','eventId','forkId','tenantId','attemptId','requestDigest','from','to','version','transitionId','occurredAt']);
  strictObject(value, keys);
  if (value.schemaVersion !== 'fork-event-v1') fail('invalid_schema_version', '$.schemaVersion must be fork-event-v1', '$.schemaVersion');
  assertString(value.eventId, '$.eventId', 200, /^evt_[A-Za-z0-9._-]+$/);
  assertForkId(value.forkId);
  assertAuditId(value.tenantId, 'tenant', '$.tenantId');
  assertAttemptId(value.attemptId);
  assertSha(value.requestDigest, '$.requestDigest');
  assertEnum(value.from, ['none', ...FORK_STATES], '$.from');
  assertEnum(value.to, FORK_STATES, '$.to');
  assertInteger(value.version, '$.version', 1);
  assertString(value.transitionId, '$.transitionId', 180, TRANSITION_ID);
  assertIso(value.occurredAt, '$.occurredAt');
  return clone(value);
}

function validateActionPayload(type, payload) {
  if (type === 'read_call') {
    strictObject(payload, new Set(['target','inputHex','maxReturnBytes']), undefined, '$.payload');
    assertAddress(payload.target, '$.payload.target');
    assertString(payload.inputHex, '$.payload.inputHex', 16_386, /^0x(?:[0-9a-f]{2})*$/);
    assertLimit(payload.maxReturnBytes, '$.payload.maxReturnBytes', 1, FORK_LIMITS.maxReturnBytes);
    return;
  }
  if (type === 'inspect_state') {
    strictObject(payload, new Set(['address','slots']), undefined, '$.payload');
    assertAddress(payload.address, '$.payload.address');
    if (!Array.isArray(payload.slots) || payload.slots.length < 1 || payload.slots.length > 64) fail('invalid_limit', '$.payload.slots is out of bounds', '$.payload.slots');
    payload.slots.forEach((slot, index) => assertBytes32(slot, `$.payload.slots[${index}]`));
    return;
  }
  if (type === 'advance_time') {
    strictObject(payload, new Set(['seconds']), undefined, '$.payload');
    assertLimit(payload.seconds, '$.payload.seconds', 1, FORK_LIMITS.maxAdvanceSeconds);
    return;
  }
  if (type === 'advance_blocks') {
    strictObject(payload, new Set(['blocks']), undefined, '$.payload');
    assertLimit(payload.blocks, '$.payload.blocks', 1, FORK_LIMITS.maxAdvanceBlocks);
    return;
  }
  if (type === 'snapshot') {
    strictObject(payload, new Set(['label']), undefined, '$.payload');
    assertString(payload.label, '$.payload.label', 80, /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/);
    return;
  }
  if (type === 'restore') {
    strictObject(payload, new Set(['checkpointId']), undefined, '$.payload');
    assertCheckpointId(payload.checkpointId, '$.payload.checkpointId');
    return;
  }
  if (type === 'state_override') {
    strictObject(payload, new Set(['address','slots']), undefined, '$.payload');
    assertAddress(payload.address, '$.payload.address');
    if (!Array.isArray(payload.slots) || payload.slots.length < 1 || payload.slots.length > FORK_LIMITS.maxStateOverrideSlots) fail('invalid_limit', '$.payload.slots is out of bounds', '$.payload.slots');
    payload.slots.forEach((entry, index) => {
      strictObject(entry, new Set(['slot','value']), undefined, `$.payload.slots[${index}]`);
      assertBytes32(entry.slot, `$.payload.slots[${index}].slot`);
      assertBytes32(entry.value, `$.payload.slots[${index}].value`);
    });
  }
}

export function validateForkActionRequest(value) {
  const keys = new Set(['schemaVersion','forkId','attemptId','actionId','requestedAt','type','payload']);
  strictObject(value, keys);
  if (value.schemaVersion !== 'fork-action-request-v1') fail('invalid_schema_version', '$.schemaVersion must be fork-action-request-v1', '$.schemaVersion');
  assertForkId(value.forkId);
  assertAttemptId(value.attemptId);
  assertString(value.actionId, '$.actionId', 84, ACTION_ID);
  assertIso(value.requestedAt, '$.requestedAt');
  assertEnum(value.type, FORK_ACTION_TYPES, '$.type');
  validateActionPayload(value.type, value.payload);
  if (ENCODER.encode(canonicalJson(value)).byteLength > FORK_LIMITS.maxActionBytes) fail('value_too_large', 'Action request is too large', '$');
  return clone(value);
}

export function validateForkActionResult(value) {
  const keys = new Set(['schemaVersion','forkId','actionId','status','blockNumber','timestamp','deterministicDigest','result']);
  strictObject(value, keys);
  if (value.schemaVersion !== 'fork-action-result-v1') fail('invalid_schema_version', '$.schemaVersion must be fork-action-result-v1', '$.schemaVersion');
  assertForkId(value.forkId);
  assertString(value.actionId, '$.actionId', 84, ACTION_ID);
  assertEnum(value.status, ['succeeded','failed','cancelled'], '$.status');
  assertInteger(value.blockNumber, '$.blockNumber', 0);
  assertInteger(value.timestamp, '$.timestamp', 0);
  assertSha(value.deterministicDigest, '$.deterministicDigest');
  assertPlainObject(value.result, '$.result');
  return clone(value);
}
