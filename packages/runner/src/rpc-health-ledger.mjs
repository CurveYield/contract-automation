export const RPC_HEALTH_EVENT_VERSION = 'rpc-health-event/v1';

const CHAIN = /^[a-z0-9][a-z0-9-]{0,31}$/u;
const RUN_ID = /^[1-9][0-9]{0,19}$/u;
const SLOT_ID = /^(?:primary-0[1-7]|secondary-0[1-3]|legacy-01)$/u;
const METHOD = /^[A-Za-z][A-Za-z0-9_]{0,127}$/u;
const FAILURE_CLASSES = new Set([
  'quota_or_rate_limit',
  'transient_http',
  'method_unsupported',
  'network_or_timeout',
  'rpc_error',
  'invalid_response',
  'unknown',
  'no_eligible_slot'
]);
const MAX_COUNT = 1_000_000_000;

function fail(message) {
  throw new Error(`Invalid RPC health event: ${message}`);
}

function exactRecord(value, expectedKeys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  let prototype;
  let descriptors;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
    keys = Reflect.ownKeys(descriptors);
  } catch {
    fail(`${label} reflection failed`);
  }
  if (prototype !== Object.prototype && prototype !== null) fail(`${label} prototype is invalid`);
  if (keys.some((key) => typeof key === 'symbol')) fail(`${label} symbol fields are not allowed`);
  const actual = keys.map(String).sort();
  const expected = [...expectedKeys].sort();
  if (actual.join('\0') !== expected.join('\0')) fail(`${label} fields are invalid`);
  const output = {};
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) {
      fail(`${label}.${key} must be an enumerable data field`);
    }
    output[key] = descriptor.value;
  }
  return output;
}

function safeText(value, label, maximum = 128) {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > maximum ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) fail(`${label} is invalid`);
  return value;
}

function timestamp(value) {
  if (typeof value !== 'string') fail('timestamp is invalid');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) fail('timestamp is invalid');
  return value;
}

function count(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_COUNT) fail(`${label} count is invalid`);
  return value;
}

function slotPool(id) {
  if (!SLOT_ID.test(id)) fail('slot ID is invalid');
  return id.startsWith('primary-') ? 'primary' : 'secondary';
}

function canonicalMethods(value) {
  if (!Array.isArray(value) || value.length > 128) fail('unsupportedMethods is invalid');
  const output = [];
  const seen = new Set();
  for (const method of value) {
    if (typeof method !== 'string' || !METHOD.test(method) || seen.has(method)) {
      fail('unsupportedMethods is invalid');
    }
    seen.add(method);
    output.push(method);
  }
  return output.sort();
}

function canonicalSlot(raw) {
  const slot = exactRecord(raw, [
    'id', 'pool', 'selected', 'sessionFailed', 'requests', 'successes', 'failures',
    'quarantined', 'failureClass', 'unsupportedMethods'
  ], 'slot');
  const expectedPool = slotPool(slot.id);
  if (slot.pool !== expectedPool) fail('slot pool is invalid');
  if (typeof slot.selected !== 'boolean' || typeof slot.sessionFailed !== 'boolean' || typeof slot.quarantined !== 'boolean') {
    fail('slot booleans are invalid');
  }
  const requests = count(slot.requests, 'requests');
  const successes = count(slot.successes, 'successes');
  const failures = count(slot.failures, 'failures');
  if (successes + failures > requests) fail('slot counts exceed requests');
  if (!slot.selected && (requests !== 0 || successes !== 0 || failures !== 0 || slot.sessionFailed || slot.quarantined)) {
    fail('unselected slot contains activity');
  }
  if (slot.selected && requests === 0) fail('selected slot has no requests');
  if (slot.quarantined && !slot.sessionFailed) fail('quarantined slot must be failed');
  if (slot.sessionFailed && failures === 0 && !slot.quarantined) fail('failed slot has no failure evidence');
  if (slot.failureClass !== null && !FAILURE_CLASSES.has(slot.failureClass)) fail('failure class is invalid');
  if (failures === 0 && slot.failureClass !== null) fail('failure class without failures is invalid');
  return {
    id: slot.id,
    pool: slot.pool,
    selected: slot.selected,
    sessionFailed: slot.sessionFailed,
    requests,
    successes,
    failures,
    quarantined: slot.quarantined,
    failureClass: slot.failureClass,
    unsupportedMethods: canonicalMethods(slot.unsupportedMethods)
  };
}

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export function validateRpcHealthEvent(raw) {
  const base = exactRecord(raw, Object.keys(raw ?? {}), 'event');
  if (base.version !== RPC_HEALTH_EVENT_VERSION) fail('version is unsupported');
  if (!['session', 'recover', 'disable'].includes(base.type)) fail('type is unsupported');
  if (typeof base.chain !== 'string' || !CHAIN.test(base.chain)) fail('chain is invalid');
  const at = timestamp(base.at);

  if (base.type === 'session') {
    const event = exactRecord(raw, ['version', 'type', 'chain', 'runId', 'at', 'slots'], 'session event');
    if (typeof event.runId !== 'string' || !RUN_ID.test(event.runId)) fail('run ID is invalid');
    if (!Array.isArray(event.slots) || event.slots.length < 1 || event.slots.length > 11) fail('session slots are invalid');
    const seen = new Set();
    const slots = event.slots.map((slot) => {
      const canonical = canonicalSlot(slot);
      if (seen.has(canonical.id)) fail('duplicate slot ID');
      seen.add(canonical.id);
      return canonical;
    });
    return freeze({
      version: RPC_HEALTH_EVENT_VERSION,
      type: 'session',
      chain: event.chain,
      runId: event.runId,
      at,
      slots
    });
  }

  if (base.type === 'recover') {
    const event = exactRecord(raw, ['version', 'type', 'chain', 'slotId', 'actor', 'at'], 'recovery event');
    slotPool(event.slotId);
    return freeze({
      version: RPC_HEALTH_EVENT_VERSION,
      type: 'recover',
      chain: event.chain,
      slotId: event.slotId,
      actor: safeText(event.actor, 'actor'),
      at
    });
  }

  const event = exactRecord(raw, ['version', 'type', 'chain', 'slotId', 'actor', 'reason', 'at'], 'disable event');
  slotPool(event.slotId);
  return freeze({
    version: RPC_HEALTH_EVENT_VERSION,
    type: 'disable',
    chain: event.chain,
    slotId: event.slotId,
    actor: safeText(event.actor, 'actor'),
    reason: safeText(event.reason, 'reason'),
    at
  });
}

