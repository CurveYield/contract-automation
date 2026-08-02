import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const V27_WORKFLOW = '.github/workflows/v27-full-live-fork.yml';
const WORKFLOWS = [
  '.github/workflows/github-native-sim-ci.yml',
  '.github/workflows/live-fork-engine-smoke.yml',
  '.github/workflows/live-fork-upgrade-ci.yml',
  '.github/workflows/export-v27-hardhat-harness.yml',
  '.github/workflows/github-native-simulate.yml',
  '.github/workflows/simulate.yml',
  V27_WORKFLOW
];

const TRUSTED_LIVE_WORKFLOWS = [
  '.github/workflows/live-fork-engine-smoke.yml',
  '.github/workflows/export-v27-hardhat-harness.yml',
  '.github/workflows/github-native-simulate.yml',
  '.github/workflows/simulate.yml',
  V27_WORKFLOW
];

const FULL_ACTION_PIN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}$/u;
const LIVE_AUTHORITY = /\$\{\{\s*(?:secrets\.(?:RPC_|SIM_ARCHIVE_|SIM_RPC_HEALTH_|PREFLIGHTSIM_)|github\.token)|issues:\s*write/gu;

function source(path) {
  return readFileSync(path, 'utf8');
}

function thirdPartyActions(text) {
  return [...text.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)\s*$/gmu)]
    .map((match) => match[1])
    .filter((reference) => !reference.startsWith('./'));
}

test('all third-party GitHub actions are pinned to immutable full commit SHAs', () => {
  for (const path of WORKFLOWS) {
    for (const reference of thirdPartyActions(source(path))) {
      assert.match(reference, FULL_ACTION_PIN, `${path}: ${reference}`);
    }
  }
});

test('pull-request workflows are secretless and have no write authority', () => {
  for (const path of WORKFLOWS) {
    const text = source(path);
    if (!/^\s{2}pull_request:/mu.test(text)) continue;
    assert.equal(LIVE_AUTHORITY.test(text), false, path);
    LIVE_AUTHORITY.lastIndex = 0;
  }
});

test('trusted live workflows cannot be triggered by pull requests', () => {
  for (const path of TRUSTED_LIVE_WORKFLOWS) {
    assert.equal(/^\s{2}pull_request:/mu.test(source(path)), false, path);
  }
});

test('full V27 live-fork acceptance remains available only on trusted events', () => {
  const text = source(V27_WORKFLOW);
  assert.match(text, /^\s{2}workflow_dispatch:/mu);
  assert.match(text, /^\s{2}push:/mu);
  assert.match(text, /^\s{6}- main$/mu);
  assert.match(text, /github-native-sim\/jobs\/live-fork-v27-v1\/run-ci\.sh/u);
  assert.match(text, /SIM_RPC_HEALTH_GITHUB_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/u);
  assert.match(text, /v27-full-live-fork-\$\{\{\s*github\.run_id\s*\}\}/u);
});

test('main-push job selection uses the immutable event before SHA', () => {
  const text = source('.github/workflows/github-native-simulate.yml');
  assert.match(text, /PUSH_BEFORE:\s*\$\{\{\s*github\.event\.before(?:\s*\|\|\s*'')?\s*\}\}/u);
  assert.match(text, /git diff --name-only "\$PUSH_BEFORE\.\.\.\$GITHUB_SHA"/u);
  assert.doesNotMatch(text, /origin\/\$DEFAULT_BRANCH\.\.\.\$GITHUB_SHA/u);
});
