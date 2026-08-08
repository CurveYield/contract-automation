import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('root shell exposes protocol and exact state provenance separately', async () => {
  const html = await fs.readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /id="controller-protocol-sha"/);
  assert.match(html, /id="controller-state-ref"/);
  assert.match(html, /id="controller-state-commit"/);
  assert.match(html, /read-only adapter v2/);
  assert.match(html, /tier3-operator-v2\.js/);
  assert.doesNotMatch(html, /tier3-operator-v1\.js/);
});

test('v2 rendering consumes projection envelope and uses textContent only', async () => {
  const script = await fs.readFile(new URL('../public/tier3-operator-v2.js', import.meta.url), 'utf8');
  assert.match(script, /value\.projection/);
  assert.match(script, /controllerStateCommit/);
  assert.match(script, /textContent/);
  assert.doesNotMatch(script, /innerHTML|insertAdjacentHTML/);
});

test('state-changing controller actions remain absent until actor auth is session-bound', async () => {
  const html = await fs.readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /id="submit-controller-command"/);
  assert.match(html, /state-changing controls remain disabled/i);
});
