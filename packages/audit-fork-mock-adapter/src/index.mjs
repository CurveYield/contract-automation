import {
  canonicalJson,
  sha256Hex,
  validateForkActionRequest,
  validateMockAdapterRequest,
  validateMockAdapterResult
} from '../../audit-fork-protocol/src/index.mjs';

const ENCODER = new TextEncoder();

function hex(bytes) {
  return `0x${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function clone(value) {
  return structuredClone(value);
}

function baseState(request) {
  return {
    chainId: request.chainId,
    blockNumber: request.blockNumber,
    timestamp: request.timestamp,
    seed: request.seed,
    overrides: {},
    snapshots: {}
  };
}

export class InertForkMockAdapter {
  #forks = new Map();

  async #result(request, status, result = {}, extras = {}) {
    const state = this.#forks.get(request.forkId) ?? baseState(request);
    const digestInput = {
      operation: request.operation,
      forkId: request.forkId,
      status,
      chainId: state.chainId,
      blockNumber: state.blockNumber,
      timestamp: state.timestamp,
      result,
      ...extras
    };
    const deterministicDigest = await sha256Hex(canonicalJson(digestInput));
    return validateMockAdapterResult({
      schemaVersion: 'fork-mock-result-v1',
      operation: request.operation,
      forkId: request.forkId,
      status,
      chainId: state.chainId,
      blockNumber: state.blockNumber,
      timestamp: state.timestamp,
      deterministicDigest,
      result: clone(result),
      ...extras
    });
  }

  async handle(input) {
    const request = validateMockAdapterRequest(input);
    if (request.mode === 'fail') return this.#result(request, 'failed', { reason: 'deterministic_mock_failure' });
    if (request.mode === 'cancel' || request.operation === 'cancel') {
      this.#forks.delete(request.forkId);
      return this.#result(request, 'cancelled', { reason: 'deterministic_mock_cancellation' });
    }

    if (request.operation === 'create') {
      if (!this.#forks.has(request.forkId)) this.#forks.set(request.forkId, baseState(request));
      return this.#result(request, 'ready', { executionEnabled: false, adapter: 'inert-mock-v1' });
    }

    const state = this.#forks.get(request.forkId);
    if (!state) return this.#result(request, 'failed', { reason: 'fork_not_created' });

    if (request.operation === 'action') {
      const action = validateForkActionRequest(request.action);
      if (action.forkId !== request.forkId) return this.#result(request, 'failed', { reason: 'fork_identity_mismatch' });
      const result = await this.#applyAction(state, action);
      return this.#result(request, 'succeeded', result);
    }

    if (request.operation === 'checkpoint') {
      const artifact = ENCODER.encode(canonicalJson({
        schemaVersion: 'inert-fork-checkpoint-v1',
        forkId: request.forkId,
        chainId: state.chainId,
        blockNumber: state.blockNumber,
        timestamp: state.timestamp,
        seed: state.seed,
        overrides: state.overrides
      }));
      const sha256 = await sha256Hex(artifact);
      state.snapshots[request.checkpointId] = clone({
        chainId: state.chainId,
        blockNumber: state.blockNumber,
        timestamp: state.timestamp,
        seed: state.seed,
        overrides: state.overrides
      });
      return this.#result(request, 'succeeded', { stored: true }, {
        checkpointId: request.checkpointId,
        sha256,
        bytes: artifact.byteLength,
        artifactHex: hex(artifact)
      });
    }

    if (request.operation === 'restore') {
      const snapshot = state.snapshots[request.checkpointId];
      if (!snapshot) return this.#result(request, 'failed', { reason: 'checkpoint_not_found' });
      state.chainId = snapshot.chainId;
      state.blockNumber = snapshot.blockNumber;
      state.timestamp = snapshot.timestamp;
      state.seed = snapshot.seed;
      state.overrides = clone(snapshot.overrides);
      return this.#result(request, 'succeeded', { restored: request.checkpointId }, { checkpointId: request.checkpointId });
    }

    return this.#result(request, 'failed', { reason: 'unsupported_operation' });
  }

  async #applyAction(state, action) {
    if (action.type === 'advance_blocks') {
      state.blockNumber += action.payload.blocks;
      return { advancedBlocks: action.payload.blocks };
    }
    if (action.type === 'advance_time') {
      state.timestamp += action.payload.seconds;
      return { advancedSeconds: action.payload.seconds };
    }
    if (action.type === 'read_call') {
      return {
        target: action.payload.target,
        returnHex: `0x${(await sha256Hex(canonicalJson(action))).slice(0, Math.min(action.payload.maxReturnBytes * 2, 64))}`
      };
    }
    if (action.type === 'inspect_state') {
      return {
        address: action.payload.address,
        slots: action.payload.slots.map((slot) => ({ slot, value: state.overrides[`${action.payload.address}:${slot}`] ?? `0x${'0'.repeat(64)}` }))
      };
    }
    if (action.type === 'state_override') {
      for (const entry of action.payload.slots) state.overrides[`${action.payload.address}:${entry.slot}`] = entry.value;
      return { updatedSlots: action.payload.slots.length };
    }
    if (action.type === 'snapshot') {
      const checkpointId = `snap_${(await sha256Hex(canonicalJson({ action, state }))).slice(0, 32)}`;
      state.snapshots[checkpointId] = clone({
        chainId: state.chainId,
        blockNumber: state.blockNumber,
        timestamp: state.timestamp,
        seed: state.seed,
        overrides: state.overrides
      });
      return { checkpointId, label: action.payload.label };
    }
    if (action.type === 'restore') {
      const snapshot = state.snapshots[action.payload.checkpointId];
      if (!snapshot) return { restored: false, reason: 'checkpoint_not_found' };
      state.chainId = snapshot.chainId;
      state.blockNumber = snapshot.blockNumber;
      state.timestamp = snapshot.timestamp;
      state.seed = snapshot.seed;
      state.overrides = clone(snapshot.overrides);
      return { restored: true, checkpointId: action.payload.checkpointId };
    }
    return { unsupported: true };
  }
}
