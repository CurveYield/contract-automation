import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { buildDeepAssuranceRunnerManifest } from '../src/deep-assurance-runner-manifest.mjs';

const workflowUrl = new URL('../../../.github/workflows/deep-assurance-github-request-v1.yml', import.meta.url);
const manifestUrl = new URL('../../../github-native-sim/deep-assurance-runner-release-v1.json', import.meta.url);
const repositoryRoot = new URL('../../../', import.meta.url);

async function text(url) {
  return readFile(url, 'utf8');
}

test('Deep Assurance workflow is trusted-release push only and request-path scoped', async () => {
  const workflow = await text(workflowUrl);
  assert.match(workflow, /branches:\s*\n\s*- orchestrator\/round4-ci-base-v1/);
  assert.match(workflow, /github-native-sim\/requests\/\*\/request\.json/);
  assert.doesNotMatch(workflow, /pull_request(?:_target)?:/);
  assert.doesNotMatch(workflow, /repository_dispatch:/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read\s*\n\s*statuses: write/);
  assert.match(workflow, /cancel-in-progress: false/);
});

test('secret-free classifier gates exactly one downstream execution job', async () => {
  const workflow = await text(workflowUrl);
  const classifyStart = workflow.indexOf('  classify:');
  const compileStart = workflow.indexOf('  execute-compile:');
  const simulateStart = workflow.indexOf('  execute-simulate:');
  assert.ok(classifyStart >= 0 && compileStart > classifyStart && simulateStart > compileStart);
  const classifyBlock = workflow.slice(classifyStart, compileStart);
  const compileBlock = workflow.slice(compileStart, simulateStart);
  const simulateBlock = workflow.slice(simulateStart);
  assert.doesNotMatch(classifyBlock, /secrets\.|RPC_ETHEREUM|SIM_ARCHIVE_/);
  assert.match(classifyBlock, /outputs:/);
  assert.match(compileBlock, /needs: classify/);
  assert.match(compileBlock, /needs\.classify\.outputs\.profile_id == 'github-native-compile-v1'/);
  assert.match(simulateBlock, /needs: classify/);
  assert.match(simulateBlock, /needs\.classify\.outputs\.profile_id == 'github-native-simulate-v1'/);
  assert.doesNotMatch(compileBlock, /RPC_ETHEREUM|SIM_ARCHIVE_/);
  assert.match(simulateBlock, /RPC_ETHEREUM/);
  assert.match(simulateBlock, /SIM_ARCHIVE_PRIMARY_ETHEREUM_01/);
});

test('workflow publishes navigational pending and terminal commit statuses', async () => {
  const workflow = await text(workflowUrl);
  assert.match(workflow, /Publish pending request status/);
  assert.equal((workflow.match(/Publish terminal .* request status/g) ?? []).length, 2);
  assert.equal((workflow.match(/publish-deep-assurance-status\.mjs/g) ?? []).length, 3);
  assert.equal((workflow.match(/GITHUB_TOKEN: \$\{\{ github\.token \}\}/g) ?? []).length, 3);
  assert.match(workflow, /--commit "\$GITHUB_SHA"/);
  assert.match(workflow, /--run-id "\$GITHUB_RUN_ID"/);
  assert.match(workflow, /if: always\(\)/);
  assert.doesNotMatch(workflow, /description:.*PASS|description:.*NO_GO/i);
});

test('terminal status publication occurs after evidence upload and propagates execution failure', async () => {
  const workflow = await text(workflowUrl);
  for (const [startMarker, endMarker] of [
    ['  execute-compile:', '  execute-simulate:'],
    ['  execute-simulate:', null],
  ]) {
    const start = workflow.indexOf(startMarker);
    const end = endMarker ? workflow.indexOf(endMarker) : workflow.length;
    const block = workflow.slice(start, end);
    const upload = block.indexOf('Upload normalized');
    const terminal = block.indexOf('Publish terminal');
    assert.ok(upload >= 0 && terminal > upload);
    assert.match(block, /state=failure/);
    assert.match(block, /test "\$state" = success/);
    assert.doesNotMatch(block, /Propagate (compile|simulation) failure/);
  }
});

test('workflow validates an atomic request before dynamic source checkout', async () => {
  const workflow = await text(workflowUrl);
  const selectIndex = workflow.indexOf('Select and validate atomic request');
  const sourceCheckoutIndex = workflow.indexOf('Check out exact audit source');
  assert.ok(selectIndex >= 0);
  assert.ok(sourceCheckoutIndex > selectIndex);
  assert.match(workflow, /git diff --name-only/);
  assert.match(workflow, /expected_runner_manifest_sha256/);
  assert.match(workflow, /persist-credentials: false/g);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /ref: \$\{\{ needs\.classify\.outputs\.source_commit \}\}/);
});

test('workflow uses immutable action revisions and always uploads normalized evidence', async () => {
  const workflow = await text(workflowUrl);
  for (const action of workflow.matchAll(/^\s*uses:\s*([^\s]+)$/gm)) {
    assert.match(action[1], /@[0-9a-f]{40}$/);
  }
  assert.match(workflow, /finalize-deep-assurance-result\.mjs/);
  assert.match(workflow, /deep-assurance-result-v1\.json/);
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /retention-days: 30/);
});

test('runner release manifest binds the exact trusted bridge bytes', async () => {
  const expected = await buildDeepAssuranceRunnerManifest(repositoryRoot);
  let actual;
  try {
    actual = JSON.parse(await text(manifestUrl));
  } catch (cause) {
    assert.fail(`runner release manifest is missing or invalid; expected:\n${JSON.stringify(expected, null, 2)}\n${cause?.message ?? String(cause)}`);
  }
  assert.deepEqual(actual, expected);
});
