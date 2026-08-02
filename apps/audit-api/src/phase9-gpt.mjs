import { PHASE4_PROFILE_CATALOG } from '../../../packages/audit-tool-catalog/src/index.mjs';
import {
  ApiContractError,
  canonicalJson,
  corsHeaders,
  createJsonResponse,
  decodePageCursor,
  encodePageCursor,
  errorResponse,
  parsePageLimit,
  validateExternalValue
} from '../../../packages/audit-api-contracts/src/index.mjs';
import {
  AUDIT_ROUTE_SCOPES,
  authorizeAuditReadRequest
} from '../../../packages/audit-api-contracts/src/authorization.mjs';
import {
  validateEvidenceSummary,
  validateStatusSummary
} from '../../../packages/audit-api-contracts/src/status.mjs';
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
const ROUTE_PREFIXES = Object.freeze([
  ['/audit/v1/gpt/workspaces/', 'workspace', 'workspaceStatusRead', 'getWorkspaceStatus', 'workspaceId'],
  ['/audit/v1/gpt/campaigns/', 'campaign', 'campaignStatusRead', 'getCampaignStatus', 'campaignId'],
  ['/audit/v1/gpt/jobs/', 'job', 'jobStatusRead', 'getJobStatus', 'jobId'],
  ['/audit/v1/gpt/forks/', 'fork', 'forkStatusRead', 'getForkStatus', 'forkId'],
  ['/audit/v1/gpt/clean-rooms/', 'clean-room', 'cleanRoomStatusRead', 'getCleanRoomStatus', 'cleanRoomId']
]);
const GPT_IDENTITIES = Object.freeze(['client', 'gpt', 'service-read']);

const CATALOG = createAuditCatalogComposition({ phase4Profiles: PHASE4_PROFILE_CATALOG.profiles });
const CAPABILITIES = createAggregateAuditCapabilities({
  catalog: CATALOG,
  legacyCapabilities: { service: 'curveyield-audit', apiVersion: 'audit-v1', phase: 3 },
  phase4ResultContracts: false
});

export function auditPhase9Capabilities(baseCapabilities = {}) {
  const base = baseCapabilities && typeof baseCapabilities === 'object'
    ? validateExternalValue(baseCapabilities, '$.baseCapabilities')
    : {};
  const derived = createAggregateAuditCapabilities({
    catalog: CATALOG,
    legacyCapabilities: base,
    phase4ResultContracts: false
  });
  return validateExternalValue({
    ...structuredClone(base),
    ...structuredClone(derived),
    phase: 9,
    executionEnabled: false,
    executionState: 'awaiting_executor',
    executorState: 'unavailable'
  });
}

function decodedSegment(encoded, code, path) {
  if (!encoded || encoded.includes('/')) throw new ApiContractError(code, 'Identifier is invalid', path);
  let value;
  try { value = decodeURIComponent(encoded); }
  catch { throw new ApiContractError(code, 'Identifier is invalid', path); }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(value)) {
    throw new ApiContractError(code, 'Identifier is invalid', path);
  }
  return value;
}

function statusOrEvidenceRoute(pathname) {
  for (const [prefix, resourceType, routeScopeKey, providerName, argumentName] of ROUTE_PREFIXES) {
    if (!pathname.startsWith(prefix)) continue;
    const suffix = pathname.slice(prefix.length);
    if (resourceType === 'job' && suffix.endsWith('/evidence-summary')) {
      return {
        kind: 'evidence-summary',
        resourceType: 'job',
        resourceId: decodedSegment(
          suffix.slice(0, -'/evidence-summary'.length),
          'invalid_resource_id',
          '$.resourceId'
        ),
        routeScopeKey: 'evidenceSummaryRead',
        providerName: 'getEvidenceSummary',
        argumentName: 'jobId'
      };
    }
    if (!suffix.endsWith('/status')) {
      throw new ApiContractError('invalid_resource_id', 'Status route is invalid', '$.resourceId');
    }
    return {
      kind: 'status',
      resourceType,
      resourceId: decodedSegment(suffix.slice(0, -'/status'.length), 'invalid_resource_id', '$.resourceId'),
      routeScopeKey,
      providerName,
      argumentName
    };
  }
  return null;
}

function match(pathname) {
  if (pathname === CAPABILITIES_PATH) return { kind: 'capabilities' };
  if (pathname === CATALOG_PATH) return { kind: 'catalog-list' };
  if (pathname.startsWith(CATALOG_ITEM_PREFIX)) {
    return {
      kind: 'catalog-item',
      profileId: decodedSegment(pathname.slice(CATALOG_ITEM_PREFIX.length), 'invalid_profile_id', '$.profileId')
    };
  }
  if (pathname === REPORTS_PATH) return { kind: 'reports-list' };
  if (pathname.startsWith(REPORTS_ITEM_PREFIX)) {
    return {
      kind: 'reports-item',
      reportId: decodedSegment(pathname.slice(REPORTS_ITEM_PREFIX.length), 'invalid_report_id', '$.reportId')
    };
  }
  return statusOrEvidenceRoute(pathname);
}

