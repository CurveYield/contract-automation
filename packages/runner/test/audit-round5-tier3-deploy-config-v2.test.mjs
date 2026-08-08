import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const workflowUrl = new URL('../../../.github/workflows/deploy.yml', import.meta.url);

test('deployment requires separate read and command controller credentials', async () => {
  const workflow = await fs.readFile(workflowUrl, 'utf8');
  assert.match(workflow, /AUDIT_CONTROLLER_GITHUB_TOKEN:\s*\$\{\{ secrets\.AUDIT_CONTROLLER_GITHUB_TOKEN \}\}/);
  assert.match(workflow, /AUDIT_CONTROLLER_GITHUB_COMMAND_TOKEN:\s*\$\{\{ secrets\.AUDIT_CONTROLLER_GITHUB_COMMAND_TOKEN \}\}/);
  assert.match(workflow, /--arg AUDIT_CONTROLLER_GITHUB_TOKEN "\$AUDIT_CONTROLLER_GITHUB_TOKEN"/);
  assert.match(workflow, /--arg AUDIT_CONTROLLER_GITHUB_COMMAND_TOKEN "\$AUDIT_CONTROLLER_GITHUB_COMMAND_TOKEN"/);
  assert.match(workflow, /AUDIT_CONTROLLER_GITHUB_COMMAND_TOKEN:\$AUDIT_CONTROLLER_GITHUB_COMMAND_TOKEN/);
  assert.doesNotMatch(workflow, /--var\s+"?AUDIT_CONTROLLER_GITHUB_(?:COMMAND_)?TOKEN/);
});

test('deployment preflight requires command credential by name without printing its value', async () => {
  const workflow = await fs.readFile(workflowUrl, 'utf8');
  const preflight = workflow.match(/missing=\(\)([\s\S]*?)if \(\( \$\{#missing\[@\]\} > 0 \)\)/)?.[1] ?? '';
  assert.match(preflight, /AUDIT_CONTROLLER_GITHUB_COMMAND_TOKEN/);
});
