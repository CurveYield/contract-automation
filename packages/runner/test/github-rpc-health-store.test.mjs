import test from 'node:test';
import assert from 'node:assert/strict';

import { createGithubRpcHealthStore } from '../src/github-rpc-health-store.mjs';

const MARKER = '<!-- curveyield-rpc-health-event-v1 -->';

function failedSession(runId, slotId = 'primary-01') {
  return {
    version: 'rpc-health-event/v1',
    type: 'session',
    chain: 'ethereum',
    runId: String(runId),
    at: `2026-08-02T11:28:${String(Number(runId) % 60).padStart(2, '0')}.000Z`,
    slots: [{
      id: slotId,
      pool: 'primary',
      selected: true,
      sessionFailed: true,
      requests: 3,
      successes: 0,
      failures: 3,
      quarantined: true,
      failureClass: 'quota_or_rate_limit',
      unsupportedMethods: []
    }]
  };
}

function recovery() {
  return {
    version: 'rpc-health-event/v1',
    type: 'recover',
    chain: 'ethereum',
    slotId: 'primary-01',
    actor: 'administrator',
    at: '2026-08-02T11:30:00.000Z'
  };
}

function body(event) {
  return `${MARKER}\n\`\`\`json\n${JSON.stringify(event)}\n\`\`\``;
}

function comment({ id, event, login = 'github-actions[bot]', userId = 41898282, type = 'Bot', association = 'NONE' }) {
  return {
    id,
    body: body(event),
    user: { login, id: userId, type },
    author_association: association
  };
}

function createFetch(comments) {
  return async (url, options = {}) => {
    if (options.method && options.method !== 'GET') {
      return new Response(JSON.stringify({ id: 999, number: 127 }), {
        status: 201,
        headers: { 'content-type': 'application/json' }
      });
    }
    if (url.includes('/issues?')) {
      return new Response(JSON.stringify([{
        number: 127,
        title: '[RPC Health Ledger] ethereum',
        body: '<!-- curveyield-rpc-health-ledger-v1 -->'
      }]), { status: 200 });
    }
    if (url.includes('/issues/127/comments')) {
      return new Response(JSON.stringify(comments), { status: 200 });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
}

function store(comments) {
  return createGithubRpcHealthStore({
    token: 'test-token',
    repository: 'CurveYield/contract-automation',
    chain: 'ethereum',
    crossSessionFailureThreshold: 4,
    fetchImpl: createFetch(comments),
    runId: '30745082610'
  });
}

test('accepts bot-authored session events and deduplicates comment IDs', async () => {
  const first = comment({ id: 1, event: failedSession(1) });
  const loaded = await store([first, structuredClone(first)]).load();
  assert.equal(loaded.events.length, 1);
  assert.equal(loaded.state.processedEvents, 1);
  assert.equal(loaded.state.slots['primary-01'].consecutiveFailedSessions, 1);
});

test('ignores events from public commenters, missing users, and fake bot identities', async () => {
  const comments = [
    comment({ id: 1, event: failedSession(1), login: 'attacker', userId: 1, type: 'User', association: 'NONE' }),
    { id: 2, body: body(failedSession(2)), user: null, author_association: 'NONE' },
    comment({ id: 3, event: failedSession(3), login: 'github-actions[bot]', userId: 999, type: 'Bot' }),
    comment({ id: 4, event: failedSession(4), login: 'github-actions[bot]', userId: 41898282, type: 'User' })
  ];
  const loaded = await store(comments).load();
  assert.equal(loaded.events.length, 0);
  assert.deepEqual(loaded.disabledSlotIds, []);
});

test('public commenters cannot disable or recover slots', async () => {
  const attacker = [1, 2, 3, 4].map((id) => comment({
    id,
    event: failedSession(id),
    login: 'attacker',
    userId: 7,
    type: 'User',
    association: 'NONE'
  }));
  attacker.push(comment({
    id: 5,
    event: recovery(),
    login: 'attacker',
    userId: 7,
    type: 'User',
    association: 'NONE'
  }));
  const loaded = await store(attacker).load();
  assert.equal(loaded.events.length, 0);
  assert.deepEqual(loaded.disabledSlotIds, []);
});

test('trusted repository administrators can persist recovery events', async () => {
  const comments = [
    ...[1, 2, 3, 4].map((id) => comment({ id, event: failedSession(id) })),
    comment({
      id: 5,
      event: recovery(),
      login: 'James-Nexus',
      userId: 274642662,
      type: 'User',
      association: 'OWNER'
    })
  ];
  const loaded = await store(comments).load();
  assert.equal(loaded.events.length, 5);
  assert.equal(loaded.state.slots['primary-01'].disabled, false);
  assert.equal(loaded.state.slots['primary-01'].lastRecoveryActor, 'administrator');
});

test('ignores malformed and schema-invalid bot comments', async () => {
  const comments = [
    {
      id: 1,
      body: `${MARKER}\n\`\`\`json\n{not-json}\n\`\`\``,
      user: { login: 'github-actions[bot]', id: 41898282, type: 'Bot' },
      author_association: 'NONE'
    },
    comment({ id: 2, event: { ...failedSession(2), credential: 'hidden' } })
  ];
  const loaded = await store(comments).load();
  assert.equal(loaded.events.length, 0);
});
