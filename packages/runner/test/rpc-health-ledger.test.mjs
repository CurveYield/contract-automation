import test from 'node:test';
import assert from 'node:assert/strict';

import {
  disabledSlotIds,
  reduceRpcHealth,
  sessionEventFromDiagnostics
} from '../src/rpc-health-ledger.mjs';

function failedSession(run, slot = 'primary-01') {
  return {
    version: 'rpc-health-event/v1',
    type: 'session',
    chain: 'ethereum',
    runId: run,
    at: `2026-08-02T00:00:0${run}.000Z`,
    slots: [{
      id: slot,
      pool: 'primary',
      selected: true,
      sessionFailed: true,
      requests: 3,
      successes: 0,
      failures: 3,
      quarantined: true,
      failureClass: 'quota_or_rate_limit'
    }]
  };
}

test('disables a slot after four consecutive failed sessions', () => {
  const state = reduceRpcHealth([
    failedSession(1),
    failedSession(2),
    failedSession(3),
    failedSession(4)
  ], { crossSessionFailureThreshold: 4 });

  assert.equal(state.slots['primary-01'].consecutiveFailedSessions, 4);
  assert.equal(state.slots['primary-01'].disabled, true);
  assert.deepEqual(disabledSlotIds(state), ['primary-01']);
});

test('a successful selected session resets the consecutive failure streak', () => {
  const success = {
    ...failedSession(3),
    slots: [{
      id: 'primary-01',
      pool: 'primary',
      selected: true,
      sessionFailed: false,
      requests: 4,
      successes: 4,
      failures: 0,
      quarantined: false,
      failureClass: null
    }]
  };
  const state = reduceRpcHealth([
    failedSession(1),
    failedSession(2),
    success,
    failedSession(4)
  ], { crossSessionFailureThreshold: 4 });

  assert.equal(state.slots['primary-01'].consecutiveFailedSessions, 1);
  assert.equal(state.slots['primary-01'].disabled, false);
});

test('an unused slot does not gain a failed session', () => {
  const unused = {
    ...failedSession(2),
    slots: [{
      id: 'primary-01',
      pool: 'primary',
      selected: false,
      sessionFailed: false,
      requests: 0,
      successes: 0,
      failures: 0,
      quarantined: false,
      failureClass: null
    }]
  };
  const state = reduceRpcHealth([failedSession(1), unused], { crossSessionFailureThreshold: 4 });
  assert.equal(state.slots['primary-01'].consecutiveFailedSessions, 1);
});

test('administrator recovery re-enables a persistently disabled slot', () => {
  const recovery = {
    version: 'rpc-health-event/v1',
    type: 'recover',
    chain: 'ethereum',
    slotId: 'primary-01',
    actor: 'admin',
    at: '2026-08-02T00:01:00.000Z'
  };
  const state = reduceRpcHealth([
    failedSession(1), failedSession(2), failedSession(3), failedSession(4), recovery
  ], { crossSessionFailureThreshold: 4 });
  assert.equal(state.slots['primary-01'].consecutiveFailedSessions, 0);
  assert.equal(state.slots['primary-01'].disabled, false);
  assert.equal(state.slots['primary-01'].lastRecoveryActor, 'admin');
});

test('converts redacted router diagnostics into one append-only session event', () => {
  const event = sessionEventFromDiagnostics({
    chain: 'ethereum',
    runId: 'run-7',
    at: '2026-08-02T00:00:07.000Z',
    diagnostics: {
      slots: [
        {
          id: 'secondary-01',
          pool: 'secondary',
          requests: 8,
          successes: 8,
          failures: 0,
          quarantined: false,
          lastFailureClass: null
        },
        {
          id: 'primary-01',
          pool: 'primary',
          requests: 3,
          successes: 0,
          failures: 3,
          quarantined: true,
          lastFailureClass: 'method_unsupported'
        }
      ]
    }
  });
  assert.equal(event.type, 'session');
  assert.equal(event.slots[0].selected, true);
  assert.equal(event.slots[0].sessionFailed, false);
  assert.equal(event.slots[1].sessionFailed, true);
  assert.equal(JSON.stringify(event).includes('http'), false);
});
