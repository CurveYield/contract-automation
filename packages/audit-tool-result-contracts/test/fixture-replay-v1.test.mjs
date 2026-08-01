import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseToolOutput } from '../../audit-tool-parsers/src/index.mjs';
import { assertPhase4FixtureInventory, validatePhase4ToolResult } from '../src/index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.resolve(here, '../../../test/fixtures/audit-phase4');
const inventory = Object.freeze([
  'cancellation-v1.json', 'compiler-findings-v1.json', 'compiler-malformed-v1.json', 'compiler-success-v1.json',
  'coverage-success-v1.json', 'foundry-fuzz-counterexample-v1.json', 'foundry-invariant-failure-v1.json',
  'foundry-test-failure-v1.json', 'foundry-test-success-v1.json', 'resource-exhaustion-v1.json',
  'slither-findings-v1.json', 'timeout-v1.json', 'trace-truncation-v1.json', 'unsafe-path-v1.json'
]);
const expectedLifecycle = Object.freeze({
  'compiler-malformed-v1.json': 'parser_error',
  'timeout-v1.json': 'timeout',
  'cancellation-v1.json': 'cancelled',
  'resource-exhaustion-v1.json': 'resource_exhaustion',
  'unsafe-path-v1.json': 'parser_error',
  'trace-truncation-v1.json': 'tool_failure'
});

test('authoritative fixture inventory has no omission or untracked envelope', () => {
  const actual = fs.readdirSync(fixtureDir).filter((name) => name.endsWith('.json') && name !== 'normalized-snapshots-v1.json').sort();
  const checked = assertPhase4FixtureInventory(actual);
  assert.deepEqual(checked.fixtureNames, [...inventory]);
  assert.equal(Object.isFrozen(checked), true);
});

test('rejects omitted and untracked fixture inventory entries deterministically', () => {
  assert.throws(() => assertPhase4FixtureInventory(inventory.slice(1)), (error) => error?.code === 'fixture_inventory_mismatch');
  assert.throws(() => assertPhase4FixtureInventory([...inventory, 'untracked-v1.json']), (error) => error?.code === 'fixture_inventory_mismatch');
});

test('replays every fixture deterministically through the strict result contract', () => {
  const snapshot = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'normalized-snapshots-v1.json'), 'utf8'));
  assert.equal(snapshot.snapshotSchemaVersion, 'audit-phase4-normalized-snapshots-v1');
  assert.deepEqual(Object.keys(snapshot.results).sort(), [...inventory]);
  for (const name of inventory) {
    const fixture = JSON.parse(fs.readFileSync(path.join(fixtureDir, name), 'utf8'));
    assert.equal(fixture.owner, 'CurveYield');
    const first = validatePhase4ToolResult(parseToolOutput(fixture.profileId, fixture.input));
    const second = validatePhase4ToolResult(parseToolOutput(fixture.profileId, fixture.input));
    assert.equal(JSON.stringify(first), JSON.stringify(second), name);
    assert.deepEqual(first, snapshot.results[name], name);
    assert.equal(first.profileId, fixture.profileId, name);
    if (expectedLifecycle[name]) assert.equal(first.exitClassification, expectedLifecycle[name], name);
    if (name === 'trace-truncation-v1.json') assert.equal(first.truncated, true);
  }
});
