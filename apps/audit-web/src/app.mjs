import { deepFreeze, toSafeIdentifier } from '../../../packages/audit-report-view-model/src/index.mjs';
import { renderAuditPage } from './pages.mjs';
import { renderShell, renderState } from './render.mjs';
import { resolveAuditRoute } from './routes.mjs';

function resourceForRoute(route) {
  const id = route.params?.id ? encodeURIComponent(route.params.id) : '';
  const resources = {
    reports: '/api/audit/reports',
    reportDetail: `/api/audit/reports/${id}`,
    workspaces: '/api/audit/workspaces',
    workspaceDetail: `/api/audit/workspaces/${id}`,
    campaignDetail: `/api/audit/campaigns/${id}`,
    jobDetail: `/api/audit/jobs/${id}`,
    forkDetail: `/api/audit/forks/${id}`,
    cleanRoomDetail: `/api/audit/clean-room/${id}`,
    catalog: '/api/audit/catalog',
    diagnostics: '/api/audit/diagnostics'
  };
  return resources[route.name] || null;
}

function activeRouteFor(route) {
  if (['reports', 'reportDetail'].includes(route.name)) return 'reports';
  if (['workspaces', 'workspaceDetail', 'campaignDetail', 'jobDetail', 'forkDetail', 'cleanRoomDetail'].includes(route.name)) return 'workspaces';
  if (route.name === 'catalog') return 'catalog';
  if (route.name === 'diagnostics') return 'diagnostics';
  return '';
}

function errorState(route, error) {
  const errorCode = toSafeIdentifier(error?.code || 'UI_CLIENT_TRANSPORT').toUpperCase().slice(0, 80) || 'UI_CLIENT_TRANSPORT';
  return deepFreeze({
    route,
    stale: false,
    error: true,
    errorCode,
    html: renderShell({
      title: route.title || 'Audit data unavailable',
      activeRoute: activeRouteFor(route),
      body: renderState({ kind: 'error', message: `Unable to load audit data (${errorCode}). Try the request again.` })
    }),
    focusTarget: route.focusTarget
  });
}

export function createAuditApp({ client, focus = () => {} } = {}) {
  if (!client || typeof client.request !== 'function') throw new TypeError('An audit client is required.');
  if (typeof focus !== 'function') throw new TypeError('Focus adapter must be a function.');
  let navigationSequence = 0;
  let currentState = null;

  async function navigate(path, options = {}) {
    const sequence = ++navigationSequence;
    const route = resolveAuditRoute(path);
    const resource = resourceForRoute(route);
    let payload = null;
    try {
      payload = resource ? await client.request(resource, { slot: 'route' }) : null;
    } catch (error) {
      if (sequence !== navigationSequence || ['UI_CLIENT_ABORTED', 'UI_CLIENT_STALE_RESPONSE'].includes(error?.code)) {
        return deepFreeze({ route, stale: true, error: false, errorCode: null, html: '', focusTarget: null });
      }
      const state = errorState(route, error);
      currentState = state;
      if (state.focusTarget) focus(state.focusTarget);
      return state;
    }
    if (sequence !== navigationSequence) return deepFreeze({ route, stale: true, error: false, errorCode: null, html: '', focusTarget: null });
    const state = deepFreeze({
      route,
      stale: false,
      error: false,
      errorCode: null,
      html: renderAuditPage(route.name, payload, options),
      focusTarget: route.focusTarget
    });
    currentState = state;
    if (state.focusTarget) focus(state.focusTarget);
    return state;
  }

  function current() {
    return currentState;
  }

  return Object.freeze({ navigate, current });
}
