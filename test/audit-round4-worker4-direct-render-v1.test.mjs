import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (relative) => import(`${pathToFileURL(path.join(root, relative)).href}?v=${Date.now()}-${Math.random()}`);

test('GitHub Direct Round 4 status renders immutable identity and execution truth with semantic labels', async () => {
  const { renderGitHubDirectStatusPage } = await load('apps/audit-web/src/pages-round3-v1.mjs');
  const digest = `sha256:${'b'.repeat(64)}`;
  const html = renderGitHubDirectStatusPage({
    id: 'direct-service-result-1', status: 'awaiting-executor', repository: 'CurveYield/contract-automation',
    targetSha: 'a'.repeat(40), checkStatus: 'queued', reportId: 'report-1', updatedAt: '2026-08-02T09:00:00Z',
    sourceSchema: 'github-direct-service-result-v2', commandKind: 'submit', serviceState: 'accepted',
    resultId: 'direct-service-result-1', resultDigest: digest, executionState: 'not-executed',
    outcome: '', reportDigest: digest, retryable: false, errorCode: ''
  });
  for (const label of ['Source schema', 'Command', 'Service result state', 'Result identifier', 'Result digest', 'Execution state', 'Report digest']) assert.match(html, new RegExp(label));
  assert.match(html, /Awaiting executor/);
  assert.match(html, /not-executed/);
  assert.match(html, /Execution unavailable/);
  assert.doesNotMatch(html, /<button|Run now|Retry execution|[0-9]+% complete/i);
});

test('GitHub Direct error rendering exposes retryability without attacker-controlled detail', async () => {
  const { renderGitHubDirectStatusPage } = await load('apps/audit-web/src/pages-round3-v1.mjs');
  const html = renderGitHubDirectStatusPage({
    id: 'github-direct-error-transport-failure', status: 'failed', checkStatus: 'failed',
    updatedAt: '2026-08-02T09:00:00Z', reason: 'GitHub Direct service operation failed',
    sourceSchema: 'github-direct-service-error-v1', commandKind: 'unknown', serviceState: 'failed',
    executionState: 'not-executed', retryable: true, errorCode: 'transport-failure'
  });
  assert.match(html, /Retryable/);
  assert.match(html, />Yes</);
  assert.match(html, /Error code/);
  assert.match(html, /transport-failure/);
});
