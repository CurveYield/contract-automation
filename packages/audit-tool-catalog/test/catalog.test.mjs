import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getToolProfileCatalogEntry,
  listToolProfileCatalog
} from '../src/index.mjs';

const expectedIds = [
  'solidity-compile-v1',
  'foundry-test-v1',
  'foundry-fuzz-v1',
  'foundry-invariant-v1',
  'slither-v1',
  'coverage-forge-v1'
];

test('catalog exposes exactly six stable ordered Phase 4 entries', () => {
  const entries = listToolProfileCatalog();
  assert.deepEqual(entries.map((item) => item.profileId), expectedIds);
  assert.equal(entries.length, 6);
  for (const entry of entries) {
    assert.equal(entry.schemaVersion, 'tool-profile-catalog-entry-v1');
    assert.equal(entry.publicationState, 'unpublished');
    assert.equal(entry.executionEnabled, false);
    assert.equal(entry.executorState, 'unavailable');
    assert.equal(entry.digestRequired, true);
    assert.equal(entry.resultSchemaVersion, 'tool-result-v1');
    assert.equal(entry.configurationSchema.schemaVersion, 'profile-configuration-schema-v1');
    assert.ok(entry.configurationSchema.fields.length > 0);
  }
});

test('catalog returns exact pinned tools and parser/adapter versions', () => {
  assert.deepEqual(getToolProfileCatalogEntry('solidity-compile-v1').tool, { name: 'solc', version: '0.8.30' });
  assert.deepEqual(getToolProfileCatalogEntry('foundry-test-v1').tool, { name: 'forge', version: '1.7.1' });
  assert.deepEqual(getToolProfileCatalogEntry('slither-v1').tool, { name: 'slither', version: '0.11.5' });
  assert.equal(getToolProfileCatalogEntry('foundry-fuzz-v1').adapterVersion, 'foundry-fuzz-adapter-v1');
  assert.equal(getToolProfileCatalogEntry('foundry-fuzz-v1').parserVersion, 'foundry-fuzz-parser-v1');
});

test('configuration descriptions expose bounded allowlisted fields without executable defaults', () => {
  const fuzz = getToolProfileCatalogEntry('foundry-fuzz-v1').configurationSchema;
  assert.deepEqual(fuzz.fields, [
    { name: 'runs', type: 'integer', required: true, minimum: 1, maximum: 100000 },
    { name: 'seed', type: 'integer', required: true, minimum: 0, maximum: 4294967295 },
    { name: 'dictionaryWeight', type: 'integer', required: true, minimum: 0, maximum: 100 },
    { name: 'includeStorage', type: 'boolean', required: true }
  ]);
  const slither = getToolProfileCatalogEntry('slither-v1').configurationSchema;
  assert.deepEqual(slither.fields[0].allowedValues, [
    'arbitrary-send-eth','controlled-delegatecall','incorrect-equality','naming-convention','reentrancy-eth','reentrancy-no-eth','shadowing-state','suicidal','unchecked-transfer','uninitialized-state'
  ]);
  assert.doesNotMatch(JSON.stringify(listToolProfileCatalog()).toLowerCase(), /"shell"|"command"|"script"|"image"|"url"|"rpc"|"privatekey"|"wallet"|"broadcast"/);
});

test('catalog returns defensive copies and rejects unknown profiles', () => {
  const first = listToolProfileCatalog();
  first[0].configurationSchema.fields[0].name = 'mutated';
  const second = listToolProfileCatalog();
  assert.notEqual(second[0].configurationSchema.fields[0].name, 'mutated');
  assert.throws(() => getToolProfileCatalogEntry('unknown-v1'), /profileId/);
});
