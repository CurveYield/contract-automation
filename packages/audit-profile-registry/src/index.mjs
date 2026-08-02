import { ValidationError, createOperationBudget, deepFreezeAuditValue, scanAuditForbiddenFields } from '../../audit-protocol/src/index.mjs';
import { ConditionalWriteError } from '../../audit-r2-store/src/index.mjs';

export const MAX_PROFILE_METADATA_BYTES = 5_000_000;
export const PROFILE_OPERATION_BUDGETS = Object.freeze({
  publish: Object.freeze(createOperationBudget({ classA: 4, classB: 1, storageBytes: 1_000_000 })),
  read: Object.freeze(createOperationBudget({ classA: 0, classB: 1, storageBytes: 0 })),
  revoke: Object.freeze(createOperationBudget({ classA: 2, classB: 1, storageBytes: 64_000 }))
});

function object(value, path = '$') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('invalid_type', `${path} must be an object`, path);
}
function keys(value, allowed, path = '$') {
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new ValidationError('unknown_field', `${path}.${key} is not allowed`, `${path}.${key}`);
}
function required(value, names, path = '$') {
  for (const name of names) if (!(name in value)) throw new ValidationError('missing_field', `${path}.${name} is required`, `${path}.${name}`);
}
function string(value, path, max = 256) {
  if (typeof value !== 'string' || value.length < 1 || value.length > max) throw new ValidationError('invalid_string', `${path} must be a non-empty string up to ${max} characters`, path);
  return value;
}
function integer(value, path, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new ValidationError('invalid_integer', `${path} must be an integer from ${min} to ${max}`, path);
  return value;
}
function sha256(value, path, prefixed = false) {
  const pattern = prefixed ? /^sha256:[0-9a-f]{64}$/ : /^[0-9a-f]{64}$/;
  if (typeof value !== 'string' || !pattern.test(value)) throw new ValidationError('invalid_digest', `${path} must be an immutable SHA-256 digest`, path);
  return value;
}
function instant(value, path) {
  string(value, path, 40);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) throw new ValidationError('invalid_timestamp', `${path} must be a canonical ISO-8601 instant`, path);
  return value;
}
function safeKey(value, path) {
  string(value, path, 1024);
  if (value.startsWith('/') || value.includes('..') || value.includes('\\')) throw new ValidationError('invalid_object_key', `${path} must be a safe relative object key`, path);
  return value;
}
function frozen(value) { return deepFreezeAuditValue(structuredClone(value)); }

export function assertProfileId(profileId, path = '$.profileId') {
  if (typeof profileId !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]*$/.test(profileId)) {
    throw new ValidationError('invalid_profile_id', `${path} must be a lowercase versioned slug`, path);
  }
  return profileId;
}

export const profileManifestKey = (id) => `profiles/${assertProfileId(id)}/profile-v1.json`;
export const profileSbomKey = (id) => `profiles/${assertProfileId(id)}/sbom-v1.json`;
export const profileAttestationKey = (id) => `profiles/${assertProfileId(id)}/attestation-v1.json`;
export const profileRevocationKey = (id) => `profiles/${assertProfileId(id)}/revocation-v1.json`;
export const profileIndexKey = () => 'indexes/profiles-v1.json';

