import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = path.join(root, 'test/fixtures/audit-round4/worker4/github-direct-public-v2.json');
const load = (relative) => import(`${pathToFileURL(path.join(root, relative)).href}?v=${Date.now()}-${Math.random()}`);

function fixture() { return JSON.parse(fs.readFileSync(fixturePath, 'utf8')); }

test('versioned GitHub Direct public fixture locks exact Round 4 schemas', () => {
  const value = fixture();
  assert.equal(value.version, 'audit-round4-worker4-github-direct-public/v1');
  assert.deepEqual(value.schemas, {
    command: 'github-direct-service-command-v1',
    result: 'github-direct-service-result-v2',
    error: 'github-direct-service-error-v1'
  });
});

test('public result fixtures deterministically project accepted and completed truth', async () => {
  const { adaptGitHubDirectResultV2 } = await load('packages/audit-web-compat/src/index-v1.mjs');
  const value = fixture();
  const accepted = adaptGitHubDirectResultV2(value.accepted);
  const completed = adaptGitHubDirectResultV2(value.completed);
  assert.deepEqual(
    [accepted.status, accepted.executionState, accepted.reportId],
    ['awaiting-executor', 'not-executed', '']
  );
  assert.deepEqual(
    [completed.status, completed.executionState, completed.outcome, completed.reportId],
    ['completed', 'fixture-modeled', 'modeled-fixture', 'report-fixture-completed']
  );
});

test('public error fixture projects stable retry state without source text', async () => {
  const { adaptGitHubDirectErrorV1 } = await load('packages/audit-web-compat/src/index-v1.mjs');
  const model = adaptGitHubDirectErrorV1(fixture().error);
  assert.equal(model.errorCode, 'transport-failure');
  assert.equal(model.retryable, true);
  assert.equal(model.reason, 'GitHub Direct service operation failed');
  assert.equal(model.executionAvailable, false);
});
