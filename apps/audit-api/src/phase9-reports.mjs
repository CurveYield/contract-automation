import {
  ApiContractError,
  canonicalJson,
  corsHeaders,
  createJsonResponse,
  decodePageCursor,
  encodePageCursor,
  errorResponse,
  parsePageLimit
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
  let value;
  try { value = env?.AUDIT_REPORT_DISCOVERY; }
  catch {
    throw new ApiContractError('service_unavailable', 'Report discovery is unavailable', '$', 503);
  }
  if (!value || typeof value !== 'object') {
    throw new ApiContractError('service_unavailable', 'Report discovery is unavailable', '$', 503);
  }
  return value;
}

function providerMethod(service, name) {
  let descriptor;
  try { descriptor = Object.getOwnPropertyDescriptor(service, name); }
  catch {
    throw new ApiContractError('service_unavailable', 'Report discovery is unavailable', '$', 503);
  }
  if (!descriptor || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'function') {
    throw new ApiContractError('service_unavailable', 'Report discovery is unavailable', '$', 503);
  }
  return descriptor.value.bind(service);
}

function providerFailure() {
  throw new ApiContractError('provider_contract_error', 'Report provider returned an invalid result', '$', 500);
}

function codeUnitCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function inspectContainer(value) {
  if (!value || typeof value !== 'object') providerFailure();
  try {
    return {
      descriptors: Object.getOwnPropertyDescriptors(value),
      isArray: Array.isArray(value),
      prototype: Object.getPrototypeOf(value)
    };
  } catch { providerFailure(); }
}

function providerArray(value) {
  const { descriptors, isArray, prototype } = inspectContainer(value);
  if (!isArray || prototype !== Array.prototype) providerFailure();
  const length = descriptors.length?.value;
  if (!Number.isSafeInteger(length) || length < 0 || length > MAX_PROVIDER_RECORDS) providerFailure();
  const expected = new Set([...Array.from({ length }, (_, index) => String(index)), 'length']);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== 'string' || !expected.has(key)) providerFailure();
  }
  const items = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) providerFailure();
    items.push(descriptor.value);
  }
  return items;
}

function providerItems(value) {
  const inspected = inspectContainer(value);
  if (inspected.isArray) return providerArray(value);
  if (inspected.prototype !== Object.prototype && inspected.prototype !== null) providerFailure();
  const keys = Reflect.ownKeys(inspected.descriptors).sort().join('\0');
  if (keys !== 'items\0schemaVersion\0snapshotVersion') providerFailure();
  const schema = inspected.descriptors.schemaVersion;
  const snapshot = inspected.descriptors.snapshotVersion;
  const items = inspected.descriptors.items;
  if (
    !schema || !Object.hasOwn(schema, 'value') || schema.value !== 'audit-report-provider-page-v1' ||
    !snapshot || !Object.hasOwn(snapshot, 'value') || typeof snapshot.value !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(snapshot.value) ||
    !items || !Object.hasOwn(items, 'value')
  ) providerFailure();
  return providerArray(items.value);
}

function reportScope(value) {
  const { descriptors, isArray, prototype } = inspectContainer(value);
  if (isArray || (prototype !== Object.prototype && prototype !== null)) providerFailure();
  const tenant = descriptors.tenantId;
  const workspace = descriptors.workspaceId;
  if (
    !tenant || !Object.hasOwn(tenant, 'value') || typeof tenant.value !== 'string' ||
    !workspace || !Object.hasOwn(workspace, 'value') || typeof workspace.value !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(tenant.value) ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(workspace.value)
  ) providerFailure();
  return { tenantId: tenant.value, workspaceId: workspace.value };
}

function canonicalVisibleReports(rawItems, scope) {
  const byId = new Map();
  for (let index = 0; index < rawItems.length; index += 1) {
    const identity = reportScope(rawItems[index]);
    if (identity.tenantId !== scope.tenantId || identity.workspaceId !== scope.workspaceId) continue;
    let report;
    try { report = validateReportReference(rawItems[index], `$.reports[${index}]`); }
    catch { providerFailure(); }
    const existing = byId.get(report.reportId);
    if (existing && canonicalJson(existing) !== canonicalJson(report)) providerFailure();
    if (!existing) byId.set(report.reportId, report);
  }
  return [...byId.values()].sort((left, right) => codeUnitCompare(left.reportId, right.reportId));
}

async function listReports(service, scope, { limit, cursor }) {
  const method = providerMethod(service, 'listReports');
  const raw = await method({ tenantId: scope.tenantId, workspaceId: scope.workspaceId });
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
  const method = providerMethod(service, 'getReport');
  const raw = await method({
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
