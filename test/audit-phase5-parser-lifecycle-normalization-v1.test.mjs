import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePhase5ToolResult, PHASE5_PARSER_VERSIONS, MAX_PHASE5_INPUT_BYTES } from '../packages/audit-phase5-parsers/src/index.mjs';
import { validatePhase5ToolResult } from '../packages/audit-phase5-result-contracts/src/index.mjs';
import { FIXTURE_CASES, parseFixture } from './audit-phase5-compatibility-helpers-v2.mjs';

const PROFILES = Object.freeze([
  'hardhat-test-v1',
  'echidna-v1',
  'mutation-v1',
  'dependency-scan-v1'
]);
const TERMINALS = Object.freeze([
  ['timeout', 'timeout'],
  ['cancelled', 'cancelled'],
  ['resource_exhausted', 'resource_exhaustion']
]);

function input(overrides = {}) {
  return {
    resultBytes: '{"ignored":[3,2,1]}',
    exitCode: 137,
    durationMs: 19,
    termination: 'resource_exhausted',
    ...overrides
  };
}

function assertEmptyEnvelope(result) {
  for (const key of ['hardhatTests', 'echidnaProperties', 'mutationResults', 'dependencyFindings', 'evidence', 'artifacts', 'parserErrors']) {
    assert.deepEqual(result[key], [], `${key} must be empty`);
  }
  assert.deepEqual(result.summary, {});
}

function assertParserError(result, code) {
  assert.equal(result.classification, 'parser_error');
  assert.equal(result.parserErrors.length, 1);
  assert.equal(result.parserErrors[0].code, code);
  assert.doesNotMatch(JSON.stringify(result), /super-secret|\/home\/runner\/private|C:\\Users\\James/i);
  return result;
}

test('resource exhaustion normalizes raw process exit codes for every profile', () => {
  for (const profileId of PROFILES) {
    for (const exitCode of [137, 143]) {
      const parsed = parsePhase5ToolResult(profileId, input({ exitCode }));
      assert.equal(parsed.profileId, profileId);
      assert.equal(parsed.parserVersion, PHASE5_PARSER_VERSIONS[profileId]);
      assert.equal(parsed.classification, 'resource_exhaustion');
      assert.equal(parsed.exitCode, null);
      assert.equal(parsed.durationMs, 19);
      assertEmptyEnvelope(parsed);
      assert.deepEqual(validatePhase5ToolResult(parsed), parsed);
    }
  }
});

test('all non-completed terminal envelopes are canonical and accepted for all profiles', () => {
  for (const profileId of PROFILES) {
    for (const [termination, classification] of TERMINALS) {
      const parsed = parsePhase5ToolResult(profileId, input({ termination, exitCode: 255, durationMs: 123 }));
      assert.equal(parsed.classification, classification);
      assert.equal(parsed.exitCode, null);
      assert.equal(parsed.durationMs, 123);
      assertEmptyEnvelope(parsed);
      const accepted = validatePhase5ToolResult(parsed);
      assert.deepEqual(accepted, parsed);
      assert.equal(Object.isFrozen(accepted), true);
      assert.equal(Object.isFrozen(accepted.summary), true);
    }
  }
});

test('terminal output ignores valid raw bytes and raw exit-code metadata', () => {
  const variants = [
    input({ resultBytes: '{}', exitCode: 0 }),
    input({ resultBytes: 'not-json and TOKEN=super-secret /home/runner/private', exitCode: 137 }),
    input({ resultBytes: new Uint8Array([123, 34, 120, 34, 58, 49, 125]), exitCode: 143 }),
    input({ resultBytes: '{"records":[3,1,2]}', exitCode: 255 })
  ];
  for (const profileId of PROFILES) {
    const normalized = variants.map((value) => parsePhase5ToolResult(profileId, value));
    for (const result of normalized) assert.deepEqual(result, normalized[0]);
    assert.doesNotMatch(JSON.stringify(normalized[0]), /super-secret|runner|records/);
  }
});

test('completed fixture outputs retain exit codes and validate against the accepted result contract', () => {
  for (const [name, profileId, exitCode, termination, classification] of FIXTURE_CASES) {
    const parsed = parseFixture(name, profileId, exitCode, termination);
    assert.equal(parsed.classification, classification);
    assert.equal(parsed.exitCode, exitCode);
    assert.deepEqual(validatePhase5ToolResult(parsed), parsed);
  }
});

