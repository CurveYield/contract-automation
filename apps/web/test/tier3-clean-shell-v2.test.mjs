import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const accepted = '2df81aacb6f5747f06b49297e89e02c3f013d4ef';
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');

test('clean v2 leaves every accepted Lite browser source file unchanged', () => {
  execFileSync('git', ['diff', '--exit-code', accepted, '--', 'apps/web/public'], { cwd: root, stdio: 'pipe' });
});

test('Tier 3 root shell is separate from Lite execution and exposes controller-only controls', () => {
  for (const relative of ['apps/web/tier3/index.html', 'apps/web/tier3/app.js', 'apps/web/tier3/styles.css']) {
    assert.equal(existsSync(path.join(root, relative)), true, `${relative} missing`);
  }
  const html = read('apps/web/tier3/index.html');
  assert.match(html, /Deep Assurance/i);
  assert.match(html, /GitHub state is authoritative/i);
  assert.match(html, /href="\.\/execution\/"/);
  assert.match(html, /id="controller-project-slug"/);
  assert.match(html, /id="controller-command-form"/);
  assert.doesNotMatch(html, /id="job-form"|id="compiler-version"|id="workflow"|id="project-file"/);
  assert.doesNotMatch(html, /github-token|issue-number|mailbox-url|controller-branch/i);
});

test('Tier 3 browser talks only to the authenticated API client and renders controller data as text', () => {
  const script = read('apps/web/tier3/app.js');
  assert.match(script, /createApiClient/);
  assert.match(script, /getControllerCompatibility/);
  assert.match(script, /getControllerProject/);
  assert.match(script, /queueControllerCommand/);
  assert.match(script, /textContent/);
  assert.doesNotMatch(script, /innerHTML\s*=/);
  assert.doesNotMatch(script, /api\.github\.com|github\.com\/repos/);
  assert.doesNotMatch(script, /createJob|uploadProject|pollJob|getReport|wallet|signTransaction|sendTransaction/i);
});

test('Tier 3 shell keeps the production API origin and safe no-broadcast statement visible', () => {
  const html = read('apps/web/tier3/index.html');
  assert.match(html, /https:\/\/api\.preflight\.curveyield\.online/);
  assert.match(html, /No private keys/i);
  assert.match(html, /No real transaction broadcasting/i);
});
