import test from 'node:test';
import assert from 'node:assert/strict';

import { Phase6ValidationError, publishPhase6Profile, validatePhase6ProfileConfiguration, validateFormalResult, parseHalmosBytes, bytes, digest, emptyResult, oldHalmosCapture } from './hardening-v2-helpers.mjs';

test('P6-R01 publication release identity is immutable and exact', () => {
  for (const releaseIdentifier of ['latest', '^0.3.3', 'v9.9.9', 'unrelated']) {
    assert.throws(
      () => publishPhase6Profile('halmos-v1', { imageDigest: digest, releaseIdentifier }),
      (error) => error instanceof Phase6ValidationError && error.code === 'invalid_release_identifier'
    );
  }
  const published = publishPhase6Profile('halmos-v1', { imageDigest: digest, releaseIdentifier: 'v0.3.3' });
  assert.equal(published.publication.releaseIdentifier, 'v0.3.3');
  assert.equal(published.runnable, false);
  assert.equal(published.executionEnabled, false);
  assert.equal(published.executor.available, false);
});

test('P6-R02 rejects class instances and custom prototypes at every object boundary', () => {
  class Config {
    constructor() {
      this.engine = 'all'; this.solver = 'z3'; this.targets = ['assert']; this.timeoutMs = 10;
      this.showProvedSafe = true; this.showUnproved = true; this.showUnsupported = false;
    }
  }
  assert.throws(
    () => validatePhase6ProfileConfiguration('solidity-smt-v1', new Config()),
    (error) => error instanceof Phase6ValidationError && error.code === 'invalid_plain_object'
  );
  const publication = Object.assign(Object.create({ inherited: true }), { imageDigest: digest, releaseIdentifier: 'v0.3.3' });
  assert.throws(
    () => publishPhase6Profile('halmos-v1', publication),
    (error) => error instanceof Phase6ValidationError && error.code === 'invalid_plain_object'
  );
  class Assertion {
    constructor() { this.id = 'assert_1'; this.expression = 'x > 0'; this.description = null; this.sourceReferenceIds = []; }
  }
  assert.throws(
    () => validateFormalResult(emptyResult({ assertions: [new Assertion()] })),
    (error) => error instanceof Phase6ValidationError && error.code === 'invalid_plain_object'
  );
});

test('P6-R03 deduplicates exact identities, rejects conflicts, and is permutation invariant', () => {
  const assertionA = { id: 'assert_1', expression: 'x > 0', description: 'same', sourceReferenceIds: [] };
  const assertionB = { id: 'assert_2', expression: 'y > 0', description: 'same', sourceReferenceIds: [] };
  const first = validateFormalResult(emptyResult({ assertions: [assertionB, assertionA, structuredClone(assertionA)] }));
  const second = validateFormalResult(emptyResult({ assertions: [structuredClone(assertionA), assertionB, assertionA] }));
  assert.equal(first.assertions.length, 2);
  assert.equal(JSON.stringify(first), JSON.stringify(second));

  assert.throws(
    () => validateFormalResult(emptyResult({ assertions: [assertionA, { ...assertionA, expression: 'x == 0' }] })),
    (error) => error instanceof Phase6ValidationError && error.code === 'conflicting_duplicate'
  );
  assert.throws(
    () => validateFormalResult(emptyResult({ models: [{ id: 'model_1', entries: [{ name: 'x', type: 'uint', value: '1' }, { name: 'x', type: 'uint', value: '2' }] }] })),
    (error) => error instanceof Phase6ValidationError && error.code === 'conflicting_duplicate'
  );
  assert.throws(
    () => validateFormalResult(emptyResult({ traces: [{ id: 'trace_1', steps: [
      { index: 0, kind: 'call', operation: 'a', detail: null, sourceReferenceIds: [] },
      { index: 0, kind: 'call', operation: 'b', detail: null, sourceReferenceIds: [] }
    ] }] })),
    (error) => error instanceof Phase6ValidationError && error.code === 'conflicting_duplicate'
  );
});

test('P6-R04 parser error paths are bounded, sanitized, and never throw for malformed inert bytes', () => {
  const hostileKeys = [
    'x'.repeat(100_000),
    `nested\u0000control`,
    'privateKey',
    'AuthorizationBearerSecret'
  ];
  for (const key of hostileKeys) {
    const capture = oldHalmosCapture({ [key]: { ['y'.repeat(100_000)]: true } });
    let result;
    assert.doesNotThrow(() => { result = parseHalmosBytes(bytes(capture)); });
    assert.equal(result.outcome, 'parser_error');
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes(key.slice(0, 32)), false);
    assert.equal(result.parserWarnings[0].path, '$.[rejected-field]');
    assert.ok(result.parserWarnings[0].path.length <= 512);
  }
});
