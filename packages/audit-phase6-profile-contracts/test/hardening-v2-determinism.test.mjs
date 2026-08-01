import test from 'node:test';
import assert from 'node:assert/strict';

import { Phase6ValidationError, validateFormalResult, parseHalmosBytes, bytes, emptyResult, oldHalmosCapture } from './hardening-v2-helpers.mjs';

test('P6-R03 every collection identity has deterministic deduplication and conflict handling', () => {
  const source = { id: 'src_1', sourceId: 'contracts/A.sol', startLine: 1, startColumn: 0, endLine: 1, endColumn: 1 };
  const assertion = { id: 'assert_1', expression: 'x', description: null, sourceReferenceIds: ['src_1'] };
  const obligation = { id: 'obl_1', kind: 'assertion', expression: 'x', assertionIds: ['assert_1'], sourceReferenceIds: ['src_1'] };
  const model = { id: 'model_1', entries: [{ name: 'x', type: 'uint', value: '1' }] };
  const trace = { id: 'trace_1', steps: [{ index: 0, kind: 'call', operation: 'f', detail: null, sourceReferenceIds: ['src_1'] }] };
  const counterexample = { id: 'cex_1', obligationId: 'obl_1', failingAssertionIds: ['assert_1'], modelIds: ['model_1'], traceIds: ['trace_1'], summary: 'failure' };
  const diagnostic = { code: 'diag_1', severity: 'error', message: 'first', sourceReferenceIds: ['src_1'] };
  const warning = { code: 'warn_1', message: 'first', path: '$.models' };
  const base = { sourceReferences: [source], assertions: [assertion], obligations: [obligation], models: [model], traces: [trace], counterexamples: [counterexample] };

  const exactDuplicate = validateFormalResult(emptyResult({
    ...base,
    obligations: [obligation, structuredClone(obligation)],
    assertions: [assertion, structuredClone(assertion)],
    models: [model, structuredClone(model)],
    traces: [trace, structuredClone(trace)],
    counterexamples: [counterexample, structuredClone(counterexample)],
    sourceReferences: [source, structuredClone(source)],
    diagnostics: [diagnostic, structuredClone(diagnostic)],
    parserWarnings: [warning, structuredClone(warning)]
  }));
  for (const field of ['obligations', 'assertions', 'models', 'traces', 'counterexamples', 'sourceReferences', 'diagnostics', 'parserWarnings']) {
    assert.equal(exactDuplicate[field].length, 1, field);
  }

  const conflictCases = [
    { field: 'obligations', first: obligation, second: { ...obligation, expression: 'y' } },
    { field: 'assertions', first: assertion, second: { ...assertion, expression: 'y' } },
    { field: 'models', first: model, second: { ...model, entries: [{ name: 'x', type: 'uint', value: '2' }] } },
    { field: 'traces', first: trace, second: { ...trace, steps: [{ index: 0, kind: 'call', operation: 'g', detail: null, sourceReferenceIds: ['src_1'] }] } },
    { field: 'counterexamples', first: counterexample, second: { ...counterexample, summary: 'other' } },
    { field: 'sourceReferences', first: source, second: { ...source, endColumn: 2 } },
    { field: 'diagnostics', first: diagnostic, second: { ...diagnostic, message: 'second' } },
    { field: 'parserWarnings', first: warning, second: { ...warning, message: 'second' } }
  ];
  for (const { field, first, second } of conflictCases) {
    const value = emptyResult({ ...base, diagnostics: [], parserWarnings: [], [field]: [first, second] });
    assert.throws(
      () => validateFormalResult(value),
      (error) => error instanceof Phase6ValidationError && error.code === 'conflicting_duplicate',
      field
    );
  }
});

