import { ValidationError } from '../../../packages/audit-protocol/src/index.mjs';
import {
  PHASE4_PROFILE_CATALOG,
  getPhase4Profile,
  listPhase4Profiles
} from '../../../packages/audit-tool-catalog/src/index.mjs';
import { PARSER_VERSIONS } from '../../../packages/audit-tool-parsers/src/index.mjs';
import {
  ApiContractError,
  authenticateAuditRead,
  corsHeaders,
  createJsonResponse,
  errorResponse
} from '../../../packages/audit-api-contracts/src/index.mjs';

export const PHASE4_TOOL_PROFILE_LIST_PATH = '/audit/v1/tool-profiles';
export const PHASE4_TOOL_PROFILE_ITEM_PREFIX = '/audit/v1/tool-profiles/';

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function profileIdFromPath(pathname) {
  if (!pathname.startsWith(PHASE4_TOOL_PROFILE_ITEM_PREFIX)) return null;
  const encoded = pathname.slice(PHASE4_TOOL_PROFILE_ITEM_PREFIX.length);
  if (!encoded || encoded.includes('/')) {
    throw new ApiContractError('invalid_profile_id', 'Profile ID is invalid', '$.profileId');
  }
  let decoded;
  try { decoded = decodeURIComponent(encoded); }
  catch { throw new ApiContractError('invalid_profile_id', 'Profile ID is invalid', '$.profileId'); }
  if (!decoded || decoded.includes('/') || decoded.includes('\\')) {
    throw new ApiContractError('invalid_profile_id', 'Profile ID is invalid', '$.profileId');
  }
  return decoded;
}

function route(pathname) {
  if (pathname === PHASE4_TOOL_PROFILE_LIST_PATH) return { kind: 'list' };
  if (pathname.startsWith(PHASE4_TOOL_PROFILE_ITEM_PREFIX)) {
    return { kind: 'item', profileId: profileIdFromPath(pathname) };
  }
  return null;
}

function exactParserIdentity(catalog, parserVersions) {
  if (!catalog || !Array.isArray(catalog.profiles) || !parserVersions || typeof parserVersions !== 'object') {
    return false;
  }
  const profiles = [...catalog.profiles].sort((left, right) => left.profileId.localeCompare(right.profileId));
  const parserIds = Object.keys(parserVersions).sort();
  if (profiles.length !== parserIds.length) return false;
  return profiles.every((profile, index) => (
    profile.profileId === parserIds[index] &&
    profile.parserVersion === parserVersions[profile.profileId]
  ));
}

export function auditPhase4Capabilities(baseCapabilities, options = {}) {
  const base = baseCapabilities && typeof baseCapabilities === 'object'
    ? structuredClone(baseCapabilities)
    : {};
  const catalog = options.catalog ?? PHASE4_PROFILE_CATALOG;
  const parserVersions = options.parserVersions ?? PARSER_VERSIONS;
  return deepFreeze({
    ...base,
    service: 'curveyield-audit',
    apiVersion: 'audit-v1',
    phase: 4,
    toolProfileCatalog: true,
    toolProfileContracts: true,
    adapterPlans: true,
    outputParsers: exactParserIdentity(catalog, parserVersions),
    resultContracts: false,
    executionEnabled: false,
    executionState: 'awaiting_executor',
    executorState: 'unavailable'
  });
}

export async function handlePhase4CatalogRequest(request, env) {
  let matched;
  try { matched = route(new URL(request.url).pathname); }
  catch (cause) { return errorResponse(cause, env); }
  if (!matched) return null;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(env) });
  }
  try {
    await authenticateAuditRead(request, env);
    if (request.method !== 'GET') {
      throw new ApiContractError(
        'method_not_allowed',
        'Phase 4 profile catalog routes are read-only',
        '$',
        405
      );
    }
    if (matched.kind === 'list') {
      return createJsonResponse({
        schemaVersion: 'phase4-tool-profile-list-v1',
        profiles: listPhase4Profiles(PHASE4_PROFILE_CATALOG)
      }, { env });
    }
    return createJsonResponse(
      getPhase4Profile(PHASE4_PROFILE_CATALOG, matched.profileId),
      { env }
    );
  } catch (cause) {
    if (cause instanceof ValidationError) {
      return errorResponse(new ApiContractError(
        cause.code,
        cause.message,
        cause.path,
        cause.code === 'not_found' ? 404 : 400
      ), env);
    }
    return errorResponse(cause, env);
  }
}
