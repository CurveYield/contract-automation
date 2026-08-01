import { PHASE6_PROFILE_TEMPLATES, publishPhase6Profile } from '../../audit-phase6-profile-contracts/src/index.mjs';
import { PHASE6_PROFILE_RESULT_IDENTITIES } from '../../audit-phase6-result-contracts/src/index.mjs';
import { canonicalJson, deepFreeze, exactKeys, fail, sanitizePhase6ExternalValue } from '../../audit-phase6-result-contracts/src/primitives.mjs';
export const PHASE6_TOOL_CATALOG_VERSION = 'phase6-tool-catalog-v1';
const catalogKeys = ['catalogVersion','entries'];
const entryKeys = ['profileId','contractVersion','purpose','versions','compatibility','publication','digestRequired','runnable','executionEnabled','executor','parserIdentity','captureSchemaVersion','resultSchemaVersion','trustedProducer'];
function validatePublished(profile) {
  const id = profile.profileId;
  const template = PHASE6_PROFILE_TEMPLATES[id];
  if (!template) fail('unknown_profile_id', '$.publishedProfiles.profileId');
  const canonical = publishPhase6Profile(id, { imageDigest: profile.publication?.imageDigest, releaseIdentifier: profile.publication?.releaseIdentifier });
  if (canonicalJson(canonical) !== canonicalJson(profile)) fail('publication_identity_drift', '$.publishedProfiles');
  return canonical;
}
function entryFrom(template, published = null) {
  const identity = PHASE6_PROFILE_RESULT_IDENTITIES[template.profileId];
  const source = published ?? template;
  return {
    profileId: template.profileId,
    contractVersion: template.contractVersion,
    purpose: template.purpose,
    versions: source.versions,
    compatibility: source.compatibility,
    publication: source.publication,
    digestRequired: source.publication.status !== 'published',
    runnable: false,
    executionEnabled: false,
    executor: { available: false, status: 'unavailable', contractVersion: null },
    parserIdentity: { package: identity.parserPackage, version: identity.parserPackageVersion, function: identity.parserId },
    captureSchemaVersion: identity.captureSchemaVersion,
    resultSchemaVersion: identity.resultSchemaVersion,
    trustedProducer: identity.trustedProducer
  };
}
export function createPhase6ToolCatalog(publishedProfiles = []) {
  const safe = sanitizePhase6ExternalValue(publishedProfiles, '$.publishedProfiles');
  if (!Array.isArray(safe)) fail('invalid_array', '$.publishedProfiles');
  const publishedById = new Map();
  for (const profile of safe) { if (!profile || typeof profile !== 'object') fail('invalid_plain_object', '$.publishedProfiles'); const id = profile.profileId; if (publishedById.has(id)) fail('duplicate_profile', '$.publishedProfiles'); publishedById.set(id, validatePublished(profile)); }
  const entries = Object.keys(PHASE6_PROFILE_TEMPLATES).sort().map((id) => entryFrom(PHASE6_PROFILE_TEMPLATES[id], publishedById.get(id)));
  return deepFreeze({ catalogVersion: PHASE6_TOOL_CATALOG_VERSION, entries });
}
export function validatePhase6ToolCatalog(value) {
  const safe = sanitizePhase6ExternalValue(value);
  exactKeys(safe, catalogKeys);
  if (safe.catalogVersion !== PHASE6_TOOL_CATALOG_VERSION) fail('invalid_catalog_version', '$.catalogVersion');
  if (!Array.isArray(safe.entries) || safe.entries.length !== 3) fail('catalog_membership_mismatch', '$.entries');
  const published = [];
  for (let index = 0; index < safe.entries.length; index += 1) {
    const entry = safe.entries[index]; exactKeys(entry, entryKeys, `$.entries[${index}]`);
    if (entry.publication.status === 'published') { const template = structuredClone(PHASE6_PROFILE_TEMPLATES[entry.profileId]); template.publication = entry.publication; template.runnable = false; template.executionEnabled = false; template.executor = { available: false, status: 'unavailable', contractVersion: null }; published.push(template); }
  }
  const expectedIds = Object.keys(PHASE6_PROFILE_TEMPLATES).sort();
  if (safe.entries.map((entry) => entry.profileId).join('\0') !== expectedIds.join('\0')) fail('catalog_membership_mismatch', '$.entries');
  const expected = createPhase6ToolCatalog(published);
  if (canonicalJson(expected) !== canonicalJson(safe)) fail('catalog_identity_drift', '$');
  return expected;
}
