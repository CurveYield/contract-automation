import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(testDirectory, '..', 'src', 'cli.mjs');

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}

test('prints usage and exits nonzero when required arguments are missing', () => {
  const result = run([]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage: .*--job <job\.json> --output <directory>/);
});

test('rejects unknown arguments', () => {
  const result = run(['--unknown', 'value']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown argument: --unknown/);
});

test('rejects duplicate arguments', () => {
  const result = run(['--job', 'one.json', '--job', 'two.json', '--output', 'out']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Duplicate argument: --job/);
});
