import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PHASE6_BOUNDS,
  PHASE6_OUTCOMES,
  PHASE6_PROFILE_TEMPLATES,
  Phase6ValidationError,
  publishPhase6Profile,
  validatePhase6ProfileConfiguration,
  validateFormalResult,
  validateProofObligation,
  validateFormalAssertion,
  validateFormalModel,
  validateFormalTrace,
  validateFormalCounterexample,
  validateFormalSourceReference,
  validateParserWarning,
  validateProofOutcome
} from '../src/index.mjs';

const digest = `sha256:${'a'.repeat(64)}`;
const empty = (outcome = 'unknown') => ({
  schemaVersion: 'formal-result-v1', profileId: 'formal-obligations-v1', outcome,
  obligations: [], assertions: [], models: [], traces: [], counterexamples: [],
  diagnostics: [], sourceReferences: [], parserWarnings: [], truncated: false
});

test('templates pin exact versions and remain unpublished, non-runnable, and executor-unavailable', () => {
  assert.deepEqual(Object.keys(PHASE6_PROFILE_TEMPLATES).sort(), ['formal-obligations-v1', 'halmos-v1', 'solidity-smt-v1']);
  assert.equal(PHASE6_PROFILE_TEMPLATES['solidity-smt-v1'].versions.compiler.version, '0.8.30');
  assert.equal(PHASE6_PROFILE_TEMPLATES['solidity-smt-v1'].versions.solver.version, '4.12.6.0');
  assert.equal(PHASE6_PROFILE_TEMPLATES['halmos-v1'].versions.tool.version, '0.3.3');
  assert.equal(PHASE6_PROFILE_TEMPLATES['halmos-v1'].versions.solver.version, '4.12.6.0');
  for (const template of Object.values(PHASE6_PROFILE_TEMPLATES)) {
    assert.equal(template.publication.status, 'unpublished');
    assert.equal(template.publication.imageDigest, null);
    assert.equal(template.runnable, false);
    assert.equal(template.executionEnabled, false);
    assert.equal(template.executor.available, false);
  }
});

test('configuration validation is exact allowlist-only and accepts null-prototype objects', () => {
  const valid = Object.assign(Object.create(null), {
    engine: 'all', solver: 'z3', targets: ['assert', 'overflow'], timeoutMs: 20_000,
    showProvedSafe: true, showUnproved: true, showUnsupported: false
  });
  assert.deepEqual(validatePhase6ProfileConfiguration('solidity-smt-v1', valid).targets, ['assert', 'overflow']);
  assert.throws(
    () => validatePhase6ProfileConfiguration('solidity-smt-v1', { ...valid, extra: true }),
    (error) => error instanceof Phase6ValidationError && error.code === 'unknown_field'
  );
  assert.throws(
    () => validatePhase6ProfileConfiguration('halmos-v1', { solver: 'z3', solverTimeoutMs: 1_000, loopBound: 2, maxPaths: 10, traceEvents: [], controls: { command: 'halmos' } }),
    (error) => error instanceof Phase6ValidationError && error.code === 'forbidden_field'
  );
});

test('publication requires exact keys, immutable digest, and exact template release', () => {
  assert.throws(() => publishPhase6Profile('halmos-v1', { imageDigest: 'latest', releaseIdentifier: 'v0.3.3' }), (error) => error.code === 'invalid_image_digest');
  assert.throws(() => publishPhase6Profile('halmos-v1', { imageDigest: digest }), (error) => error.code === 'missing_field');
  assert.throws(() => publishPhase6Profile('halmos-v1', { imageDigest: digest, releaseIdentifier: 'v0.3.3', extra: true }), (error) => error.code === 'unknown_field');
  const published = publishPhase6Profile('halmos-v1', { imageDigest: digest, releaseIdentifier: 'v0.3.3' });
  assert.equal(published.publication.status, 'published');
  assert.equal(published.publication.imageDigest, digest);
  assert.equal(published.publication.releaseIdentifier, 'v0.3.3');
  assert.equal(published.runnable, false);
  assert.equal(published.executionEnabled, false);
  assert.equal(published.executor.available, false);
  assert.equal(Object.isFrozen(published), true);
});

test('formal result schema supports every outcome and enforces expression bounds', () => {
  assert.deepEqual(PHASE6_OUTCOMES, ['proved', 'disproved', 'unknown', 'timeout', 'resource_exhausted', 'cancelled', 'parser_error']);
  for (const outcome of PHASE6_OUTCOMES) assert.equal(validateFormalResult(empty(outcome)).outcome, outcome);
  const value = empty();
  value.obligations = [{ id: 'obl_1', kind: 'assertion', expression: 'x'.repeat(PHASE6_BOUNDS.symbolicExpressionChars + 1), assertionIds: [], sourceReferenceIds: [] }];
  assert.throws(() => validateFormalResult(value), (error) => error.code === 'string_too_long');
});

test('individual normalized schema validators remain strict and versioned', () => {
  assert.equal(validateFormalSourceReference({ id: 'src_1', sourceId: 'contracts/A.sol', startLine: 1, startColumn: 0, endLine: 1, endColumn: 10 }).id, 'src_1');
  assert.equal(validateFormalAssertion({ id: 'assert_1', expression: 'x > 0', description: 'positive', sourceReferenceIds: ['src_1'] }).id, 'assert_1');
  assert.equal(validateProofObligation({ id: 'obl_1', kind: 'assertion', expression: 'x > 0', assertionIds: ['assert_1'], sourceReferenceIds: ['src_1'] }).id, 'obl_1');
  assert.equal(validateFormalModel({ id: 'model_1', entries: [{ name: 'x', type: 'uint256', value: '1' }] }).id, 'model_1');
  assert.equal(validateFormalTrace({ id: 'trace_1', steps: [{ index: 0, kind: 'assertion', operation: 'assert', detail: 'x > 0', sourceReferenceIds: ['src_1'] }] }).id, 'trace_1');
  assert.equal(validateFormalCounterexample({ id: 'cex_1', obligationId: 'obl_1', failingAssertionIds: ['assert_1'], modelIds: ['model_1'], traceIds: ['trace_1'], summary: 'x is zero' }).id, 'cex_1');
  assert.equal(validateParserWarning({ code: 'bounded_warning', message: 'bounded', path: '$.models' }).code, 'bounded_warning');
  assert.equal(validateProofOutcome(empty('proved')).outcome, 'proved');
});
