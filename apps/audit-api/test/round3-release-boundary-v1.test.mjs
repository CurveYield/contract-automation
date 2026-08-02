import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const changedPathManifestPath = 'docs/audit/round3/2026-08-01-candidate-changed-paths-v1.json';
const protectedManifestPath = 'docs/audit/round3/2026-08-01-protected-simulation-addon-blobs-v1.json';
const handoffPath = 'docs/audit/round3/2026-08-01-round4-api-handoff-v1.md';
const reviewPath = 'docs/audit/reviews/2026-08-01-audit-round3-api-gpt-auth-release-candidate-v1.md';

const frozenPrefixes = Object.freeze([
  '.github/workflows/github-native-sim-ci.yml',
  '.github/workflows/github-native-simulate.yml',
  'packages/github-native-sim/',
  'packages/runner/src/fork-rpc-guard.mjs',
  'packages/runner/src/rpc-method-policy.mjs',
  'packages/runner/src/run-job.mjs',
  'packages/runner/test/fork-rpc-guard.test.mjs',
  'packages/runner/test/rpc-method-policy.test.mjs',
  'packages/runner/test/rpc-policy-termination.test.mjs',
  'docs/github-native-simulation.md',
  'docs/rpc-method-policy-v2.md'
]);

function matchesAllowlist(path) {
  if ([
    'apps/audit-api/src/entry.mjs',
    'apps/audit-api/src/phase4-catalog.mjs',
    'apps/audit-api/src/phase5-catalog.mjs',
    'apps/audit-api/src/phase6-catalog.mjs',
    'apps/audit-api/src/phase9-gpt.mjs',
    'apps/audit-api/src/phase9-reports.mjs',
    reviewPath
  ].includes(path)) return true;
  return [
    /^apps\/audit-api\/test\/round3-[A-Za-z0-9._-]+\.test\.mjs$/u,
    /^packages\/audit-api-contracts\/src\/[A-Za-z0-9._-]+\.mjs$/u,
    /^packages\/audit-api-contracts\/test\/round3-[A-Za-z0-9._-]+\.test\.mjs$/u,
    /^packages\/audit-catalog-composition\/src\/[A-Za-z0-9._-]+\.mjs$/u,
    /^packages\/audit-catalog-composition\/test\/round3-[A-Za-z0-9._-]+\.test\.mjs$/u,
    /^docs\/audit\/round3\/[A-Za-z0-9._-]+\.(?:json|md)$/u
  ].some((pattern) => pattern.test(path));
}

test('candidate changed-path manifest is exact, sorted, unique, owned, and frozen-addon-free', async () => {
  const manifest = JSON.parse(await readFile(resolve(root, changedPathManifestPath), 'utf8'));
  assert.equal(manifest.schemaVersion, 'audit-round3-api-candidate-changed-paths-v1');
  assert.equal(manifest.issueNumber, 113);
  assert.equal(manifest.branch, 'audit-round3/api-gpt-auth-release-v1');
  assert.equal(manifest.startingSha, 'd2d17ce80071f67cf5894c09d3a7291f5904cf43');
  assert.match(manifest.implementationSha, /^[0-9a-f]{40}$/u);
  assert.equal(manifest.expectedFinalChangedFileCount, 30);
  assert.equal(manifest.paths.length, 30);
  assert.equal(new Set(manifest.paths).size, manifest.paths.length);
  assert.deepEqual(manifest.paths, [...manifest.paths].sort());
  assert.equal(manifest.paths.every(matchesAllowlist), true);
  assert.equal(manifest.paths.some((path) => frozenPrefixes.some((prefix) => path === prefix || path.startsWith(prefix))), false);
  assert.equal(manifest.frozenAddonChangedFiles, 0);
  assert.equal(manifest.unownedChangedFiles, 0);
});

test('protected addon manifest contains exact reference identity and 17 immutable Git blob pins', async () => {
  const manifest = JSON.parse(await readFile(resolve(root, protectedManifestPath), 'utf8'));
  assert.equal(manifest.schemaVersion, 'audit-round3-protected-simulation-addon-blobs-v1');
  assert.equal(manifest.referenceCommit, '3f68cc1b12cc7f9a84e4cb04b768c049138814c6');
  assert.equal(manifest.candidateStartingCommit, 'd2d17ce80071f67cf5894c09d3a7291f5904cf43');
  const entries = Object.entries(manifest.coreBlobPins);
  assert.equal(entries.length, 17);
  assert.equal(new Set(entries.map(([path]) => path)).size, 17);
  for (const [path, sha] of entries) {
    assert.equal(frozenPrefixes.some((prefix) => path === prefix || path.startsWith(prefix)), true, path);
    assert.match(sha, /^[0-9a-f]{40}$/u, path);
  }
});

test('Round 4 handoff and durable review pin the implementation, routes, auth, compatibility, verification, and residual risks', async () => {
  const [handoff, review] = await Promise.all([
    readFile(resolve(root, handoffPath), 'utf8'),
    readFile(resolve(root, reviewPath), 'utf8')
  ]);
  for (const document of [handoff, review]) {
    for (const required of [
      'f02840ee3fc0c59759c5034dc5c40e0c154bdab5',
      'audit-api-contracts-v2',
      'audit-catalog-composition-v2',
      'service-read',
      '13af0c6c6c3d74ceacdc1894d6f3146460884fb4',
      '3f68cc1b12cc7f9a84e4cb04b768c049138814c6',
      'executionEnabled: false',
      'Round 4',
      'residual risk'
    ]) assert.equal(document.includes(required), true, required);
  }
  assert.equal(handoff.includes('/audit/v1/gpt/jobs/:jobId/evidence-summary'), true);
  assert.equal(handoff.includes('/audit/v1/gpt/clean-rooms/:cleanRoomId/status'), true);
  assert.equal(review.includes('ACCEPT'), true);
});

test('all Round 3 JSON manifests parse and remain versioned v1 artifacts', async () => {
  for (const relative of [
    'docs/audit/round3/2026-08-01-api-contract-catalog-capability-inventory-v1.json',
    changedPathManifestPath,
    protectedManifestPath
  ]) {
    const parsed = JSON.parse(await readFile(resolve(root, relative), 'utf8'));
    assert.match(parsed.schemaVersion, /-v1$/u, relative);
  }
});