test('malformed output and parser errors preserve bounded accepted exit-code behavior', () => {
  const malformed = parsePhase5ToolResult('hardhat-test-v1', input({ resultBytes: '{', exitCode: 17, termination: 'completed' }));
  assert.equal(malformed.classification, 'malformed_output');
  assert.equal(malformed.exitCode, 17);
  assert.deepEqual(validatePhase5ToolResult(malformed), malformed);

  const parserError = parsePhase5ToolResult('hardhat-test-v1', input({ resultBytes: '{}', exitCode: 23, termination: 'completed' }));
  assert.equal(parserError.classification, 'parser_error');
  assert.equal(parserError.exitCode, 23);
  assert.deepEqual(validatePhase5ToolResult(parserError), parserError);
});

test('invalid and unknown profile IDs remain bounded and deterministic', () => {
  for (const profileId of ['x'.repeat(100_000), 'bad\u0000profile', {}, [], 'unknown-profile-v1']) {
    const first = parsePhase5ToolResult(profileId, input({ termination: 'completed', exitCode: 0, resultBytes: '{}' }));
    const second = parsePhase5ToolResult(profileId, input({ termination: 'completed', exitCode: 0, resultBytes: '{}' }));
    assert.equal(first.profileId, 'invalid-profile-v1');
    assert.equal(first.parserVersion, 'unknown-parser-v1');
    assert.ok(['invalid_profile_id', 'unknown_profile_id'].includes(first.parserErrors[0].code));
    assert.ok(JSON.stringify(first).length < 3_000);
    assert.deepEqual(first, second);
    assert.deepEqual(validatePhase5ToolResult(first), first);
  }
});

test('ordinary and null-prototype input objects are accepted', () => {
  const ordinary = parsePhase5ToolResult('hardhat-test-v1', input({ termination: 'timeout', exitCode: 9 }));
  const nullPrototype = Object.assign(Object.create(null), input({ termination: 'timeout', exitCode: 9 }));
  assert.deepEqual(parsePhase5ToolResult('hardhat-test-v1', nullPrototype), ordinary);
});

test('custom prototypes and class instances are rejected without retaining attacker prototypes', () => {
  class HostileInput {
    constructor() { Object.assign(this, input()); }
  }
  const custom = Object.assign(Object.create({ hostile: true }), input());
  for (const value of [custom, new HostileInput()]) {
    const parsed = assertParserError(parsePhase5ToolResult('hardhat-test-v1', value), 'invalid_object');
    assert.equal(Object.getPrototypeOf(parsed), Object.prototype);
    assert.equal(Object.getPrototypeOf(parsed.parserErrors[0]), Object.prototype);
    assert.equal(Object.isFrozen(parsed), true);
  }
});

test('accessor input is rejected without invoking the accessor or exposing its source text', () => {
  let getterCalls = 0;
  const value = input();
  Object.defineProperty(value, 'termination', {
    enumerable: true,
    get() {
      getterCalls += 1;
      throw new Error('TOKEN=super-secret /home/runner/private');
    }
  });
  const parsed = assertParserError(parsePhase5ToolResult('hardhat-test-v1', value), 'invalid_object');
  assert.equal(getterCalls, 0);
  assert.match(parsed.parserErrors[0].message, /data properties|plain object|object/i);
});

test('safely testable proxies are rejected with a bounded parser error', () => {
  const proxy = new Proxy(input(), {
    getPrototypeOf() { return { hostile: true }; }
  });
  const parsed = assertParserError(parsePhase5ToolResult('hardhat-test-v1', proxy), 'invalid_object');
  assert.ok(JSON.stringify(parsed).length < 3_000);
});

test('descriptor-trapping and revoked proxies still return bounded parser errors', () => {
  const descriptorTrap = new Proxy(input(), {
    getPrototypeOf() { return Object.prototype; },
    getOwnPropertyDescriptor() { throw new Error('SECRET=super-secret /home/runner/private'); }
  });
  const trapped = parsePhase5ToolResult('hardhat-test-v1', descriptorTrap);
  assert.equal(trapped.classification, 'parser_error');
  assert.equal(trapped.profileId, 'hardhat-test-v1');
  assert.match(trapped.parserErrors[0].message, /\[redacted\]|object/i);
  assert.doesNotMatch(JSON.stringify(trapped), /super-secret|runner/);

  const revocable = Proxy.revocable(input(), {});
  revocable.revoke();
  const revoked = parsePhase5ToolResult('hardhat-test-v1', revocable.proxy);
  assert.equal(revoked.classification, 'parser_error');
  assert.equal(revoked.profileId, 'hardhat-test-v1');
  assert.ok(JSON.stringify(revoked).length < 3_000);
});

