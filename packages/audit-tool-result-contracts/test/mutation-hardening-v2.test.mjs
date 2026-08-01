import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePhase4ResultForPlan, validatePhase4ToolResult } from '../src/index.mjs';
import {
  ALL_CANONICAL_RESULTS, assertError, canonicalPlan, compilerFailure, compilerSuccess,
  coverageSuccess, foundryTestSuccess, fuzzFailure, invariantFailure, slitherSuccess, timeoutResult
} from './test-helpers-v2.mjs';

function changed(base, apply) {
  const value = structuredClone(base);
  apply(value);
  return value;
}

const resultMutations = [
  ['schema-version', compilerSuccess, (v) => { v.schemaVersion = 'tool-result-v2'; }, 'invalid_schema_version', '$.schemaVersion'],
  ['unknown-profile', compilerSuccess, (v) => { v.profileId = 'unknown-v1'; }, 'unknown_profile_id', '$.profileId'],
  ['parser-substitution', compilerSuccess, (v) => { v.parserVersion = 'slither-parser-v1'; }, 'profile_parser_mismatch', '$.parserVersion'],
  ['classification-enum', compilerSuccess, (v) => { v.exitClassification = 'unknown'; }, 'invalid_enum', '$.exitClassification'],
  ['termination-enum', compilerSuccess, (v) => { v.terminationReason = 'unknown'; }, 'invalid_enum', '$.terminationReason'],
  ['duration-negative', compilerSuccess, (v) => { v.durationMs = -1; }, 'invalid_integer', '$.durationMs'],
  ['duration-overflow', compilerSuccess, (v) => { v.durationMs = 86_400_001; }, 'invalid_integer', '$.durationMs'],
  ['exit-code-overflow', compilerSuccess, (v) => { v.exitCode = 256; }, 'invalid_integer', '$.exitCode'],
  ['truncation-flag', compilerSuccess, (v) => { v.truncated = true; }, 'truncation_mismatch', '$.truncated'],
  ['diagnostics-type', compilerSuccess, (v) => { v.diagnostics = {}; }, 'invalid_array', '$.diagnostics'],
  ['tests-type', compilerSuccess, (v) => { v.tests = {}; }, 'invalid_array', '$.tests'],
  ['counterexamples-type', compilerSuccess, (v) => { v.counterexamples = {}; }, 'invalid_array', '$.counterexamples'],
  ['invariants-type', compilerSuccess, (v) => { v.invariants = {}; }, 'invalid_array', '$.invariants'],
  ['findings-type', compilerSuccess, (v) => { v.findings = {}; }, 'invalid_array', '$.findings'],
  ['unexpected-coverage', compilerSuccess, (v) => { v.coverage = coverageSuccess().coverage; }, 'unexpected_evidence', '$.coverage'],
  ['invalid-warning', compilerSuccess, (v) => { v.parserWarnings = [{ code: 'other', message: 'x', path: '$', omitted: 1 }]; v.truncated = true; }, 'invalid_warning', '$.parserWarnings[0]'],
  ['unexpected-parser-error', compilerSuccess, (v) => { v.parserErrors = [{ code: 'x', message: 'x', path: '$' }]; }, 'unexpected_parser_error', '$.parserErrors'],
  ['summary-missing', compilerSuccess, (v) => { delete v.summary.contracts; }, 'missing_field', '$.summary.contracts'],
  ['diagnostic-severity', compilerFailure, (v) => { v.diagnostics[0].severity = 'fatal'; }, 'invalid_enum', '$.diagnostics[0].severity'],
  ['diagnostic-category-bound', compilerFailure, (v) => { v.diagnostics[0].category = 'x'.repeat(161); }, 'string_too_long', '$.diagnostics[0].category'],
  ['location-end-before-start', compilerFailure, (v) => { v.diagnostics[0].location.end = 0; }, 'invalid_integer', '$.diagnostics[0].location.end'],
  ['unit-status', foundryTestSuccess, (v) => { v.tests[0].status = 'unknown'; }, 'invalid_enum', '$.tests[0].status'],
  ['unit-duration-negative-zero', foundryTestSuccess, (v) => { v.tests[0].durationMs = -0; }, 'noncanonical_number', '$.tests[0].durationMs'],
  ['fuzz-runs-bound', fuzzFailure, (v) => { v.tests[0].runs = 1_000_001; }, 'invalid_integer', '$.tests[0].runs'],
  ['fuzz-seed-bound', fuzzFailure, (v) => { v.tests[0].seed = 4_294_967_296; }, 'invalid_integer', '$.tests[0].seed'],
  ['trace-bound', fuzzFailure, (v) => { v.counterexamples[0].trace = Array.from({ length: 65 }, () => ({ contract: 'H', function: 'f', arguments: [], result: null })); }, 'collection_too_large', '$.counterexamples[0].trace'],
  ['counterexample-byte-bound', fuzzFailure, (v) => { v.counterexamples[0].value = { data: 'x'.repeat(256_001) }; }, 'string_too_long', '$.counterexamples[0].value.*'],
  ['invariant-depth-bound', invariantFailure, (v) => { v.invariants[0].depth = 10_001; }, 'invalid_integer', '$.invariants[0].depth'],
  ['source-lines-order', slitherSuccess, (v) => { v.findings[0].locations[0].lines = [2, 1]; }, 'noncanonical_order', '$.findings[0].locations[0].lines[1]'],
  ['coverage-percentage', coverageSuccess, (v) => { v.coverage.files[0].lines.percentage = 81; }, 'invalid_coverage', '$.coverage.files[0].lines.percentage'],
  ['coverage-totals', coverageSuccess, (v) => { v.coverage.totals.lines.covered = 7; v.coverage.totals.lines.percentage = 70; }, 'invalid_coverage', '$.coverage.totals.lines'],
  ['warning-omitted-zero', compilerSuccess, (v) => { v.parserWarnings = [{ code: 'truncated', message: 'Normalized entries were truncated at the configured bound.', path: '$.tests', omitted: 0 }]; v.truncated = true; }, 'invalid_integer', '$.parserWarnings[0].omitted'],
  ['summary-negative', compilerSuccess, (v) => { v.summary.contracts = -1; }, 'numeric_out_of_range', '$.summary.contracts'],
  ['summary-object', compilerSuccess, (v) => { v.summary.note = {}; }, 'invalid_summary_value', '$.summary.note'],
  ['lifecycle-timeout-classification', timeoutResult, (v) => { v.exitClassification = 'cancelled'; }, 'lifecycle_mismatch', '$.terminationReason'],
  ['lifecycle-timeout-exit-code', timeoutResult, (v) => { v.exitCode = 0; }, 'invalid_exit_code_state', '$.exitCode'],
  ['terminal-evidence', timeoutResult, (v) => { v.diagnostics = compilerFailure().diagnostics; }, 'terminal_evidence_present', '$'],
  ['compiler-success-with-error', compilerFailure, (v) => { v.exitClassification = 'success'; v.exitCode = 0; }, 'classification_mismatch', '$.exitClassification'],
  ['foundry-success-with-failure', foundryTestSuccess, (v) => { v.tests[0].status = 'failed'; v.summary = { passed: 0, failed: 1, skipped: 0, total: 1 }; }, 'classification_mismatch', '$.exitClassification'],
  ['fuzz-counterexample-substitution', fuzzFailure, (v) => { v.counterexamples[0].test = 'different'; }, 'evidence_identity_mismatch', '$.counterexamples[0].test'],
  ['invariant-counterexample-substitution', invariantFailure, (v) => { v.counterexamples[0].invariant = 'different'; }, 'evidence_identity_mismatch', '$.counterexamples[0].invariant']
];

