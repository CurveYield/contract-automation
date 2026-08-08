import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const workflowUrl = new URL('../../../.github/workflows/deploy.yml', import.meta.url);

test('deployment requires dedicated controller credential without exposing it as a var', async () => {
  const workflow = await fs.readFile(workflowUrl, 'utf8');
  assert.match(workflow, /AUDIT_CONTROLLER_GITHUB_TOKEN:\s*\$\{\{ secrets\.AUDIT_CONTROLLER_GITHUB_TOKEN \}\}/);
  assert.match(workflow, /--arg AUDIT_CONTROLLER_GITHUB_TOKEN "\$AUDIT_CONTROLLER_GITHUB_TOKEN"/);
  assert.doesNotMatch(workflow, /--var\s+"?AUDIT_CONTROLLER_GITHUB_TOKEN/);
});

test('deployment binds Tier 3 to exact protocol and automation releases', async () => {
  const workflow = await fs.readFile(workflowUrl, 'utf8');
  assert.match(workflow, /AUDIT_CONTROLLER_PROTOCOL_SHA:\s*\$\{\{ vars\.AUDIT_CONTROLLER_PROTOCOL_SHA \}\}/);
  assert.match(workflow, /AUDIT_CONTROLLER_STATE_REF:\s*\$\{\{ vars\.AUDIT_CONTROLLER_STATE_REF \}\}/);
  assert.match(workflow, /--var\s+"AUTOMATION_RELEASE_SHA:\$GITHUB_SHA"/);
  assert.match(workflow, /--var\s+"AUDIT_CONTROLLER_PROTOCOL_SHA:\$AUDIT_CONTROLLER_PROTOCOL_SHA"/);
  assert.match(workflow, /--var\s+"AUDIT_CONTROLLER_STATE_REF:\$AUDIT_CONTROLLER_STATE_REF"/);
});
