import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_FINDINGS,
  MAX_INPUT_BYTES,
  MAX_LINES,
  MAX_NESTING_DEPTH,
  MAX_NUMERIC_VALUE,
  MAX_SOURCE_REFERENCES,
  MAX_TEST_CASES,
  MAX_TRACE_ENTRIES,
  PARSER_LIMITS,
  PARSER_VERSIONS,
  TOOL_RESULT_SCHEMA_VERSION,
  parseToolOutput
} from '../src/index.mjs';

function input(resultJson, overrides = {}) {
  const inertResult = resultJson !== null && typeof resultJson === 'object' && !(resultJson instanceof Uint8Array)
    ? JSON.stringify(resultJson)
    : resultJson;
  return {
    resultJson: inertResult,
    stdout: 'CurveYield-owned inert fixture output',
    stderr: '',
    exitCode: 0,
    durationMs: 1234,
    terminationReason: 'completed',
    ...overrides
  };
}

function assertStableShape(result, profileId) {
  assert.equal(result.schemaVersion, TOOL_RESULT_SCHEMA_VERSION);
  assert.equal(result.profileId, profileId);
  assert.equal(typeof result.parserVersion, 'string');
  assert.ok(['success', 'tool_failure', 'timeout', 'cancelled', 'resource_exhaustion', 'parser_error'].includes(result.exitClassification));
  assert.equal(Array.isArray(result.diagnostics), true);
  assert.equal(Array.isArray(result.tests), true);
  assert.equal(Array.isArray(result.counterexamples), true);
  assert.equal(Array.isArray(result.invariants), true);
  assert.equal(Array.isArray(result.findings), true);
  assert.equal(Array.isArray(result.parserWarnings), true);
  assert.equal(Array.isArray(result.parserErrors), true);
}

test('publishes stable Phase 4 parser versions and explicit bounds', () => {
  assert.equal(TOOL_RESULT_SCHEMA_VERSION, 'tool-result-v1');
  assert.deepEqual(PARSER_VERSIONS, {
    'solidity-compile-v1': 'solidity-compile-parser-v1',
    'foundry-test-v1': 'foundry-test-parser-v1',
    'foundry-fuzz-v1': 'foundry-fuzz-parser-v1',
    'foundry-invariant-v1': 'foundry-invariant-parser-v1',
    'slither-v1': 'slither-parser-v1',
    'coverage-forge-v1': 'coverage-forge-parser-v1'
  });
  assert.deepEqual(PARSER_LIMITS, {
    inputBytes: MAX_INPUT_BYTES,
    lines: MAX_LINES,
    findings: MAX_FINDINGS,
    testCases: MAX_TEST_CASES,
    traceEntries: MAX_TRACE_ENTRIES,
    sourceReferences: MAX_SOURCE_REFERENCES,
    stringLength: 4_000,
    numericValue: MAX_NUMERIC_VALUE,
    nestingDepth: MAX_NESTING_DEPTH,
    rawCollectionEntries: 10_000,
    objectFields: 1_000,
    counterexampleBytes: 256_000,
    durationMs: 86_400_000
  });
});

test('regression: compiler diagnostics classify as tool_failure and deterministically deduplicate', () => {
  const result = parseToolOutput('solidity-compile-v1', input({
    errors: [
      { severity: 'warning', type: 'Warning', component: 'general', message: 'B', formattedMessage: 'B', sourceLocation: { file: 'B.sol', start: 9, end: 12 } },
      { severity: 'error', type: 'TypeError', component: 'general', message: 'A', formattedMessage: 'A', sourceLocation: { file: 'A.sol', start: 1, end: 3 } },
      { severity: 'error', type: 'TypeError', component: 'general', message: 'A', formattedMessage: 'A', sourceLocation: { file: 'A.sol', start: 1, end: 3 } }
    ],
    contracts: { 'A.sol': { A: {} } }
  }));
  assertStableShape(result, 'solidity-compile-v1');
  assert.equal(result.exitClassification, 'tool_failure');
  assert.deepEqual(result.diagnostics.map(({ severity, location }) => [severity, location.path]), [['error', 'A.sol'], ['warning', 'B.sol']]);
  assert.deepEqual(result.summary, { contracts: 1, errors: 1, warnings: 1, diagnostics: 2 });
});

