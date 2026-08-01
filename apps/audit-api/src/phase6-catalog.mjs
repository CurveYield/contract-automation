import {
  ApiContractError,
  authenticateAuditRead,
  corsHeaders,
  createJsonResponse,
  errorResponse
} from '../../../packages/audit-api-contracts/src/index.mjs';
import { createAcceptedPhase6Catalog } from '../../../packages/audit-catalog-composition/src/index.mjs';

export const PHASE6_TOOL_PROFILE_LIST_PATH = '/audit/v1/phase6/tool-profiles';
const ITEM_PREFIX = `${PHASE6_TOOL_PROFILE_LIST_PATH}/`;
const CATALOG = createAcceptedPhase6Catalog();

function match(pathname) {
  if (pathname === PHASE6_TOOL_PROFILE_LIST_PATH) return { kind: 'list' };
  if (!pathname.startsWith(ITEM_PREFIX)) return null;
  const encoded = pathname.slice(ITEM_PREFIX.length);
  if (!encoded || encoded.includes('/')) {
    throw new ApiContractError('invalid_profile_id', 'Profile ID is invalid', '$.profileId');
  }
  let profileId;
  try { profileId = decodeURIComponent(encoded); }
  catch { throw new ApiContractError('invalid_profile_id', 'Profile ID is invalid', '$.profileId'); }
  if (!profileId || profileId.includes('/') || profileId.includes('\\')) {
    throw new ApiContractError('invalid_profile_id', 'Profile ID is invalid', '$.profileId');
  }
  return { kind: 'item', profileId };
}

export async function handlePhase6CatalogRequest(request, env) {
  let route;
  try { route = match(new URL(request.url).pathname); }
  catch (cause) { return errorResponse(cause, env); }
  if (!route) return null;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(env) });
  }
  try {
    await authenticateAuditRead(request, env);
    if (request.method !== 'GET') {
      throw new ApiContractError('method_not_allowed', 'Phase 6 catalog routes are read-only', '$', 405);
    }
    if (route.kind === 'list') {
      return createJsonResponse({
        schemaVersion: 'phase6-tool-profile-list-v1',
        profiles: CATALOG
      }, { env });
    }
    const profile = CATALOG.find((entry) => entry.profileId === route.profileId);
    if (!profile) throw new ApiContractError('not_found', 'Profile not found', '$.profileId', 404);
    return createJsonResponse(profile, { env });
  } catch (cause) {
    return errorResponse(cause, env);
  }
}
