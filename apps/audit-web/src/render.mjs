const NAV = Object.freeze([
  ['reports', '/reports', 'Reports'],
  ['workspaces', '/workspaces', 'Workspaces'],
  ['catalog', '/catalog', 'Catalog'],
  ['diagnostics', '/diagnostics', 'Diagnostics']
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
  const kind = state.kind || 'empty';
  const message = escapeHtml(state.message || (kind === 'loading' ? 'Loading' : kind === 'error' ? 'Unable to load this view' : 'No data available'));
  if (kind === 'loading') return `<section class="state state--loading" aria-busy="true" aria-live="polite"><p>${message}</p></section>`;
  if (kind === 'error') return `<section class="state state--error" role="alert"><h2>Something went wrong</h2><p>${message}</p></section>`;
  return `<section class="state state--empty" aria-live="polite"><p>${message}</p></section>`;
}

export function renderShell({ title, activeRoute, body }) {
  const safeTitle = escapeHtml(title || 'Audit');
  const nav = NAV.map(([name, href, label]) => `<a href="${href}"${activeRoute === name ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle} · CurveYield Audit</title><link rel="stylesheet" href="/styles.css"></head><body><a class="skip-link" href="#main-content">Skip to content</a><header><a class="brand" href="/reports">CurveYield Audit</a><nav aria-label="Primary">${nav}</nav></header><main id="main-content" tabindex="-1"><h1 id="main-heading">${safeTitle}</h1>${body || ''}</main><footer><p>Read-only audit reporting surface. Execution is unavailable.</p></footer></body></html>`;
}
