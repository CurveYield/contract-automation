import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflowUrl = new URL('../../../.github/workflows/deploy.yml', import.meta.url);

test('production deploy requires and uploads a dedicated audit-controller GitHub token', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');

  assert.match(
    workflow,
    /PREFLIGHTSIM_AUDIT_CONTROLLER_GITHUB_TOKEN:\s*\$\{\{\s*secrets\.PREFLIGHTSIM_AUDIT_CONTROLLER_GITHUB_TOKEN\s*\}\}/,
  );
  assert.match(
    workflow,
    /for name in[\s\S]*PREFLIGHTSIM_AUDIT_CONTROLLER_GITHUB_TOKEN \\[\s\S]*PREFLIGHTSIM_ALLOWED_GITHUB_USERS; do/,
  );
  assert.match(
    workflow,
    /--arg AUDIT_CONTROLLER_GITHUB_TOKEN "\$PREFLIGHTSIM_AUDIT_CONTROLLER_GITHUB_TOKEN"/,
  );
  assert.match(
    workflow,
    /AUDIT_CONTROLLER_GITHUB_TOKEN:\$AUDIT_CONTROLLER_GITHUB_TOKEN/,
  );
  assert.doesNotMatch(workflow, /AUDIT_CONTROLLER_GITHUB_TOKEN:\s*[^$\s][^\n]*/);
});
