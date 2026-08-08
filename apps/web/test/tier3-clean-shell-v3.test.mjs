import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const accepted = '2df81aacb6f5747f06b49297e89e02c3f013d4ef';
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');

test('current Tier 3 browser still leaves accepted Lite source untouched', () => {
  execFileSync('git', ['diff', '--exit-code', accepted, '--', 'apps/web/public'], { cwd: root, stdio: 'pipe' });
});

test('root app uses current v16.14 view and gates commands on authoritative routing state', () => {
  const script = read('apps/web/tier3/app.js');
  assert.match(script, /assertTier3BrowserCompatibilityV2/);
  assert.match(script, /controllerViewModelV2/);
  assert.match(script, /commandAvailable/);
  assert.match(script, /PHASE0_BOOTSTRAP_FENCED/);
  assert.match(script, /queue-controller-command'\]\.disabled = !commandAvailable/);
  assert.match(script, /if \(!commandAvailable\)/);
  assert.doesNotMatch(script, /assertTier3BrowserCompatibilityV1|controllerViewModelV1/);
  assert.doesNotMatch(script, /innerHTML\s*=|api\.github\.com|github\.com\/repos/);
});

test('root shell remains controller-only and visibly links to accepted execution', () => {
  const html = read('apps/web/tier3/index.html');
  assert.match(html, /href="\.\/execution\/"/);
  assert.match(html, /GitHub state is authoritative/i);
  assert.match(html, /No real transaction broadcasting/i);
  assert.doesNotMatch(html, /id="job-form"|id="compiler-version"|id="workflow"|id="project-file"/);
});
