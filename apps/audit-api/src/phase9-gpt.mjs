import { PHASE4_PROFILE_CATALOG } from '../../../packages/audit-tool-catalog/src/index.mjs';
import {
  ApiContractError,
  authenticateAuditRead,
  corsHeaders,
  createJsonResponse,
  decodePageCursor,
  encodePageCursor,
  errorResponse,
  parsePageLimit
} from '../../../packages/audit-api-contracts/src/index.mjs';
import { resolveAuditReadScope } from '../../../packages/audit-api-contracts/src/discovery.mjs';
import { validateStatusSummary } from '../../../packages/audit-api-contracts/src/status.mjs';
import {
  createAggregateAuditCapabilities,
  createAuditCatalogComposition
} from '../../../packages/audit-catalog-composition/src/index.mjs';
import { handlePhase9ReportRequest } from './phase9-reports.mjs';

const CAPABILITIES_PATH = '/audit/v1/gpt/capabilities';
const CATALOG_PATH = '/audit/v1/gpt/catalog';
const CATALOG_ITEM_PREFIX = `${CATALOG_PATH}/`;
const REPORTS_PATH = '/audit/v1/gpt/reports';
const REPORTS_ITEM_PREFIX = `${REPORTS_PATH}/`;
const CAMPAIGN_PREFIX = '/audit/v1/gpt/campaigns/';
const JOB_PREFIX = '/audit/v1/gpt/jobs/';

const CATALOG = createAuditCatalogComposition({
  phase4Profiles: PHASE4_PROFILE_CATALOG.profiles
});
const CAPABILITIES = createAggregateAuditCapabilities({
  catalog: CATALOG,
  basePhases: { phase1: true, phase2: true, phase3: true },
  phase4ResultContracts: false,
  phase7Available: false,
  phase8Available: false
});

function decodedSegment(encoded, code, path) {
  if (!encoded || encoded.includes('/')) {
    throw new ApiContractError(code, 'Identifier is invalid', path);
  }
  let value;
  try { value = decodeURIComponent(encoded); }
  catch { throw new ApiContractError(code, 'Identifier is invalid', path); }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value)) {
    throw new ApiContractError(code, 'Identifier is invalid', path);
  }
  return value;
}

function statusRoute(pathname, prefix, resourceType) {
  if (!pathname.startsWith(prefix)) return null;
  const suffix = pathname.slice(prefix.length);
  if (!suffix.endsWith('/status')) {
    throw new ApiContractError('invalid_resource_id', 'Status route is invalid', '$.resourceId');
  }
  const encoded = suffix.slice(0, -'/status'.length);
  return {
    kind: 'status',
    resourceType,
    resourceId: decodedSegment(encoded, 'invalid_resource_id', '$.resourceId')
  };
}

function match(pathname) {
  if (pathname === CAPABILITIES_PATH) return { kind: 'capabilities' };
  if (pathname === CATALOG_PATH) return { kind: 'catalog-list' };
  if (pathname.startsWith(CATALOG_ITEM_PREFIX)) {
    return {
      kind: 'catalog-item',
      profileId: decodedSegment(
        pathname.slice(CATALOG_ITEM_PREFIX.length),
        'invalid_profile_id',
        '$.profileId'
      )
    };
  }
  if (pathname === REPORTS_PATH || pathname.startsWith(REPORTS_ITEM_PREFIX)) {
    return { kind: 'reports' };
  }
  return statusRoute(pathname, CAMPAIGN_PREFIX, 'campaign') ??
    statusRoute(pathname, JOB_PREFIX, 'job');
}

function exactQuery(url, allowed) {
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key)) {
      throw new ApiContractError('invalid_query', 'Query parameter is not allowed', '$.query');
    }
  }
  for (const key of allowed) {
    if (url.searchParams.getAll(key).length > 1) {
      throw new ApiContractError('invalid_query', 'Duplicate query parameter', '$.query');
    }
  }
}