function exactQuery(url, allowed) {
  const seen = new Set();
  for (const [key] of url.searchParams) {
    if (!allowed.has(key) || seen.has(key)) {
      throw new ApiContractError('invalid_query', 'Query parameter is not allowed', '$.query');
    }
    seen.add(key);
  }
}

function providerMethod(env, name) {
  const provider = env?.AUDIT_STATUS_DISCOVERY;
  let descriptor;
  try {
    descriptor = provider && typeof provider === 'object'
      ? Object.getOwnPropertyDescriptor(provider, name)
      : null;
  } catch {
    throw new ApiContractError('capability_unavailable', 'Status discovery is unavailable', '$', 503);
  }
  if (!descriptor || typeof descriptor.value !== 'function') {
    throw new ApiContractError('capability_unavailable', 'Status discovery is unavailable', '$', 503);
  }
  return descriptor.value.bind(provider);
}

function rewrittenReportRequest(request) {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace('/audit/v1/gpt/reports', '/audit/v1/reports');
  return new Request(url, { method: request.method, headers: request.headers });
}

async function authorizationForRoute(request, env, route) {
  if (route.kind === 'reports-list') {
    return authorizeAuditReadRequest(request, env, {
      routeScope: AUDIT_ROUTE_SCOPES.reportsList,
      allowedIdentities: GPT_IDENTITIES
    });
  }
  if (route.kind === 'reports-item') {
    return authorizeAuditReadRequest(request, env, {
      routeScope: AUDIT_ROUTE_SCOPES.reportRead,
      resourceType: 'report',
      resourceId: route.reportId,
      allowedIdentities: GPT_IDENTITIES
    });
  }
  if (route.kind === 'catalog-list' || route.kind === 'catalog-item') {
    return authorizeAuditReadRequest(request, env, {
      routeScope: AUDIT_ROUTE_SCOPES.catalogRead,
      allowedIdentities: GPT_IDENTITIES
    });
  }
  if (route.kind === 'capabilities') {
    return authorizeAuditReadRequest(request, env, {
      routeScope: AUDIT_ROUTE_SCOPES.capabilitiesRead,
      allowedIdentities: GPT_IDENTITIES
    });
  }
  return authorizeAuditReadRequest(request, env, {
    routeScope: AUDIT_ROUTE_SCOPES[route.routeScopeKey],
    resourceType: route.resourceType,
    resourceId: route.resourceId,
    allowedIdentities: GPT_IDENTITIES
  });
}

export async function handlePhase9GptRequest(request, env) {
  let url;
  let route;
  try {
    url = new URL(request.url);
    route = match(url.pathname);
  } catch (cause) { return errorResponse(cause, env); }
  if (!route) return null;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(env) });
  try {
    if (request.method !== 'GET') {
      throw new ApiContractError('method_not_allowed', 'GPT routes are read-only', '$', 405);
    }
    const scope = await authorizationForRoute(request, env, route);
    if (route.kind === 'reports-list' || route.kind === 'reports-item') {
      return handlePhase9ReportRequest(rewrittenReportRequest(request), env);
    }
    const cache = {
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
      route: url.pathname,
      query: canonicalJson(Object.fromEntries([...url.searchParams.entries()].sort()))
    };
    if (route.kind === 'capabilities') {
      exactQuery(url, new Set());
      return createJsonResponse(CAPABILITIES, { env, cache });
    }
    if (route.kind === 'catalog-item') {
      exactQuery(url, new Set());
      const profile = CATALOG.entries.find((entry) => entry.profileId === route.profileId);
      if (!profile) throw new ApiContractError('not_found', 'Profile not found', '$.profileId', 404);
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
        throw new ApiContractError('stale_cursor', 'Cursor anchor is no longer available', '$.cursor');
      }
      const profiles = CATALOG.entries.slice(afterIndex + 1, afterIndex + 1 + limit);
      const hasMore = CATALOG.entries.length > afterIndex + 1 + limit;
      const nextCursor = hasMore && profiles.length
        ? await encodePageCursor({ scope: cursorScope, kind: 'gpt-catalog', after: profiles.at(-1).profileId })
        : null;
      return createJsonResponse({
        schemaVersion: 'audit-gpt-catalog-list-v2',
        profiles,
        nextCursor
      }, { env, cache });
    }
    exactQuery(url, new Set());
    const raw = await providerMethod(env, route.providerName)({
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
      [route.argumentName]: route.resourceId
    });
    if (raw === null || raw === undefined) {
      throw new ApiContractError('not_found', 'Resource not found', '$.resourceId', 404);
    }
    const value = route.kind === 'evidence-summary'
      ? validateEvidenceSummary(raw, {
        jobId: route.resourceId,
        tenantId: scope.tenantId,
        workspaceId: scope.workspaceId
      })
      : validateStatusSummary(raw, {
        resourceType: route.resourceType,
        resourceId: route.resourceId,
        tenantId: scope.tenantId,
        workspaceId: scope.workspaceId
      });
    return createJsonResponse(value, { env, cache });
  } catch (cause) {
    return errorResponse(cause, env);
  }
}
