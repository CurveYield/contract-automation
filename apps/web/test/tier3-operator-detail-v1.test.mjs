import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexUrl = new URL('../public/index.html', import.meta.url);
const appUrl = new URL('../public/app.js', import.meta.url);
const viewUrl = new URL('../src/controller-view-v2.mjs', import.meta.url);
const stylesUrl = new URL('../public/controller-detail-v1.css', import.meta.url);

async function source() {
  const [html, app, view, styles] = await Promise.all([
    readFile(indexUrl, 'utf8'),
    readFile(appUrl, 'utf8'),
    readFile(viewUrl, 'utf8'),
    readFile(stylesUrl, 'utf8'),
  ]);
  return { html, app, view, styles };
}

test('operator UI exposes bounded detail regions for every canonical Tier 3 projection class', async () => {
  const { html, view } = await source();
  const surface = `${html}\n${view}`;
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
    assert.match(surface, new RegExp(id), `missing ${id}`);
  }
  for (const heading of ['Gate', 'Worker', 'Assignment', 'Proof actor', 'Finding', 'Sequence']) {
    assert.match(view, new RegExp(`['\"]${heading}['\"]`), `missing detail heading ${heading}`);
  }
});

test('controller view v2 renders detail model with node creation and never raw HTML', async () => {
  const { app, view } = await source();
  assert.match(view, /controllerDetailModelV1/);
  assert.match(view, /renderControllerDetails/);
  assert.match(view, /document\.createElement\('tr'\)/);
  assert.match(view, /replaceChildren/);
  assert.match(view, /controller-detail-v1\.css/);
  assert.doesNotMatch(`${app}\n${view}`, /\.innerHTML\s*=/);
  assert.doesNotMatch(`${app}\n${view}`, /insertAdjacentHTML/);
});

test('detail table styling remains scrollable and responsive', async () => {
  const { styles } = await source();
  assert.match(styles, /\.detail-section/);
  assert.match(styles, /\.table-wrap/);
  assert.match(styles, /\.operator-table/);
  assert.match(styles, /overflow-x:auto/);
});
