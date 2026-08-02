import { RELEASE_MANIFEST_SCHEMA, ROUND4_INTAKE_SLOTS } from './contracts.mjs';
import {
  canonicalJson,
  exact,
  fail,
  frozen,
  identifier,
  ordinaryArray,
  pathValue,
  sha40,
  sortedUnique
} from './boundary.mjs';
import { digestOf } from './digest.mjs';
import { createReleaseIntakePlan } from './intake.mjs';

function validateProtectedBlob(entry, path) {
  const safe = exact(entry, ['path', 'blobSha'], path);
  return {
    path: pathValue(safe.path, `${path}.path`),
    blobSha: sha40(safe.blobSha, `${path}.blobSha`)
  };
}

export function createReleaseIntegrationManifest(input) {
  const safe = exact(input, [
    'baseSha',
    'components',
    'protectedBlobs',
    'sharedUnions',
    'staleInputs',
    'round4Slots'
  ]);

  const protectedBlobs = ordinaryArray(safe.protectedBlobs, '$.protectedBlobs', 10_000)
    .map((entry, index) => validateProtectedBlob(entry, `$.protectedBlobs[${index}]`))
    .sort((left, right) => left.path.localeCompare(right.path));
  if (new Set(protectedBlobs.map((item) => item.path)).size !== protectedBlobs.length) {
    fail('duplicate_protected_path', '$.protectedBlobs');
  }

  const plan = createReleaseIntakePlan({
    baseSha: safe.baseSha,
    candidates: safe.components,
    protectedPaths: protectedBlobs.map((item) => item.path),
    sharedUnions: safe.sharedUnions
  });

  const staleInputs = sortedUnique(safe.staleInputs, '$.staleInputs', 128, identifier);
  const round4Slots = ordinaryArray(safe.round4Slots, '$.round4Slots', 16);
  if (canonicalJson(round4Slots) !== canonicalJson(ROUND4_INTAKE_SLOTS)) {
    fail('round4_slot_mismatch', '$.round4Slots');
  }

  const body = {
    schemaVersion: RELEASE_MANIFEST_SCHEMA,
    baseSha: plan.baseSha,
    components: plan.candidates,
    protectedBlobs,
    sharedUnions: plan.sharedUnions,
    staleInputs,
    round4Slots: ROUND4_INTAKE_SLOTS,
    capabilities: plan.capabilities
  };

  return frozen({ ...body, releaseDigest: digestOf(body) });
}

export function validateReleaseIntegrationManifest(value) {
  const safe = exact(value, [
    'schemaVersion',
    'baseSha',
    'components',
    'protectedBlobs',
    'sharedUnions',
    'staleInputs',
    'round4Slots',
    'capabilities',
    'releaseDigest'
  ]);

  if (safe.schemaVersion !== RELEASE_MANIFEST_SCHEMA) {
    fail('invalid_schema_version', '$.schemaVersion');
  }

  const rebuilt = createReleaseIntegrationManifest({
    baseSha: safe.baseSha,
    components: safe.components,
    protectedBlobs: safe.protectedBlobs,
    sharedUnions: safe.sharedUnions,
    staleInputs: safe.staleInputs,
    round4Slots: safe.round4Slots
  });

  if (canonicalJson(safe.capabilities) !== canonicalJson(rebuilt.capabilities)) {
    fail('capability_drift', '$.capabilities');
  }
  if (safe.releaseDigest !== rebuilt.releaseDigest) {
    fail('digest_mismatch', '$.releaseDigest');
  }

  return rebuilt;
}