test('P6-R03 complete normalized output is byte-identical under permutation and replay', () => {
  const value = emptyResult({
    sourceReferences: [
      { id: 'src_2', sourceId: 'contracts/B.sol', startLine: 2, startColumn: 0, endLine: 2, endColumn: 1 },
      { id: 'src_1', sourceId: 'contracts/A.sol', startLine: 1, startColumn: 0, endLine: 1, endColumn: 1 }
    ],
    assertions: [
      { id: 'assert_2', expression: 'y', description: 'b', sourceReferenceIds: ['src_2', 'src_1'] },
      { id: 'assert_1', expression: 'x', description: 'a', sourceReferenceIds: ['src_1'] }
    ],
    obligations: [
      { id: 'obl_2', kind: 'invariant', expression: 'y', assertionIds: ['assert_2', 'assert_1'], sourceReferenceIds: ['src_2'] },
      { id: 'obl_1', kind: 'assertion', expression: 'x', assertionIds: ['assert_1'], sourceReferenceIds: ['src_1'] }
    ],
    models: [
      { id: 'model_2', entries: [{ name: 'z', type: 'uint', value: '3' }, { name: 'a', type: 'uint', value: '1' }] },
      { id: 'model_1', entries: [{ name: 'x', type: 'uint', value: '2' }] }
    ],
    traces: [
      { id: 'trace_2', steps: [
        { index: 1, kind: 'return', operation: 'b', detail: null, sourceReferenceIds: ['src_2'] },
        { index: 0, kind: 'call', operation: 'a', detail: null, sourceReferenceIds: ['src_1'] }
      ] },
      { id: 'trace_1', steps: [] }
    ],
    counterexamples: [
      { id: 'cex_2', obligationId: 'obl_2', failingAssertionIds: ['assert_2', 'assert_1'], modelIds: ['model_2', 'model_1'], traceIds: ['trace_2'], summary: 'b' },
      { id: 'cex_1', obligationId: 'obl_1', failingAssertionIds: ['assert_1'], modelIds: ['model_1'], traceIds: ['trace_1'], summary: 'a' }
    ],
    diagnostics: [
      { code: 'diag_2', severity: 'warning', message: 'b', sourceReferenceIds: ['src_2'] },
      { code: 'diag_1', severity: 'error', message: 'a', sourceReferenceIds: ['src_1'] }
    ],
    parserWarnings: [
      { code: 'warn_2', message: 'b', path: '$.traces' },
      { code: 'warn_1', message: 'a', path: '$.models' }
    ]
  });
  const permuted = structuredClone(value);
  for (const field of ['sourceReferences', 'assertions', 'obligations', 'models', 'traces', 'counterexamples', 'diagnostics', 'parserWarnings']) permuted[field].reverse();
  for (const assertionItem of permuted.assertions) assertionItem.sourceReferenceIds.reverse();
  for (const obligationItem of permuted.obligations) { obligationItem.assertionIds.reverse(); obligationItem.sourceReferenceIds.reverse(); }
  for (const modelItem of permuted.models) modelItem.entries.reverse();
  for (const traceItem of permuted.traces) traceItem.steps.reverse();
  for (const cex of permuted.counterexamples) { cex.failingAssertionIds.reverse(); cex.modelIds.reverse(); cex.traceIds.reverse(); }
  const a = JSON.stringify(validateFormalResult(value));
  const b = JSON.stringify(validateFormalResult(permuted));
  const replay = JSON.stringify(validateFormalResult(value));
  assert.equal(a, b);
  assert.equal(a, replay);
});

test('P6-R04 sanitizes nested hostile keys and parser output never contains attacker key text', () => {
  const hostileKeys = ['x'.repeat(100_000), 'privateKey', 'SECRET_TOKEN', `bad\u0000field`];
  for (const hostileKey of hostileKeys) {
    const capture = oldHalmosCapture({
      assertions: [{ id: 'assert_1', expression: 'x', description: null, sourceReferenceIds: [], [hostileKey]: true }]
    });
    const result = parseHalmosBytes(bytes(capture));
    assert.equal(result.outcome, 'parser_error');
    assert.equal(result.parserWarnings[0].path, '$.[rejected-field]');
    const output = JSON.stringify(result);
    assert.equal(output.includes(hostileKey.slice(0, 24)), false);
  }
});

test('P6-R05 applies every required deterministic redaction pattern', () => {
  const secret64 = `0x${'a'.repeat(64)}`;
  const message = [
    `private key=${secret64}`,
    'mnemonic abandon ability able about above absent absorb abstract absurd abuse access accident',
    'seed phrase abandon ability able about above absent absorb',
    'api key: api-value',
    'access_key=access-value',
    'Bearer bearer-value',
    'Authorization: auth-value',
    'KEY=key-value TOKEN=token-value SECRET=secret-value',
    '/var/lib/project/contracts/A.sol',
    'C:\\Users\\alice\\project\\A.sol'
  ].join(' | ');
  const result = validateFormalResult(emptyResult({
    diagnostics: [{ code: 'diag_1', severity: 'error', message, sourceReferenceIds: [] }],
    parserWarnings: [{ code: 'warn_1', message, path: '$.diagnostics' }]
  }));
  const output = JSON.stringify(result);
  for (const forbidden of [secret64, 'api-value', 'access-value', 'bearer-value', 'auth-value', 'key-value', 'token-value', 'secret-value', '/var/lib/project', 'C:\\\\Users']) {
    assert.equal(output.includes(forbidden), false, forbidden);
  }
  assert.ok((output.match(/\[redacted\]/g) || []).length >= 8);
  assert.ok((output.match(/\[path\]/g) || []).length >= 2);
});
