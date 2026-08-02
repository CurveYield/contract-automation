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
import { validateReportReference } from '../../../packages/audit-api-contracts/src/discovery.mjs';

const LIST_PATH = '/audit/v1/reports';
const ITEM_PREFIX = '/audit/v1/reports/';
const MAX_PROVIDER_RECORDS = 1_000;

function route(pathname) {
  if (pathname === LIST_PATH) return { kind: 'list' };
  if (!pathname.startsWith(ITEM_PREFIX)) return null;
  const encoded = pathname.slice(ITEM_PREFIX.length);
  if (!encoded || encoded.includes('/')) {
    throw new ApiContractError('invalid_report_id', 'Report ID is invalid', '$.reportId');
  }
  let reportId;
  try { reportId = decodeURIComponent(encoded); }
  catch { throw new ApiContractError('invalid_report_id', 'Report ID is invalid', '$.reportId'); }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(reportId)) {
    throw new ApiContractError('invalid_report_id', 'Report ID is invalid', '$.reportId');
  }
  return { kind: 'item', reportId };
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

function provider(env) {
  const value = env?.AUDIT_REPORT_DISCOVERY;
  if (!value || typeof value !== 'object') {
    throw new ApiContractError('service_unavailable', 'Report discovery is unavailable', '$', 503);
  }
  return value;
}

function providerFailure() {
  throw new ApiContractError('provider_contract_error', 'Report provider returned an invalid result', '$', 500);
}

function codeUnitCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function providerItems(value) {
  let safe;
  try { safe = validateExternalValue(value, '$.providerResult'); }
  catch { providerFailure(); }
  if (Array.isArray(safe)) return safe;
  const keys = Object.keys(safe).sort().join('\0');
  if (keys !== 'items\0schemaVersion\0snapshotVersion') providerFailure();
  if (
    safe.schemaVersion !== 'audit-report-provider-page-v1' ||
    !Array.isArray(safe.items) ||
    typeof safe.snapshotVersion !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(safe.snapshotVersion)
  ) providerFailure();
  return safe.items;
}

function canonicalVisibleReports(rawItems, scope) {
  if (rawItems.length > MAX_PROVIDER_RECORDS) providerFailure();
  const byId = new Map();
  for (let index = 0; index < rawItems.length; index += 1) {
    let report;
    try { report = validateReportReference(rawItems[index], `$.reports[${index}]`); }
    catch { providerFailure(); }
    if (report.tenantId !== scope.tenantId || report.workspaceId !== scope.workspaceId) continue;
    const existing = byId.get(report.reportId);
    if (existing && canonicalJson(existing) !== canonicalJson(report)) providerFailure();
    if (!existing) byId.set(report.reportId, report);
  }
  return [...byId.values()].sort((left, right) => codeUnitCompare(left.reportId, right.reportId));
}

async function listReports(service, scope, { limit, cursor }) {
  if (typeof service.listReports !== 'function') {
    throw new ApiContractError('service_unavailable', 'Report discovery is unavailable', '$', 503);
  }
  const raw = await service.listReports({ tenantId: scope.tenantId, workspaceId: scope.workspaceId });
  const reports = canonicalVisibleReports(providerItems(raw), scope);
  let start = 0;
  if (cursor) {
    const decoded = await decodePageCursor(cursor, {
      scope: `${scope.tenantId}/${scope.workspaceId}`,
      kind: 'reports'
    });
    const anchor = reports.findIndex((report) => report.reportId === decoded.after);
    if (anchor < 0) {
      throw new ApiContractError('stale_cursor', 'Cursor anchor is no longer available', '$.cursor');
    }
    start = anchor + 1;
  }
  const page = reports.slice(start, start + limit);
  const hasMore = start + page.length < reports.length;
  const nextCursor = hasMore && page.length > 0
    ? await encodePageCursor({
      scope: `${scope.tenantId}/${scope.workspaceId}`,
      kind: 'reports',
      after: page.at(-1).reportId
    })
    : null;
  return { reports: page, nextCursor };
}

async function getReport(service, scope, reportId) {
  if (typeof service.getReport !== 'function') {
    throw new ApiContractError('service_unavailable', 'Report discovery is unavailable', '$', 503);
  }
  const raw = await service.getReport({
    tenantId: scope.tenantId,
    workspaceId: scope.workspaceId,
    reportId
  });
  if (raw === null || raw === undefined) {
    throw new ApiContractError('not_found', 'Report not found', '$.reportId', 404);
  }
  let report;
  try { report = validateReportReference(raw); }
  catch { providerFailure(); }
  if (
    report.reportId !== reportId ||
    report.tenantId !== scope.tenantId ||
    report.workspaceId !== scope.workspaceId
  ) throw new ApiContractError('not_found', 'Report not found', '$.reportId', 404);
  return report;
}

export async function handlePhase9ReportRequest(request, env) {
  let matched;
  let url;
  try {
    url = new URL(request.url);
    matched = route(url.pathname);
  } catch (cause) { return errorResponse(cause, env); }
  if (!matched) return null;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(env) });
  try {
    if (request.method !== 'GET') {
      throw new ApiContractError('method_not_allowed', 'Report discovery is read-only', '$', 405);
    }
    exactQuery(url, matched.kind === 'list' ? new Set(['limit', 'cursor']) : new Set());
    const scope = await authorizeAuditReadRequest(request, env, {
      routeScope: matched.kind === 'list'
        ? AUDIT_ROUTE_SCOPES.reportsList
        : AUDIT_ROUTE_SCOPES.reportRead,
      ...(matched.kind === 'item' ? { resourceType: 'report', resourceId: matched.reportId } : {})
    });
    const service = provider(env);
    if (matched.kind === 'item') {
      return createJsonResponse(await getReport(service, scope, matched.reportId), {
        env,
        cache: {
          tenantId: scope.tenantId,
          workspaceId: scope.workspaceId,
          route: `${ITEM_PREFIX}${matched.reportId}`,
          query: ''
        }
      });
    }
    const limit = parsePageLimit(url.searchParams.get('limit'));
    const cursor = url.searchParams.get('cursor');
    const result = await listReports(service, scope, { limit, cursor });
    return createJsonResponse({
      schemaVersion: 'audit-report-list-v2',
      reports: result.reports,
      nextCursor: result.nextCursor
    }, {
      env,
      cache: {
        tenantId: scope.tenantId,
        workspaceId: scope.workspaceId,
        route: LIST_PATH,
        query: canonicalJson({ limit, cursor: cursor ?? null })
      }
    });
  } catch (cause) {
    return errorResponse(cause, env);
  }
}
