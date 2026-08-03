import test from 'node:test';
import assert from 'node:assert/strict';

import {
  reduceRpcHealth,
  recoveryEvent,
  sessionEventFromDiagnostics
} from '../src/rpc-health-ledger.mjs';

function sessionEvent(overrides = {}) {
  return {
    version: 'rpc-health-event/v1',
    type: 'session',
    chain: 'ethereum',
    runId: '30745082610',
    at: '2026-08-02T11:28:40.000Z',
    slots: [{
      id: 'primary-01',
      pool: 'primary',
      selected: true,
      sessionFailed: false,
      requests: 4,
      successes: 4,
      failures: 0,
      quarantined: false,
      failureClass: null,
      unsupportedMethods: []
    }],
    ...overrides
  };
}

function withSlot(overrides = {}) {
  return sessionEvent({
    slots: [{
      ...sessionEvent().slots[0],
      ...overrides
    }]
  });
}

test('rejects prototype-polluting and out-of-range RPC slot IDs without mutating globals', () => {
  const invalid = [
    '__proto__', 'constructor', 'prototype',
    'primary-00', 'primary-08', 'secondary-04', 'legacy-02'
  ];
  for (const id of invalid) {
    try {
      assert.throws(() => reduceRpcHealth([withSlot({ id })]), /slot|event|invalid/iu, id);
    } finally {
      delete Object.prototype.lastEventAt;
      delete Object.prototype.lastRunId;
      delete Object.prototype.totalRequests;
      delete Object.prototype.consecutiveFailedSessions;
    }
    assert.equal(Object.prototype.lastEventAt, undefined, id);
  }
});

test('uses a null-prototype slot map', () => {
  const state = reduceRpcHealth([sessionEvent()]);
  assert.equal(Object.getPrototypeOf(state.slots), null);
});

test('rejects unknown event and slot fields', () => {
  assert.throws(() => reduceRpcHealth([{ ...sessionEvent(), credential: 'hidden' }]), /field|event|invalid/iu);
  assert.throws(() => reduceRpcHealth([withSlot({ endpoint: 'https://rpc.invalid/key' })]), /field|slot|invalid/iu);
});

test('rejects duplicate slots, invalid run IDs, and invalid pool bindings', () => {
  const duplicate = sessionEvent({ slots: [sessionEvent().slots[0], sessionEvent().slots[0]] });
  assert.throws(() => reduceRpcHealth([duplicate]), /duplicate|slot/iu);
  assert.throws(() => reduceRpcHealth([sessionEvent({ runId: 'run-7' })]), /run|event|invalid/iu);
  assert.throws(() => reduceRpcHealth([withSlot({ id: 'primary-01', pool: 'secondary' })]), /pool|slot|invalid/iu);
});

test('rejects impossible and unsafe counters', () => {
  for (const event of [
    withSlot({ requests: -1 }),
    withSlot({ requests: 1, successes: 1, failures: 1 }),
    withSlot({ selected: false, requests: 1, successes: 1 }),
    withSlot({ selected: false, sessionFailed: true }),
    withSlot({ requests: Number.MAX_SAFE_INTEGER + 1 })
  ]) {
    assert.throws(() => reduceRpcHealth([event]), /count|request|slot|invalid|selected/iu);
  }
});

test('event constructors validate and freeze canonical output', () => {
  const event = sessionEventFromDiagnostics({
    chain: 'ethereum',
    runId: '30745082610',
    at: '2026-08-02T11:28:40.000Z',
    diagnostics: {
      slots: [{
        id: 'secondary-01',
        pool: 'secondary',
        requests: 2,
        successes: 2,
        failures: 0,
        quarantined: false,
        lastFailureClass: null,
        unsupportedMethods: []
      }]
    }
  });
  assert.equal(Object.isFrozen(event), true);
  assert.equal(Object.isFrozen(event.slots), true);
  assert.equal(Object.isFrozen(event.slots[0]), true);
  assert.throws(() => sessionEventFromDiagnostics({
    chain: 'ethereum',
    runId: 'not-a-run-id',
    diagnostics: { slots: [] }
  }), /run|event|invalid/iu);

  const recovery = recoveryEvent({
    chain: 'ethereum',
    slotId: 'primary-01',
    actor: 'administrator',
    at: '2026-08-02T11:30:00.000Z'
  });
  assert.equal(Object.isFrozen(recovery), true);
  assert.throws(() => recoveryEvent({
    chain: 'ethereum',
    slotId: '__proto__',
    actor: 'administrator'
  }), /slot|event|invalid/iu);
});
