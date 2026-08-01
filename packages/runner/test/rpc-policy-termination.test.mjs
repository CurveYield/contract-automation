import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createRpcPolicyTermination,
  raceWithRpcPolicyTermination
} from '../src/rpc-method-policy.mjs';

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

test('runner-level policy termination wins over a later workflow failure', async () => {
  const controller = createRpcPolicyTermination();
  const laterFailure = (async () => {
    await delay(30);
    throw new Error('later workflow failure');
  })();

  setImmediate(() => controller.terminate('eth_sendTransaction'));

  await assert.rejects(
    () => raceWithRpcPolicyTermination(laterFailure, controller.termination),
    (error) => {
      assert.equal(error.code, 'CALL_NOT_SUPPORTED');
      assert.equal(error.method, 'eth_sendTransaction');
      assert.doesNotMatch(error.message, /later workflow failure/);
      return true;
    }
  );

  await delay(40);
});

test('runner-level policy termination closes an engine that resolves after termination', async () => {
  const controller = createRpcPolicyTermination();
  let closed = false;
  const lateEngine = (async () => {
    await delay(30);
    return {
      async close() { closed = true; }
    };
  })();

  setImmediate(() => controller.terminate('personal_unlockAccount'));

  await assert.rejects(
    () => raceWithRpcPolicyTermination(lateEngine, controller.termination, {
      async onLateValue(engine) { await engine.close(); }
    }),
    (error) => error.code === 'CALL_NOT_SUPPORTED'
  );

  await delay(40);
  assert.equal(closed, true);
});
