import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (relative) => import(`${pathToFileURL(path.join(root, relative)).href}?v=${Date.now()}-${Math.random()}`);
const file = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const changedProduction = [
  'packages/audit-ui-contracts/src/index.mjs',
  'packages/audit-report-view-model/src/lifecycle-v1.mjs',
  'packages/audit-report-view-model/src/safety-v1.mjs',
  'packages/audit-report-view-model/src/models-core-v1.mjs',
  'packages/audit-report-view-model/src/models-operator-v1.mjs',
  'packages/audit-web-compat/src/index-v1.mjs',
  'packages/audit-web-compat/src/github-direct-v2.mjs',
  'apps/audit-web/src/pages-round3-v1.mjs'
];

test('Round 4 production imports only Worker 4 compatibility/view contracts', () => {
  const source = changedProduction.map(file).join('\n');
  for (const forbidden of [
    /audit-github-direct-(?:ledger|auth|adapter|runner|reporting|protocol)/,
    /audit-phase78-service/,
    /apps\/audit-api/,
    /github-native-sim/,
    /rpc-method-policy|fork-rpc-guard/
  ]) assert.doesNotMatch(source, forbidden);
  assert.match(file('packages/audit-web-compat/src/github-direct-v2.mjs'), /audit-report-view-model/);
});

test('Round 4 changed source contains no execution, network, persistence, credential, or dynamic-code sink', () => {
  const source = [...changedProduction, 'apps/audit-web/src/client.mjs'].map(file).join('\n');
  for (const forbidden of [
    /\bfetch\s*\(/, /XMLHttpRequest|WebSocket/, /localStorage|sessionStorage|indexedDB|document\.cookie/,
    /\beval\s*\(|new\s+Function\b/, /node:child_process/, /\b(?:exec|spawn|fork)Sync?\s*\(/,
    /window\.ethereum|signer|signTransaction|sendTransaction|broadcastTransaction/i
  ]) assert.doesNotMatch(source, forbidden);
});

test('Direct status shell exposes semantic landmarks, keyboard focus, accessible names, and truthful state', async () => {
  const { renderShell } = await load('apps/audit-web/src/render.mjs');
  const { renderGitHubDirectStatusPage } = await load('apps/audit-web/src/pages-round3-v1.mjs');
  const body = renderGitHubDirectStatusPage({
    id: 'direct-1', status: 'awaiting-executor', repository: 'CurveYield/contract-automation',
    targetSha: 'a'.repeat(40), checkStatus: 'queued', updatedAt: '2026-08-02T10:00:00Z',
    sourceSchema: 'github-direct-service-result-v2', commandKind: 'submit', serviceState: 'accepted',
    resultId: 'direct-1', resultDigest: `sha256:${'b'.repeat(64)}`, executionState: 'not-executed', retryable: false
  });
  const html = renderShell({ title: 'GitHub Direct Audit status', activeRoute: 'operations', body });
  assert.match(html, /<html lang="en">/);
  assert.match(html, /href="#main-content">Skip to content/);
  assert.match(html, /<nav aria-label="Primary">/);
  assert.match(html, /<main id="main-content" tabindex="-1">/);
  assert.match(html, /<h1 id="main-heading">/);
  assert.match(html, /<section aria-labelledby="github-direct-summary">/);
  assert.match(html, /<dl>/);
  assert.match(html, /tabindex="0" aria-label="Identifier/);
  assert.match(html, /Awaiting executor/);
  assert.match(html, /Execution is unavailable/);
});

test('responsive stylesheet includes narrow layout, visible focus, forced colors, reduced motion, and overflow bounds', () => {
  const css = file('apps/audit-web/src/styles.css');
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\s*\(max-width:\s*37\.499rem\)/);
  assert.match(css, /@media\s*\(forced-colors:\s*active\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /max-inline-size:\s*100%/);
});

test('inert public fixture traverses accepted, completed report, and recoverable error views', async () => {
  const fixture = JSON.parse(file('test/fixtures/audit-round4/worker4/github-direct-public-v2.json'));
  const { adaptGitHubDirectResultV2, adaptGitHubDirectErrorV1 } = await load('packages/audit-web-compat/src/index-v1.mjs');
  const { renderGitHubDirectStatusPage } = await load('apps/audit-web/src/pages-round3-v1.mjs');
  const accepted = renderGitHubDirectStatusPage(adaptGitHubDirectResultV2(fixture.accepted));
  const completed = renderGitHubDirectStatusPage(adaptGitHubDirectResultV2(fixture.completed));
  const error = renderGitHubDirectStatusPage(adaptGitHubDirectErrorV1(fixture.error));
  assert.match(accepted, /Awaiting executor/);
  assert.match(accepted, /not-executed/);
  assert.match(completed, /Completed/);
  assert.match(completed, /report-fixture-completed/);
  assert.match(completed, /fixture-modeled/);
  assert.match(error, /transport-failure/);
  assert.match(error, />Yes</);
  assert.doesNotMatch(`${accepted}${completed}${error}`, /<button[^>]*>\s*(?:Run|Execute|Retry|Cancel)|Run now|Retry execution/i);
});
