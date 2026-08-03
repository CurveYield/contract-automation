const LEGACY_NAV = Object.freeze([
  ['reports', '/reports', 'Reports'],
  ['workspaces', '/workspaces', 'Workspaces'],
  ['catalog', '/catalog', 'Catalog'],
  ['diagnostics', '/diagnostics', 'Diagnostics']
]);
const ROUND3_NAV = Object.freeze([
  ...LEGACY_NAV.slice(0, 2),
  ['profiles', '/profiles', 'Profiles'],
  ...LEGACY_NAV.slice(2),
  ['operations', '/operations', 'Operations'],
  ['release', '/release', 'Release']
]);

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderState(state = {}) {
  const kind = ['idle', 'loading', 'empty', 'error', 'notFound', 'unauthorized', 'offline'].includes(state.kind) ? state.kind : 'empty';
  const defaults = {
    idle: 'Audit data has not been requested.',
    loading: 'Loading audit data.',
    empty: 'No data available.',
    error: 'Unable to load this view.',
    notFound: 'The requested page is not available.',
    unauthorized: 'This audit resource is not available to the current identity.',
    offline: 'Showing the latest cached audit data while the transport is offline.'
  };
  const message = escapeHtml(state.message || defaults[kind]);
  if (kind === 'loading') return `<section class="state state--loading" aria-busy="true" aria-live="polite"><p>${message}</p></section>`;
  if (kind === 'error') return `<section class="state state--error" role="alert"><h2>Something went wrong</h2><p>${message}</p></section>`;
  if (kind === 'unauthorized') return `<section class="state state--unauthorized" data-state="unauthorized" role="status" aria-live="polite"><h2>Access unavailable</h2><p>${message}</p></section>`;
  if (kind === 'notFound') return `<section class="state state--not-found" data-state="not-found" role="status"><h2>Page not found</h2><p>${message}</p></section>`;
  if (kind === 'offline') return `<section class="state state--offline" data-state="offline-stale" role="status" aria-live="polite"><h2>Offline data</h2><p>${message}</p></section>`;
  return `<section class="state state--${kind}" aria-live="polite"><p>${message}</p></section>`;
}

export function renderShell({ title, activeRoute, body, state = 'ready' }) {
  const safeTitle = escapeHtml(title || 'Audit');
  const navigation = ['profiles', 'operations', 'release'].includes(activeRoute) ? ROUND3_NAV : LEGACY_NAV;
  const nav = navigation.map(([name, href, label]) => `<a href="${href}"${activeRoute === name ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  const stateAttribute = state && state !== 'ready' ? ` data-app-state="${escapeHtml(state)}"` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle} · CurveYield Audit</title><link rel="stylesheet" href="/styles.css"></head><body${stateAttribute}><a class="skip-link" href="#main-content">Skip to content</a><header><a class="brand" href="/reports">CurveYield Audit</a><nav aria-label="Primary">${nav}</nav></header><main id="main-content" tabindex="-1"><h1 id="main-heading">${safeTitle}</h1>${body || ''}</main><footer><p>Read-only audit reporting surface. Execution is unavailable.</p></footer></body></html>`;
}
