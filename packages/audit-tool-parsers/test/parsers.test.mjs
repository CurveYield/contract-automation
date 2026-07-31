import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_FINDINGS,
  MAX_INPUT_BYTES,
  MAX_LINES,
  PARSER_VERSIONS,
  parseToolOutput
} from '../src/index.mjs';

function input(resultJson, overrides = {}) {
  return {
    resultJson,
    stdout: 'trusted fixture stdout',
    stderr: '',
    exitCode: 0,
    durationMs: 1234,
    ...overrides
  };
}

test('publishes one parser version per Phase 4 profile and bounded input limits', () => {
  assert.deepEqual(PARSER_VERSIONS, {
    'solidity-compile-v1': 'solidity-compile-parser-v1',
    'foundry-test-v1': 'foundry-test-parser-v1',
    'foundry-fuzz-v1': 'foundry-fuzz-parser-v1',
    'foundry-invariant-v1': 'foundry-invariant-parser-v1',
    'slither-v1': 'slither-parser-v1',
    'coverage-forge-v1': 'coverage-forge-parser-v1'
  });
  assert.equal(MAX_INPUT_BYTES, 5_000_000);
  assert.equal(MAX_LINES, 10_000);
  assert.equal(MAX_FINDINGS, 10_000);
});

test('normalizes Solidity compiler diagnostics with deterministic ordering and deduplication', () => {
  const result = parseToolOutput('solidity-compile-v1', input({
    errors: [
      { severity: 'warning', type: 'Warning', component: 'general', message: 'B', formattedMessage: 'B', sourceLocation: { file: 'B.sol', start: 9, end: 12 } },
      { severity: 'error', type: 'TypeError', component: 'general', message: 'A', formattedMessage: 'A', sourceLocation: { file: 'A.sol', start: 1, end: 3 } },
      { severity: 'error', type: 'TypeError', component: 'general', message: 'A', formattedMessage: 'A', sourceLocation: { file: 'A.sol', start: 1, end: 3 } }
    ],
    contracts: { 'A.sol': { A: {} } }
  }));
  assert.equal(result.schemaVersion, 'tool-result-v1');
  assert.equal(result.profileId, 'solidity-compile-v1');
  assert.equal(result.exitClassification, 'tool_failure');
  assert.deepEqual(result.diagnostics.map((item) => item.severity), ['error', 'warning']);
  assert.equal(result.diagnostics.length, 2);
  assert.deepEqual(result.summary, { contracts: 1, errors: 1, warnings: 1 });
});

test('normalizes Foundry unit tests and stable failure reasons', () => {
  const result = parseToolOutput('foundry-test-v1', input({
    tests: [
      { suite: 'BoostHubTest', name: 'testWithdraw', status: 'failed', durationMs: 10, reason: 'expected 1 got 0' },
      { suite: 'BoostHubTest', name: 'testDeposit', status: 'passed', durationMs: 5 }
    ]
  }, { exitCode: 1 }));
  assert.deepEqual(result.tests.map((item) => item.name), ['testDeposit', 'testWithdraw']);
  assert.deepEqual(result.summary, { passed: 1, failed: 1, skipped: 0, total: 2 });
  assert.equal(result.exitClassification, 'tool_failure');
});

test('normalizes Foundry fuzz counterexamples and invariant failures', () => {
  const fuzz = parseToolOutput('foundry-fuzz-v1', input({
    cases: [{ test: 'testFuzzWithdraw', status: 'failed', runs: 812, seed: 42, counterexample: { amount: '0', user: '0x0000000000000000000000000000000000000001' } }]
  }, { exitCode: 1 }));
  assert.equal(fuzz.counterexamples.length, 1);
  assert.equal(fuzz.counterexamples[0].seed, 42);
  assert.equal(fuzz.summary.failed, 1);

  const invariant = parseToolOutput('foundry-invariant-v1', input({
    invariants: [{ contract: 'Handler', name: 'invariantSolvent', status: 'failed', runs: 256, depth: 64, seed: 7, counterexample: [{ method: 'withdraw', args: ['0'] }] }]
  }, { exitCode: 1 }));
  assert.equal(invariant.invariants.length, 1);
  assert.equal(invariant.invariants[0].name, 'invariantSolvent');
  assert.equal(invariant.summary.failed, 1);
});

test('normalizes Slither findings and source mappings', () => {
  const result = parseToolOutput('slither-v1', input({
    success: true,
    results: {
      detectors: [
        { check: 'reentrancy-eth', impact: 'High', confidence: 'Medium', description: 'External call before state update', elements: [{ source_mapping: { filename_relative: 'contracts/BoostHub.sol', lines: [44, 45] } }] },
        { check: 'uninitialized-state', impact: 'High', confidence: 'High', description: 'State variable not initialized', elements: [{ source_mapping: { filename_relative: 'contracts/Vault.sol', lines: [12] } }] }
      ]
    }
  }));
  assert.equal(result.findings.length, 2);
  assert.deepEqual(result.findings.map((item) => item.detector), ['reentrancy-eth', 'uninitialized-state']);
  assert.deepEqual(result.findings[0].locations[0], { path: 'contracts/BoostHub.sol', lines: [44, 45] });
});

test('normalizes Forge coverage totals and files', () => {
  const result = parseToolOutput('coverage-forge-v1', input({
    files: [
      { path: 'contracts/Vault.sol', lines: { covered: 8, total: 10 }, functions: { covered: 3, total: 4 }, branches: { covered: 2, total: 4 } },
      { path: 'contracts/BoostHub.sol', lines: { covered: 90, total: 100 }, functions: { covered: 18, total: 20 }, branches: { covered: 10, total: 12 } }
    ]
  }));
  assert.deepEqual(result.coverage.files.map((item) => item.path), ['contracts/BoostHub.sol', 'contracts/Vault.sol']);
  assert.deepEqual(result.coverage.totals.lines, { covered: 98, total: 110, percentage: 89.09 });
  assert.equal(result.exitClassification, 'success');
});

test('malformed or oversized inputs return normalized parser errors without leaking internal paths', () => {
  const malformed = parseToolOutput('slither-v1', input('{not-json'));
  assert.equal(malformed.exitClassification, 'parser_error');
  assert.equal(malformed.parserErrors.length, 1);
  assert.doesNotMatch(JSON.stringify(malformed), /\/home\/|C:\\|node_modules/);

  const oversized = parseToolOutput('foundry-test-v1', input({ tests: [] }, { stdout: 'x'.repeat(MAX_INPUT_BYTES + 1) }));
  assert.equal(oversized.exitClassification, 'parser_error');
  assert.equal(oversized.parserErrors[0].code, 'input_too_large');
});

test('bounds lines, findings, strings, durations, and unknown profiles', () => {
  const tooManyLines = parseToolOutput('foundry-test-v1', input({ tests: [] }, { stdout: Array.from({ length: MAX_LINES + 1 }, () => 'x').join('\n') }));
  assert.equal(tooManyLines.parserErrors[0].code, 'too_many_lines');

  assert.throws(() => parseToolOutput('unknown-v1', input({})), /profileId/);
  const badDuration = parseToolOutput('foundry-test-v1', input({ tests: [] }, { durationMs: -1 }));
  assert.equal(badDuration.parserErrors[0].code, 'invalid_duration');
});
