import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { parseToolOutput } from '../packages/audit-tool-parsers/src/index.mjs';
import { validatePhase4ToolResult } from '../packages/audit-tool-result-contracts/src/index.mjs';

const FIXTURE_DIR = new URL('./fixtures/audit-phase4/', import.meta.url);
const EXPECTED_INPUTS = Object.freeze([
  'cancellation-v1.json',
  'compiler-findings-v1.json',
  'compiler-malformed-v1.json',
  'compiler-success-v1.json',
  'coverage-success-v1.json',
  'foundry-fuzz-counterexample-v1.json',
  'foundry-invariant-failure-v1.json',
  'foundry-test-failure-v1.json',
  'foundry-test-success-v1.json',
  'resource-exhaustion-v1.json',
  'slither-findings-v1.json',
  'timeout-v1.json',
  'trace-truncation-v1.json',
  'unsafe-path-v1.json'
]);

async function readJson(name) {
  return JSON.parse(await readFile(new URL(name, FIXTURE_DIR), 'utf8'));
}

function assertFixtureInventory(files, snapshotKeys) {
  const expectedFiles = ['README_v1.md', ...EXPECTED_INPUTS, 'normalized-snapshots-v1.json'].sort();
  assert.deepEqual([...files].sort(), expectedFiles, 'fixture file inventory drift');
  assert.deepEqual([...snapshotKeys].sort(), [...EXPECTED_INPUTS].sort(), 'snapshot inventory drift');
}

test('fixture inventory is exact and no normalized snapshot entry is silently omitted', async () => {
  const files = await readdir(FIXTURE_DIR);
  const snapshots = await readJson('normalized-snapshots-v1.json');
  assert.equal(snapshots.snapshotSchemaVersion, 'audit-phase4-normalized-snapshots-v1');
  assertFixtureInventory(files, Object.keys(snapshots.results));
});

test('every CurveYield-owned fixture replays deterministically and validates against its committed snapshot', async () => {
  const snapshots = (await readJson('normalized-snapshots-v1.json')).results;
  for (const name of EXPECTED_INPUTS) {
    const fixture = await readJson(name);
    assert.equal(fixture.owner, 'CurveYield');
    const first = parseToolOutput(fixture.profileId, fixture.input);
    const second = parseToolOutput(fixture.profileId, fixture.input);
    assert.equal(JSON.stringify(first), JSON.stringify(second), name);
    assert.deepEqual(first, snapshots[name], name);
    assert.deepEqual(validatePhase4ToolResult(first), first, name);
    assert.equal(first.profileId, fixture.profileId, name);
  }
});

test('malformed and terminal fixtures preserve exact lifecycle classifications', async () => {
  const expected = {
    'cancellation-v1.json': 'cancelled',
    'compiler-malformed-v1.json': 'parser_error',
    'resource-exhaustion-v1.json': 'resource_exhaustion',
    'timeout-v1.json': 'timeout',
    'trace-truncation-v1.json': 'tool_failure',
    'unsafe-path-v1.json': 'parser_error'
  };
  for (const [name, classification] of Object.entries(expected)) {
    const fixture = await readJson(name);
    const result = validatePhase4ToolResult(parseToolOutput(fixture.profileId, fixture.input));
    assert.equal(result.exitClassification, classification, name);
  }
  const trace = validatePhase4ToolResult(parseToolOutput(
    (await readJson('trace-truncation-v1.json')).profileId,
    (await readJson('trace-truncation-v1.json')).input
  ));
  assert.equal(trace.truncated, true);
  assert.deepEqual(trace.parserWarnings, [{
    code: 'truncated',
    message: 'Normalized entries were truncated at the configured bound.',
    path: '$.resultJson.cases[0].trace',
    omitted: 2
  }]);
});

test('inventory drift is detected when a fixture or snapshot entry is missing', async () => {
  const files = await readdir(FIXTURE_DIR);
  const snapshotKeys = Object.keys((await readJson('normalized-snapshots-v1.json')).results);
  assert.throws(() => assertFixtureInventory(files.filter((name) => name !== 'compiler-success-v1.json'), snapshotKeys), /fixture file inventory drift/);
  assert.throws(() => assertFixtureInventory(files, snapshotKeys.filter((name) => name !== 'compiler-success-v1.json')), /snapshot inventory drift/);
});
