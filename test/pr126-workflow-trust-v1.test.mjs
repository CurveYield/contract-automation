import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const WORKFLOWS = [
  '.github/workflows/github-native-sim-ci.yml',
  '.github/workflows/live-fork-engine-smoke.yml',
  '.github/workflows/live-fork-upgrade-ci.yml',
  '.github/workflows/export-v27-hardhat-harness.yml',
  '.github/workflows/github-native-simulate.yml',
  '.github/workflows/simulate.yml'
];

const TRUSTED_LIVE_WORKFLOWS = [
  '.github/workflows/live-fork-engine-smoke.yml',
  '.github/workflows/export-v27-hardhat-harness.yml',
  '.github/workflows/github-native-simulate.yml',
  '.github/workflows/simulate.yml'
];

const FULL_ACTION_PIN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}$/u;
const LIVE_AUTHORITY = /\$\{\{\s*(?:secrets\.(?:RPC_|SIM_ARCHIVE_|SIM_RPC_HEALTH_|PREFLIGHTSIM_)|github\.token)|issues:\s*write/gu;

function source(path) {
  return readFileSync(path, 'utf8');
}

function thirdPartyActions(text) {
  return [...text.matchAll(/^\s*uses:\s*([^\s#]+)\s*$/gmu)]
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