test('regression: invalid duration preserves the domain-specific invalid_duration code', () => {
  const result = parseToolOutput('foundry-test-v1', input({ tests: [] }, { durationMs: -1 }));
  assert.equal(result.exitClassification, 'parser_error');
  assert.deepEqual(result.parserErrors, [{ code: 'invalid_duration', message: 'Duration is outside the configured range.', path: '$.durationMs' }]);
});

test('normalizes timeout, cancellation, and resource exhaustion without parsing missing result JSON', () => {
  for (const [terminationReason, exitClassification] of [
    ['timeout', 'timeout'],
    ['cancelled', 'cancelled'],
    ['resource_exhaustion', 'resource_exhaustion']
  ]) {
    const result = parseToolOutput('foundry-test-v1', input(null, { terminationReason, exitCode: null }));
    assertStableShape(result, 'foundry-test-v1');
    assert.equal(result.exitClassification, exitClassification);
    assert.deepEqual(result.summary, { terminationReason });
    assert.equal(result.parserErrors.length, 0);
  }
});

test('normalizes Foundry tests with deterministic sorting, exact deduplication, and bounded truncation', () => {
  const tests = Array.from({ length: MAX_TEST_CASES + 2 }, (_, index) => ({
    suite: index % 2 === 0 ? 'SuiteB' : 'SuiteA',
    name: `test${String(index).padStart(5, '0')}`,
    status: index === 1 ? 'failed' : 'passed',
    durationMs: index,
    reason: index === 1 ? 'synthetic failure' : null
  }));
  tests.push(structuredClone(tests[0]));
  const result = parseToolOutput('foundry-test-v1', input({ tests }, { exitCode: 1 }));
  assert.equal(result.exitClassification, 'tool_failure');
  assert.equal(result.tests.length, MAX_TEST_CASES);
  assert.equal(result.truncated, true);
  assert.deepEqual(result.parserWarnings, [{ code: 'truncated', message: 'Normalized entries were truncated at the configured bound.', path: '$.resultJson.tests', omitted: 2 }]);
  assert.equal(result.summary.total, MAX_TEST_CASES);
  assert.equal(result.summary.failed, 1);
  assert.deepEqual(result.tests, structuredClone(result.tests).sort((a, b) => a.suite.localeCompare(b.suite) || a.name.localeCompare(b.name) || a.status.localeCompare(b.status)));
});

test('normalizes Foundry fuzz counterexamples and bounds trace entries', () => {
  const trace = Array.from({ length: MAX_TRACE_ENTRIES + 3 }, (_, index) => ({
    contract: 'Handler',
    function: 'withdraw',
    arguments: [String(index)],
    result: index % 2 === 0 ? 'ok' : 'revert'
  }));
  const result = parseToolOutput('foundry-fuzz-v1', input({
    cases: [{ test: 'testFuzzWithdraw', status: 'failed', runs: 812, seed: 42, counterexample: { amount: '0' }, trace }]
  }, { exitCode: 1 }));
  assert.equal(result.exitClassification, 'tool_failure');
  assert.equal(result.counterexamples.length, 1);
  assert.equal(result.counterexamples[0].trace.length, MAX_TRACE_ENTRIES);
  assert.equal(result.truncated, true);
  assert.deepEqual(result.parserWarnings, [{ code: 'truncated', message: 'Normalized entries were truncated at the configured bound.', path: '$.resultJson.cases[0].trace', omitted: 3 }]);
});

test('normalizes invariant failures with deterministic counterexamples', () => {
  const result = parseToolOutput('foundry-invariant-v1', input({
    invariants: [
      { contract: 'HandlerB', name: 'invariantSolvent', status: 'passed', runs: 10, depth: 5, seed: 9 },
      { contract: 'HandlerA', name: 'invariantAssets', status: 'failed', runs: 256, depth: 64, seed: 7, counterexample: { sequence: ['deposit', 'withdraw'] }, trace: [] }
    ]
  }, { exitCode: 1 }));
  assert.equal(result.exitClassification, 'tool_failure');
  assert.deepEqual(result.invariants.map((item) => item.contract), ['HandlerA', 'HandlerB']);
  assert.equal(result.counterexamples[0].invariant, 'invariantAssets');
  assert.deepEqual(result.summary, { passed: 1, failed: 1, total: 2 });
});

