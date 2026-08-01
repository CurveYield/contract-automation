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
import {
  resolveAuditReadScope,
  validateReportReference
} from '../../../packages/audit-api-contracts/src/discovery.mjs';

export const AUDIT_REPORT_LIST_PATH = '/audit/v1/reports';
const ITEM_PREFIX = `${AUDIT_REPORT_LIST_PATH}/`;

function route(pathname) {
  if (pathname === AUDIT_REPORT_LIST_PATH) return { kind: 'list' };
  if (!pathname.startsWith(ITEM_PREFIX)) return null;
  const encoded = pathname.slice(ITEM_PREFIX.length);
  if (!encoded || encoded.includes('/')) {
    throw new ApiContractError('invalid_report_id', 'Report ID is invalid', '$.reportId');
  }
  let reportId;
  try { reportId = decodeURIComponent(encoded); }
  catch { throw new ApiContractError('invalid_report_id', 'Report ID is invalid', '$.reportId'); }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(reportId)) {
    throw new ApiContractError('invalid_report_id', 'Report ID is invalid', '$.reportId');
  }
  return { kind: 'item', reportId };
}

function providerMethod(env, name) {
  const provider = env?.AUDIT_REPORT_DISCOVERY;
  const descriptor = provider && typeof provider === 'object'
    ? Object.getOwnPropertyDescriptor(provider, name)
    : null;
  if (!descriptor || typeof descriptor.value !== 'function') {
    throw new ApiContractError(
      'capability_unavailable',
      'Report discovery is unavailable',
      '$',
      503
    );
  }
  return descriptor.value.bind(provider);
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

export async function handlePhase9ReportRequest(request, env) {
  const url = new URL(request.url);
  let matched;
  try { matched = route(url.pathname); }
  catch (cause) { return errorResponse(cause, env); }
  if (!matched) return null;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(env) });
  }
  try {
    const identity = await authenticateAuditRead(request, env);
    const scope = resolveAuditReadScope(identity, env);
    if (request.method !== 'GET') {
      throw new ApiContractError('method_not_allowed', 'Report discovery is read-only', '$', 405);
    }
    const cache = {
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
      route: url.pathname,
      query: url.search
    };
    if (matched.kind === 'item') {
      exactQuery(url, new Set());
      const raw = await providerMethod(env, 'getReport')({
        ...scope,
        reportId: matched.reportId
      });
      if (raw === null || raw === undefined) {
        throw new ApiContractError('not_found', 'Report not found', '$.reportId', 404);
      }
      const report = validateReportReference(raw);
      if (
        report.tenantId !== scope.tenantId ||
        report.workspaceId !== scope.workspaceId ||
        report.reportId !== matched.reportId
      ) {
        throw new ApiContractError('not_found', 'Report not found', '$.reportId', 404);
      }
      return createJsonResponse(report, { env, cache });
    }
    exactQuery(url, new Set(['limit', 'cursor']));
    const limit = parsePageLimit(url.searchParams.get('limit'));
    const cursorValue = url.searchParams.get('cursor');
    const cursorScope = `${scope.tenantId}/${scope.workspaceId}`;
    const decoded = cursorValue
      ? await decodePageCursor(cursorValue, { scope: cursorScope, kind: 'reports' })
      : null;
    const raw = await providerMethod(env, 'listReports')({
      ...scope,
      limit: limit + 1,
      after: decoded?.after ?? null
    });
    if (!Array.isArray(raw)) {
      throw new ApiContractError(
        'provider_contract_error',
        'Report provider returned an invalid collection',
        '$',
        500
      );
    }
    const reports = raw.map((value, index) => (
      validateReportReference(value, `$.reports[${index}]`)
    ));
    if (reports.some((report) => (
      report.tenantId !== scope.tenantId ||
      report.workspaceId !== scope.workspaceId
    ))) {
      throw new ApiContractError(
        'provider_contract_error',
        'Report provider scope mismatch',
        '$',
        500
      );
    }
    reports.sort((left, right) => (
      left.createdAt.localeCompare(right.createdAt) ||
      left.reportId.localeCompare(right.reportId)
    ));
    const afterIndex = decoded
      ? reports.findIndex((report) => report.reportId === decoded.after)
      : -1;
    const selected = reports.slice(afterIndex + 1, afterIndex + 1 + limit);
    const hasMore = reports.length > afterIndex + 1 + limit;
    const nextCursor = hasMore && selected.length
      ? await encodePageCursor({
        scope: cursorScope,
        kind: 'reports',
        after: selected.at(-1).reportId
      })
      : null;
    return createJsonResponse({
      schemaVersion: 'audit-report-list-v1',
      reports: selected,
      nextCursor
    }, { env, cache });
  } catch (cause) {
    return errorResponse(cause, env);
  }
}
