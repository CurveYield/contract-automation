import { canonicalJson } from '../../audit-fork-protocol/src/index.mjs';
import { ForkService as InternalForkService } from './service.mjs';
import { ForkStateError } from './storage.mjs';

function safeInput(input, allowed, required = allowed) {
  const value = JSON.parse(canonicalJson(input));
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ForkStateError('invalid_read_request', 'Read request must be an object');
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new ForkStateError('invalid_read_request', `Unknown read field ${key}`);
  }
  for (const key of required) {
    if (typeof value[key] !== 'string' || value[key].length < 1) {
      throw new ForkStateError('invalid_read_request', `Read field ${key} is required`);
    }
  }
  return value;
}

export class ForkService {
  #internal;

  constructor(store) {
    this.#internal = new InternalForkService(store);
  }

  operationTrace() { return this.#internal.operationTrace(); }
  clearOperationTrace() { return this.#internal.clearOperationTrace(); }
  createFork(input) { return this.#internal.createFork(input); }
  transitionFork(input) { return this.#internal.transitionFork(input); }
  publishActionResult(input) { return this.#internal.publishActionResult(input); }
  publishCheckpoint(input) { return this.#internal.publishCheckpoint(input); }
  exportCheckpoint(input) { return this.#internal.exportCheckpoint(input); }
  restoreCheckpoint(input) { return this.#internal.restoreCheckpoint(input); }
  deleteFork(input) { return this.#internal.deleteFork(input); }
  capability() { return this.#internal.capability(); }

  async readFork(input) {
    const value = safeInput(input, ['forkId', 'tenantId', 'attemptId'], ['forkId', 'tenantId']);
    const current = await this.#internal.readFork(value.forkId);
    if (
      current.tenantId !== value.tenantId ||
      (value.attemptId !== undefined && current.attemptId !== value.attemptId)
    ) {
      throw new ForkStateError('fork_not_found', 'Fork does not exist');
    }
    return current;
  }

  readForkForTenant(input) { return this.readFork(input); }

  async readCheckpoint(input) {
    const value = safeInput(
      input,
      ['forkId', 'checkpointId', 'tenantId', 'attemptId'],
      ['forkId', 'checkpointId', 'tenantId', 'attemptId']
    );
    const current = await this.#internal.readFork(value.forkId);
    if (current.tenantId !== value.tenantId || current.attemptId !== value.attemptId) {
      throw new ForkStateError('checkpoint_not_found', 'Checkpoint manifest does not exist');
    }
    const checkpoint = await this.#internal.readCheckpoint(value.forkId, value.checkpointId);
    if (checkpoint.tenantId !== value.tenantId || checkpoint.attemptId !== value.attemptId) {
      throw new ForkStateError('checkpoint_not_found', 'Checkpoint manifest does not exist');
    }
    return checkpoint;
  }

  readCheckpointForTenant(input) { return this.readCheckpoint(input); }
}
