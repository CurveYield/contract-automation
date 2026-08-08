import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexUrl = new URL('../public/index.html', import.meta.url);
const appUrl = new URL('../public/app.js', import.meta.url);
const stylesUrl = new URL('../public/styles.css', import.meta.url);

async function source() {
  const [html, app, styles] = await Promise.all([
    readFile(indexUrl, 'utf8'),
    readFile(appUrl, 'utf8'),
    readFile(stylesUrl, 'utf8'),
  ]);
  return { html, app, styles };
}

test('operator page exposes bounded detail regions for every canonical Tier 3 projection class', async () => {
  const { html } = await source();
  for (const id of [
    'capability-detail',
    'gate-detail-body',
    'worker-detail-body',
    'assignment-detail-body',
    'proof-detail-body',
    'finding-detail-body',
    'remediation-detail',
    'report-detail',
    'event-detail-body',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
  }
  assert.match(html, /<th scope="col">Gate<\/th>/);
  assert.match(html, /<th scope="col">Worker<\/th>/);
  assert.match(html, /<th scope="col">Assignment<\/th>/);
  assert.match(html, /<th scope="col">Proof actor<\/th>/);
  assert.match(html, /<th scope="col">Finding<\/th>/);
  assert.match(html, /<th scope="col">Sequence<\/th>/);
});

test('operator JavaScript renders detail model with node creation and never raw HTML', async () => {
  const { app } = await source();
  assert.match(app, /controllerDetailModelV1/);
  assert.match(app, /renderControllerDetails/);
  assert.match(app, /document\.createElement\('tr'\)/);
  assert.match(app, /replaceChildren/);
  assert.doesNotMatch(app, /\.innerHTML\s*=/);
  assert.doesNotMatch(app, /insertAdjacentHTML/);
});

test('detail table styling remains scrollable and responsive', async () => {
  const { styles } = await source();
  assert.match(styles, /\.detail-section/);
  assert.match(styles, /\.table-wrap/);
  assert.match(styles, /\.operator-table/);
  assert.match(styles, /overflow-x:auto/);
});
