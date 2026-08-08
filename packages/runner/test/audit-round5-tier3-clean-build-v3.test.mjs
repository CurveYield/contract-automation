import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function filesBelow(directory, prefix = '') {
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...filesBelow(absolute, relative));
    else output.push(relative);
  }
  return output.sort();
}
function sameFile(left, right) { assert.deepEqual(fs.readFileSync(left), fs.readFileSync(right), `${left} differs from ${right}`); }

test('v3 build preserves accepted Lite and publishes current controller browser modules', () => {
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: root, stdio: 'pipe' });
  const publicDir = path.join(root, 'apps/web/public');
  const executionDir = path.join(root, 'dist/web/execution');
  const tier3Dir = path.join(root, 'apps/web/tier3');
  const output = path.join(root, 'dist/web');
  for (const relative of filesBelow(publicDir)) sameFile(path.join(publicDir, relative), path.join(executionDir, relative));
  for (const relative of filesBelow(tier3Dir)) sameFile(path.join(tier3Dir, relative), path.join(output, relative));
  sameFile(path.join(root, 'apps/web/src/client.mjs'), path.join(executionDir, 'client.js'));
  sameFile(path.join(root, 'apps/web/src/client.mjs'), path.join(output, 'client.js'));
  sameFile(path.join(root, 'apps/web/src/controller-view-v3.mjs'), path.join(output, 'controller-view.js'));
  sameFile(path.join(root, 'apps/web/src/controller-detail-model-v2.mjs'), path.join(output, 'controller-detail-model-v2.mjs'));
  assert.equal(fs.existsSync(path.join(output, 'controller-detail-model-v1.mjs')), false);
  const rootHtml = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
  const executionHtml = fs.readFileSync(path.join(executionDir, 'index.html'), 'utf8');
  assert.match(rootHtml, /Deep Assurance/i);
  assert.match(executionHtml, /PreflightSim Lite/);
  assert.match(executionHtml, /<option value="base" selected>Base<\/option>/);
});
