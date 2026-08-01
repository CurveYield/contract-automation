import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  PHASE6_TRUSTED_PRODUCER,
  parseFormalObligationsBytes,
  parseHalmosBytes,
  parseSoliditySmtBytes
} from '../src/index.mjs';

const fixture = (name) => new URL(`../../../test/fixtures/audit-phase6/${name}`, import.meta.url);
const encode = (value) => new TextEncoder().encode(JSON.stringify(value));
const capture = (profileId, overrides = {}) => {
  const metadata = {
    'solidity-smt-v1': ['solidity-smt-capture-v1', '0.8.30'],
    'halmos-v1': ['halmos-capture-v1', '0.3.3'],
    'formal-obligations-v1': ['formal-obligations-capture-v1', '1.0.0']
  }[profileId];
  return {
    schemaVersion: metadata[0], trustedProducer: PHASE6_TRUSTED_PRODUCER, profileId, toolVersion: metadata[1], outcome: 'unknown',
    obligations: [], assertions: [], models: [], traces: [], counterexamples: [], diagnostics: [], sourceReferences: [], parserWarnings: [], truncated: false,
    ...overrides
  };
};

test('parsers accept only explicitly supplied inert bytes', () => {
  assert.throws(() => parseSoliditySmtBytes('{}'), /Uint8Array/);
  assert.throws(() => parseHalmosBytes({}), /Uint8Array/);
});

test('capture envelope requires exact producer, schema, profile, and tool version', () => {
  assert.equal(parseHalmosBytes(encode({ ...capture('halmos-v1'), trustedProducer: 'arbitrary' })).diagnostics[0].code, 'invalid_trusted_producer');
  assert.equal(parseHalmosBytes(encode({ ...capture('halmos-v1'), toolVersion: '9.9.9' })).diagnostics[0].code, 'invalid_tool_version');
  assert.equal(parseHalmosBytes(encode({ ...capture('halmos-v1'), fixtureOwner: 'CurveYield' })).diagnostics[0].code, 'unknown_field');
});

test('SMT and Halmos fixtures cover every terminal normalized outcome', async () => {
  const expected = [
    ['proof', 'proved'], ['counterexample', 'disproved'], ['unknown', 'unknown'], ['timeout', 'timeout'],
    ['resource_exhausted', 'resource_exhausted'], ['cancelled', 'cancelled']
  ];
  for (const [label, outcome] of expected) {
    assert.equal(parseSoliditySmtBytes(await readFile(fixture(`solidity-smt-${label}-v2.json`))).outcome, outcome);
    assert.equal(parseHalmosBytes(await readFile(fixture(`halmos-${label}-v2.json`))).outcome, outcome);
  }
});

test('counterexample fixtures canonicalize models and traces', async () => {
  const result = parseHalmosBytes(await readFile(fixture('halmos-counterexample-v2.json')));
  assert.equal(result.outcome, 'disproved');
  assert.deepEqual(result.models[0].entries.map(({ name }) => name), ['amount', 'sender']);
  assert.deepEqual(result.traces[0].steps.map(({ index }) => index), [0, 1]);
});

test('formal obligation fixtures cover proof, counterexample, and truncation', async () => {
  assert.equal(parseFormalObligationsBytes(await readFile(fixture('formal-obligations-proof-v2.json'))).outcome, 'proved');
  assert.equal(parseFormalObligationsBytes(await readFile(fixture('formal-obligations-counterexample-v2.json'))).outcome, 'disproved');
  const truncated = parseFormalObligationsBytes(await readFile(fixture('formal-obligations-truncation-v2.json')));
  assert.equal(truncated.truncated, true);
  assert.equal(truncated.models[0].entries.length, 256);
  assert.equal(truncated.parserWarnings.some(({ code }) => code === 'collection_truncated'), true);
});

test('malformed, invalid UTF-8, and oversized inert bytes never throw', async () => {
  const inputs = [
    await readFile(fixture('halmos-malformed-v2.txt')),
    Uint8Array.from([0xff, 0xfe, 0xfd]),
    new Uint8Array(1_048_577)
  ];
  for (const input of inputs) {
    let result;
    assert.doesNotThrow(() => { result = parseHalmosBytes(input); });
    assert.equal(result.outcome, 'parser_error');
  }
});

test('deterministic locally generated malformed inert bytes are bounded and non-throwing', () => {
  let state = 0x12345678;
  for (let caseIndex = 0; caseIndex < 256; caseIndex += 1) {
    const length = 1 + (caseIndex % 257);
    const data = new Uint8Array(length);
    for (let index = 0; index < length; index += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      data[index] = state & 0xff;
    }
    let result;
    assert.doesNotThrow(() => { result = parseSoliditySmtBytes(data); });
    assert.equal(result.outcome, 'parser_error');
    assert.ok(JSON.stringify(result).length < 8_192);
  }
});

