import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PHASE4_TOOL_RESULT_DOCUMENTATION,
  PHASE4_TOOL_RESULT_DOCUMENTATION_VERSION,
  serializePhase4ToolResultDocumentation,
  validatePhase4ToolResult
} from '../src/index.mjs';
import { ALL_CANONICAL_RESULTS, assertError } from './test-helpers-v2.mjs';

const expectedTopLevel = ['schemaVersion','profileId','parserVersion','exitClassification','terminationReason','durationMs','exitCode','truncated','diagnostics','tests','counterexamples','invariants','findings','coverage','parserWarnings','parserErrors','summary'];

test('publishes deterministic complete JSON-schema-style documentation', () => {
  assert.equal(PHASE4_TOOL_RESULT_DOCUMENTATION_VERSION, 'phase4-tool-result-documentation-v2');
  assert.equal(PHASE4_TOOL_RESULT_DOCUMENTATION.type, 'object');
  assert.equal(PHASE4_TOOL_RESULT_DOCUMENTATION.additionalProperties, false);
  assert.deepEqual(PHASE4_TOOL_RESULT_DOCUMENTATION.required, expectedTopLevel);
  assert.deepEqual(Object.keys(PHASE4_TOOL_RESULT_DOCUMENTATION.properties), expectedTopLevel);
  assert.equal(Object.keys(PHASE4_TOOL_RESULT_DOCUMENTATION.$defs).length >= 13, true);
  assert.deepEqual(Object.keys(PHASE4_TOOL_RESULT_DOCUMENTATION['x-curveyield-profile-parser-pairs']).sort(), [
    'coverage-forge-v1','foundry-fuzz-v1','foundry-invariant-v1','foundry-test-v1','slither-v1','solidity-compile-v1'
  ]);
  assert.deepEqual(Object.keys(PHASE4_TOOL_RESULT_DOCUMENTATION['x-curveyield-profile-evidence-rules']).sort(), [
    'coverage-forge-v1','foundry-fuzz-v1','foundry-invariant-v1','foundry-test-v1','slither-v1','solidity-compile-v1'
  ]);
});

test('documentation serialization is byte-stable and parses to the frozen contract', () => {
  const first = serializePhase4ToolResultDocumentation();
  const second = serializePhase4ToolResultDocumentation();
  assert.equal(first, second);
  assert.deepEqual(JSON.parse(first), PHASE4_TOOL_RESULT_DOCUMENTATION);
});

test('every documented canonical profile shape validates and remains byte-stable', () => {
  for (const value of ALL_CANONICAL_RESULTS) {
    const first = validatePhase4ToolResult(value);
    const second = validatePhase4ToolResult(value);
    assert.equal(JSON.stringify(first), JSON.stringify(second), value.profileId);
  }
});

test('documented top-level required fields and enums are enforced by runtime', () => {
  const canonical = ALL_CANONICAL_RESULTS[0];
  for (const key of PHASE4_TOOL_RESULT_DOCUMENTATION.required) {
    const value = structuredClone(canonical); delete value[key];
    assertError(assert, () => validatePhase4ToolResult(value), 'missing_field', `$.${key}`);
  }
  for (const [field, allowed] of Object.entries({
    exitClassification: PHASE4_TOOL_RESULT_DOCUMENTATION.properties.exitClassification.enum,
    terminationReason: PHASE4_TOOL_RESULT_DOCUMENTATION.properties.terminationReason.enum
  })) {
    assert.equal(allowed.length > 0, true);
    const value = structuredClone(canonical); value[field] = 'not-allowed';
    assertError(assert, () => validatePhase4ToolResult(value), 'invalid_enum', `$.${field}`);
  }
});

test('documented profile/parser pairings and lifecycle rules are runtime-congruent', () => {
  const pairs = PHASE4_TOOL_RESULT_DOCUMENTATION['x-curveyield-profile-parser-pairs'];
  for (const value of ALL_CANONICAL_RESULTS.filter((item) => item.terminationReason === 'completed')) {
    assert.equal(value.parserVersion, pairs[value.profileId]);
    const substituted = structuredClone(value);
    substituted.parserVersion = pairs[Object.keys(pairs).find((id) => id !== value.profileId)];
    assertError(assert, () => validatePhase4ToolResult(substituted), 'profile_parser_mismatch', '$.parserVersion');
  }
  const mismatch = structuredClone(ALL_CANONICAL_RESULTS[0]); mismatch.terminationReason = 'timeout';
  assertError(assert, () => validatePhase4ToolResult(mismatch), 'lifecycle_mismatch', '$.terminationReason');
});