test(`single-field result mutation corpus rejects ${resultMutations.length} invalid variants with stable code/path`, () => {
  for (const [name, make, mutate, code, path] of resultMutations) {
    const value = changed(make(), mutate);
    let caught;
    try { validatePhase4ToolResult(value); } catch (error) { caught = error; }
    assert.ok(caught, `${name}: expected rejection`);
    assert.equal(caught.code, code, `${name}: code`);
    assert.equal(caught.path, path, `${name}: path`);
  }
});

test('canonical valid variants remain byte-stable and recursively frozen', () => {
  for (const value of ALL_CANONICAL_RESULTS) {
    const first = validatePhase4ToolResult(value);
    const second = validatePhase4ToolResult(structuredClone(value));
    assert.equal(JSON.stringify(first), JSON.stringify(second), value.profileId);
    assert.equal(Object.isFrozen(first), true, value.profileId);
  }
});

test('plan/result mutation corpus rejects identity substitution deterministically', () => {
  const result = compilerSuccess();
  const plan = canonicalPlan(result.profileId, result.parserVersion);
  assertError(assert, () => validatePhase4ResultForPlan(changed(plan, (v) => { v.profileIdentity.profileId = 'slither-v1'; }), result), 'plan_result_profile_mismatch', '$.result.profileId');
  assertError(assert, () => validatePhase4ResultForPlan(changed(plan, (v) => { v.parserVersion = 'slither-parser-v1'; }), result), 'plan_result_parser_mismatch', '$.result.parserVersion');
  assertError(assert, () => validatePhase4ResultForPlan(plan, changed(result, (v) => { v.parserVersion = 'slither-parser-v1'; })), 'profile_parser_mismatch', '$.parserVersion');
});
