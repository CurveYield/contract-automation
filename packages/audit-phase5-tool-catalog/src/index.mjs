import {
  PHASE5_PROFILE_IDS,
  PHASE5_PROFILE_TEMPLATES,
  getPhase5ProfileTemplate,
  validatePublishedPhase5ProfileContract
} from '../../audit-phase5-profile-contracts/src/index.mjs';
import { PHASE5_PARSER_VERSIONS } from '../../audit-phase5-parsers/src/index.mjs';

function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function plain(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('invalid_object', `${path} must be an object`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail('invalid_object', `${path} must be a plain object`);
}

export function createPhase5ToolCatalog(publishedProfiles = []) {
  if (!Array.isArray(publishedProfiles)) fail('invalid_catalog_input', 'publishedProfiles must be an array');
  const publishedById = new Map();
  for (const [index, contract] of publishedProfiles.entries()) {
    plain(contract, `$.publishedProfiles[${index}]`);
    const validated = validatePublishedPhase5ProfileContract(contract);
    if (publishedById.has(validated.profileId)) fail('catalog_duplicate', 'duplicate published profile');
    publishedById.set(validated.profileId, validated);
  }
  const records = [...PHASE5_PROFILE_TEMPLATES]
    .sort((a, b) => a.profileId.localeCompare(b.profileId))
    .map((template) => {
      const published = publishedById.get(template.profileId) ?? null;
      return freeze({
        profileId: template.profileId,
        parserVersion: template.parserVersion,
        adapterVersion: template.adapterVersion,
        toolName: template.tool.name,
        toolVersion: template.tool.version,
        publicationState: published ? 'published' : 'unpublished',
        digestRequired: !published,
        digest: published ? published.registryArtifact.digest : null,
        runnable: false,
        executionEnabled: false,
        executorState: 'unavailable'
      });
    });
  if (publishedById.size > records.length) fail('unknown_profile_id', 'published profile is outside Phase 5 catalog');
  return freeze(records);
}

export function assertPhase5PackageCompatibility() {
  const ids = [...PHASE5_PROFILE_IDS].sort();
  const templateIds = PHASE5_PROFILE_TEMPLATES.map((item) => item.profileId).sort();
  const parserIds = Object.keys(PHASE5_PARSER_VERSIONS).sort();
  const catalogIds = createPhase5ToolCatalog().map((item) => item.profileId).sort();
  const encoded = JSON.stringify(ids);
  if (JSON.stringify(templateIds) !== encoded || JSON.stringify(parserIds) !== encoded || JSON.stringify(catalogIds) !== encoded) {
    fail('phase5_package_mismatch', 'Phase 5 profile, parser, and catalog sets differ');
  }
  for (const profileId of ids) {
    const template = getPhase5ProfileTemplate(profileId);
    if (template.profileId !== profileId || template.parserVersion !== PHASE5_PARSER_VERSIONS[profileId]) fail('phase5_package_mismatch', `Phase 5 parser mismatch for ${profileId}`);
    if (template.executionEnabled !== false || template.executorState !== 'unavailable') fail('execution_boundary_violation', `Phase 5 execution boundary drift for ${profileId}`);
    if (template.publicationState !== 'unpublished' || template.digestRequired !== true) fail('publication_boundary_violation', `Phase 5 template publication drift for ${profileId}`);
  }
  return freeze({
    schemaVersion: 'phase5-package-compatibility-v1',
    profileIds: ids,
    compatible: true,
    executionEnabled: false,
    executorState: 'unavailable'
  });
}
