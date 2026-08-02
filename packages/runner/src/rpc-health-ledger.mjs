export const RPC_HEALTH_EVENT_VERSION = 'rpc-health-event/v1';

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

function slotState(state, id, pool = 'unknown') {
  if (!state.slots[id]) state.slots[id] = initialSlot(id, pool);
  if (state.slots[id].pool === 'unknown' && pool !== 'unknown') state.slots[id].pool = pool;
  return state.slots[id];
}

function validateEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('RPC health event must be an object');
  if (event.version !== RPC_HEALTH_EVENT_VERSION) throw new Error(`Unsupported RPC health event version: ${event.version}`);
  if (!['session', 'recover', 'disable'].includes(event.type)) throw new Error(`Unsupported RPC health event type: ${event.type}`);
  if (typeof event.chain !== 'string' || event.chain.length === 0) throw new Error('RPC health event chain is required');
  if (typeof event.at !== 'string' || Number.isNaN(Date.parse(event.at))) throw new Error('RPC health event timestamp is invalid');
  return event;
}

export function reduceRpcHealth(events = [], { crossSessionFailureThreshold = 4 } = {}) {
  if (!Number.isSafeInteger(crossSessionFailureThreshold) || crossSessionFailureThreshold < 1) {
    throw new Error('crossSessionFailureThreshold must be a positive safe integer');
  }
  const state = {
    version: 'rpc-health-state/v1',
    crossSessionFailureThreshold,
    chain: null,
    slots: {},
    processedEvents: 0
  };

  for (const raw of events) {
    const event = validateEvent(raw);
    if (state.chain === null) state.chain = event.chain;
    if (state.chain !== event.chain) throw new Error('RPC health events must belong to one chain');
    state.processedEvents += 1;

    if (event.type === 'session') {
      if (!Array.isArray(event.slots)) throw new Error('Session health event requires slots');
      for (const entry of event.slots) {
        if (!entry || typeof entry.id !== 'string') throw new Error('Session health slot ID is required');
        const slot = slotState(state, entry.id, entry.pool);
        slot.lastEventAt = event.at;
        slot.lastRunId = event.runId ?? null;
        slot.totalRequests += Number.isSafeInteger(entry.requests) ? entry.requests : 0;
        if (!entry.selected) continue;
        if (entry.sessionFailed) {
          slot.consecutiveFailedSessions += 1;
          slot.totalFailedSessions += 1;
          slot.lastFailureClass = entry.failureClass ?? null;
          if (slot.consecutiveFailedSessions >= crossSessionFailureThreshold) {
            slot.disabled = true;
            slot.disabledAt ??= event.at;
          }
        } else if ((entry.successes ?? 0) > 0) {
          slot.consecutiveFailedSessions = 0;
          slot.totalSuccessfulSessions += 1;
          slot.lastFailureClass = null;
          if (!slot.disabled) slot.disabledAt = null;
        }
      }
      continue;
    }

    const slot = slotState(state, event.slotId, event.pool);
    slot.lastEventAt = event.at;
    if (event.type === 'recover') {
      slot.disabled = false;
      slot.disabledAt = null;
      slot.consecutiveFailedSessions = 0;
      slot.lastFailureClass = null;
      slot.lastRecoveryActor = event.actor ?? 'unknown';
      continue;
    }
    slot.disabled = true;
    slot.disabledAt = event.at;
    slot.lastFailureClass = event.reason ?? 'manual_disable';
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
  if (typeof chain !== 'string' || chain.length === 0) throw new Error('chain is required');
  if (!diagnostics || !Array.isArray(diagnostics.slots)) throw new Error('router slot diagnostics are required');
  return {
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
  };
}

export function recoveryEvent({ chain, slotId, actor, at = new Date().toISOString() }) {
  return {
    version: RPC_HEALTH_EVENT_VERSION,
    type: 'recover',
    chain,
    slotId,
    actor,
    at
  };
}

export function manualDisableEvent({ chain, slotId, actor, reason = 'manual_disable', at = new Date().toISOString() }) {
  return {
    version: RPC_HEALTH_EVENT_VERSION,
    type: 'disable',
    chain,
    slotId,
    actor,
    reason,
    at
  };
}