test('normalizes and deduplicates Slither findings and source references', () => {
  const detector = {
    check: 'reentrancy-eth',
    impact: 'High',
    confidence: 'Medium',
    description: 'External call before state update',
    elements: [
      { source_mapping: { filename_relative: 'contracts/BoostHub.sol', lines: [45, 44, 44] } },
      { source_mapping: { filename_relative: 'contracts/BoostHub.sol', lines: [44, 45] } }
    ]
  };
  const result = parseToolOutput('slither-v1', input({ success: true, results: { detectors: [detector, structuredClone(detector)] } }));
  assert.equal(result.exitClassification, 'success');
  assert.equal(result.findings.length, 1);
  assert.deepEqual(result.findings[0].locations, [{ path: 'contracts/BoostHub.sol', lines: [44, 45] }]);
  assert.deepEqual(result.summary, { findings: 1, high: 1 });
});

test('truncates excessive Slither source references deterministically', () => {
  const elements = Array.from({ length: MAX_SOURCE_REFERENCES + 4 }, (_, index) => ({
    source_mapping: { filename_relative: `contracts/F${String(index).padStart(4, '0')}.sol`, lines: [index + 1] }
  }));
  const result = parseToolOutput('slither-v1', input({
    success: true,
    results: { detectors: [{ check: 'synthetic', impact: 'Low', confidence: 'High', description: 'Synthetic finding', elements }] }
  }));
  assert.equal(result.findings[0].locations.length, MAX_SOURCE_REFERENCES);
  assert.equal(result.truncated, true);
  assert.deepEqual(result.parserWarnings, [{ code: 'truncated', message: 'Normalized entries were truncated at the configured bound.', path: '$.resultJson.results.detectors[0].elements', omitted: 4 }]);
});

test('normalizes Forge coverage, deduplicates identical files, and rejects conflicting duplicates', () => {
  const file = { path: 'contracts/BoostHub.sol', lines: { covered: 90, total: 100 }, functions: { covered: 18, total: 20 }, branches: { covered: 10, total: 12 } };
  const result = parseToolOutput('coverage-forge-v1', input({ files: [file, structuredClone(file)] }));
  assert.equal(result.exitClassification, 'success');
  assert.equal(result.coverage.files.length, 1);
  assert.deepEqual(result.coverage.totals.lines, { covered: 90, total: 100, percentage: 90 });

  const conflicting = parseToolOutput('coverage-forge-v1', input({ files: [file, { ...file, lines: { covered: 91, total: 100 } }] }));
  assert.equal(conflicting.exitClassification, 'parser_error');
  assert.equal(conflicting.parserErrors[0].code, 'conflicting_coverage_file');
});

test('rejects live JavaScript result objects and accepts only inert JSON text or bytes', () => {
  const result = parseToolOutput('foundry-test-v1', {
    resultJson: { tests: [] },
    stdout: '',
    stderr: '',
    exitCode: 0,
    durationMs: 1,
    terminationReason: 'completed'
  });
  assert.deepEqual(result.parserErrors, [{ code: 'invalid_json_value', message: 'Tool result data is not valid bounded JSON.', path: '$.resultJson' }]);
});

test('accepts inert UTF-8 JSON bytes and never executes embedded command-shaped data', () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ tests: [{ suite: 'Safe', name: 'command', status: 'passed', durationMs: 0, reason: 'rm -rf / is inert text' }] }));
  const result = parseToolOutput('foundry-test-v1', input(bytes));
  assert.equal(result.exitClassification, 'success');
  assert.equal(result.tests[0].reason, 'rm -rf / is inert text');
});

test('malformed inputs return stable sanitized parser errors without paths, secrets, stacks, or runtime messages', () => {
  const malformed = parseToolOutput('slither-v1', input('{"secret":"sk_test_NEVER_EXPOSE","path":"/home/runner/private","broken":'));
  assert.equal(malformed.exitClassification, 'parser_error');
  assert.deepEqual(malformed.parserErrors, [{ code: 'invalid_json', message: 'Tool result JSON is malformed.', path: '$.resultJson' }]);
  const serialized = JSON.stringify(malformed);
  assert.doesNotMatch(serialized, /sk_test|\/home\/|C:\\|node_modules|SyntaxError|stack/i);

  const unsafePath = parseToolOutput('solidity-compile-v1', input({ errors: [{ severity: 'error', sourceLocation: { file: '/home/runner/Secret.sol', start: 0, end: 1 }, message: 'x' }], contracts: {} }));
  assert.deepEqual(unsafePath.parserErrors, [{ code: 'unsafe_path', message: 'A source reference was not a safe repository-relative path.', path: '$.resultJson.errors[0].sourceLocation.file' }]);
  assert.doesNotMatch(JSON.stringify(unsafePath), /home|Secret/);
});