test('non-Uint8Array binary-like values and sparse arrays are rejected', () => {
  for (const resultBytes of [{ 0: 123, length: 1 }, [123], new Array(2)]) {
    assertParserError(parsePhase5ToolResult('hardhat-test-v1', input({ resultBytes })), 'invalid_input_bytes');
  }
  class Bytes extends Uint8Array {}
  const accepted = parsePhase5ToolResult('hardhat-test-v1', input({ resultBytes: new Bytes([123, 125]), termination: 'timeout' }));
  assert.equal(accepted.classification, 'timeout');
  assert.equal(accepted.exitCode, null);
});

test('invalid UTF-8 and oversized bytes fail deterministically', () => {
  const invalidUtf8 = parsePhase5ToolResult('hardhat-test-v1', input({ resultBytes: new Uint8Array([0xff, 0xfe]) }));
  assertParserError(invalidUtf8, 'invalid_utf8');
  const oversized = parsePhase5ToolResult('hardhat-test-v1', input({ resultBytes: new Uint8Array(MAX_PHASE5_INPUT_BYTES + 1) }));
  assertParserError(oversized, 'input_too_large');
});

test('negative zero, unsafe integers, and out-of-range metadata are rejected', () => {
  const cases = [
    [input({ durationMs: -0 }), 'invalid_integer'],
    [input({ exitCode: -0 }), 'invalid_integer'],
    [input({ durationMs: Number.MAX_SAFE_INTEGER + 1 }), 'invalid_integer'],
    [input({ durationMs: 86_400_001 }), 'invalid_integer'],
    [input({ exitCode: 256 }), 'invalid_integer'],
    [input({ exitCode: -1 }), 'invalid_integer']
  ];
  for (const [value, code] of cases) assertParserError(parsePhase5ToolResult('hardhat-test-v1', value), code);
});

test('control characters in metadata are rejected', () => {
  assertParserError(parsePhase5ToolResult('hardhat-test-v1', input({ termination: 'time\u0007out' })), 'invalid_string');
});

test('malformed and parser-failure envelopes are accepted for every profile', () => {
  for (const profileId of PROFILES) {
    const malformed = parsePhase5ToolResult(profileId, input({ resultBytes: '{', exitCode: 17, termination: 'completed' }));
    assert.equal(malformed.profileId, profileId);
    assert.equal(malformed.parserVersion, PHASE5_PARSER_VERSIONS[profileId]);
    assert.equal(malformed.classification, 'malformed_output');
    assert.equal(malformed.exitCode, 17);
    assert.deepEqual(validatePhase5ToolResult(malformed), malformed);

    const parserError = parsePhase5ToolResult(profileId, input({ resultBytes: '{}', exitCode: 23, termination: 'completed' }));
    assert.equal(parserError.profileId, profileId);
    assert.equal(parserError.parserVersion, PHASE5_PARSER_VERSIONS[profileId]);
    assert.equal(parserError.classification, 'parser_error');
    assert.equal(parserError.exitCode, 23);
    assert.deepEqual(validatePhase5ToolResult(parserError), parserError);
  }
});

test('terminal envelopes differ across profiles only by identity fields', () => {
  const stripIdentity = ({ profileId, parserVersion, ...rest }) => rest;
  for (const [termination] of TERMINALS) {
    const outputs = PROFILES.map((profileId) => parsePhase5ToolResult(profileId, input({
      termination,
      exitCode: null,
      durationMs: 444,
      resultBytes: 'ignored TOKEN=super-secret /home/runner/private'
    })));
    for (const output of outputs) {
      assert.equal(output.exitCode, null);
      assert.doesNotMatch(JSON.stringify(output), /super-secret|runner|ignored/);
      assert.deepEqual(stripIdentity(output), stripIdentity(outputs[0]));
    }
  }
});

test('unavoidable proxy inspection errors are deterministically redacted', () => {
  const value = new Proxy(input(), {
    getPrototypeOf() { return Object.prototype; },
    ownKeys() { throw new Error('TOKEN=super-secret /home/runner/private C:\\Users\\James\\key.txt'); }
  });
  const parsed = parsePhase5ToolResult('hardhat-test-v1', value);
  assert.equal(parsed.classification, 'parser_error');
  assert.equal(parsed.parserErrors[0].code, 'parser_error');
  assert.match(parsed.parserErrors[0].message, /\[redacted\]/);
  assert.match(parsed.parserErrors[0].message, /\[path\]/);
  assert.doesNotMatch(JSON.stringify(parsed), /super-secret|runner|James|key\.txt/);
});

test('terminal envelopes are byte-identical across replay', () => {
  for (const profileId of PROFILES) {
    for (const [termination] of TERMINALS) {
      const args = input({ termination, durationMs: 77, exitCode: 143 });
      const first = parsePhase5ToolResult(profileId, args);
      const second = parsePhase5ToolResult(profileId, structuredClone(args));
      assert.equal(JSON.stringify(first), JSON.stringify(second));
    }
  }
});
