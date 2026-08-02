import {
  PHASE5_PROFILE_IDS,
  PHASE5_PROFILE_TEMPLATES,
  getPhase5ProfileTemplate,
  validatePublishedPhase5ProfileContract
} from '../../audit-phase5-profile-contracts/src/index.mjs';
import { PHASE5_PARSER_VERSIONS } from '../../audit-phase5-parsers/src/index.mjs';
import {
  PHASE5_RESULT_SCHEMA_VERSION,
  PHASE5_RESULT_CONTRACTS,
  PHASE5_RESULT_PROFILE_IDS
} from '../../audit-phase5-result-contracts/src/index.mjs';
import { fail } from '../../audit-phase5-result-contracts/src/errors.mjs';
import {
  plainObject, ordinaryArray, exactKeys, ownValue, boundedString, deepFrozenClone, assertOrdinaryTree
} from '../../audit-phase5-result-contracts/src/boundary.mjs';

export const PHASE5_CATALOG_ENTRY_SCHEMA_VERSION = 'phase5-tool-catalog-entry-v1';
const ENTRY_KEYS = Object.freeze([
  'schemaVersion', 'profileId', 'parserVersion', 'adapterVersion', 'toolName', 'toolVersion',
  'registryRepository', 'publicationState', 'digestRequired', 'digest', 'publishedAt',
  'runnable', 'executionEnabled', 'executorState'
]);
const SORTED_PROFILE_IDS = Object.freeze([...PHASE5_PROFILE_IDS].sort());
const TEMPLATE_BY_ID = new Map(PHASE5_PROFILE_TEMPLATES.map((template) => [template.profileId, template]));

function booleanLiteral(value, expected, path) {
  if (value !== expected) fail('catalog_field_mismatch', path, `${path} must equal ${expected}`);
}

function stringLiteral(value, expected, path) {
  boundedString(value, path, 512, false);
  if (value !== expected) fail('catalog_field_mismatch', path, `${path} does not match the template`);
}

function digest(value, path) {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(value)) {
    fail('invalid_digest', path, `${path} must be an immutable lowercase digest`);
  }
}

function canonicalInstant(value, path) {
  if (typeof value !== 'string') fail('invalid_timestamp', path, `${path} must be a canonical instant`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    fail('invalid_timestamp', path, `${path} must be a canonical instant`);
  }
}

function catalogEntry(template, published) {
  return {
    schemaVersion: PHASE5_CATALOG_ENTRY_SCHEMA_VERSION,
    profileId: template.profileId,
    parserVersion: template.parserVersion,
    adapterVersion: template.adapterVersion,
    toolName: template.tool.name,
    toolVersion: template.tool.version,
    registryRepository: template.registryRepository,
    publicationState: published ? 'published' : 'unpublished',
    digestRequired: true,
    digest: published ? published.registryArtifact.digest : null,
    publishedAt: published ? published.publishedAt : null,
    runnable: false,
    executionEnabled: false,
    executorState: 'unavailable'
  };
}

function validateEntry(entry, path, expectedProfileId) {
  plainObject(entry, path);
  exactKeys(entry, ENTRY_KEYS, path);
  stringLiteral(ownValue(entry, 'schemaVersion', `${path}.schemaVersion`), PHASE5_CATALOG_ENTRY_SCHEMA_VERSION, `${path}.schemaVersion`);
  const profileId = ownValue(entry, 'profileId', `${path}.profileId`);
  boundedString(profileId, `${path}.profileId`, 80, false);
  if (profileId !== expectedProfileId || !TEMPLATE_BY_ID.has(profileId)) {
    fail('catalog_profile_mismatch', `${path}.profileId`, `${path}.profileId is not canonical`);
  }
  const template = TEMPLATE_BY_ID.get(profileId);
  stringLiteral(ownValue(entry, 'parserVersion', `${path}.parserVersion`), template.parserVersion, `${path}.parserVersion`);
  stringLiteral(ownValue(entry, 'adapterVersion', `${path}.adapterVersion`), template.adapterVersion, `${path}.adapterVersion`);
  stringLiteral(ownValue(entry, 'toolName', `${path}.toolName`), template.tool.name, `${path}.toolName`);
  stringLiteral(ownValue(entry, 'toolVersion', `${path}.toolVersion`), template.tool.version, `${path}.toolVersion`);
  stringLiteral(ownValue(entry, 'registryRepository', `${path}.registryRepository`), template.registryRepository, `${path}.registryRepository`);
  const publicationState = ownValue(entry, 'publicationState', `${path}.publicationState`);
  if (publicationState !== 'published' && publicationState !== 'unpublished') {
    fail('invalid_publication_state', `${path}.publicationState`, `${path}.publicationState is invalid`);
  }
  booleanLiteral(ownValue(entry, 'digestRequired', `${path}.digestRequired`), true, `${path}.digestRequired`);
  const digestValue = ownValue(entry, 'digest', `${path}.digest`);
  const publishedAt = ownValue(entry, 'publishedAt', `${path}.publishedAt`);
  if (publicationState === 'published') {
    digest(digestValue, `${path}.digest`);
    canonicalInstant(publishedAt, `${path}.publishedAt`);
  } else {
    if (digestValue !== null) fail('catalog_field_mismatch', `${path}.digest`, `${path}.digest must be null`);
    if (publishedAt !== null) fail('catalog_field_mismatch', `${path}.publishedAt`, `${path}.publishedAt must be null`);
  }
  booleanLiteral(ownValue(entry, 'runnable', `${path}.runnable`), false, `${path}.runnable`);
  booleanLiteral(ownValue(entry, 'executionEnabled', `${path}.executionEnabled`), false, `${path}.executionEnabled`);
  stringLiteral(ownValue(entry, 'executorState', `${path}.executorState`), 'unavailable', `${path}.executorState`);
  return entry;
}

