import test from 'node:test';
import assert from 'node:assert/strict';

import { Phase6ValidationError, validateFormalResult, parseHalmosBytes, bytes, emptyResult, oldHalmosCapture } from './hardening-v2-helpers.mjs';

test('P6-R05 redacts message and provenance text without changing formal semantics', () => {
  const privateKey = `0x${'1'.repeat(64)}`;
  const mnemonic = 'seed phrase abandon ability able about above absent absorb abstract absurd abuse access accident';
  const result = validateFormalResult(emptyResult({
    assertions: [{ id: 'assert_1', expression: `owner == ${privateKey}`, description: `private key ${privateKey} ${mnemonic}`, sourceReferenceIds: ['src_1'] }],
    models: [{ id: 'model_1', entries: [{ name: 'secretLikeModel', type: 'bytes32', value: privateKey }] }],
    traces: [{ id: 'trace_1', steps: [{ index: 0, kind: 'other', operation: 'inspect', detail: 'Authorization: Bearer token-value C:\\Users\\alice\\repo\\A.sol', sourceReferenceIds: ['src_1'] }] }],
    diagnostics: [{ code: 'diag_1', severity: 'error', message: 'API_KEY=abc TOKEN=def SECRET=ghi /home/alice/repo/A.sol', sourceReferenceIds: ['src_1'] }],
    sourceReferences: [{ id: 'src_1', sourceId: '/home/alice/repo/A.sol', startLine: 1, startColumn: 0, endLine: 1, endColumn: 1 }]
  }));
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('token-value'), false);
  assert.equal(serialized.includes('/home/alice'), false);
  assert.equal(serialized.includes('C:\\\\Users'), false);
  assert.equal(result.assertions[0].description.includes('[redacted]'), true);
  assert.equal(result.traces[0].steps[0].detail.includes('[path]'), true);
  assert.equal(result.sourceReferences[0].sourceId, '[path]');
  assert.equal(result.assertions[0].expression, `owner == ${privateKey}`);
  assert.equal(result.models[0].entries[0].value, privateKey);

  assert.throws(
    () => validateFormalResult(emptyResult({ models: [{ id: 'model_1', entries: [{ name: 'x', type: 'string', value: 'bad\u0000value' }] }] })),
    (error) => error instanceof Phase6ValidationError && error.code === 'unsafe_control_character'
  );
});

test('P6-R06 capture envelope uses one strict versioned trusted producer identity', () => {
  const accepted = oldHalmosCapture();
  delete accepted.fixtureOwner;
  accepted.trustedProducer = 'curveyield-formal-capture-producer-v1';
  const parsed = parseHalmosBytes(bytes(accepted));
  assert.equal(parsed.outcome, 'unknown');

  const arbitrary = { ...accepted, trustedProducer: 'someone-else' };
  assert.equal(parseHalmosBytes(bytes(arbitrary)).diagnostics[0].code, 'invalid_trusted_producer');

  const legacy = oldHalmosCapture();
  assert.equal(parseHalmosBytes(bytes(legacy)).diagnostics[0].code, 'unknown_field');
});

test('P6-R07 rejects all dangling normalized references deterministically', () => {
  const cases = [
    emptyResult({ obligations: [{ id: 'obl_1', kind: 'assertion', expression: 'x', assertionIds: ['missing_assertion'], sourceReferenceIds: [] }] }),
    emptyResult({ assertions: [{ id: 'assert_1', expression: 'x', description: null, sourceReferenceIds: ['missing_source'] }] }),
    emptyResult({ counterexamples: [{ id: 'cex_1', obligationId: 'missing_obligation', failingAssertionIds: [], modelIds: [], traceIds: [], summary: 'bad' }] }),
    emptyResult({ counterexamples: [{ id: 'cex_1', obligationId: 'obl_1', failingAssertionIds: ['missing_assertion'], modelIds: ['missing_model'], traceIds: ['missing_trace'], summary: 'bad' }], obligations: [{ id: 'obl_1', kind: 'assertion', expression: 'x', assertionIds: [], sourceReferenceIds: [] }] })
  ];
  for (const value of cases) {
    assert.throws(
      () => validateFormalResult(value),
      (error) => error instanceof Phase6ValidationError && error.code === 'dangling_reference'
    );
  }
});
