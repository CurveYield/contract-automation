import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.mjs', import.meta.url), 'utf8');

test('API worker configures the trusted hosted controller intake issue without exposing it as browser input', () => {
  assert.match(source, /AUDIT_CONTROLLER_INTAKE_ISSUE/);
  assert.match(source, /intakeIssueNumber/);
  assert.match(source, /Number\(env\.AUDIT_CONTROLLER_INTAKE_ISSUE/);
});

test('API worker exposes an authenticated inactive-campaign create route through submitCampaignCreate', () => {
  assert.match(source, /submitCampaignCreate/);
  assert.match(source, /\/api\\\/v1\\\/audit\\\/projects\\\/\(\[a-z0-9[^\n]+\\\/campaigns/);
  assert.match(source, /request\.method === 'POST'/);
});
