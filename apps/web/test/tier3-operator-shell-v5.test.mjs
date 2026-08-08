import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const publicDir = new URL('../public/', import.meta.url);

test('operator shell v5 exposes session-capability command controls without persistence', async () => {
  const html = await fs.readFile(new URL('index.html', publicDir), 'utf8');
  assert.match(html, /tier3-operator-v5\.js/);
  assert.doesNotMatch(html, /tier3-operator-v4\.js/);
  assert.match(html, /id="controller-authorization-id"/);
  assert.match(html, /id="controller-capability-token"[^>]*type="password"/);
  assert.match(html, /id="controller-command-json"/);
  assert.match(html, /id="controller-submit-command"[^>]*disabled/);
  assert.match(html, /SUBMITTED_TO_CONTROLLER_MAILBOX|Controller command/);
});

test('operator v5 enables publication only for session capability mode and clears capability token', async () => {
  const source = await fs.readFile(new URL('tier3-operator-v5.js', publicDir), 'utf8');
  assert.match(source, /session-capability-mailbox-v1/);
  assert.match(source, /submitControllerCommand/);
  assert.match(source, /controller-capability-token/);
  assert.match(source, /capabilityElement\.value = ''/);
  assert.doesNotMatch(source, /localStorage[^\n]*capabil/i);
  assert.doesNotMatch(source, /sessionStorage[^\n]*capabil/i);
});
