import { deepFreeze } from '../../../packages/audit-report-view-model/src/index.mjs';
import { renderAuditPage } from './pages.mjs';
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

export function createAuditApp({ client, focus = () => {} } = {}) {
  if (!client || typeof client.request !== 'function') throw new TypeError('An audit client is required.');
  if (typeof focus !== 'function') throw new TypeError('Focus adapter must be a function.');
  let navigationSequence = 0;
  let currentState = null;

  async function navigate(path, options = {}) {
    const sequence = ++navigationSequence;
    const route = resolveAuditRoute(path);
    const resource = resourceForRoute(route);
    const payload = resource ? await client.request(resource, { slot: 'route' }) : null;
    if (sequence !== navigationSequence) return deepFreeze({ route, stale: true, html: '', focusTarget: null });
    const state = deepFreeze({
      route,
      stale: false,
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