export function validateProfileManifest(value) {
  object(value);
  scanAuditForbiddenFields(value);
  const allowed = new Set(['schemaVersion', 'profileId', 'registryArtifact', 'tool', 'resourcePolicy', 'evidenceContract', 'sbomSha256', 'attestationSha256', 'publishedAt']);
  keys(value, allowed); required(value, allowed);
  if (value.schemaVersion !== 'profile-v1') throw new ValidationError('invalid_schema_version', '$.schemaVersion must be profile-v1', '$.schemaVersion');
  assertProfileId(value.profileId);
  object(value.registryArtifact, '$.registryArtifact');
  keys(value.registryArtifact, new Set(['repository', 'digest']), '$.registryArtifact');
  required(value.registryArtifact, new Set(['repository', 'digest']), '$.registryArtifact');
  if (typeof value.registryArtifact.repository !== 'string' || !/^ghcr\.io\/[a-z0-9._-]+\/[a-z0-9._/-]+$/.test(value.registryArtifact.repository)) {
    throw new ValidationError('invalid_registry_repository', '$.registryArtifact.repository must be a lowercase GHCR repository identity', '$.registryArtifact.repository');
  }
  sha256(value.registryArtifact.digest, '$.registryArtifact.digest', true);
  object(value.tool, '$.tool'); keys(value.tool, new Set(['name', 'version']), '$.tool'); required(value.tool, new Set(['name', 'version']), '$.tool');
  string(value.tool.name, '$.tool.name', 80); string(value.tool.version, '$.tool.version', 80);
  object(value.resourcePolicy, '$.resourcePolicy');
  keys(value.resourcePolicy, new Set(['cpuLimit', 'memoryMiB', 'timeoutSeconds']), '$.resourcePolicy');
  required(value.resourcePolicy, new Set(['cpuLimit', 'memoryMiB', 'timeoutSeconds']), '$.resourcePolicy');
  integer(value.resourcePolicy.cpuLimit, '$.resourcePolicy.cpuLimit', 1, 64);
  integer(value.resourcePolicy.memoryMiB, '$.resourcePolicy.memoryMiB', 128, 262_144);
  integer(value.resourcePolicy.timeoutSeconds, '$.resourcePolicy.timeoutSeconds', 1, 86_400);
  object(value.evidenceContract, '$.evidenceContract');
  keys(value.evidenceContract, new Set(['schemaVersion', 'requiredArtifacts']), '$.evidenceContract');
  required(value.evidenceContract, new Set(['schemaVersion', 'requiredArtifacts']), '$.evidenceContract');
  if (value.evidenceContract.schemaVersion !== 'evidence-v1') throw new ValidationError('invalid_schema_version', '$.evidenceContract.schemaVersion must be evidence-v1', '$.evidenceContract.schemaVersion');
  if (!Array.isArray(value.evidenceContract.requiredArtifacts) || value.evidenceContract.requiredArtifacts.length > 64 || value.evidenceContract.requiredArtifacts.some((item) => typeof item !== 'string' || item.length < 1 || item.length > 160)) {
    throw new ValidationError('invalid_evidence_contract', '$.evidenceContract.requiredArtifacts is invalid', '$.evidenceContract.requiredArtifacts');
  }
  if (new Set(value.evidenceContract.requiredArtifacts).size !== value.evidenceContract.requiredArtifacts.length) throw new ValidationError('duplicate_artifact', '$.evidenceContract.requiredArtifacts contains duplicates', '$.evidenceContract.requiredArtifacts');
  sha256(value.sbomSha256, '$.sbomSha256'); sha256(value.attestationSha256, '$.attestationSha256'); instant(value.publishedAt, '$.publishedAt');
  return frozen(value);
}

