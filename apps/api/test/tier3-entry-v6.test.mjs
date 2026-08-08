import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const entryUrl = new URL('../src/entry.mjs', import.meta.url);

test('Worker entry routes Tier 3 reads and commands through adapter v6 only', async () => {
  const source = await fs.readFile(entryUrl, 'utf8');
  assert.match(source, /controllerCompatibilityResponseV6/);
  assert.match(source, /controllerProjectionResponseV6/);
  assert.match(source, /controllerCommandResponseV6/);
  assert.match(source, /tier3-controller-adapter-v6\.mjs/);
  assert.match(source, /POST/);
  assert.match(source, /controller\/campaigns/);
  assert.match(source, /commands/);
  assert.doesNotMatch(source, /tier3-controller-adapter-v5\.mjs/);
});

test('setup readiness distinguishes Tier 3 read and write configuration', async () => {
  const source = await fs.readFile(entryUrl, 'utf8');
  assert.match(source, /tier3ControllerRead/);
  assert.match(source, /tier3ControllerWrite/);
  assert.match(source, /AUDIT_CONTROLLER_GITHUB_COMMAND_TOKEN/);
});
