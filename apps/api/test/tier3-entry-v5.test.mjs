import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const entryUrl = new URL('../src/entry.mjs', import.meta.url);

test('Worker entry serves Tier 3 compatibility and campaign reads through adapter v5 only', async () => {
  const source = await fs.readFile(entryUrl, 'utf8');
  assert.match(source, /controllerCompatibilityResponseV5/);
  assert.match(source, /controllerProjectionResponseV5/);
  assert.match(source, /tier3-controller-adapter-v5\.mjs/);
  assert.doesNotMatch(source, /controllerCompatibilityResponseV4/);
  assert.doesNotMatch(source, /controllerProjectionResponseV4/);
  assert.doesNotMatch(source, /tier3-controller-adapter-v4\.mjs/);
});
