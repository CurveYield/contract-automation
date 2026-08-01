import {
  ValidationError,
  assertProfileId
} from '../../audit-protocol/src/index.mjs';
import {
  PHASE4_PROFILE_TEMPLATES,
  validatePublishedProfileContract
} from '../../audit-tool-profile-contracts/src/index.mjs';

export const PHASE4_PROFILE_CATALOG_SCHEMA_VERSION = 'phase4-tool-profile-catalog-v1';

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function frozenClone(value) {
  return deepFreeze(structuredClone(value));
}

function publishedProfilesById(publishedProfiles) {
  if (!Array.isArray(publishedProfiles)) {
    throw new ValidationError('invalid_array', '$.publishedProfiles must be an array', '$.publishedProfiles');
  }
  const result = new Map();
  for (let index = 0; index < publishedProfiles.length; index += 1) {
    const validated = validatePublishedProfileContract(publishedProfiles[index]);
    if (result.has(validated.profileId)) {
      throw new ValidationError(
        'duplicate_profile',
        `$.publishedProfiles[${index}].profileId is duplicated`,
        `$.publishedProfiles[${index}].profileId`
      );
    }
    result.set(validated.profileId, validated);
  }
  return result;
}

export function createPhase4ProfileCatalog(publishedProfiles = []) {
  const publishedById = publishedProfilesById(publishedProfiles);
  const profiles = PHASE4_PROFILE_TEMPLATES
    .map((template) => publishedById.get(template.profileId) ?? template)
    .map((profile) => structuredClone(profile))
    .sort((left, right) => left.profileId.localeCompare(right.profileId));

  return deepFreeze({
    schemaVersion: PHASE4_PROFILE_CATALOG_SCHEMA_VERSION,
    profiles
  });
}

export const PHASE4_PROFILE_CATALOG = createPhase4ProfileCatalog();

function validateCatalog(catalog) {
  if (
    !catalog ||
    typeof catalog !== 'object' ||
    Array.isArray(catalog) ||
    catalog.schemaVersion !== PHASE4_PROFILE_CATALOG_SCHEMA_VERSION ||
    !Array.isArray(catalog.profiles)
  ) {
    throw new ValidationError('invalid_catalog', '$.catalog must be a Phase 4 profile catalog', '$.catalog');
  }
  return catalog;
}

export function listPhase4Profiles(catalog = PHASE4_PROFILE_CATALOG) {
  return frozenClone(validateCatalog(catalog).profiles);
}

export function getPhase4Profile(catalog, profileId) {
  const validatedCatalog = validateCatalog(catalog ?? PHASE4_PROFILE_CATALOG);
  assertProfileId(profileId, '$.profileId');
  const profile = validatedCatalog.profiles.find((candidate) => candidate.profileId === profileId);
  if (!profile) {
    throw new ValidationError('not_found', 'Phase 4 profile not found', '$.profileId');
  }
  return frozenClone(profile);
}