function initialSlot(id, pool) {
  return {
    id,
    pool,
    disabled: false,
    consecutiveFailedSessions: 0,
    totalFailedSessions: 0,
    totalSuccessfulSessions: 0,
    totalRequests: 0,
    lastRunId: null,
    lastFailureClass: null,
    lastEventAt: null,
    lastRecoveryActor: null,
    disabledAt: null
  };
}

function slotState(state, id) {
  const pool = slotPool(id);
  if (!Object.hasOwn(state.slots, id)) state.slots[id] = initialSlot(id, pool);
  return state.slots[id];
}

export function reduceRpcHealth(events = [], { crossSessionFailureThreshold = 4 } = {}) {
  if (!Number.isSafeInteger(crossSessionFailureThreshold) || crossSessionFailureThreshold < 1) {
    throw new Error('crossSessionFailureThreshold must be a positive safe integer');
  }
  const state = {
    version: 'rpc-health-state/v1',
    crossSessionFailureThreshold,
    chain: null,
    slots: Object.create(null),
    processedEvents: 0
  };

  for (const raw of events) {
    const event = validateRpcHealthEvent(raw);
    if (state.chain === null) state.chain = event.chain;
    if (state.chain !== event.chain) throw new Error('RPC health events must belong to one chain');
    state.processedEvents += 1;

    if (event.type === 'session') {
      for (const entry of event.slots) {
        const slot = slotState(state, entry.id);
        slot.lastEventAt = event.at;
        slot.lastRunId = event.runId;
        slot.totalRequests += entry.requests;
        if (!entry.selected) continue;
        if (entry.sessionFailed) {
          slot.consecutiveFailedSessions += 1;
          slot.totalFailedSessions += 1;
          slot.lastFailureClass = entry.failureClass;
          if (slot.consecutiveFailedSessions >= crossSessionFailureThreshold) {
            slot.disabled = true;
            slot.disabledAt ??= event.at;
          }
        } else if (entry.successes > 0) {
          slot.consecutiveFailedSessions = 0;
          slot.totalSuccessfulSessions += 1;
          slot.lastFailureClass = null;
          if (!slot.disabled) slot.disabledAt = null;
        }
      }
      continue;
    }

    const slot = slotState(state, event.slotId);
    slot.lastEventAt = event.at;
    if (event.type === 'recover') {
      slot.disabled = false;
      slot.disabledAt = null;
      slot.consecutiveFailedSessions = 0;
      slot.lastFailureClass = null;
      slot.lastRecoveryActor = event.actor;
      continue;
    }
    slot.disabled = true;
    slot.disabledAt = event.at;
    slot.lastFailureClass = event.reason;
  }
  return state;
}

export function disabledSlotIds(state) {
  if (!state?.slots || typeof state.slots !== 'object') return [];
  return Object.values(state.slots)
    .filter((slot) => slot.disabled)
    .map((slot) => slot.id)
    .sort();
}

export function sessionEventFromDiagnostics({ chain, runId, at = new Date().toISOString(), diagnostics }) {
  if (!diagnostics || !Array.isArray(diagnostics.slots)) throw new Error('router slot diagnostics are required');
  return validateRpcHealthEvent({
    version: RPC_HEALTH_EVENT_VERSION,
    type: 'session',
    chain,
    runId,
    at,
    slots: diagnostics.slots.map((slot) => ({
      id: slot.id,
      pool: slot.pool,
      selected: (slot.requests ?? 0) > 0,
      sessionFailed: Boolean(slot.quarantined) || ((slot.failures ?? 0) > 0 && (slot.successes ?? 0) === 0),
      requests: slot.requests ?? 0,
      successes: slot.successes ?? 0,
      failures: slot.failures ?? 0,
      quarantined: Boolean(slot.quarantined),
      failureClass: slot.lastFailureClass ?? null,
      unsupportedMethods: Array.isArray(slot.unsupportedMethods) ? [...slot.unsupportedMethods] : []
    }))
  });
}

export function recoveryEvent({ chain, slotId, actor, at = new Date().toISOString() }) {
  return validateRpcHealthEvent({
    version: RPC_HEALTH_EVENT_VERSION,
    type: 'recover',
    chain,
    slotId,
    actor,
    at
  });
}

export function manualDisableEvent({ chain, slotId, actor, reason = 'manual_disable', at = new Date().toISOString() }) {
  return validateRpcHealthEvent({
    version: RPC_HEALTH_EVENT_VERSION,
    type: 'disable',
    chain,
    slotId,
    actor,
    reason,
    at
  });
}
