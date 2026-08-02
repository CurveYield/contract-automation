import { deepFreeze, toSafeIdentifier } from '../../../packages/audit-report-view-model/src/index.mjs';
import { renderAuditPage } from './pages.mjs';
import { renderShell, renderState } from './render.mjs';
import { resolveAuditRoute } from './routes.mjs';

function listQuery(route) {
  if (route.name !== 'reports') return '';
  const params = new URLSearchParams();
  for (const key of ['query', 'status', 'sort', 'page', 'pageSize']) if (route.query?.[key]) params.set(key, route.query[key]);
  const text = params.toString();
  return text ? `?${text}` : '';
}

function resourceForRoute(route) {
  const id = route.params?.id ? encodeURIComponent(route.params.id) : '';
  const resources = {
    reports: `/api/audit/reports${listQuery(route)}`,
    reportDetail: `/api/audit/reports/${id}`,
    workspaces: '/api/audit/workspaces',
    workspaceDetail: `/api/audit/workspaces/${id}`,
    campaignDetail: `/api/audit/campaigns/${id}`,
    jobDetail: `/api/audit/jobs/${id}`,
    forkDetail: `/api/audit/forks/${id}`,
    cleanRoomDetail: `/api/audit/clean-room/${id}`,
    profiles: '/api/audit/profiles',
    profileDetail: `/api/audit/profiles/${id}`,
    parserDetail: `/api/audit/parsers/${id}`,
    resultDetail: `/api/audit/results/${id}`,
    catalog: '/api/audit/catalog',
    githubDirectStatus: '/api/audit/github-direct/status',
    operations: '/api/audit/operations',
    diagnostics: '/api/audit/diagnostics',
    releaseProvenance: '/api/audit/release'
  };
  return resources[route.name] || null;
}

function activeRouteFor(route) {
  if (['reports', 'reportDetail'].includes(route.name)) return 'reports';
  if (['workspaces', 'workspaceDetail', 'campaignDetail', 'jobDetail', 'forkDetail', 'cleanRoomDetail'].includes(route.name)) return 'workspaces';
  if (['profiles', 'profileDetail', 'parserDetail', 'resultDetail'].includes(route.name)) return 'profiles';
  if (route.name === 'catalog') return 'catalog';
  if (['operations', 'githubDirectStatus'].includes(route.name)) return 'operations';
  if (route.name === 'diagnostics') return 'diagnostics';
  if (route.name === 'releaseProvenance') return 'release';
  return '';
}

function stateShell(route, kind, message) {
  return renderShell({ title: route.title || 'Audit', activeRoute: activeRouteFor(route), state: kind, body: renderState({ kind, message }) });
}

function errorState(route, error) {
  const errorCode = toSafeIdentifier(error?.code || 'UI_CLIENT_TRANSPORT').toUpperCase().slice(0, 80) || 'UI_CLIENT_TRANSPORT';
  const unauthorized = errorCode === 'UI_CLIENT_UNAUTHORIZED';
  const offline = errorCode === 'UI_CLIENT_OFFLINE';
  const kind = unauthorized ? 'unauthorized' : offline ? 'offline' : 'error';
  const message = unauthorized
    ? 'This audit resource is not available to the current identity.'
    : offline
      ? 'The audit transport is offline and no matching cached response is available.'
      : `Unable to load audit data (${errorCode}). Try the request again.`;
  return deepFreeze({
    kind, route, stale: false, error: !unauthorized && !offline, errorCode,
    html: stateShell(route, kind, message), focusTarget: route.focusTarget
  });
}

export function createAuditApp({
  client,
  focus = () => {},
  history = { push: () => {}, replace: () => {} },
  onState = () => {}
} = {}) {
  if (!client || typeof client.request !== 'function') throw new TypeError('An audit client is required.');
  if (typeof focus !== 'function') throw new TypeError('Focus adapter must be a function.');
  if (!history || typeof history.push !== 'function' || typeof history.replace !== 'function') throw new TypeError('History adapter must expose push and replace functions.');
  if (typeof onState !== 'function') throw new TypeError('State adapter must be a function.');
  let navigationSequence = 0;
  const idleRoute = resolveAuditRoute('/');
  let currentState = deepFreeze({ kind: 'idle', route: idleRoute, stale: false, error: false, errorCode: null, html: stateShell(idleRoute, 'idle'), focusTarget: null });

  function publish(state, shouldFocus = false) {
    currentState = deepFreeze(state);
    onState(currentState);
    if (shouldFocus && currentState.focusTarget) focus(currentState.focusTarget);
    return currentState;
  }

  async function navigate(path, options = {}) {
    const sequence = ++navigationSequence;
    const route = resolveAuditRoute(path);
    const resource = resourceForRoute(route);
    if (!resource) {
      const state = publish({
        kind: 'notFound', route, stale: false, error: false, errorCode: null,
        html: stateShell(route, 'notFound'), focusTarget: route.focusTarget
      }, true);
      if (options.replaceHistory) history.replace(path); else history.push(path);
      return state;
    }

    publish({ kind: 'loading', route, stale: false, error: false, errorCode: null, html: stateShell(route, 'loading'), focusTarget: null });

    let payload;
    try {
      payload = await client.request(resource, {
        slot: 'route', cacheScope: options.cacheScope || 'public', allowStaleOnError: options.allowStaleOnError === true
      });
    } catch (error) {
      if (sequence !== navigationSequence || ['UI_CLIENT_ABORTED', 'UI_CLIENT_STALE_RESPONSE'].includes(error?.code)) {
        return deepFreeze({ kind: 'stale', route, stale: true, error: false, errorCode: null, html: '', focusTarget: null });
      }
      return publish(errorState(route, error), true);
    }
    if (sequence !== navigationSequence) return deepFreeze({ kind: 'stale', route, stale: true, error: false, errorCode: null, html: '', focusTarget: null });

    const offlineStale = payload && typeof payload === 'object' && payload.__auditCacheState === 'offline-stale';
    const data = offlineStale ? payload.value : payload;
    const state = publish({
      kind: offlineStale ? 'offline-stale' : 'ready', route, stale: offlineStale, error: false, errorCode: null,
      html: offlineStale
        ? `${renderAuditPage(route.name, data, { ...route.query, ...options })}${renderState({ kind: 'offline' })}`
        : renderAuditPage(route.name, data, { ...route.query, ...options }),
      focusTarget: route.focusTarget
    }, true);
    if (options.replaceHistory) history.replace(path); else history.push(path);
    return state;
  }

  return Object.freeze({ navigate, current: () => currentState });
}
