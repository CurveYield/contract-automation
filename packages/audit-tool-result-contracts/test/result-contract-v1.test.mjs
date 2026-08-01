import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PHASE4_RESULT_CONTRACT_SCHEMA_VERSION,
  PHASE4_TOOL_RESULT_CONTRACT_VERSION,
  validatePhase4ToolResult
} from '../src/index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(here, '../../../test/fixtures/audit-phase4');
const snapshots = JSON.parse(fs.readFileSync(path.join(fixtures, 'normalized-snapshots-v1.json'), 'utf8')).results;
const valid = () => structuredClone(snapshots['compiler-success-v1.json']);

function assertCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code, `expected ${code}`);
}

test('publishes the strict Phase 4 result contract version', () => {
  assert.equal(PHASE4_RESULT_CONTRACT_SCHEMA_VERSION, 'tool-result-v1');
  assert.equal(PHASE4_TOOL_RESULT_CONTRACT_VERSION, 'phase4-tool-result-contract-v1');
});

test('accepts all authoritative normalized snapshot results and freezes defensive clones', () => {
  for (const [name, value] of Object.entries(snapshots)) {
    const checked = validatePhase4ToolResult(value);
    assert.deepEqual(checked, value, name);
    assert.notEqual(checked, value, name);
    assert.equal(Object.isFrozen(checked), true, name);
    for (const child of Object.values(checked)) {
      if (child && typeof child === 'object') assert.equal(Object.isFrozen(child), true, `${name} nested`);
    }
  }
});

test('requires exact top-level fields and the exact profile/parser pair', () => {
  const missing = valid();
  delete missing.summary;
  assertCode(() => validatePhase4ToolResult(missing), 'missing_field');
  assertCode(() => validatePhase4ToolResult({ ...valid(), extra: true }), 'unknown_field');
  assertCode(() => validatePhase4ToolResult({ ...valid(), parserVersion: 'slither-parser-v1' }), 'profile_parser_mismatch');
});

test('rejects lifecycle inconsistency and invalid exit-code nullability', () => {
  assertCode(() => validatePhase4ToolResult({ ...valid(), exitClassification: 'success', terminationReason: 'timeout' }), 'lifecycle_mismatch');
  assertCode(() => validatePhase4ToolResult({ ...valid(), exitClassification: 'timeout', terminationReason: 'timeout', exitCode: 0 }), 'invalid_exit_code_state');
  assertCode(() => validatePhase4ToolResult({ ...valid(), exitClassification: 'parser_error', parserErrors: [] }), 'parser_error_cardinality');
  assertCode(() => validatePhase4ToolResult({ ...valid(), parserErrors: [{ code: 'x', message: 'x', path: '$' }] }), 'unexpected_parser_error');
  const timed = structuredClone(snapshots['timeout-v1.json']);
  timed.summary = { terminationReason: 'timeout', files: 1 };
  assertCode(() => validatePhase4ToolResult(timed), 'terminal_evidence_present');
});

test('rejects extra nested fields and custom prototypes recursively', () => {
  const nestedExtra = valid();
  nestedExtra.diagnostics = [{
    severity: 'error', category: 'TypeError', component: 'general', message: 'x', formattedMessage: 'x',
    location: { path: 'contracts/A.sol', start: 0, end: 1, extra: true }
  }];
  assertCode(() => validatePhase4ToolResult(nestedExtra), 'unknown_field');

  const custom = valid();
  custom.summary = Object.create({ inherited: true });
  custom.summary.contracts = 2;
  assertCode(() => validatePhase4ToolResult(custom), 'invalid_plain_object');

  const customArray = valid();
  Object.setPrototypeOf(customArray.tests, { custom: true });
  assertCode(() => validatePhase4ToolResult(customArray), 'invalid_array');
});

test('rejects unsafe repository paths and control characters', () => {
  for (const unsafe of ['/host/A.sol', '../A.sol', 'C:/host/A.sol', 'https://example.invalid/A.sol', 'contracts\\A.sol', 'contracts/\u0001A.sol']) {
    const value = valid();
    value.diagnostics = [{
      severity: 'error', category: 'TypeError', component: 'general', message: 'x', formattedMessage: 'x',
      location: { path: unsafe, start: 0, end: 1 }
    }];
    value.exitClassification = 'tool_failure';
    value.summary = { contracts: 0, errors: 1, warnings: 0, diagnostics: 1 };
    assertCode(() => validatePhase4ToolResult(value), 'unsafe_path');
  }
});

test('enforces trace, collection, string, numeric, summary, and nesting bounds', () => {
  const trace = structuredClone(snapshots['foundry-fuzz-counterexample-v1.json']);
  trace.counterexamples[0].trace = Array.from({ length: 65 }, () => ({ contract: 'H', function: 's', arguments: [], result: null }));
  assertCode(() => validatePhase4ToolResult(trace), 'collection_too_large');

  const string = valid();
  string.summary = { note: 'x'.repeat(4001) };
  assertCode(() => validatePhase4ToolResult(string), 'string_too_long');

  const numeric = valid();
  numeric.summary = { count: 1_000_000_000_001 };
  assertCode(() => validatePhase4ToolResult(numeric), 'numeric_out_of_range');

  const manySummary = valid();
  manySummary.summary = Object.fromEntries(Array.from({ length: 33 }, (_, index) => [`k${index}`, index]));
  assertCode(() => validatePhase4ToolResult(manySummary), 'object_too_large');

  const deep = structuredClone(snapshots['foundry-fuzz-counterexample-v1.json']);
  let cursor = {};
  deep.counterexamples[0].value = cursor;
  for (let index = 0; index < 13; index += 1) { cursor.next = {}; cursor = cursor.next; }
  assertCode(() => validatePhase4ToolResult(deep), 'data_too_deep');
});

test('enforces truncation flag and warning consistency', () => {
  assertCode(() => validatePhase4ToolResult({ ...valid(), truncated: true }), 'truncation_mismatch');
  const value = valid();
  value.parserWarnings = [{ code: 'truncated', message: 'Normalized entries were truncated at the configured bound.', path: '$.tests', omitted: 1 }];
  assertCode(() => validatePhase4ToolResult(value), 'truncation_mismatch');
});

test('rejects noncanonical ordering and exact duplicate normalized entries', () => {
  const reversed = structuredClone(snapshots['compiler-findings-v1.json']);
  reversed.diagnostics.reverse();
  assertCode(() => validatePhase4ToolResult(reversed), 'noncanonical_order');

  const duplicated = structuredClone(snapshots['foundry-test-success-v1.json']);
  duplicated.tests.push(structuredClone(duplicated.tests[0]));
  duplicated.summary = { passed: 2, failed: 0, skipped: 0, total: 2 };
  assertCode(() => validatePhase4ToolResult(duplicated), 'duplicate_entry');
});
