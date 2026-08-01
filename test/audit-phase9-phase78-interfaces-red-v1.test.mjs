import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const map = JSON.parse(await readFile(new URL('./fixtures/audit-phase9-phase78/module-interface-map-v1.json', import.meta.url), 'utf8'));
for (const entry of map.packages) {
  test(`${entry.path} exposes the Phase 9 interface contract`, async () => {
    const module = await import(new URL(`../${entry.path}`, import.meta.url));
    for (const name of entry.exports) assert.equal(typeof module[name], 'function', `${name} missing`);
  });
}