function providerMethod(env, name) {
  const provider = env?.AUDIT_STATUS_DISCOVERY;
  const descriptor = provider && typeof provider === 'object'
    ? Object.getOwnPropertyDescriptor(provider, name)
    : null;
  if (!descriptor || typeof descriptor.value !== 'function') {
    throw new ApiContractError(
      'capability_unavailable',
      'Status discovery is unavailable',
      '$',
      503
    );
  }
  return descriptor.value.bind(provider);
}

function gptIdentity(identity) {
  if (identity.identity !== 'client' && identity.identity !== 'gpt') {
    throw new ApiContractError('forbidden', 'GPT read identity required', '$', 403);
  }
  return identity;
}

function rewrittenReportRequest(request) {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace('/audit/v1/gpt/reports', '/audit/v1/reports');
  return new Request(url, {
    method: request.method,
    headers: request.headers
  });
}

export async function handlePhase9GptRequest(request, env) {
  const url = new URL(request.url);
  let route;
  try { route = match(url.pathname); }
  catch (cause) { return errorResponse(cause, env); }
  if (!route) return null;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(env) });
  }
  try {
    const identity = gptIdentity(await authenticateAuditRead(request, env));
    const scope = resolveAuditReadScope(identity, env);
    if (request.method !== 'GET') {
      throw new ApiContractError('method_not_allowed', 'GPT routes are read-only', '$', 405);
    }
    if (route.kind === 'reports') {
      return handlePhase9ReportRequest(rewrittenReportRequest(request), env);
    }
    const cache = {
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
      route: url.pathname,
      query: url.search
    };
    if (route.kind === 'capabilities') {
      exactQuery(url, new Set());
      return createJsonResponse(CAPABILITIES, { env, cache });
    }
    if (route.kind === 'catalog-item') {
      exactQuery(url, new Set());
      const profile = CATALOG.entries.find((entry) => entry.profileId === route.profileId);
      if (!profile) {
        throw new ApiContractError('not_found', 'Profile not found', '$.profileId', 404);
      }
      return createJsonResponse(profile, { env, cache });
    }
    if (route.kind === 'catalog-list') {
      exactQuery(url, new Set(['limit', 'cursor']));
      const limit = parsePageLimit(url.searchParams.get('limit'));
      const cursorScope = `${scope.tenantId}/${scope.workspaceId}`;
      const cursorValue = url.searchParams.get('cursor');
      const decoded = cursorValue
        ? await decodePageCursor(cursorValue, { scope: cursorScope, kind: 'gpt-catalog' })
        : null;
      const afterIndex = decoded
        ? CATALOG.entries.findIndex((entry) => entry.profileId === decoded.after)
        : -1;
      if (decoded && afterIndex < 0) {
        throw new ApiContractError('invalid_cursor', 'Cursor is invalid', '$.cursor');
      }
      const profiles = CATALOG.entries.slice(afterIndex + 1, afterIndex + 1 + limit);
      const hasMore = CATALOG.entries.length > afterIndex + 1 + limit;
      const nextCursor = hasMore && profiles.length
        ? await encodePageCursor({
          scope: cursorScope,
          kind: 'gpt-catalog',
          after: profiles.at(-1).profileId
        })
        : null;
      return createJsonResponse({
        schemaVersion: 'audit-gpt-catalog-list-v1',
        profiles,
        nextCursor
      }, { env, cache });
    }
    exactQuery(url, new Set());
    const name = route.resourceType === 'campaign'
      ? 'getCampaignStatus'
      : 'getJobStatus';
    const argumentName = route.resourceType === 'campaign'
      ? 'campaignId'
      : 'jobId';
    const raw = await providerMethod(env, name)({
      ...scope,
      [argumentName]: route.resourceId
    });
    if (raw === null || raw === undefined) {
      throw new ApiContractError('not_found', 'Resource not found', '$.resourceId', 404);
    }
    const status = validateStatusSummary(raw, {
      resourceType: route.resourceType,
      resourceId: route.resourceId,
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId
    });
    return createJsonResponse(status, { env, cache });
  } catch (cause) {
    return errorResponse(cause, env);
  }
}