function validateReference(value, kind, profileId) {
  object(value, `$.${kind}`);
  scanAuditForbiddenFields(value, `$.${kind}`);
  const allowed = new Set(['schemaVersion', 'sha256', 'objectKey']);
  keys(value, allowed, `$.${kind}`); required(value, allowed, `$.${kind}`);
  const version = kind === 'sbom' ? 'sbom-reference-v1' : 'attestation-reference-v1';
  if (value.schemaVersion !== version) throw new ValidationError('invalid_schema_version', `$.${kind}.schemaVersion must be ${version}`, `$.${kind}.schemaVersion`);
  sha256(value.sha256, `$.${kind}.sha256`); safeKey(value.objectKey, `$.${kind}.objectKey`);
  const expectedKey = kind === 'sbom' ? profileSbomKey(profileId) : profileAttestationKey(profileId);
  if (value.objectKey !== expectedKey) throw new ValidationError('invalid_object_key', `$.${kind}.objectKey must equal ${expectedKey}`, `$.${kind}.objectKey`);
  return frozen(value);
}
function validateIndex(value) {
  object(value, '$.index');
  scanAuditForbiddenFields(value, '$.index');
  keys(value, new Set(['schemaVersion', 'profiles', 'records']), '$.index');
  required(value, new Set(['schemaVersion', 'profiles']), '$.index');
  if (value.schemaVersion !== 'profile-index-v1') throw new ValidationError('invalid_schema_version', '$.index.schemaVersion must be profile-index-v1', '$.index.schemaVersion');
  if (!Array.isArray(value.profiles) || value.profiles.some((id) => { try { assertProfileId(id); return false; } catch { return true; } })) throw new ValidationError('invalid_profile_index', '$.index.profiles is invalid', '$.index.profiles');
  if (new Set(value.profiles).size !== value.profiles.length || JSON.stringify(value.profiles) !== JSON.stringify([...value.profiles].sort())) throw new ValidationError('noncanonical_profile_index', '$.index.profiles must be unique and sorted', '$.index.profiles');
  const records = value.records ?? {};
  object(records, '$.index.records');
  const recordKeys = Object.keys(records).sort();
  if (JSON.stringify(recordKeys) !== JSON.stringify(value.profiles)) throw new ValidationError('profile_index_mismatch', '$.index.records must exactly match profiles', '$.index.records');
  for (const profileId of recordKeys) {
    const entry = records[profileId];
    object(entry, `$.index.records.${profileId}`);
    keys(entry, new Set(['manifest', 'revoked', 'revocation']), `$.index.records.${profileId}`);
    required(entry, new Set(['manifest', 'revoked', 'revocation']), `$.index.records.${profileId}`);
    const manifest = validateProfileManifest(entry.manifest);
    if (manifest.profileId !== profileId) throw new ValidationError('profile_index_mismatch', 'Profile record manifest identity does not match its key', `$.index.records.${profileId}.manifest.profileId`);
    if (typeof entry.revoked !== 'boolean') throw new ValidationError('invalid_revocation_state', 'Profile revoked state must be boolean', `$.index.records.${profileId}.revoked`);
    if (!entry.revoked && entry.revocation !== null) throw new ValidationError('invalid_revocation_state', 'Unrevoked profiles must have null revocation', `$.index.records.${profileId}.revocation`);
    if (entry.revoked && (!entry.revocation || typeof entry.revocation !== 'object')) throw new ValidationError('invalid_revocation_state', 'Revoked profiles require revocation metadata', `$.index.records.${profileId}.revocation`);
  }
  return frozen({ schemaVersion: value.schemaVersion, profiles: value.profiles, records });
}
function emptyIndex() { return frozen({ schemaVersion: 'profile-index-v1', profiles: [], records: {} }); }
function parse(record) { return record ? JSON.parse(typeof record.value === 'string' ? record.value : new TextDecoder().decode(record.value)) : null; }
function sameJson(record, expected) {
  try { return JSON.stringify(parse(record)) === JSON.stringify(expected); }
  catch { return false; }
}
async function putImmutable(store, key, value) {
  try {
    await store.put(key, JSON.stringify(value), { onlyIf: { etagDoesNotMatch: '*' } });
    return false;
  } catch (error) {
    if (!(error instanceof ConditionalWriteError)) throw error;
    const existing = await store.get(key);
    if (!existing || !sameJson(existing, value)) throw error;
    return true;
  }
}

