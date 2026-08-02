import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertScopes,
  createOperationBudget,
  validateAuditJobRequest
} from '../packages/audit-protocol/src/index.mjs';
import { InMemoryAuditStore } from '../packages/audit-r2-store/src/index.mjs';

const ID = '0'.repeat(32);
function request(overrides = {}) {
  return {
    workspaceId: `ws_${ID}`,
    campaignId: `cmp_${ID}`,
    profileId: `prf_${ID}`,
    tool: 'inert-tool',
    configuration: { mode: 'strict' },
    resourceClass: 'bounded-v1',
    timeoutSeconds: 60,
    retentionPolicy: 'ephemeral-v1',
    expectedEvidence: ['summary-v1'],
    idempotencyKey: 'request-1',
    ...overrides
  };
}
function capture(fn) {
  try { fn(); return null; } catch (error) { return error; }
}

test('Phase 1 rejects custom prototypes, symbols, accessors, and sparse arrays', () => {
  const custom = Object.create({ inherited: true });
  Object.assign(custom, request());
  assert.equal(capture(() => validateAuditJobRequest(custom))?.code, 'invalid_plain_object');

  let invoked = false;
  const accessor = request();
  Object.defineProperty(accessor.configuration, 'secret', {
    enumerable: true,
    get() { invoked = true; throw new Error('getter executed'); }
  });
  assert.equal(capture(() => validateAuditJobRequest(accessor))?.code, 'accessor_property');
  assert.equal(invoked, false);

  const symbolic = request();
  symbolic.configuration[Symbol('hidden')] = true;
  assert.equal(capture(() => validateAuditJobRequest(symbolic))?.code, 'symbol_property');

  const sparse = request({ expectedEvidence: new Array(2) });
  sparse.expectedEvidence[1] = 'summary-v1';
  assert.equal(capture(() => validateAuditJobRequest(sparse))?.code, 'sparse_array');
});

test('Phase 1 rejects duplicate scopes and returns frozen defensive values', () => {
  assert.equal(capture(() => assertScopes(['audit:read', 'audit:read'], ['audit:read']))?.code, 'duplicate_scope');
  assert.equal(capture(() => assertScopes(['audit:read'], ['audit:read', 'audit:read']))?.code, 'duplicate_scope');

  const source = request();
  const validated = validateAuditJobRequest(source);
  source.configuration.mode = 'mutated';
  assert.equal(validated.configuration.mode, 'strict');
  assert.equal(Object.isFrozen(validated), true);
  assert.equal(Object.isFrozen(validated.configuration), true);
  assert.equal(Object.isFrozen(validated.expectedEvidence), true);

  const budget = createOperationBudget({ classA: 1, classB: 2, storageBytes: 3 });
  assert.equal(Object.isFrozen(budget), true);
});

test('R2 conditional writes reject hostile options and contradictory predicates', async () => {
  const store = new InMemoryAuditStore();
  let invoked = false;
  const options = {};
  Object.defineProperty(options, 'onlyIf', {
    enumerable: true,
    get() { invoked = true; throw new Error('getter executed'); }
  });
  await assert.rejects(() => store.put('safe/key', 'value', options), (error) => error.code === 'accessor_property');
  assert.equal(invoked, false);

  await assert.rejects(
    () => store.put('safe/key', 'value', { onlyIf: { etagMatches: 'a', etagDoesNotMatch: '*' } }),
    (error) => error.code === 'invalid_precondition'
  );
  await assert.rejects(() => store.put('../unsafe', 'value'), (error) => error.code === 'invalid_key');
});
