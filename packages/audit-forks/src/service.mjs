import {
  FREE_DEVELOPMENT_FORK_CAPABILITY,
  FORK_TRANSITIONS,
  assertTransitionId,
  canonicalJson,
  digestForkRequest,
  forkActionKey,
  forkCurrentKey,
  forkEventKey,
  forkRequestKey,
  tenantForkIndexKey,
  validateForkActionResult,
  validateForkEvent,
  validateForkRequest,
  validateForkState
} from '../../audit-fork-protocol/src/index.mjs';
import {
  deleteForkOperation,
  exportCheckpointOperation,
  publishCheckpointOperation,
  readCheckpointOperation,
  restoreCheckpointOperation
} from './checkpoint-operations.mjs';
import { ForkStateError, ForkStorage, eventId, parseRecord, sameJson } from './storage.mjs';

const ALLOWED_TRANSITIONS = Object.freeze(Object.fromEntries(
  Object.entries(FORK_TRANSITIONS).map(([state, targets]) => [state, new Set(targets)])
));

export class ForkService {
  storage;

  constructor(store) {
    this.storage = new ForkStorage(store);
  }

  operationTrace() { return this.storage.operationTrace(); }
  clearOperationTrace() { this.storage.clearOperationTrace(); }

  async readRequest(forkId) {
    const record = await this.storage.get(forkRequestKey(forkId));
    if (!record) throw new ForkStateError('fork_request_not_found', 'Fork request does not exist');
    return parseRecord(record);
  }