export function validatePhase5Catalog(value) {
  ordinaryArray(value, '$', SORTED_PROFILE_IDS.length);
  if (value.length !== SORTED_PROFILE_IDS.length) fail('catalog_membership_mismatch', '$', 'catalog must contain exactly four profiles');
  value.forEach((entry, index) => validateEntry(entry, `$[${index}]`, SORTED_PROFILE_IDS[index]));
  return deepFrozenClone(value);
}

export function createPhase5ToolCatalog(publishedProfiles = []) {
  ordinaryArray(publishedProfiles, '$.publishedProfiles', SORTED_PROFILE_IDS.length);
  const publishedById = new Map();
  publishedProfiles.forEach((contract, index) => {
    const path = `$.publishedProfiles[${index}]`;
    plainObject(contract, path);
    assertOrdinaryTree(contract, path);
    let validated;
    try {
      validated = validatePublishedPhase5ProfileContract(contract);
    } catch (error) {
      const upstreamPath = typeof error?.path === 'string' ? error.path : '$';
      fail(error?.code ?? 'invalid_published_profile', `${path}${upstreamPath.slice(1)}`, error?.message ?? 'published profile is invalid');
    }
    if (!TEMPLATE_BY_ID.has(validated.profileId)) fail('unknown_profile_id', `${path}.profileId`, 'published profile is not Phase 5');
    if (publishedById.has(validated.profileId)) fail('catalog_duplicate', path, 'published profile is duplicated');
    const template = getPhase5ProfileTemplate(validated.profileId);
    if (
      validated.profileId !== template.profileId || validated.parserVersion !== template.parserVersion ||
      validated.adapterVersion !== template.adapterVersion || validated.tool.name !== template.tool.name ||
      validated.tool.version !== template.tool.version || validated.registryArtifact.repository !== template.registryRepository ||
      validated.executionEnabled !== false || validated.executorState !== 'unavailable'
    ) fail('immutable_profile_mismatch', path, 'published profile identity drifted');
    publishedById.set(validated.profileId, validated);
  });
  const catalog = SORTED_PROFILE_IDS.map((profileId) => catalogEntry(TEMPLATE_BY_ID.get(profileId), publishedById.get(profileId) ?? null));
  return validatePhase5Catalog(catalog);
}

export function assertPhase5PackageCompatibility() {
  const profileIds = [...PHASE5_PROFILE_IDS].sort();
  const templateIds = PHASE5_PROFILE_TEMPLATES.map((template) => template.profileId).sort();
  const parserIds = Object.keys(PHASE5_PARSER_VERSIONS).sort();
  const resultIds = [...PHASE5_RESULT_PROFILE_IDS].sort();
  const catalogIds = createPhase5ToolCatalog().map((entry) => entry.profileId);
  const expected = JSON.stringify(profileIds);
  for (const [path, ids] of [
    ['$.templates', templateIds], ['$.parsers', parserIds], ['$.results', resultIds], ['$.catalog', catalogIds]
  ]) if (JSON.stringify(ids) !== expected) fail('phase5_package_mismatch', path, `${path} profile membership differs`);

  const parserVersions = {};
  const evidenceTypes = {};
  const resultRecordKeys = {};
  for (const profileId of profileIds) {
    const template = getPhase5ProfileTemplate(profileId);
    const resultContract = PHASE5_RESULT_CONTRACTS[profileId];
    if (template.parserVersion !== PHASE5_PARSER_VERSIONS[profileId] || template.parserVersion !== resultContract.parserVersion) {
      fail('phase5_package_mismatch', `$.parserVersions.${profileId}`, 'parser versions differ');
    }
    if (template.executionEnabled !== false || template.executorState !== 'unavailable' || template.digestRequired !== true) {
      fail('execution_boundary_violation', `$.templates.${profileId}`, 'template boundary drifted');
    }
    parserVersions[profileId] = template.parserVersion;
    evidenceTypes[profileId] = resultContract.evidenceType;
    resultRecordKeys[profileId] = resultContract.recordKey;
  }
  return deepFrozenClone({
    schemaVersion: 'phase5-package-compatibility-v2',
    resultSchemaVersion: PHASE5_RESULT_SCHEMA_VERSION,
    profileIds,
    parserVersions,
    evidenceTypes,
    resultRecordKeys,
    compatible: true,
    runnable: false,
    executionEnabled: false,
    executorState: 'unavailable'
  });
}