export class ProfileRegistry {
  constructor(store) {
    if (!store || typeof store.put !== 'function' || typeof store.get !== 'function') throw new TypeError('ProfileRegistry requires an Audit store');
    this.store = store;
  }
  async publish(bundle) {
    object(bundle); scanAuditForbiddenFields(bundle);
    keys(bundle, new Set(['manifest', 'sbom', 'attestation', 'index', 'indexEtag']));
    required(bundle, new Set(['manifest', 'sbom', 'attestation']));
    const manifest = validateProfileManifest(bundle.manifest);
    const sbom = validateReference(bundle.sbom, 'sbom', manifest.profileId);
    const attestation = validateReference(bundle.attestation, 'attestation', manifest.profileId);
    if (bundle.index !== undefined) validateIndex(bundle.index);
    if (sbom.sha256 !== manifest.sbomSha256 || attestation.sha256 !== manifest.attestationSha256) throw new ValidationError('digest_mismatch', 'Profile reference digests must match the manifest', '$');

    const indexRecord = await this.store.get(profileIndexKey());
    if (bundle.indexEtag !== undefined && (!indexRecord || indexRecord.etag !== bundle.indexEtag)) {
      throw new ValidationError('stale_index', '$.indexEtag is stale', '$.indexEtag');
    }
    const currentIndex = indexRecord ? validateIndex(parse(indexRecord)) : emptyIndex();
    if (currentIndex.records?.[manifest.profileId]) throw new ValidationError('profile_exists', 'Profile already exists', '$.profileId');
    const storedIndex = validateIndex({
      schemaVersion: 'profile-index-v1',
      profiles: [...new Set([...currentIndex.profiles, manifest.profileId])].sort(),
      records: { ...(currentIndex.records ?? {}), [manifest.profileId]: { manifest, revoked: false, revocation: null } }
    });
    const total = new TextEncoder().encode(JSON.stringify({ manifest, sbom, attestation, index: storedIndex })).byteLength;
    if (total > MAX_PROFILE_METADATA_BYTES) throw new ValidationError('profile_metadata_too_large', `Profile metadata exceeds ${MAX_PROFILE_METADATA_BYTES} bytes`, '$');

    const recoveredManifest = await putImmutable(this.store, profileManifestKey(manifest.profileId), manifest);
    const recoveredSbom = await putImmutable(this.store, profileSbomKey(manifest.profileId), sbom);
    const recoveredAttestation = await putImmutable(this.store, profileAttestationKey(manifest.profileId), attestation);
    const onlyIf = indexRecord ? { etagMatches: indexRecord.etag } : { etagDoesNotMatch: '*' };
    await this.store.put(profileIndexKey(), JSON.stringify(storedIndex), { onlyIf });
    return frozen({
      profileId: manifest.profileId,
      recoveredPartialPublication: recoveredManifest || recoveredSbom || recoveredAttestation,
      operationBudget: PROFILE_OPERATION_BUDGETS.publish
    });
  }
  async readIndex() {
    const record = await this.store.get(profileIndexKey());
    if (!record) return emptyIndex();
    return validateIndex(parse(record));
  }
  async read(profileId) {
    assertProfileId(profileId);
    const index = await this.readIndex(); const entry = index.records?.[profileId];
    if (!entry) throw new ValidationError('not_found', 'Profile not found', '$.profileId');
    return frozen({ ...entry.manifest, revoked: entry.revoked, revocation: entry.revocation });
  }
  async revoke(profileId, revocation) {
    assertProfileId(profileId); object(revocation, '$.revocation'); scanAuditForbiddenFields(revocation, '$.revocation');
    const allowed = new Set(['schemaVersion', 'profileId', 'reason', 'revokedAt']); keys(revocation, allowed, '$.revocation'); required(revocation, allowed, '$.revocation');
    if (revocation.schemaVersion !== 'profile-revocation-v1') throw new ValidationError('invalid_schema_version', '$.revocation.schemaVersion must be profile-revocation-v1', '$.revocation.schemaVersion');
    if (revocation.profileId !== profileId) throw new ValidationError('profile_mismatch', '$.revocation.profileId must match', '$.revocation.profileId');
    string(revocation.reason, '$.revocation.reason', 256); instant(revocation.revokedAt, '$.revocation.revokedAt');
    const checkedRevocation = frozen(revocation);
    const indexRecord = await this.store.get(profileIndexKey()); if (!indexRecord) throw new ValidationError('not_found', 'Profile index not found', '$.profileId');
    const index = validateIndex(parse(indexRecord)); if (!index.records?.[profileId]) throw new ValidationError('not_found', 'Profile not found', '$.profileId');
    const existingEntry = index.records[profileId];
    if (existingEntry.revoked) {
      if (JSON.stringify(existingEntry.revocation) !== JSON.stringify(checkedRevocation)) throw new ValidationError('revocation_conflict', 'Existing profile revocation differs from the retry', '$.revocation');
      const recovered = await putImmutable(this.store, profileRevocationKey(profileId), checkedRevocation);
      return frozen({ profileId, revoked: true, idempotent: true, recoveredPartialPublication: recovered, operationBudget: PROFILE_OPERATION_BUDGETS.revoke });
    }
    const recoveredRevocation = await putImmutable(this.store, profileRevocationKey(profileId), checkedRevocation);
    const next = {
      schemaVersion: index.schemaVersion,
      profiles: [...index.profiles],
      records: { ...index.records, [profileId]: { ...existingEntry, revoked: true, revocation: checkedRevocation } }
    };
    const validatedNext = validateIndex(next);
    await this.store.put(profileIndexKey(), JSON.stringify(validatedNext), { onlyIf: { etagMatches: indexRecord.etag } });
    return frozen({ profileId, revoked: true, idempotent: false, recoveredPartialPublication: recoveredRevocation, operationBudget: PROFILE_OPERATION_BUDGETS.revoke });
  }
}
