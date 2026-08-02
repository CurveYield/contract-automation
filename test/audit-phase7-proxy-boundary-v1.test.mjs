import test from 'node:test';
import assert from 'node:assert/strict';

import { validateForkActionRequest } from '../packages/audit-fork-protocol/src/index.mjs';

const forkId = `fork_${'4'.repeat(32)}`;
const attemptId = `att_${'5'.repeat(32)}`;

test('Phase 7 validators consume descriptor values without invoking a proxy get trap', () => {
  let gets = 0;
  const target = {
    schemaVersion: 'fork-action-request-v1',
    forkId,
    attemptId,
    actionId: 'act_proxy',
    type: 'call',
    payload: {
      to: `0x${'1'.repeat(40)}`,
      data: '0x',
      value: '0'
    },
    requestedAt: '2026-08-01T00:00:00.000Z'
  };
  const input = new Proxy(target, {
    get(object, property, receiver) {
      gets += 1;
      return Reflect.get(object, property, receiver);
    }
  });

  const validated = validateForkActionRequest(input);
  assert.equal(validated.actionId, 'act_proxy');
  assert.equal(gets, 0);
});
