import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.mjs', import.meta.url), 'utf8');

test('hosted audit adapter uses a dedicated audit-controller GitHub token', () => {
  assert.match(source, /token:\s*env\.AUDIT_CONTROLLER_GITHUB_TOKEN/);
  const adapterBlock = source.slice(source.indexOf('function auditControllerAdapter'), source.indexOf('async function parseAuditCommandBody'));
  assert.doesNotMatch(adapterBlock, /token:\s*env\.GITHUB_TOKEN/);
});

test('contract-automation job dispatch continues to use its existing repository-scoped token', () => {
  const dispatchBlock = source.slice(source.indexOf('async function dispatchGithub'), source.indexOf('async function handleUpload'));
  assert.match(dispatchBlock, /authorization:\s*`Bearer \$\{env\.GITHUB_TOKEN\}`/);
  assert.doesNotMatch(dispatchBlock, /AUDIT_CONTROLLER_GITHUB_TOKEN/);
});