test('documented runtime bounds exactly match every validator boundary', () => {
  const bounds = PHASE4_TOOL_RESULT_DOCUMENTATION['x-curveyield-runtime-bounds'];
  assert.deepEqual(bounds, {
    findings: 1000,
    tests: 2000,
    counterexamples: 2000,
    invariants: 2000,
    traceEntries: 64,
    sourceReferences: 1000,
    stringLength: 4000,
    pathLength: 1024,
    nameLength: 512,
    categoryLength: 160,
    numericAbsoluteValue: 1000000000000,
    nestingDepth: 12,
    objectFields: 1000,
    counterexampleBytes: 256000,
    durationMs: 86400000,
    coverageValue: 1000000000,
    lineNumber: 10000000,
    seed: 4294967295,
    warnings: 32,
    summaryFields: 32,
    exitCode: 255
  });
  assert.equal(PHASE4_TOOL_RESULT_DOCUMENTATION.properties.diagnostics.maxItems, bounds.findings);
  assert.equal(PHASE4_TOOL_RESULT_DOCUMENTATION.properties.tests.maxItems, bounds.tests);
  assert.equal(PHASE4_TOOL_RESULT_DOCUMENTATION.properties.counterexamples.maxItems, bounds.counterexamples);
  assert.equal(PHASE4_TOOL_RESULT_DOCUMENTATION.$defs.trace.maxItems, bounds.traceEntries);
  assert.equal(PHASE4_TOOL_RESULT_DOCUMENTATION.$defs.safePath.maxLength, bounds.pathLength);
  assert.equal(PHASE4_TOOL_RESULT_DOCUMENTATION.$defs.fuzzTest.properties.seed.maximum, bounds.seed);
  assert.equal(PHASE4_TOOL_RESULT_DOCUMENTATION.$defs.coverageMetric.properties.covered.maximum, bounds.coverageValue);
});

test('every nested evidence definition documents exact keys and closed objects', () => {
  const expected = {
    sourceLocation: ['path', 'start', 'end'],
    diagnostic: ['severity', 'category', 'component', 'message', 'formattedMessage', 'location'],
    unitTest: ['suite', 'name', 'status', 'durationMs', 'reason'],
    fuzzTest: ['test', 'status', 'runs', 'seed'],
    traceEntry: ['contract', 'function', 'arguments', 'result'],
    fuzzCounterexample: ['test', 'seed', 'value', 'trace'],
    invariantCounterexample: ['contract', 'invariant', 'seed', 'value', 'trace'],
    invariant: ['contract', 'name', 'status', 'runs', 'depth', 'seed', 'counterexample', 'trace'],
    sourceReference: ['path', 'lines'],
    finding: ['detector', 'impact', 'confidence', 'description', 'locations'],
    coverageMetric: ['covered', 'total', 'percentage'],
    coverageFile: ['path', 'lines', 'functions', 'branches'],
    coverage: ['files', 'totals'],
    parserWarning: ['code', 'message', 'path', 'omitted'],
    parserError: ['code', 'message', 'path']
  };
  for (const [name, required] of Object.entries(expected)) {
    const definition = PHASE4_TOOL_RESULT_DOCUMENTATION.$defs[name];
    assert.equal(definition.additionalProperties, false, name);
    assert.deepEqual(definition.required, required, name);
    assert.deepEqual(Object.keys(definition.properties), required, name);
  }
});

test('profile-specific evidence documentation exactly matches accepted canonical results', () => {
  const rules = PHASE4_TOOL_RESULT_DOCUMENTATION['x-curveyield-profile-evidence-rules'];
  for (const value of ALL_CANONICAL_RESULTS.filter((item) => ['success', 'tool_failure'].includes(item.exitClassification))) {
    const rule = rules[value.profileId];
    assert.equal(rule.parserVersion, value.parserVersion, value.profileId);
    const requiredSummary = [...rule.summary.required].sort();
    const actualSummary = Object.keys(value.summary).filter((key) => !rule.summary.optional.includes(key)).sort();
    assert.deepEqual(actualSummary, requiredSummary, value.profileId);
    for (const [field, state] of Object.entries(rule.evidence)) {
      if (state === 'empty') assert.deepEqual(value[field], [], `${value.profileId}:${field}`);
      if (state === 'null') assert.equal(value[field], null, `${value.profileId}:${field}`);
      if (state === 'required') assert.notEqual(value[field], null, `${value.profileId}:${field}`);
    }
  }
});

test('all documented terminal lifecycle forms validate and contradictory mutations fail', () => {
  const terminals = ALL_CANONICAL_RESULTS.filter((item) => ['timeout', 'cancelled', 'resource_exhaustion', 'parser_error'].includes(item.exitClassification));
  assert.equal(terminals.length, 4);
  for (const value of terminals) assert.deepEqual(validatePhase4ToolResult(value), value, value.exitClassification);
  for (const value of terminals.filter((item) => item.exitClassification !== 'parser_error')) {
    const changed = structuredClone(value);
    changed.summary = { terminationReason: value.terminationReason, extra: true };
    assertError(assert, () => validatePhase4ToolResult(changed), 'terminal_evidence_present', '$');
  }
});
