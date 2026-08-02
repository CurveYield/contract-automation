import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (relative) => import(`${pathToFileURL(path.join(root, relative)).href}?v=${Date.now()}-${Math.random()}`);
const sha = 'a'.repeat(40);
const digest = `sha256:${'b'.repeat(64)}`;

function acceptedResult(overrides = {}) {
  return {
    schemaVersion: 'github-direct-service-result-v2', modeId: 'github-direct-audit-v1', commandKind: 'submit',
    jobId: 'job-1', targetCommitSha: sha, state: 'accepted',
    data: {
      currentState: { jobId: 'job-1', targetCommitSha: sha, repositoryFullName: 'CurveYield/contract-automation', state: 'awaiting_executor' },
      bundle: { schemaVersion: 'github-direct-submission-reporting-v1', jobId: 'job-1', targetCommitSha: sha }
    },
    completedAt: '2026-08-02T09:00:00.000Z', cloudflareFallback: false,
    resultId: `direct-service-result-${'b'.repeat(24)}`, resultDigest: digest, ...overrides
  };
}

test('GitHub Direct result v2 adapter preserves immutable identity and awaiting-executor truth', async () => {
  const { adaptGitHubDirectResultV2, ROUND4_COMPATIBILITY_VERSIONS } = await load('packages/audit-web-compat/src/index-v1.mjs');
  assert.equal(ROUND4_COMPATIBILITY_VERSIONS.githubDirectResult, 'github-direct-service-result-v2');
  const model = adaptGitHubDirectResultV2(acceptedResult());
  assert.equal(model.sourceSchema, 'github-direct-service-result-v2');
  assert.equal(model.commandKind, 'submit');
  assert.equal(model.serviceState, 'accepted');
  assert.equal(model.status, 'awaiting-executor');
  assert.equal(model.resultId, `direct-service-result-${'b'.repeat(24)}`);
  assert.equal(model.resultDigest, digest);
  assert.equal(model.repository, 'CurveYield/contract-automation');
  assert.equal(model.targetSha, sha);
  assert.equal(model.executionState, 'not-executed');
  assert.equal(model.executionAvailable, false);
  assert.equal(Object.isFrozen(model), true);
});

test('GitHub Direct result adapter rejects schema skew, fallback and identity/state contradictions', async () => {
  const { adaptGitHubDirectResultV2, AuditWebCompatibilityError } = await load('packages/audit-web-compat/src/index-v1.mjs');
  const invalid = [
    acceptedResult({ schemaVersion: 'github-direct-service-result-v1' }),
    acceptedResult({ cloudflareFallback: true }),
    acceptedResult({ resultId: `direct-service-result-${'c'.repeat(24)}` }),
    acceptedResult({ data: { currentState: { jobId: 'other', targetCommitSha: sha, state: 'awaiting_executor' } } }),
    acceptedResult({ data: { currentState: { jobId: 'job-1', targetCommitSha: sha, state: 'completed' } } }),
    acceptedResult({ token: 'secret' })
  ];
  for (const input of invalid) assert.throws(() => adaptGitHubDirectResultV2(input), (error) => error instanceof AuditWebCompatibilityError);
});

test('completed GitHub Direct result projects one immutable report reference and execution truth', async () => {
  const { adaptGitHubDirectResultV2 } = await load('packages/audit-web-compat/src/index-v1.mjs');
  const result = acceptedResult({
    commandKind: 'report', state: 'completed',
    data: {
      currentState: { jobId: 'job-1', targetCommitSha: sha, repositoryFullName: 'CurveYield/contract-automation', state: 'completed' },
      bundle: {
        schemaVersion: 'github-direct-terminal-reporting-v1', jobId: 'job-1', targetCommitSha: sha,
        resultManifest: { jobId: 'job-1', targetCommitSha: sha, executionState: 'fixture-modeled', outcome: 'modeled-fixture' },
        reportIndex: { jobId: 'job-1', targetCommitSha: sha, entries: [{ reportId: 'report-1', reportDigest: digest }] }
      }
    }
  });
  const model = adaptGitHubDirectResultV2(result);
  assert.equal(model.status, 'completed');
  assert.equal(model.executionState, 'fixture-modeled');
  assert.equal(model.outcome, 'modeled-fixture');
  assert.equal(model.reportId, 'report-1');
  assert.equal(model.reportDigest, digest);
});

test('GitHub Direct error v1 adapter exposes only stable code, retry truth and generic redacted message', async () => {
  const { adaptGitHubDirectErrorV1 } = await load('packages/audit-web-compat/src/index-v1.mjs');
  const model = adaptGitHubDirectErrorV1({
    schemaVersion: 'github-direct-service-error-v1', modeId: 'github-direct-audit-v1',
    code: 'execution_plane_unavailable', retryable: true,
    message: 'GitHub Direct service operation failed', at: '2026-08-02T09:00:00.000Z'
  });
  assert.equal(model.sourceSchema, 'github-direct-service-error-v1');
  assert.equal(model.status, 'execution-plane-unavailable');
  assert.equal(model.errorCode, 'execution-plane-unavailable');
  assert.equal(model.retryable, true);
  assert.equal(model.reason, 'GitHub Direct service operation failed');
  assert.equal(model.executionAvailable, false);
});

test('legacy API fixture remains supported only through an exact bounded legacy adapter', async () => {
  const { adaptApiFixture, COMPATIBILITY_VERSIONS } = await load('packages/audit-web-compat/src/index-v1.mjs');
  const output = adaptApiFixture({
    version: COMPATIBILITY_VERSIONS.api,
    githubDirect: { id: 'direct-legacy', status: 'awaiting-executor', repository: 'CurveYield/contract-automation', targetSha: sha, checkStatus: 'queued' }
  });
  assert.equal(output.githubDirect.id, 'direct-legacy');
  assert.equal(output.githubDirect.status, 'awaiting-executor');
  assert.throws(() => adaptApiFixture({ version: COMPATIBILITY_VERSIONS.api, githubDirect: { id: 'direct', status: 'completed', attacker: true } }));
});
