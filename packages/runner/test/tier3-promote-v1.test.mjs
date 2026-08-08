import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(new URL('../../../.github/workflows/promote-tier3-v1.yml', import.meta.url), 'utf8');

test('promotion is manual-only and exact clean-v2 source gated', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\n\s+push:/);
  assert.doesNotMatch(workflow, /\n\s+pull_request:/);
  assert.match(workflow, /audit-round5\/tier3-controller-ui-v2/);
  assert.match(workflow, /PROMOTE_TIER3_V2/);
  assert.match(workflow, /inputs\.expected_sha.*GITHUB_SHA/);
});

test('promotion requires stable final PASS receipt for the exact feature SHA', () => {
  const receipt = workflow.indexOf('Require exact final PASS receipt for feature SHA');
  const compare = workflow.indexOf('Prove release branch can fast-forward exactly to verified SHA');
  assert.equal(receipt >= 0 && compare > receipt, true);
  assert.match(workflow, /CURVEYIELD_TIER3_FINAL_RECEIPT/);
  assert.match(workflow, /contains\("- result: `PASS`"\)/);
  assert.match(workflow, /contains\("- source SHA: `" \+ \$sha \+ "`"\)/);
});

test('promotion rejects divergence and updates release without force', () => {
  assert.match(workflow, /test "\$status" = ahead/);
  assert.match(workflow, /test "\$behind" = 0/);
  assert.match(workflow, /test "\$ahead" -gt 0/);
  assert.match(workflow, /orchestrator\/round4-ci-base-v1/);
  assert.match(workflow, /-F force=false/);
  assert.doesNotMatch(workflow, /force=true/);
});

test('promotion performs no install, build, compiler, Cloudflare deploy, or controller command', () => {
  assert.doesNotMatch(workflow, /npm (install|ci)|pnpm|yarn|forge|hardhat|solc|wrangler/);
  assert.doesNotMatch(workflow, /AUDIT_CONTROLLER_GITHUB_TOKEN|CURVEYIELD_AUDIT_COMMAND_V1/);
  assert.match(workflow, /does not deploy Cloudflare/);
});