test('enforces input byte and line bounds before profile parsing', () => {
  const oversized = parseToolOutput('foundry-test-v1', input({ tests: [] }, { stdout: 'x'.repeat(MAX_INPUT_BYTES + 1) }));
  assert.equal(oversized.parserErrors[0].code, 'input_too_large');
  const tooManyLines = parseToolOutput('foundry-test-v1', input({ tests: [] }, { stdout: Array.from({ length: MAX_LINES + 1 }, () => 'x').join('\n') }));
  assert.equal(tooManyLines.parserErrors[0].code, 'too_many_lines');
});

test('enforces numeric and nesting bounds with stable domain codes', () => {
  const numeric = parseToolOutput('foundry-fuzz-v1', input({ cases: [{ test: 'f', status: 'failed', runs: 1, seed: 1, counterexample: { amount: MAX_NUMERIC_VALUE + 1 } }] }));
  assert.equal(numeric.parserErrors[0].code, 'numeric_out_of_range');

  let nested = 'leaf';
  for (let index = 0; index < MAX_NESTING_DEPTH + 1; index += 1) nested = { child: nested };
  const depth = parseToolOutput('foundry-fuzz-v1', input({ cases: [{ test: 'f', status: 'failed', runs: 1, seed: 1, counterexample: nested }] }));
  assert.equal(depth.parserErrors[0].code, 'data_too_deep');
});

test('rejects unknown envelope fields and unknown profiles deterministically', () => {
  const extra = parseToolOutput('foundry-test-v1', { ...input({ tests: [] }), command: 'forbidden but inert' });
  assert.deepEqual(extra.parserErrors, [{ code: 'unknown_field', message: 'Parser input contains an unsupported field.', path: '$' }]);
  assert.throws(
    () => parseToolOutput('unknown-v1', input({})),
    (error) => error?.name === 'ValidationError' && error?.code === 'unknown_profile_id' && error?.path === '$.profileId'
  );
});

test('failure classification accounts for valid failures omitted by output truncation', () => {
  const compilerDiagnostics = Array.from({ length: MAX_FINDINGS }, (_, index) => ({
    severity: 'warning',
    type: 'Warning',
    component: 'general',
    message: `warning-${String(index).padStart(5, '0')}`,
    sourceLocation: { file: `contracts/A${String(index).padStart(5, '0')}.sol`, start: 0, end: 1 }
  }));
  compilerDiagnostics.push({
    severity: 'error',
    type: 'TypeError',
    component: 'general',
    message: 'omitted-error',
    sourceLocation: { file: 'contracts/Z99999.sol', start: 0, end: 1 }
  });
  const compiler = parseToolOutput('solidity-compile-v1', input({ errors: compilerDiagnostics, contracts: {} }));
  assert.equal(compiler.diagnostics.length, MAX_FINDINGS);
  assert.equal(compiler.exitClassification, 'tool_failure');
  assert.equal(compiler.summary.errors, 1);

  const foundryTests = Array.from({ length: MAX_TEST_CASES }, (_, index) => ({
    suite: 'A',
    name: `test${String(index).padStart(5, '0')}`,
    status: 'passed',
    durationMs: 0
  }));
  foundryTests.push({ suite: 'Z', name: 'zzOmittedFailure', status: 'failed', durationMs: 0, reason: 'synthetic' });
  const unit = parseToolOutput('foundry-test-v1', input({ tests: foundryTests }));
  assert.equal(unit.tests.length, MAX_TEST_CASES);
  assert.equal(unit.exitClassification, 'tool_failure');

  const fuzzCases = Array.from({ length: MAX_TEST_CASES }, (_, index) => ({
    test: `test${String(index).padStart(5, '0')}`,
    status: 'passed',
    runs: 1,
    seed: index
  }));
  fuzzCases.push({ test: 'zzOmittedFailure', status: 'failed', runs: 1, seed: 4294967295 });
  const fuzz = parseToolOutput('foundry-fuzz-v1', input({ cases: fuzzCases }));
  assert.equal(fuzz.tests.length, MAX_TEST_CASES);
  assert.equal(fuzz.exitClassification, 'tool_failure');

  const invariants = Array.from({ length: MAX_TEST_CASES }, (_, index) => ({
    contract: 'A',
    name: `invariant${String(index).padStart(5, '0')}`,
    status: 'passed',
    runs: 1,
    depth: 1,
    seed: index
  }));
  invariants.push({ contract: 'Z', name: 'zzOmittedFailure', status: 'failed', runs: 1, depth: 1, seed: 4294967295 });
  const invariant = parseToolOutput('foundry-invariant-v1', input({ invariants }));
  assert.equal(invariant.invariants.length, MAX_TEST_CASES);
  assert.equal(invariant.exitClassification, 'tool_failure');
});

