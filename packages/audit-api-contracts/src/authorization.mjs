import {
  ApiContractError,
  authenticateAuditRead,
  validateExternalValue
} from './index.mjs';

export const AUDIT_ROUTE_SCOPES = Object.freeze({
  catalogRead: 'catalog.read',
  capabilitiesRead: 'capabilities.read',
  reportsList: 'reports.list',
  reportRead: 'reports.read',
  workspaceStatusRead: 'workspace.status.read',
  campaignStatusRead: 'campaign.status.read',
  jobStatusRead: 'job.status.read',
  evidenceSummaryRead: 'evidence.summary.read',
  forkStatusRead: 'fork.status.read',
  cleanRoomStatusRead: 'clean-room.status.read'
});

const ALL_ROUTE_SCOPES = new Set(Object.values(AUDIT_ROUTE_SCOPES));
const DEFAULT_SCOPES = Object.freeze({
  client: Object.freeze([...ALL_ROUTE_SCOPES]),
  gpt: Object.freeze([...ALL_ROUTE_SCOPES]),
  'legacy-read': Object.freeze([
    AUDIT_ROUTE_SCOPES.catalogRead,
    AUDIT_ROUTE_SCOPES.reportsList,
    AUDIT_ROUTE_SCOPES.reportRead
  ]),
  'legacy-submit': Object.freeze([
    AUDIT_ROUTE_SCOPES.catalogRead,
    AUDIT_ROUTE_SCOPES.reportsList,
    AUDIT_ROUTE_SCOPES.reportRead
  ]),
  'legacy-admin': Object.freeze([
    AUDIT_ROUTE_SCOPES.catalogRead,
    AUDIT_ROUTE_SCOPES.reportsList,
    AUDIT_ROUTE_SCOPES.reportRead
  ])
});
const SERVICE_GRANT_KEYS = Object.freeze([
  'tenantId', 'workspaceId', 'scopes', 'resourceBindings', 'expiresAt', 'revoked'
]);
const RESOURCE_TYPES = new Set(['workspace', 'campaign', 'job', 'report', 'fork', 'clean-room']);

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function forbidden() {
  throw new ApiContractError('forbidden', 'Read authorization is unavailable', '$', 403);
}

function hidden() {
  throw new ApiContractError('not_found', 'Resource not found', '$.resourceId', 404);
}

function exactKeys(value, expected) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.join('\0') !== wanted.join('\0')) forbidden();
}

function identifier(value) {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 160 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
  ) forbidden();
  return value;
}

function instant(value) {
  if (typeof value !== 'string') forbidden();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) forbidden();
  return parsed.getTime();
}

function readIdentityScope(env, identity, optional = false) {
  const scopes = env?.AUDIT_READ_SCOPES;
  let descriptor;
  try {
    descriptor = scopes && typeof scopes === 'object'
      ? Object.getOwnPropertyDescriptor(scopes, identity)
      : null;
  } catch {
    forbidden();
  }
  if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.value === undefined) {
    if (optional) return null;
    forbidden();
  }
  try { return validateExternalValue(descriptor.value, '$.readScope'); }
  catch { forbidden(); }
}

function baseScope(value) {
  exactKeys(value, ['tenantId', 'workspaceId']);
  return {
    tenantId: identifier(value.tenantId),
    workspaceId: identifier(value.workspaceId)
  };
}

function canonicalStringSet(value, allowed, pattern = null) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 64) forbidden();
  const output = [];
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== 'string' || item.length < 1 || item.length > 192) forbidden();
    if (allowed && !allowed.has(item)) forbidden();
    if (pattern && !pattern.test(item)) forbidden();
    if (seen.has(item)) forbidden();
    seen.add(item);
    output.push(item);
  }
  const sorted = [...output].sort();
  if (output.join('\0') !== sorted.join('\0')) forbidden();
  return output;
}

function serviceGrant(value, env) {
  exactKeys(value, SERVICE_GRANT_KEYS);
  const tenantId = identifier(value.tenantId);
  const workspaceId = identifier(value.workspaceId);
  const scopes = canonicalStringSet(value.scopes, ALL_ROUTE_SCOPES);
  const resourceBindings = canonicalStringSet(
    value.resourceBindings,
    null,
    /^(?:workspace|campaign|job|report|fork|clean-room):[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u
  );
  if (value.revoked !== false) forbidden();
  const expiresAt = instant(value.expiresAt);
  const now = instant(env?.AUDIT_AUTHORIZATION_NOW);
  if (now >= expiresAt) forbidden();
  return { tenantId, workspaceId, scopes, resourceBindings };
}

function assertRouteScope(routeScope) {
  if (typeof routeScope !== 'string' || !ALL_ROUTE_SCOPES.has(routeScope)) forbidden();
  return routeScope;
}

function assertResource(resourceType, resourceId) {
  if (resourceType === null || resourceType === undefined) {
    if (resourceId !== null && resourceId !== undefined) forbidden();
    return null;
  }
  if (!RESOURCE_TYPES.has(resourceType)) forbidden();
  return `${resourceType}:${identifier(resourceId)}`;
}

export async function authorizeAuditReadRequest(request, env = {}, {
  routeScope,
  resourceType = null,
  resourceId = null,
  allowedIdentities = null
} = {}) {
  const requiredScope = assertRouteScope(routeScope);
  const binding = assertResource(resourceType, resourceId);
  const authenticated = await authenticateAuditRead(request, env);
  const identity = authenticated.identity;
  if (allowedIdentities !== null) {
    if (!Array.isArray(allowedIdentities) || !allowedIdentities.includes(identity)) forbidden();
  }
  const rawScope = readIdentityScope(
    env,
    identity,
    identity !== 'service-read' && requiredScope === AUDIT_ROUTE_SCOPES.catalogRead
  );

  if (identity === 'service-read') {
    const grant = serviceGrant(rawScope, env);
    if (!grant.scopes.includes(requiredScope)) forbidden();
    const requiredBinding = binding ?? `workspace:${grant.workspaceId}`;
    if (!grant.resourceBindings.includes(requiredBinding)) hidden();
    return freeze({
      identity,
      tenantId: grant.tenantId,
      workspaceId: grant.workspaceId,
      routeScope: requiredScope,
      serviceBound: true
    });
  }

  const allowed = DEFAULT_SCOPES[identity];
  if (!allowed || !allowed.includes(requiredScope)) forbidden();
  const scope = rawScope === null
    ? { tenantId: 'global', workspaceId: 'global' }
    : baseScope(rawScope);
  return freeze({
    identity,
    tenantId: scope.tenantId,
    workspaceId: scope.workspaceId,
    routeScope: requiredScope,
    serviceBound: false
  });
}
