import test from 'node:test';
import assert from 'node:assert/strict';
import * as catalogModule from '../src/index.mjs';
import {
  PHASE4_PROFILE_TEMPLATES,
  createPublishedProfileContract
} from '../../audit-tool-profile-contracts/src/index.mjs';

const EXPECTED_IDS = Object.freeze([
  'coverage-forge-v1',
  'foundry-fuzz-v1',
  'foundry-invariant-v1',
  'foundry-test-v1',
  'slither-v1',
  'solidity-compile-v1'
]);
const DIGEST = `sha256:${'a'.repeat(64)}`;

const {
  PHASE4_PROFILE_CATALOG,
  createPhase4ProfileCatalog,
  getPhase4Profile,
  listPhase4Profiles
} = catalogModule;

function errorCode(action) {
  try { action(); }
  catch (error) { return error.code; }
  assert.fail('Expected action to throw');
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}

test('default catalog is seeded only from templates and sorted by exact profile ID', () => {
  const profiles = listPhase4Profiles(PHASE4_PROFILE_CATALOG);
  assert.deepEqual(profiles.map((profile) => profile.profileId), EXPECTED_IDS);
  assert.equal(profiles.length, 6);
  assert.equal(new Set(profiles.map((profile) => profile.profileId)).size, 6);

  const expected = structuredClone(PHASE4_PROFILE_TEMPLATES)
    .sort((left, right) => left.profileId.localeCompare(right.profileId));
  assert.deepEqual(profiles, expected);
});

test('unpublished state and exact pinned tool identities remain truthful', () => {
  for (const profile of listPhase4Profiles(PHASE4_PROFILE_CATALOG)) {
    assert.equal(profile.publicationState, 'unpublished');
    assert.equal(profile.runnable, false);
    assert.equal(profile.executionEnabled, false);
    assert.equal(profile.executorState, 'unavailable');
    assert.equal(profile.digestRequired, true);
    assert.equal('registryArtifact' in profile, false);
    assert.equal('publishedAt' in profile, false);
  }
  assert.deepEqual(getPhase4Profile(PHASE4_PROFILE_CATALOG, 'solidity-compile-v1').tool, { name: 'solc', version: '0.8.30' });
  assert.deepEqual(getPhase4Profile(PHASE4_PROFILE_CATALOG, 'foundry-test-v1').tool, { name: 'forge', version: '1.7.1' });
  assert.deepEqual(getPhase4Profile(PHASE4_PROFILE_CATALOG, 'slither-v1').tool, { name: 'slither', version: '0.11.5' });
});

test('published contracts enter the catalog only after integrated validation succeeds', () => {
  const published = createPublishedProfileContract('foundry-fuzz-v1', {
    digest: DIGEST,
    publishedAt: '2026-08-01T11:00:00.000Z'
  });
  const catalog = createPhase4ProfileCatalog([published]);
  const profile = getPhase4Profile(catalog, 'foundry-fuzz-v1');
  assert.equal(profile.publicationState, 'published');
  assert.equal(profile.runnable, true);
  assert.equal(profile.executionEnabled, false);
  assert.equal(profile.executorState, 'unavailable');
  assert.equal(profile.digestRequired, false);
  assert.deepEqual(profile.registryArtifact, {
    repository: 'ghcr.io/curveyield/audit-foundry-fuzz',
    digest: DIGEST
  });

  assert.equal(errorCode(() => createPhase4ProfileCatalog([{ ...published, executionEnabled: true }])), 'execution_disabled');
  assert.equal(errorCode(() => createPhase4ProfileCatalog([{ ...published, executorState: 'ready' }])), 'executor_unavailable');
  assert.equal(errorCode(() => createPhase4ProfileCatalog([{ ...published, registryArtifact: { ...published.registryArtifact, digest: 'latest' } }])), 'invalid_digest');
  assert.equal(errorCode(() => createPhase4ProfileCatalog([{ ...published, extra: true }])), 'unknown_field');
});

test('duplicate publications and unknown profile lookups return stable errors', () => {
  const published = createPublishedProfileContract('slither-v1', {
    digest: DIGEST,
    publishedAt: '2026-08-01T11:00:00.000Z'
  });
  assert.equal(errorCode(() => createPhase4ProfileCatalog([published, published])), 'duplicate_profile');
  assert.equal(errorCode(() => getPhase4Profile(PHASE4_PROFILE_CATALOG, 'unknown-v1')), 'not_found');
  assert.equal(errorCode(() => getPhase4Profile(PHASE4_PROFILE_CATALOG, '../escape')), 'invalid_profile_id');
});

test('catalog and returned snapshots are deeply frozen and copy-safe', () => {
  assertDeepFrozen(PHASE4_PROFILE_CATALOG);
  const first = listPhase4Profiles(PHASE4_PROFILE_CATALOG);
  const second = listPhase4Profiles(PHASE4_PROFILE_CATALOG);
  assertDeepFrozen(first);
  assertDeepFrozen(second);
  assert.notEqual(first, second);
  assert.notEqual(first[0], second[0]);
  assert.throws(() => { first[0].tool.version = 'mutable'; }, TypeError);
  assert.equal(second[0].tool.version, getPhase4Profile(PHASE4_PROFILE_CATALOG, second[0].profileId).tool.version);
});

test('catalog public exports contain no execution-like operation', () => {
  const prohibited = /(?:^|_)(submit|execute|run|spawn|install|fetch|network|broadcast)(?:_|$)/i;
  for (const name of Object.keys(catalogModule)) assert.doesNotMatch(name, prohibited);
});
