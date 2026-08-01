import { PHASE6_PROFILE_TEMPLATES } from '../../audit-phase6-profile-contracts/src/index.mjs';
import { PHASE6_PROFILE_RESULT_IDENTITIES, validatePhase6ToolResult } from '../../audit-phase6-result-contracts/src/index.mjs';
import { deepFreeze, fail, sanitizePhase6ExternalValue } from '../../audit-phase6-result-contracts/src/primitives.mjs';
import { createPhase6ToolCatalog, validatePhase6ToolCatalog } from './catalog.mjs';
export const PHASE6_PACKAGE_COMPATIBILITY_VERSION = 'phase6-package-compatibility-v1';
function remap(error, prefix) { const suffix = error?.path === '$' ? '' : String(error?.path ?? '$').slice(1); fail(error?.code ?? 'compatibility_error', `${prefix}${suffix}`); }
export function assertPhase6PackageCompatibility(options = {}) {
  const safe = sanitizePhase6ExternalValue(options, '$.options');
  for (const key of Object.keys(safe)) if (key !== 'results') fail('unknown_field', `$.options.${key}`);
  const results = safe.results ?? [];
  if (!Array.isArray(results)) fail('invalid_array', '$.results');
  const profileIds = Object.keys(PHASE6_PROFILE_TEMPLATES).sort();
  if (profileIds.join('\0') !== Object.keys(PHASE6_PROFILE_RESULT_IDENTITIES).sort().join('\0')) fail('profile_set_mismatch', '$');
  const catalog = validatePhase6ToolCatalog(createPhase6ToolCatalog());
  if (catalog.entries.map((entry) => entry.profileId).join('\0') !== profileIds.join('\0')) fail('profile_set_mismatch', '$.catalog');
  const checked = results.map((result, index) => { try { return validatePhase6ToolResult(result); } catch (error) { remap(error, `$.results[${index}]`); } });
  for (const result of checked) { const identity = PHASE6_PROFILE_RESULT_IDENTITIES[result.profileId]; const template = PHASE6_PROFILE_TEMPLATES[result.profileId]; if (!identity || !template || template.versions.tool.version !== result.toolVersion) fail('identity_mismatch', '$.results'); }
  return deepFreeze({ contractVersion: PHASE6_PACKAGE_COMPATIBILITY_VERSION, compatible: true, profileIds, checkedTemplates: profileIds.length, checkedCatalogEntries: catalog.entries.length, checkedResults: checked.length });
}
