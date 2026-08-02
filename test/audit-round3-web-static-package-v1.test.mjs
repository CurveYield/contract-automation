import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (value) => fs.readFileSync(path.join(root, value), 'utf8');

test('versioned static HTML shell loads only local CSS and native ESM entry', () => {
  const html = read('apps/audit-web/index-v1.html');
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /href="\.\/src\/styles\.css"/);
  assert.match(html, /type="module" src="\.\/src\/static-entry-v1\.mjs"/);
  assert.match(html, /id="audit-root"/);
  assert.match(html, /execution-disabled audit application/);
  assert.doesNotMatch(html, /https?:\/\/|<script(?![^>]*src=)[^>]*>/i);
});

test('static browser entry uses injected transport and safe DOM replacement without direct networking', () => {
  const source = read('apps/audit-web/src/static-entry-v1.mjs');
  assert.match(source, /__CURVEYIELD_AUDIT_TRANSPORT__/);
  assert.match(source, /createAuditClient/);
  assert.match(source, /createAuditApp/);
  assert.match(source, /replaceChildren/);
  assert.match(source, /popstate/);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|innerHTML|outerHTML|insertAdjacentHTML|eval\s*\(|new Function/);
});

test('static package inventory has no build-time dependency or production credential file', () => {
  const files = [
    'apps/audit-web/index-v1.html',
    'apps/audit-web/src/static-entry-v1.mjs',
    'apps/audit-web/src/styles.css',
    'apps/audit-web/src/app.mjs',
    'apps/audit-web/src/client.mjs',
    'packages/audit-report-view-model/src/index.mjs',
    'packages/audit-ui-contracts/src/index.mjs',
    'packages/audit-web-compat/src/index-v1.mjs'
  ];
  for (const value of files) assert.equal(fs.existsSync(path.join(root, value)), true, value);
  const combined = files.map(read).join('\n');
  assert.doesNotMatch(combined, /process\.env|\.env\b|private[_-]?key|mnemonic|seed phrase/i);
});