  async #upsertTenantForkState(state) {
    const request = await this.readRequest(state.forkId);
    if (request.tenantId !== state.tenantId || request.attemptId !== state.attemptId || request.requestDigest !== state.requestDigest) {
      throw new ForkStateError('fork_identity_mismatch', 'Fork state does not match its immutable request identity');
    }
    const key = tenantForkIndexKey(request.tenantId);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const record = await this.storage.get(key);
      const index = record ? parseRecord(record) : { schemaVersion: 'tenant-fork-index-v1', tenantId: request.tenantId, entries: [], updatedAt: state.updatedAt };
      if (index.tenantId !== request.tenantId) throw new ForkStateError('fork_identity_mismatch', 'Tenant index identity does not match the immutable request');
      const entry = { forkId: state.forkId, workspaceId: request.workspaceId, campaignId: request.campaignId, state: state.state, requestDigest: state.requestDigest, createdAt: state.createdAt, updatedAt: state.updatedAt };
      const position = index.entries.findIndex((item) => item.forkId === state.forkId);
      if (position >= 0 && sameJson(index.entries[position], entry)) return index;
      if (position >= 0) index.entries[position] = entry; else index.entries.push(entry);
      index.entries.sort((a, b) => a.forkId.localeCompare(b.forkId)); index.updatedAt = state.updatedAt;
      try {
        await this.storage.put(key, canonicalJson(index), record ? { onlyIf: { etagMatches: record.etag } } : { onlyIf: { etagDoesNotMatch: '*' } });
        return index;
      } catch (cause) { if (cause?.code !== 'precondition_failed') throw cause; }
    }
    throw new ForkStateError('index_conflict', `Unable to update tenant index for ${state.forkId}`);
  }

  async createFork(input) {
    const request = validateForkRequest(input);
    const requestDigest = await digestForkRequest(request);
    await this.storage.putImmutable(forkRequestKey(request.forkId), { ...request, requestDigest });
    const requestedState = validateForkState({
      schemaVersion: 'fork-state-v1', forkId: request.forkId, tenantId: request.tenantId, attemptId: request.attemptId,
      requestDigest, state: 'requested', version: 1, executionGate: request.executionGate, adapterKind: request.adapterKind,
      chainId: request.chainId, blockNumber: request.blockNumber, blockHash: request.blockHash ?? null,
      createdAt: request.createdAt, updatedAt: request.createdAt,
      lastTransitionId: `create:${request.idempotencyKey}:requested`, lastFromState: 'none'
    });
    try { await this.storage.put(forkCurrentKey(request.forkId), canonicalJson(requestedState), { onlyIf: { etagDoesNotMatch: '*' } }); }
    catch (cause) { if (cause?.code !== 'precondition_failed') throw cause; }
    let current = await this.readFork(request.forkId);
    if (current.requestDigest !== requestDigest) throw new ForkStateError('fork_conflict', 'Fork ID already belongs to another request');
    if (current.version === 1) await this.ensureTransitionEvent(current);
    const targetState = request.adapterKind === 'mock' ? 'ready' : 'awaiting_executor';
    const transitionId = `tr_admit_${requestDigest.slice(0, 24)}`;
    if (current.state === 'requested') {
      current = await this.transitionFork({ forkId: request.forkId, tenantId: request.tenantId, attemptId: request.attemptId, from: 'requested', to: targetState, expectedEtag: current.etag, transitionId, occurredAt: request.createdAt });
    } else if (current.state === targetState && current.lastTransitionId === transitionId) {
      await this.ensureTransitionEvent(current); await this.#upsertTenantForkState(current);
    } else if (current.state !== targetState) throw new ForkStateError('fork_conflict', 'Existing fork state does not match the immutable create request');
    return current;
  }

  async readFork(forkId) {
    const record = await this.storage.get(forkCurrentKey(forkId));
    if (!record) throw new ForkStateError('fork_not_found', 'Fork does not exist');
    return Object.freeze({ ...validateForkState(parseRecord(record)), etag: record.etag });
  }

  async ensureTransitionEvent(state) {
    const event = validateForkEvent({ schemaVersion: 'fork-event-v1', eventId: eventId(state.version, state.lastTransitionId), forkId: state.forkId, tenantId: state.tenantId, attemptId: state.attemptId, requestDigest: state.requestDigest, from: state.lastFromState, to: state.state, version: state.version, transitionId: state.lastTransitionId, occurredAt: state.updatedAt });
    await this.storage.putImmutable(forkEventKey(state.forkId, state.version), event);
  }

  async transitionFork(input) {
    const keys = new Set(['forkId','tenantId','attemptId','from','to','expectedEtag','transitionId','occurredAt','blockNumber','blockHash']);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ForkStateError('invalid_transition', 'Transition must be an object');
    for (const key of Object.keys(input)) if (!keys.has(key)) throw new ForkStateError('unknown_field', `Unknown transition field ${key}`);
    assertTransitionId(input.transitionId);
    const current = await this.readFork(input.forkId);
    if (current.tenantId !== input.tenantId) throw new ForkStateError('unauthorized_tenant', 'Tenant does not own this fork');
    if (current.attemptId !== input.attemptId) throw new ForkStateError('attempt_mismatch', 'Attempt does not own this fork');
    if (current.lastTransitionId === input.transitionId) { await this.ensureTransitionEvent(current); await this.#upsertTenantForkState(current); return current; }
    if (current.etag !== input.expectedEtag || current.state !== input.from) throw new ForkStateError('stale_state', 'Current state changed');
    if (!ALLOWED_TRANSITIONS[current.state]?.has(input.to)) throw new ForkStateError('invalid_transition', `${current.state} cannot transition to ${input.to}`);
    const nextInput = { ...current, state: input.to, version: current.version + 1, updatedAt: input.occurredAt, lastTransitionId: input.transitionId, lastFromState: current.state, blockNumber: input.blockNumber ?? current.blockNumber, blockHash: input.blockHash ?? current.blockHash, ...(input.to === 'deleted' ? { deletedAt: input.occurredAt, tombstone: true } : {}) };
    delete nextInput.etag;
    const next = validateForkState(nextInput);
    let written;
    try { written = await this.storage.put(forkCurrentKey(input.forkId), canonicalJson(next), { onlyIf: { etagMatches: current.etag } }); }
    catch (cause) { if (cause?.code === 'precondition_failed') throw new ForkStateError('stale_state', 'Current state ETag changed'); throw cause; }
    await this.ensureTransitionEvent(next);
    const result = Object.freeze({ ...next, etag: written.etag }); await this.#upsertTenantForkState(result); return result;
  }

  async publishActionResult(input) {
    const result = validateForkActionResult(input);
    const current = await this.readFork(result.forkId);
    if (current.state !== 'ready') throw new ForkStateError('fork_not_ready', 'Fork is not ready for inert action results');
    await this.storage.putImmutable(forkActionKey(result.forkId, result.actionId), result);
    return result;
  }

  publishCheckpoint(input) { return publishCheckpointOperation(this, input); }
  readCheckpoint(forkId, checkpointId) { return readCheckpointOperation(this, forkId, checkpointId); }
  exportCheckpoint(input) { return exportCheckpointOperation(this, input); }
  restoreCheckpoint(input) { return restoreCheckpointOperation(this, input); }
  deleteFork(input) { return deleteForkOperation(this, input); }
  capability() { return FREE_DEVELOPMENT_FORK_CAPABILITY; }
}
