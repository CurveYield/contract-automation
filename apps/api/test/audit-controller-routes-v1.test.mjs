import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const INDEX_PATH = new URL('../src/index.mjs', import.meta.url);
const source = readFileSync(INDEX_PATH, 'utf8');

test('API worker wires the hosted audit adapter through authenticated v1 routes', () => {
  assert.match(source, /audit-controller-adapter-v1\.mjs/);
  assert.match(source, /GET['"]?\s*&&\s*path\s*===\s*['"]\/api\/v1\/audit\/compatibility['"]/);
  assert.match(source, /\/api\\\/v1\\\/audit\\\/projects\\\/\(\[a-z0-9/);
  assert.match(source, /submitCommand/);
  assert.match(source, /getProject/);
});

test('hosted audit routes use dedicated controller repository configuration and bounded adapter errors', () => {
  assert.match(source, /AUDIT_CONTROLLER_OWNER/);
  assert.match(source, /AUDIT_CONTROLLER_REPO/);
  assert.match(source, /AUDIT_CONTROLLER_REF/);
  assert.match(source, /AUDIT_CONTROLLER_COMMIT/);
  assert.match(source, /AUDIT_CONTROLLER_SKILL_RELEASE/);
  assert.match(source, /AUTOMATION_RELEASE/);
  assert.match(source, /AuditControllerAdapterError/);
  assert.doesNotMatch(source, /GITHUB_OWNER\)\s*,?\s*repo:\s*env\.GITHUB_REPO/);
});

test('hosted audit command route accepts only one top-level command object', () => {
  assert.match(source, /Audit command body may contain only the command field/);
  assert.match(source, /body\.command/);
});
