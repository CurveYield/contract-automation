import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const PUBLIC = new URL('../public/', import.meta.url);
function read(name) { return readFileSync(new URL(name, PUBLIC), 'utf8'); }

test('Lite home links to the Tier 3 audit operator without changing Ethereum/Base scope', () => {
  const html = read('index.html');
  assert.match(html, /href="\.\/audit-v1\.html"/);
  assert.match(html, /value="ethereum"/);
  assert.match(html, /value="base" selected/);
  assert.doesNotMatch(html, /value="katana"|value="arbitrum"|value="polygon"|value="optimism"|value="fraxtal"/i);
});

test('Tier 3 operator page exposes accessible authoritative-state panels and no direct GitHub credential surface', () => {
  const html = read('audit-v1.html');
  for (const id of [
    'audit-connection',
    'audit-project',
    'compatibility-state',
    'campaign-state',
    'preflight-state',
    'gate-state',
    'assignment-state',
    'worker-state',
    'proof-state',
    'finding-state',
    'remediation-state',
    'report-state',
    'publication-state',
    'event-state',
    'audit-live-region',
  ]) assert.match(html, new RegExp(`id="${id}"`), `missing ${id}`);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /GitHub remains authoritative/i);
  assert.match(html, /No private keys/i);
  assert.doesNotMatch(html, /github token|github personal access token|private key|seed phrase/i);
  assert.doesNotMatch(html, /connect wallet|broadcast transaction|sign transaction/i);
});

test('Tier 3 script imports only the authenticated API client and browser state model for controller access', () => {
  const script = read('audit-v1.js');
  assert.match(script, /from '\.\/client\.js'/);
  assert.match(script, /from '\.\/tier3-model-v1\.js'/);
  assert.match(script, /getAuditCompatibility/);
  assert.match(script, /getAuditProject/);
  assert.doesNotMatch(script, /api\.github\.com|github\.com\/repos|authorization:\s*[`'"]Bearer\s+gh/i);
  assert.doesNotMatch(script, /innerHTML\s*=/);
  assert.match(script, /textContent/);
});

test('Tier 3 presentation is responsive and preserves visible keyboard focus', () => {
  const css = read('audit-v1.css');
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\s*\(max-width:/);
  assert.match(css, /overflow-wrap|word-break/);
});

test('build copies the versioned Tier 3 model into the Pages artifact', () => {
  const build = readFileSync(new URL('../../../scripts/build.mjs', import.meta.url), 'utf8');
  assert.match(build, /tier3-model-v1\.mjs/);
  assert.match(build, /tier3-model-v1\.js/);
});
