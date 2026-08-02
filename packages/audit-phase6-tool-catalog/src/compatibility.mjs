import { PHASE6_PROFILE_TEMPLATES } from '../../audit-phase6-profile-contracts/src/index.mjs';
import { PHASE6_PROFILE_RESULT_IDENTITIES, validatePhase6ToolResult } from '../../audit-phase6-result-contracts/src/index.mjs';
import { canonicalJson, deepFreeze, fail, sanitizePhase6ExternalValue } from '../../audit-phase6-result-contracts/src/primitives.mjs';
import { createPhase6ToolCatalog, validatePhase6ToolCatalog } from './catalog.mjs';
export const PHASE6_PACKAGE_COMPATIBILITY_VERSION = 'phase6-package-compatibility-v1';
function remap(error, prefix) { const suffix = error?.path === '$' ? '' : String(error?.path ?? '$').slice(1); fail(error?.code ?? 'compatibility_error', `${prefix}${suffix}`); }
export function assertPhase6PackageCompatibility(options = {}) {
  const safe = sanitizePhase6ExternalValue(options, '$.options');
  for (const key of Object.keys(safe)) if (!['catalog','publishedProfiles','results'].includes(key)) fail('unknown_field', `$.options.${key}`);
  const results = safe.results ?? [];
  const publishedProfiles = safe.publishedProfiles ?? [];
  if (!Array.isArray(results)) fail('invalid_array', '$.results');
  if (!Array.isArray(publishedProfiles)) fail('invalid_array', '$.publishedProfiles');
  const profileIds = Object.keys(PHASE6_PROFILE_TEMPLATES).sort();
  if (profileIds.join('\0') !== Object.keys(PHASE6_PROFILE_RESULT_IDENTITIES).sort().join('\0')) fail('profile_set_mismatch', '$');
  let expectedCatalog;
  try { expectedCatalog = createPhase6ToolCatalog(publishedProfiles); } catch (error) { remap(error, '$.publishedProfiles'); }
  let catalog;
  try { catalog = safe.catalog === undefined ? expectedCatalog : validatePhase6ToolCatalog(safe.catalog); } catch (error) { remap(error, '$.catalog'); }
  if (canonicalJson(catalog) !== canonicalJson(expectedCatalog)) fail('catalog_identity_drift', '$.catalog');
  if (catalog.entries.map((entry) => entry.profileId).join('\0') !== profileIds.join('\0')) fail('profile_set_mismatch', '$.catalog');
  for (const entry of catalog.entries) {
    const identity = PHASE6_PROFILE_RESULT_IDENTITIES[entry.profileId];
    const template = PHASE6_PROFILE_TEMPLATES[entry.profileId];
    if (!identity || !template) fail('identity_mismatch', '$.catalog');
    if (entry.versions.tool.version !== identity.toolVersion || entry.captureSchemaVersion !== identity.captureSchemaVersion || entry.resultSchemaVersion !== identity.resultSchemaVersion || entry.trustedProducer !== identity.trustedProducer) fail('identity_mismatch', '$.catalog');
    if (entry.parserIdentity.package !== identity.parserPackage || entry.parserIdentity.version !== identity.parserPackageVersion || entry.parserIdentity.function !== identity.parserId) fail('identity_mismatch', '$.catalog');
    if (entry.runnable !== false || entry.executionEnabled !== false || entry.executor.available !== false || entry.executor.status !== 'unavailable') fail('unsafe_catalog_state', '$.catalog');
  }
  const checked = results.map((result, index) => { try { return validatePhase6ToolResult(result); } catch (error) { remap(error, `$.results[${index}]`); } });
  for (const result of checked) { const identity = PHASE6_PROFILE_RESULT_IDENTITIES[result.profileId]; const template = PHASE6_PROFILE_TEMPLATES[result.profileId]; if (!identity || !template || template.versions.tool.version !== result.toolVersion) fail('identity_mismatch', '$.results'); }
  return deepFreeze({ contractVersion: PHASE6_PACKAGE_COMPATIBILITY_VERSION, compatible: true, profileIds, checkedTemplates: profileIds.length, checkedCatalogEntries: catalog.entries.length, checkedPublishedProfiles: publishedProfiles.length, checkedResults: checked.length });
}
