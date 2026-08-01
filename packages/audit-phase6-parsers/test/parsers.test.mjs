import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  parseFormalObligationsBytes,
  parseHalmosBytes,
  parseSoliditySmtBytes
} from '../src/index.mjs';

const fixture = (name) => new URL(`../../../test/fixtures/audit-phase6/${name}`, import.meta.url);

test('parsers accept only explicitly supplied inert bytes', () => {
  assert.throws(() => parseSoliditySmtBytes('{"schemaVersion":"solidity-smt-capture-v1"}'), /Uint8Array/);
  assert.throws(() => parseHalmosBytes({}), /Uint8Array/);
});

test('SMT parser handles proof, counterexample, unknown, timeout, resource exhaustion and cancellation fixtures', async () => {
  const names = [
    ['solidity-smt-proof-v1.json', 'proved'],
    ['solidity-smt-counterexample-v1.json', 'disproved'],
    ['solidity-smt-unknown-v1.json', 'unknown'],
    ['solidity-smt-timeout-v1.json', 'timeout'],
    ['solidity-smt-resource-exhausted-v1.json', 'resource_exhausted'],
    ['solidity-smt-cancelled-v1.json', 'cancelled']
  ];
  for (const [name, expected] of names) {
    const result = parseSoliditySmtBytes(await readFile(fixture(name)));
    assert.equal(result.outcome, expected);
    assert.equal(result.profileId, 'solidity-smt-v1');
  }
});

test('Halmos parser normalizes deterministic counterexample models and traces', async () => {
  const result = parseHalmosBytes(await readFile(fixture('halmos-counterexample-v1.json')));
  assert.equal(result.outcome, 'disproved');
  assert.deepEqual(result.models[0].entries.map((entry) => entry.name), ['amount', 'sender']);
  assert.deepEqual(result.traces[0].steps.map((step) => step.index), [0, 1]);
});

test('formal obligations parser normalizes obligations and assertions', async () => {
  const result = parseFormalObligationsBytes(await readFile(fixture('formal-obligations-proof-v1.json')));
  assert.equal(result.outcome, 'proved');
  assert.equal(result.obligations.length, 1);
  assert.equal(result.assertions.length, 1);
});

test('malformed and oversized captures return bounded parser_error results without throwing', async () => {
  const malformed = parseHalmosBytes(await readFile(fixture('halmos-malformed-v1.txt')));
  assert.equal(malformed.outcome, 'parser_error');
  assert.equal(malformed.diagnostics.length, 1);
  assert.equal(malformed.diagnostics[0].message.includes('/mnt/'), false);

  const truncated = parseFormalObligationsBytes(await readFile(fixture('formal-obligations-truncation-v1.json')));
  assert.equal(truncated.truncated, true);
  assert.equal(truncated.parserWarnings.some((warning) => warning.code === 'collection_truncated'), true);

  const oversizedCapture = {
    schemaVersion: 'formal-obligations-capture-v1',
    fixtureOwner: 'CurveYield',
    profileId: 'formal-obligations-v1',
    toolVersion: '1.0.0',
    outcome: 'unknown',
    obligations: [], assertions: [], traces: [], counterexamples: [], diagnostics: [], sourceReferences: [], parserWarnings: [], truncated: false,
    models: [{ id: 'model_generated', entries: Array.from({ length: 257 }, (_, index) => ({ name: `v${index}`, type: 'uint8', value: '0' })) }]
  };
  const oversized = parseFormalObligationsBytes(new TextEncoder().encode(JSON.stringify(oversizedCapture)));
  assert.equal(oversized.models[0].entries.length, 256);
  assert.equal(oversized.truncated, true);
  assert.equal(oversized.parserWarnings.some((warning) => warning.code === 'collection_truncated'), true);
});
