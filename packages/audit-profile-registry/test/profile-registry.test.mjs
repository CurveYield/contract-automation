import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryAuditStore } from '../../audit-r2-store/src/index.mjs';
import {
  MAX_PROFILE_METADATA_BYTES,
  PROFILE_OPERATION_BUDGETS,
  ProfileRegistry,
  profileAttestationKey,
  profileIndexKey,
  profileManifestKey,
  profileRevocationKey,
  profileSbomKey,
  validateProfileManifest
} from '../src/index.mjs';

function manifest(overrides = {}) {
  return {
    schemaVersion: 'profile-v1',
    profileId: 'slither-solidity-v1',
    registryArtifact: {
      repository: 'ghcr.io/curveyield/audit-slither',
      digest: `sha256:${'a'.repeat(64)}`
    },
    tool: { name: 'slither', version: '0.11.3' },
    resourcePolicy: { cpuLimit: 2, memoryMiB: 4096, timeoutSeconds: 1800 },
    evidenceContract: { schemaVersion: 'evidence-v1', requiredArtifacts: ['findings.json', 'stdout.txt'] },
    sbomSha256: 'b'.repeat(64),
    attestationSha256: 'c'.repeat(64),
    publishedAt: '2026-07-31T12:00:00.000Z',
    ...overrides
  };
}

test('validates immutable lowercase versioned profile manifests', () => {
  assert.deepEqual(validateProfileManifest(manifest()), manifest());
  assert.throws(() => validateProfileManifest(manifest({ profileId: 'Slither-v1' })), /profileId/);
  assert.throws(() => validateProfileManifest(manifest({ profileId: 'slither' })), /profileId/);
  assert.throws(() => validateProfileManifest(manifest({ registryArtifact: { repository: 'ghcr.io/curveyield/audit-slither', digest: 'latest' } })), /digest/);
  assert.throws(() => validateProfileManifest({ ...manifest(), image: 'custom:latest' }), /image/);
  assert.throws(() => validateProfileManifest({ ...manifest(), extra: true }), /extra/);
});

test('publishes deterministic profile keys and operation budgets', () => {
  assert.equal(MAX_PROFILE_METADATA_BYTES, 5_000_000);
  assert.deepEqual(PROFILE_OPERATION_BUDGETS.publish, { classA: 4, classB: 1, storageBytes: 1_000_000 });
  assert.deepEqual(PROFILE_OPERATION_BUDGETS.read, { classA: 0, classB: 1, storageBytes: 0 });
  assert.deepEqual(PROFILE_OPERATION_BUDGETS.revoke, { classA: 2, classB: 1, storageBytes: 64_000 });
  assert.equal(profileManifestKey('slither-solidity-v1'), 'profiles/slither-solidity-v1/profile-v1.json');
  assert.equal(profileSbomKey('slither-solidity-v1'), 'profiles/slither-solidity-v1/sbom-v1.json');
  assert.equal(profileAttestationKey('slither-solidity-v1'), 'profiles/slither-solidity-v1/attestation-v1.json');
  assert.equal(profileRevocationKey('slither-solidity-v1'), 'profiles/slither-solidity-v1/revocation-v1.json');
  assert.equal(profileIndexKey(), 'indexes/profiles-v1.json');
});

test('publishes once, reads through the deterministic index, and rejects duplicates', async () => {
  const store = new InMemoryAuditStore();
  const registry = new ProfileRegistry(store);
  const bundle = {
    manifest: manifest(),
    sbom: { schemaVersion: 'sbom-reference-v1', sha256: 'b'.repeat(64), objectKey: 'profiles/slither-solidity-v1/sbom.spdx.json' },
    attestation: { schemaVersion: 'attestation-reference-v1', sha256: 'c'.repeat(64), objectKey: 'profiles/slither-solidity-v1/attestation.json' },
    index: { schemaVersion: 'profile-index-v1', profiles: ['slither-solidity-v1'] }
  };
  const published = await registry.publish(bundle);
  assert.equal(published.profileId, 'slither-solidity-v1');
  assert.deepEqual(store.usage(), { classA: 4, classB: 1, free: 0, storedBytes: store.usage().storedBytes });
  const index = await registry.readIndex();
  assert.deepEqual(index.profiles, ['slither-solidity-v1']);
  await assert.rejects(() => registry.publish(bundle), /profile already exists/i);
});

test('revokes append-only while retaining immutable profile metadata', async () => {
  const store = new InMemoryAuditStore();
  const registry = new ProfileRegistry(store);
  await registry.publish({
    manifest: manifest(),
    sbom: { schemaVersion: 'sbom-reference-v1', sha256: 'b'.repeat(64), objectKey: 'profiles/slither-solidity-v1/sbom.spdx.json' },
    attestation: { schemaVersion: 'attestation-reference-v1', sha256: 'c'.repeat(64), objectKey: 'profiles/slither-solidity-v1/attestation.json' },
    index: { schemaVersion: 'profile-index-v1', profiles: ['slither-solidity-v1'] }
  });
  const before = await store.get(profileManifestKey('slither-solidity-v1'));
  const revoked = await registry.revoke('slither-solidity-v1', {
    schemaVersion: 'profile-revocation-v1',
    profileId: 'slither-solidity-v1',
    reason: 'superseded',
    revokedAt: '2026-08-01T12:00:00.000Z'
  });
  assert.equal(revoked.revoked, true);
  const after = await store.get(profileManifestKey('slither-solidity-v1'));
  assert.equal(after.etag, before.etag);
  const profile = await registry.read('slither-solidity-v1');
  assert.equal(profile.revoked, true);
  await assert.rejects(() => registry.revoke('slither-solidity-v1', {
    schemaVersion: 'profile-revocation-v1', profileId: 'slither-solidity-v1', reason: 'again', revokedAt: '2026-08-02T12:00:00.000Z'
  }), /precondition/i);
});
