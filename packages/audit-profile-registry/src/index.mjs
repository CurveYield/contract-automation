import { ValidationError, createOperationBudget, scanAuditForbiddenFields } from '../../audit-protocol/src/index.mjs';

export const MAX_PROFILE_METADATA_BYTES = 5_000_000;
export const PROFILE_OPERATION_BUDGETS = Object.freeze({
  publish: Object.freeze(createOperationBudget({ classA: 4, classB: 0, storageBytes: 1_000_000 })),
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
  sha256(value.sbomSha256, '$.sbomSha256'); sha256(value.attestationSha256, '$.attestationSha256'); instant(value.publishedAt, '$.publishedAt');
  return structuredClone(value);
}

function validateReference(value, kind, profileId) {
  object(value, `$.${kind}`);
  const allowed = new Set(['schemaVersion', 'sha256', 'objectKey']);
  keys(value, allowed, `$.${kind}`); required(value, allowed, `$.${kind}`);
  const version = kind === 'sbom' ? 'sbom-reference-v1' : 'attestation-reference-v1';
  if (value.schemaVersion !== version) throw new ValidationError('invalid_schema_version', `$.${kind}.schemaVersion must be ${version}`, `$.${kind}.schemaVersion`);
  sha256(value.sha256, `$.${kind}.sha256`); safeKey(value.objectKey, `$.${kind}.objectKey`);
  if (!value.objectKey.startsWith(`profiles/${profileId}/`)) throw new ValidationError('invalid_object_key', `$.${kind}.objectKey must remain under the profile prefix`, `$.${kind}.objectKey`);
  return structuredClone(value);
}
function validateIndex(value) {
  object(value, '$.index');
  keys(value, new Set(['schemaVersion', 'profiles', 'records']), '$.index');
  required(value, new Set(['schemaVersion', 'profiles']), '$.index');
  if (value.schemaVersion !== 'profile-index-v1') throw new ValidationError('invalid_schema_version', '$.index.schemaVersion must be profile-index-v1', '$.index.schemaVersion');
  if (!Array.isArray(value.profiles) || value.profiles.some((id) => { try { assertProfileId(id); return false; } catch { return true; } })) throw new ValidationError('invalid_profile_index', '$.index.profiles is invalid', '$.index.profiles');
  if (value.records !== undefined) object(value.records, '$.index.records');
  return structuredClone(value);
}
function parse(record) { return record ? JSON.parse(typeof record.value === 'string' ? record.value : new TextDecoder().decode(record.value)) : null; }

export class ProfileRegistry {
  constructor(store) {
    if (!store || typeof store.put !== 'function' || typeof store.get !== 'function') throw new TypeError('ProfileRegistry requires an Audit store');
    this.store = store;
  }
  async publish(bundle) {
    object(bundle); scanAuditForbiddenFields(bundle);
    keys(bundle, new Set(['manifest', 'sbom', 'attestation', 'index', 'indexEtag'])); required(bundle, new Set(['manifest', 'sbom', 'attestation', 'index']));
    const manifest = validateProfileManifest(bundle.manifest);
    const sbom = validateReference(bundle.sbom, 'sbom', manifest.profileId);
    const attestation = validateReference(bundle.attestation, 'attestation', manifest.profileId);
    const suppliedIndex = validateIndex(bundle.index);
    if (!suppliedIndex.profiles.includes(manifest.profileId)) throw new ValidationError('invalid_profile_index', '$.index.profiles must include the published profile', '$.index.profiles');
    if (sbom.sha256 !== manifest.sbomSha256 || attestation.sha256 !== manifest.attestationSha256) throw new ValidationError('digest_mismatch', 'Profile reference digests must match the manifest', '$');
    const storedIndex = { schemaVersion: 'profile-index-v1', profiles: [...new Set(suppliedIndex.profiles)].sort(), records: { ...(suppliedIndex.records ?? {}), [manifest.profileId]: { manifest, revoked: false, revocation: null } } };
    const total = new TextEncoder().encode(JSON.stringify({ manifest, sbom, attestation, index: storedIndex })).byteLength;
    if (total > MAX_PROFILE_METADATA_BYTES) throw new ValidationError('profile_metadata_too_large', `Profile metadata exceeds ${MAX_PROFILE_METADATA_BYTES} bytes`, '$');
    await this.store.put(profileManifestKey(manifest.profileId), JSON.stringify(manifest), { onlyIf: { etagDoesNotMatch: '*' } });
    await this.store.put(profileSbomKey(manifest.profileId), JSON.stringify(sbom), { onlyIf: { etagDoesNotMatch: '*' } });
    await this.store.put(profileAttestationKey(manifest.profileId), JSON.stringify(attestation), { onlyIf: { etagDoesNotMatch: '*' } });
    const onlyIf = bundle.indexEtag ? { etagMatches: bundle.indexEtag } : { etagDoesNotMatch: '*' };
    await this.store.put(profileIndexKey(), JSON.stringify(storedIndex), { onlyIf });
    return Object.freeze({ profileId: manifest.profileId, operationBudget: PROFILE_OPERATION_BUDGETS.publish });
  }
  async readIndex() {
    const record = await this.store.get(profileIndexKey());
    if (!record) return Object.freeze({ schemaVersion: 'profile-index-v1', profiles: [], records: {} });
    return Object.freeze(parse(record));
  }
  async read(profileId) {
    assertProfileId(profileId);
    const index = await this.readIndex(); const entry = index.records?.[profileId];
    if (!entry) throw new ValidationError('not_found', 'Profile not found', '$.profileId');
    return Object.freeze({ ...entry.manifest, revoked: entry.revoked, revocation: entry.revocation });
  }
  async revoke(profileId, revocation) {
    assertProfileId(profileId); object(revocation, '$.revocation'); scanAuditForbiddenFields(revocation, '$.revocation');
    const allowed = new Set(['schemaVersion', 'profileId', 'reason', 'revokedAt']); keys(revocation, allowed, '$.revocation'); required(revocation, allowed, '$.revocation');
    if (revocation.schemaVersion !== 'profile-revocation-v1') throw new ValidationError('invalid_schema_version', '$.revocation.schemaVersion must be profile-revocation-v1', '$.revocation.schemaVersion');
    if (revocation.profileId !== profileId) throw new ValidationError('profile_mismatch', '$.revocation.profileId must match', '$.revocation.profileId');
    string(revocation.reason, '$.revocation.reason', 256); instant(revocation.revokedAt, '$.revocation.revokedAt');
    const indexRecord = await this.store.get(profileIndexKey()); if (!indexRecord) throw new ValidationError('not_found', 'Profile index not found', '$.profileId');
    const index = parse(indexRecord); if (!index.records?.[profileId]) throw new ValidationError('not_found', 'Profile not found', '$.profileId');
    await this.store.put(profileRevocationKey(profileId), JSON.stringify(revocation), { onlyIf: { etagDoesNotMatch: '*' } });
    index.records[profileId] = { ...index.records[profileId], revoked: true, revocation: structuredClone(revocation) };
    await this.store.put(profileIndexKey(), JSON.stringify(index), { onlyIf: { etagMatches: indexRecord.etag } });
    return Object.freeze({ profileId, revoked: true, operationBudget: PROFILE_OPERATION_BUDGETS.revoke });
  }
}
