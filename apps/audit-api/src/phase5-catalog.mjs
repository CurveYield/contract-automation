import {
  ApiContractError,
  corsHeaders,
  createJsonResponse,
  errorResponse
} from '../../../packages/audit-api-contracts/src/index.mjs';
import {
  AUDIT_ROUTE_SCOPES,
  authorizeAuditReadRequest
} from '../../../packages/audit-api-contracts/src/authorization.mjs';
import { createAcceptedPhase5Catalog } from '../../../packages/audit-catalog-composition/src/index.mjs';

export const PHASE5_TOOL_PROFILE_LIST_PATH = '/audit/v1/phase5/tool-profiles';
const ITEM_PREFIX = `${PHASE5_TOOL_PROFILE_LIST_PATH}/`;
const CATALOG = createAcceptedPhase5Catalog();

function match(pathname) {
  if (pathname === PHASE5_TOOL_PROFILE_LIST_PATH) return { kind: 'list' };
  if (!pathname.startsWith(ITEM_PREFIX)) return null;
  const encoded = pathname.slice(ITEM_PREFIX.length);
  if (!encoded || encoded.includes('/')) {
    throw new ApiContractError('invalid_profile_id', 'Profile ID is invalid', '$.profileId');
  }
  let profileId;
  try { profileId = decodeURIComponent(encoded); }
  catch { throw new ApiContractError('invalid_profile_id', 'Profile ID is invalid', '$.profileId'); }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(profileId)) {
    throw new ApiContractError('invalid_profile_id', 'Profile ID is invalid', '$.profileId');
  }
  return { kind: 'item', profileId };
}

export async function handlePhase5CatalogRequest(request, env) {
  let route;
  try { route = match(new URL(request.url).pathname); }
  catch (cause) { return errorResponse(cause, env); }
  if (!route) return null;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(env) });
  }
  try {
    if (request.method !== 'GET') {
      throw new ApiContractError('method_not_allowed', 'Phase 5 catalog routes are read-only', '$', 405);
    }
    await authorizeAuditReadRequest(request, env, { routeScope: AUDIT_ROUTE_SCOPES.catalogRead });
    if (route.kind === 'list') {
      return createJsonResponse({
        schemaVersion: 'phase5-tool-profile-list-v2',
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