test('sanitizes user-controlled keys from parser-error paths', () => {
  const unknownSecretKey = 'sk_live_DO_NOT_REFLECT';
  const unknown = parseToolOutput('foundry-test-v1', {
    ...input({ tests: [] }),
    [unknownSecretKey]: true
  });
  assert.deepEqual(unknown.parserErrors, [{
    code: 'unknown_field',
    message: 'Parser input contains an unsupported field.',
    path: '$'
  }]);
  assert.doesNotMatch(JSON.stringify(unknown), /sk_live_DO_NOT_REFLECT/);

  const nested = parseToolOutput('foundry-fuzz-v1', input({
    cases: [{
      test: 'f',
      status: 'failed',
      runs: 1,
      seed: 1,
      counterexample: {
        'github_pat_DO_NOT_REFLECT': 'x'.repeat(PARSER_LIMITS.stringLength + 1)
      }
    }]
  }));
  assert.deepEqual(nested.parserErrors, [{
    code: 'string_too_long',
    message: 'A string exceeded the configured length bound.',
    path: '$.resultJson.cases[0].counterexample.*'
  }]);
  assert.doesNotMatch(JSON.stringify(nested), /github_pat_DO_NOT_REFLECT/);
});

test('preserves reserved JSON keys as inert data and rejects normalization collisions', () => {
  const reserved = parseToolOutput('foundry-fuzz-v1', input(JSON.parse(`{
    "cases": [{
      "test": "reserved",
      "status": "failed",
      "runs": 1,
      "seed": 1,
      "counterexample": {
        "__proto__": {"polluted": true},
        "constructor": "inert"
      }
    }]
  }`)));
  assert.equal(reserved.exitClassification, 'tool_failure');
  const value = reserved.counterexamples[0].value;
  assert.equal(Object.hasOwn(value, '__proto__'), true);
  assert.deepEqual(value.__proto__, { polluted: true });
  assert.equal(value.constructor, 'inert');
  assert.equal({}.polluted, undefined);

  const collision = parseToolOutput('foundry-fuzz-v1', input({
    cases: [{
      test: 'collision',
      status: 'failed',
      runs: 1,
      seed: 1,
      counterexample: {
        safe: 'first',
        'safe\u0000': 'second'
      }
    }]
  }));
  assert.deepEqual(collision.parserErrors, [{
    code: 'duplicate_key',
    message: 'Normalized JSON object keys collide.',
    path: '$.resultJson.cases[0].counterexample.*'
  }]);
});

test('rejects malformed compiler diagnostic field types instead of coercing runtime objects', () => {
  const result = parseToolOutput('solidity-compile-v1', input({
    errors: [{
      severity: 'error',
      type: 'TypeError',
      component: 'general',
      message: { secret: 'must-not-be-stringified' },
      sourceLocation: { file: 'contracts/Safe.sol', start: 0, end: 1 }
    }],
    contracts: {}
  }));
  assert.deepEqual(result.parserErrors, [{
    code: 'invalid_string',
    message: 'A required value was not a string.',
    path: '$.resultJson.errors[0].message'
  }]);
  assert.doesNotMatch(JSON.stringify(result), /must-not-be-stringified|\[object Object\]/);
});
