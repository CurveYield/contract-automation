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

export class ForkService extends InternalForkService {
  async readForkForTenant(input) {
    const value = safeInput(input, ['forkId', 'tenantId', 'attemptId'], ['forkId', 'tenantId']);
    const current = await super.readFork(value.forkId);
    if (
      current.tenantId !== value.tenantId ||
      (value.attemptId !== undefined && current.attemptId !== value.attemptId)
    ) {
      throw new ForkStateError('fork_not_found', 'Fork does not exist');
    }
    return current;
  }

  async readCheckpointForTenant(input) {
    const value = safeInput(
      input,
      ['forkId', 'checkpointId', 'tenantId', 'attemptId'],
      ['forkId', 'checkpointId', 'tenantId', 'attemptId']
    );
    const current = await super.readFork(value.forkId);
    if (current.tenantId !== value.tenantId || current.attemptId !== value.attemptId) {
      throw new ForkStateError('checkpoint_not_found', 'Checkpoint manifest does not exist');
    }
    const checkpoint = await super.readCheckpoint(value.forkId, value.checkpointId);
    if (checkpoint.tenantId !== value.tenantId || checkpoint.attemptId !== value.attemptId) {
      throw new ForkStateError('checkpoint_not_found', 'Checkpoint manifest does not exist');
    }
    return checkpoint;
  }
}
