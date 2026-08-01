import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryAuditStore } from '../packages/audit-r2-store/src/index.mjs';
import {
  ProfileRegistry,
  profileIndexKey,
  profileManifestKey
} from '../packages/audit-profile-registry/src/index.mjs';

function manifest(profileId, suffix, publishedAt) {
  return {
    schemaVersion: 'profile-v1',
    profileId,
    registryArtifact: {
      repository: `ghcr.io/curveyield/audit-${suffix}`,
      digest: `sha256:${suffix.charCodeAt(0).toString(16).padStart(2, '0').repeat(32)}`
    },
    tool: { name: suffix, version: '1.0.0' },
    resourcePolicy: { cpuLimit: 2, memoryMiB: 4096, timeoutSeconds: 1800 },
    evidenceContract: { schemaVersion: 'evidence-v1', requiredArtifacts: ['result.json'] },
    sbomSha256: 'b'.repeat(64),
    attestationSha256: 'c'.repeat(64),
    publishedAt
  };
}
function bundle(profileId, suffix, publishedAt, extras = {}) {
  return {
    manifest: manifest(profileId, suffix, publishedAt),
    sbom: { schemaVersion: 'sbom-reference-v1', sha256: 'b'.repeat(64), objectKey: `profiles/${profileId}/sbom.spdx.json` },
    attestation: { schemaVersion: 'attestation-reference-v1', sha256: 'c'.repeat(64), objectKey: `profiles/${profileId}/attestation.json` },
    ...extras
  };
}

test('profile publication merges the server-owned index and cannot erase an earlier profile', async () => {
  const store = new InMemoryAuditStore();
  const registry = new ProfileRegistry(store);
  await registry.publish(bundle('slither-solidity-v1', 'slither', '2026-08-01T07:00:00.000Z'));

  const indexRecord = await store.get(profileIndexKey());
  await registry.publish(bundle('forge-coverage-v1', 'forge', '2026-08-01T07:01:00.000Z', {
    indexEtag: indexRecord.etag,
    index: { schemaVersion: 'profile-index-v1', profiles: ['forge-coverage-v1'] }
  }));

  const index = await registry.readIndex();
  assert.deepEqual(index.profiles, ['forge-coverage-v1', 'slither-solidity-v1']);
  assert.ok(index.records['slither-solidity-v1']);
  assert.ok(index.records['forge-coverage-v1']);
});

test('profile publication retries safely after immutable objects were written but the index write failed', async () => {
  const backing = new InMemoryAuditStore();
  let failIndexOnce = true;
  const store = {
    get: (...args) => backing.get(...args),
    put: async (key, value, options) => {
      if (key === profileIndexKey() && failIndexOnce) {
        failIndexOnce = false;
        throw new Error('simulated index write failure');
      }
      return backing.put(key, value, options);
    }
  };
  const registry = new ProfileRegistry(store);
  const input = bundle('slither-solidity-v1', 'slither', '2026-08-01T07:00:00.000Z');

  await assert.rejects(() => registry.publish(input), /simulated index write failure/);
  assert.ok(await backing.get(profileManifestKey('slither-solidity-v1')));
  assert.equal(await backing.get(profileIndexKey()), null);

  const result = await registry.publish(input);
  assert.equal(result.profileId, 'slither-solidity-v1');
  assert.equal(result.recoveredPartialPublication, true);
  assert.deepEqual((await registry.readIndex()).profiles, ['slither-solidity-v1']);
});
