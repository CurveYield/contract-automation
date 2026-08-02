import test from 'node:test';
import assert from 'node:assert/strict';

import {
  closeRpcHealthSession,
  filterDisabledRpcSlots,
  openRpcHealthSession
} from '../src/rpc-health-session.mjs';

test('filters persistently disabled slots before router creation', () => {
  const slots = [
    { id: 'primary-01', pool: 'primary' },
    { id: 'primary-02', pool: 'primary' },
    { id: 'secondary-01', pool: 'secondary' }
  ];
  assert.deepEqual(
    filterDisabledRpcSlots(slots, ['primary-02']),
    [slots[0], slots[2]]
  );
});

test('opens injected store and returns disabled slot IDs', async () => {
  const store = {
    async load() {
      return {
        issueNumber: 10,
        disabledSlotIds: ['primary-02'],
        state: { slots: { 'primary-02': { disabled: true } } }
      };
    }
  };
  const session = await openRpcHealthSession({
    environment: {},
    chain: 'ethereum',
    crossSessionFailureThreshold: 4,
    store
  });
  assert.equal(session.backend, 'github-issue');
  assert.deepEqual(session.disabledSlotIds, ['primary-02']);
  assert.equal(session.load.ledgerIssueNumber, 10);
});

test('records one redacted router session summary after execution', async () => {
  const calls = [];
  const store = {
    async load() { return { issueNumber: 10, disabledSlotIds: [], state: { slots: {} } }; },
    async recordSession(input) {
      calls.push(input);
      return {
        backend: 'github-issue',
        ledgerIssueNumber: 10,
        disabledSlotIds: ['primary-01'],
        newlyDisabled: ['primary-01'],
        incidentIssues: [11]
      };
    }
  };
  const session = await openRpcHealthSession({ environment: {}, chain: 'ethereum', store });
  const result = await closeRpcHealthSession({
    session,
    environment: {},
    runId: 'run-1',
    diagnostics: {
      slots: [{
        id: 'primary-01',
        pool: 'primary',
        requests: 3,
        successes: 0,
        failures: 3,
        quarantined: true,
        lastFailureClass: 'quota_or_rate_limit'
      }]
    }
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].runId, 'run-1');
  assert.equal(result.status, 'recorded');
  assert.deepEqual(result.newlyDisabled, ['primary-01']);
  assert.deepEqual(result.incidentIssues, [11]);
  assert.equal(JSON.stringify(result).includes('http'), false);
});

test('health reporting is disabled when no trusted store is configured', async () => {
  const session = await openRpcHealthSession({ environment: {}, chain: 'ethereum' });
  assert.equal(session.backend, 'disabled');
  assert.deepEqual(session.disabledSlotIds, []);
  const result = await closeRpcHealthSession({
    session,
    environment: {},
    diagnostics: { slots: [] }
  });
  assert.equal(result.status, 'disabled');
});
