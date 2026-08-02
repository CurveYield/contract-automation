import {
  PHASE5_PROFILE_IDS, PHASE5_PROFILE_TEMPLATES, getPhase5ProfileTemplate,
  validatePublishedPhase5ProfileContract
} from '../../audit-phase5-profile-contracts/src/index.mjs';
import { PHASE5_PARSER_VERSIONS } from '../../audit-phase5-parsers/src/index.mjs';
import {
  PHASE5_RESULT_SCHEMA_VERSION, PHASE5_RESULT_CONTRACTS, PHASE5_RESULT_PROFILE_IDS
} from '../../audit-phase5-result-contracts/src/index.mjs';

export const PHASE5_CATALOG_ENTRY_SCHEMA_VERSION = 'phase5-tool-catalog-entry-v1';
const IDS = Object.freeze([...PHASE5_PROFILE_IDS].sort());
function fail(code, path, message = code) { const error = new Error(message); error.name='Phase5CatalogError'; error.code=code; error.path=path; throw error; }
function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }
function entry(template, published = null) {
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
export function createPhase5ToolCatalog(publishedProfiles = []) {
  if (!Array.isArray(publishedProfiles) || publishedProfiles.length > IDS.length) fail('invalid_array', '$.publishedProfiles');
  const published = new Map();
  publishedProfiles.forEach((item, index) => {
    let checked;
    try { checked = validatePublishedPhase5ProfileContract(item); } catch (error) { fail(error.code ?? 'invalid_published_profile', `$.publishedProfiles[${index}]${error.path?.slice(1) ?? ''}`); }
    if (published.has(checked.profileId)) fail('catalog_duplicate', `$.publishedProfiles[${index}]`);
    published.set(checked.profileId, checked);
  });
  return freeze(IDS.map((id) => entry(getPhase5ProfileTemplate(id), published.get(id) ?? null)));
}
export function validatePhase5Catalog(value) {
  if (!Array.isArray(value) || value.length !== IDS.length) fail('catalog_membership_mismatch', '$');
  const expected = createPhase5ToolCatalog(value.filter((item) => item.publicationState === 'published').map((item) => {
    const template = structuredClone(getPhase5ProfileTemplate(item.profileId));
    template.schemaVersion='phase5-tool-profile-contract-v1'; template.publicationState='published'; template.digestRequired=false;
    template.registryArtifact={repository:template.registryRepository,digest:item.digest}; template.publishedAt=item.publishedAt;
    return template;
  }));
  if (JSON.stringify(value) !== JSON.stringify(expected)) fail('catalog_field_mismatch', '$');
  return expected;
}
export function assertPhase5PackageCompatibility() {
  const expected = JSON.stringify(IDS);
  const sets = [PHASE5_PROFILE_TEMPLATES.map(x=>x.profileId).sort(), Object.keys(PHASE5_PARSER_VERSIONS).sort(), [...PHASE5_RESULT_PROFILE_IDS].sort(), createPhase5ToolCatalog().map(x=>x.profileId)];
  if (sets.some((ids) => JSON.stringify(ids)!==expected)) fail('phase5_package_mismatch', '$');
  for (const id of IDS) {
    const template=getPhase5ProfileTemplate(id); const result=PHASE5_RESULT_CONTRACTS[id];
    if (template.parserVersion!==PHASE5_PARSER_VERSIONS[id] || result.parserVersion!==template.parserVersion) fail('phase5_package_mismatch', `$.parserVersions.${id}`);
    if (template.executionEnabled!==false || template.executorState!=='unavailable') fail('execution_boundary_violation', `$.templates.${id}`);
  }
  return freeze({schemaVersion:'phase5-package-compatibility-v2',resultSchemaVersion:PHASE5_RESULT_SCHEMA_VERSION,profileIds:IDS,compatible:true,runnable:false,executionEnabled:false,executorState:'unavailable'});
}
