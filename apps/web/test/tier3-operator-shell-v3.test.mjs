import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('root shell exposes workers assignments and event provenance', async () => {
  const html = await fs.readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  for (const id of ['controller-workers', 'controller-assignments', 'controller-provenance']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /read-only adapter v3/);
  assert.match(html, /tier3-operator-v3\.js/);
});

test('v3 renderer uses complete projection without HTML injection', async () => {
  const script = await fs.readFile(new URL('../public/tier3-operator-v3.js', import.meta.url), 'utf8');
  assert.match(script, /projection\.workers/);
  assert.match(script, /projection\.assignments/);
  assert.match(script, /projection\.provenance/);
  assert.match(script, /textContent/);
  assert.doesNotMatch(script, /innerHTML|insertAdjacentHTML/);
});
