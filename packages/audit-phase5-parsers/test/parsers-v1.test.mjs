import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const moduleUrl = new URL('../src/index.mjs', import.meta.url);
const load = () => import(moduleUrl.href);
const fixtureUrl = (name) => new URL(`../../../test/fixtures/audit-phase5/${name}`, import.meta.url);
const fixture = (name, encoding = null) => readFile(fixtureUrl(name), encoding ? { encoding } : undefined);
const input = (resultBytes, overrides = {}) => ({
  resultBytes,
  exitCode: 0,
  durationMs: 25,
  termination: 'completed',
  ...overrides
});

function assertStableEnvelope(result, profileId, classification) {
  assert.equal(result.schemaVersion, 'phase5-tool-result-v1');
  assert.equal(result.profileId, profileId);
  assert.equal(result.classification, classification);
  assert.equal(Object.isFrozen(result), true);
  assert.ok(Array.isArray(result.hardhatTests));
  assert.ok(Array.isArray(result.echidnaProperties));
  assert.ok(Array.isArray(result.mutationResults));
  assert.ok(Array.isArray(result.dependencyFindings));
  assert.ok(Array.isArray(result.evidence));
  assert.ok(Array.isArray(result.artifacts));
  assert.ok(Array.isArray(result.parserErrors));
}

test('normalizes Hardhat success and findings with deterministic sorting and deduplication', async () => {
  const { parsePhase5ToolResult } = await load();
  const success = parsePhase5ToolResult('hardhat-test-v1', input(await fixture('hardhat-success-v1.json')));
  assertStableEnvelope(success, 'hardhat-test-v1', 'success');
  assert.equal(success.hardhatTests.length, 2);
  assert.equal(success.hardhatTests[0].suite, 'Alpha');
  assert.deepEqual(success.summary, { passed: 2, failed: 0, skipped: 0, total: 2 });

  const findings = parsePhase5ToolResult('hardhat-test-v1', input(await fixture('hardhat-findings-v1.json'), { exitCode: 1 }));
  assertStableEnvelope(findings, 'hardhat-test-v1', 'findings');
  assert.equal(findings.summary.failed, 1);
  assert.equal(findings.hardhatTests[0].errorMessage, 'expected invariant to hold');
});

test('normalizes Echidna properties and bounded counterexamples', async () => {
  const { parsePhase5ToolResult } = await load();
  const success = parsePhase5ToolResult('echidna-v1', input(await fixture('echidna-success-v1.json')));
  assertStableEnvelope(success, 'echidna-v1', 'success');
  assert.equal(success.summary.passed, 2);
  assert.equal(success.summary.seed, 41);

  const findings = parsePhase5ToolResult('echidna-v1', input(await fixture('echidna-findings-v1.json'), { exitCode: 1 }));
  assertStableEnvelope(findings, 'echidna-v1', 'findings');
  assert.equal(findings.summary.failed, 1);
  assert.equal(findings.echidnaProperties.find((item) => item.status === 'failed').counterexample.length, 1);
});

test('normalizes mutation kills, survivors, timeouts, and deterministic mutation score', async () => {
  const { parsePhase5ToolResult } = await load();
  const success = parsePhase5ToolResult('mutation-v1', input(await fixture('mutation-success-v1.json')));
  assertStableEnvelope(success, 'mutation-v1', 'success');
  assert.deepEqual(success.mutationResults.map((item) => item.id), ['mut-001', 'mut-002']);
  assert.equal(success.summary.mutationScore, 100);

  const findings = parsePhase5ToolResult('mutation-v1', input(await fixture('mutation-findings-v1.json')));
  assertStableEnvelope(findings, 'mutation-v1', 'findings');
  assert.deepEqual(findings.summary, { killed: 1, survived: 1, timedOut: 1, invalid: 0, total: 3, mutationScore: 50 });
});

test('normalizes dependency findings with deterministic sorting and deduplication', async () => {
  const { parsePhase5ToolResult } = await load();
  const success = parsePhase5ToolResult('dependency-scan-v1', input(await fixture('dependency-success-v1.json')));
  assertStableEnvelope(success, 'dependency-scan-v1', 'success');
  assert.deepEqual(success.summary, { critical: 0, high: 0, moderate: 0, low: 0, unknown: 0, total: 0 });

  const findings = parsePhase5ToolResult('dependency-scan-v1', input(await fixture('dependency-findings-v1.json'), { exitCode: 1 }));
  assertStableEnvelope(findings, 'dependency-scan-v1', 'findings');
  assert.equal(findings.dependencyFindings.length, 2);
  assert.deepEqual(findings.dependencyFindings.map((item) => item.id), ['OSV-EXAMPLE-1', 'OSV-EXAMPLE-2']);
  assert.equal(findings.summary.high, 1);
  assert.equal(findings.summary.moderate, 1);
});

test('normalizes malformed output, timeout, cancellation, resource exhaustion, and parser errors', async () => {
  const { parsePhase5ToolResult } = await load();
  const malformed = parsePhase5ToolResult('hardhat-test-v1', input(await fixture('malformed-output-v1.txt')));
  assertStableEnvelope(malformed, 'hardhat-test-v1', 'malformed_output');
  assert.deepEqual(malformed.parserErrors, [{ code: 'invalid_json', message: 'Tool result JSON is malformed' }]);

  for (const [file, classification] of [
    ['timeout-v1.json', 'timeout'],
    ['cancellation-v1.json', 'cancelled'],
    ['resource-exhaustion-v1.json', 'resource_exhaustion']
  ]) {
    const data = JSON.parse(await fixture(file, 'utf8'));
    const result = parsePhase5ToolResult('hardhat-test-v1', {
      resultBytes: data.resultJson,
      exitCode: data.exitCode,
      durationMs: data.durationMs,
      termination: data.termination
    });
    assertStableEnvelope(result, 'hardhat-test-v1', classification);
    assert.equal(result.parserErrors.length, 0);
  }

  const parserError = parsePhase5ToolResult('hardhat-test-v1', input(await fixture('parser-error-unsafe-path-v1.json')));
  assertStableEnvelope(parserError, 'hardhat-test-v1', 'parser_error');
  assert.equal(parserError.parserErrors[0].code, 'unsafe_path');
  assert.doesNotMatch(parserError.parserErrors[0].message, /\/mnt\/|stack|secret\.test/);
});

test('bounds inert input bytes and returns a stable parser error without executing content', async () => {
  const { MAX_PHASE5_INPUT_BYTES, parsePhase5ToolResult } = await load();
  const oversized = new Uint8Array(MAX_PHASE5_INPUT_BYTES + 1);
  const result = parsePhase5ToolResult('hardhat-test-v1', input(oversized));
  assertStableEnvelope(result, 'hardhat-test-v1', 'parser_error');
  assert.deepEqual(result.parserErrors, [{ code: 'input_too_large', message: `Tool result exceeds ${MAX_PHASE5_INPUT_BYTES} bytes` }]);

  const unknown = parsePhase5ToolResult('unknown-v1', input('{}'));
  assertStableEnvelope(unknown, 'unknown-v1', 'parser_error');
  assert.equal(unknown.parserErrors[0].code, 'unknown_profile_id');
});