test('parser replay and permutation outputs are byte-identical', () => {
  const base = capture('formal-obligations-v1', {
    sourceReferences: [
      { id: 'src_2', sourceId: 'contracts/B.sol', startLine: 2, startColumn: 0, endLine: 2, endColumn: 1 },
      { id: 'src_1', sourceId: 'contracts/A.sol', startLine: 1, startColumn: 0, endLine: 1, endColumn: 1 }
    ],
    assertions: [
      { id: 'assert_2', expression: 'y', description: null, sourceReferenceIds: ['src_2', 'src_1'] },
      { id: 'assert_1', expression: 'x', description: null, sourceReferenceIds: ['src_1'] }
    ],
    obligations: [
      { id: 'obl_2', kind: 'invariant', expression: 'y', assertionIds: ['assert_2'], sourceReferenceIds: ['src_2'] },
      { id: 'obl_1', kind: 'assertion', expression: 'x', assertionIds: ['assert_1'], sourceReferenceIds: ['src_1'] }
    ]
  });
  const permuted = structuredClone(base);
  permuted.sourceReferences.reverse(); permuted.assertions.reverse(); permuted.obligations.reverse();
  for (const item of permuted.assertions) item.sourceReferenceIds.reverse();
  const a = JSON.stringify(parseFormalObligationsBytes(encode(base)));
  const b = JSON.stringify(parseFormalObligationsBytes(encode(permuted)));
  const replay = JSON.stringify(parseFormalObligationsBytes(encode(base)));
  assert.equal(a, b);
  assert.equal(a, replay);
});

test('conflicting duplicates and dangling references become stable parser errors', () => {
  const conflict = capture('formal-obligations-v1', {
    assertions: [
      { id: 'assert_1', expression: 'x', description: null, sourceReferenceIds: [] },
      { id: 'assert_1', expression: 'y', description: null, sourceReferenceIds: [] }
    ]
  });
  const conflictResult = parseFormalObligationsBytes(encode(conflict));
  assert.equal(conflictResult.outcome, 'parser_error');
  assert.equal(conflictResult.diagnostics[0].code, 'conflicting_duplicate');

  const dangling = capture('formal-obligations-v1', {
    obligations: [{ id: 'obl_1', kind: 'assertion', expression: 'x', assertionIds: ['missing'], sourceReferenceIds: [] }]
  });
  const danglingResult = parseFormalObligationsBytes(encode(dangling));
  assert.equal(danglingResult.outcome, 'parser_error');
  assert.equal(danglingResult.diagnostics[0].code, 'dangling_reference');
});


test('duplicates are resolved before truncation and boundary conflicts cannot be hidden', () => {
  const exact = { id: 'src_000', sourceId: 'contracts/A.sol', startLine: 1, startColumn: 0, endLine: 1, endColumn: 1 };
  const unique = Array.from({ length: 4_096 }, (_, index) => ({
    id: `src_${String(index).padStart(4, '0')}`,
    sourceId: `contracts/${index}.sol`,
    startLine: 1,
    startColumn: 0,
    endLine: 1,
    endColumn: 1
  }));
  const duplicateHeavy = capture('formal-obligations-v1', {
    sourceReferences: [exact, structuredClone(exact), ...unique.slice(1)]
  });
  const deduplicated = parseFormalObligationsBytes(encode(duplicateHeavy));
  assert.equal(deduplicated.outcome, 'unknown');
  assert.equal(deduplicated.sourceReferences.length, 4_096);
  assert.equal(deduplicated.parserWarnings.some(({ code }) => code === 'collection_truncated'), false);

  const obligations = Array.from({ length: 256 }, (_, index) => ({
    id: `obl_${String(index).padStart(3, '0')}`,
    kind: 'custom',
    expression: `x_${index}`,
    assertionIds: [],
    sourceReferenceIds: []
  }));
  obligations.push({ ...obligations[255], expression: 'conflicting_boundary_value' });
  const conflict = parseFormalObligationsBytes(encode(capture('formal-obligations-v1', { obligations })));
  assert.equal(conflict.outcome, 'parser_error');
  assert.equal(conflict.diagnostics[0].code, 'conflicting_duplicate');
});

test('fixture inventory is exact and repository-owned', async () => {
  const inventory = JSON.parse(await readFile(fixture('FIXTURE_INVENTORY_v2.json'), 'utf8'));
  assert.equal(inventory.schemaVersion, 'audit-phase6-fixture-inventory-v2');
  assert.equal(inventory.fixtureOwner, 'CurveYield');
  assert.equal(inventory.trustedProducer, PHASE6_TRUSTED_PRODUCER);
  assert.equal(inventory.fileCount, inventory.fixtures.length);
  for (const item of inventory.fixtures) {
    const data = await readFile(fixture(item.file));
    assert.ok(data.byteLength > 0);
    if (item.file.endsWith('.json')) {
      const parsed = JSON.parse(data);
      assert.equal(parsed.trustedProducer, PHASE6_TRUSTED_PRODUCER);
      assert.equal('fixtureOwner' in parsed, false);
    }
  }
});
