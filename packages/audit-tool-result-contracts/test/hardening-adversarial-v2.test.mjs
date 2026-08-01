import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePhase4ResultForPlan, validatePhase4ToolResult } from '../src/index.mjs';
import { compilerFailure, compilerSuccess, fuzzFailure, canonicalPlan, assertError } from './test-helpers-v2.mjs';

test('rejects accessors without invoking getter code', () => {
  const value = compilerSuccess();
  let invoked = 0;
  Object.defineProperty(value, 'schemaVersion', { enumerable: true, get() { invoked += 1; throw new Error('getter executed'); } });
  assertError(assert, () => validatePhase4ToolResult(value), 'accessor_property', '$.schemaVersion');
  assert.equal(invoked, 0);
});

test('does not trigger a proxy get trap while producing a defensive plain clone', () => {
  const target = compilerSuccess();
  let gets = 0;
  const proxy = new Proxy(target, { get() { gets += 1; throw new Error('proxy get executed'); } });
  const checked = validatePhase4ToolResult(proxy);
  assert.deepEqual(checked, target);
  assert.equal(gets, 0);
  assert.equal(Object.getPrototypeOf(checked), Object.prototype);
});

test('maps hostile reflection traps to a stable bounded error', () => {
  const proxy = new Proxy(compilerSuccess(), { ownKeys() { throw new Error('hostile ownKeys'); } });
  assertError(assert, () => validatePhase4ToolResult(proxy), 'hostile_object', '$');
});

test('rejects symbols, non-enumerable fields, sparse arrays, and nested custom prototypes', () => {
  const symbol = compilerSuccess(); symbol[Symbol('hidden')] = true;
  assertError(assert, () => validatePhase4ToolResult(symbol), 'unsupported_property', '$');
  const hidden = compilerSuccess(); Object.defineProperty(hidden, 'hidden', { value: true, enumerable: false });
  assertError(assert, () => validatePhase4ToolResult(hidden), 'unsupported_property', '$.hidden');
  const sparse = compilerSuccess(); sparse.tests = new Array(1);
  assertError(assert, () => validatePhase4ToolResult(sparse), 'invalid_array', '$.tests');
  const nested = fuzzFailure(); nested.counterexamples[0].value = Object.create({ inherited: true }); nested.counterexamples[0].value.amount = '0';
  assertError(assert, () => validatePhase4ToolResult(nested), 'invalid_plain_object', '$.counterexamples[0].value');
});

test('rejects negative zero, NaN, Infinity, NUL, and oversized normalized strings', () => {
  const negativeZero = compilerSuccess(); negativeZero.durationMs = -0;
  assertError(assert, () => validatePhase4ToolResult(negativeZero), 'noncanonical_number', '$.durationMs');
  const nan = compilerSuccess(); nan.durationMs = Number.NaN;
  assertError(assert, () => validatePhase4ToolResult(nan), 'invalid_integer', '$.durationMs');
  const infinity = compilerSuccess(); infinity.durationMs = Infinity;
  assertError(assert, () => validatePhase4ToolResult(infinity), 'invalid_integer', '$.durationMs');
  const nul = compilerFailure(); nul.diagnostics[0].message = 'bad\u0000message'; nul.diagnostics[0].formattedMessage = 'bad\u0000message';
  assertError(assert, () => validatePhase4ToolResult(nul), 'noncanonical_string', '$.diagnostics[0].message');
  const oversized = compilerFailure(); oversized.diagnostics[0].message = 'x'.repeat(4001);
  assertError(assert, () => validatePhase4ToolResult(oversized), 'string_too_long', '$.diagnostics[0].message');
});

test('accepts bounded Unicode while rejecting unsafe path variants', () => {
  const unicode = compilerFailure(); unicode.diagnostics[0].message = 'Δοκιμή 🔒'; unicode.diagnostics[0].formattedMessage = 'Δοκιμή 🔒';
  assert.deepEqual(validatePhase4ToolResult(unicode), unicode);
  for (const unsafe of ['/x.sol','../x.sol','a/./x.sol','C:/x.sol','C:\\x.sol','file:x.sol','https://x.invalid/x.sol','//server/share/x.sol','a/\u0001x.sol']) {
    const value = compilerFailure(); value.diagnostics[0].location.path = unsafe;
    assertError(assert, () => validatePhase4ToolResult(value), 'unsafe_path', '$.diagnostics[0].location.path');
  }
});

test('detects duplicate semantic records despite byte-different object key insertion order', () => {
  const value = fuzzFailure();
  const first = value.counterexamples[0];
  const reorderedValue = {};
  reorderedValue.actor = first.value.actor;
  reorderedValue.amount = first.value.amount;
  const duplicate = { test: first.test, seed: first.seed, value: reorderedValue, trace: [] };
  value.counterexamples.push(duplicate);
  assert.notEqual(JSON.stringify(first), JSON.stringify(duplicate));
  assertError(assert, () => validatePhase4ToolResult(value), 'duplicate_entry', '$.counterexamples[1]');
});

test('canonicalizes plain object key order and returns recursively frozen attacker-independent values', () => {
  const value = fuzzFailure();
  const unordered = {}; unordered.z = 1; unordered.a = 2;
  value.counterexamples[0].value = unordered;
  const checked = validatePhase4ToolResult(value);
  assert.deepEqual(Object.keys(checked.counterexamples[0].value), ['a', 'z']);
  assert.equal(Object.isFrozen(checked), true);
  assert.equal(Object.isFrozen(checked.counterexamples[0].value), true);
  unordered.a = 99;
  assert.equal(checked.counterexamples[0].value.a, 2);
});

test('sanitizes invocation plans before validating plan/result identity', () => {
  const result = compilerSuccess();
  const planTarget = canonicalPlan(result.profileId, result.parserVersion);
  let gets = 0;
  const plan = new Proxy(planTarget, { get() { gets += 1; throw new Error('plan get executed'); } });
  const checked = validatePhase4ResultForPlan(plan, result);
  assert.equal(checked.result.profileId, result.profileId);
  assert.equal(gets, 0);
});

test('bounds hostile property names in stable error paths without reflecting attacker text', () => {
  const longKey = `secret-${'x'.repeat(5000)}`;
  const value = compilerSuccess();
  Object.defineProperty(value, longKey, { value: true, enumerable: true });
  let caught;
  try { validatePhase4ToolResult(value); } catch (error) { caught = error; }
  assert.equal(caught?.code, 'unknown_field');
  assert.equal(caught?.path, '$.*');
  assert.equal(caught?.message.includes(longKey), false);

  const accessor = compilerSuccess();
  let invoked = 0;
  Object.defineProperty(accessor, longKey, { enumerable: true, get() { invoked += 1; return true; } });
  try { validatePhase4ToolResult(accessor); } catch (error) { caught = error; }
  assert.equal(caught?.code, 'accessor_property');
  assert.equal(caught?.path, '$.*');
  assert.equal(invoked, 0);
});
