import { createAuditApp } from './app.mjs';
import { createAuditClient } from './client.mjs';

const root = document.getElementById('audit-root');
if (!root) throw new Error('The audit application root is missing.');

const transport = typeof globalThis.__CURVEYIELD_AUDIT_TRANSPORT__ === 'function'
  ? globalThis.__CURVEYIELD_AUDIT_TRANSPORT__
  : async () => { throw Object.assign(new Error('Audit transport unavailable.'), { code: 'UI_CLIENT_OFFLINE' }); };

function commitState(state) {
  if (!state?.html) return;
  const parsed = new DOMParser().parseFromString(state.html, 'text/html');
  document.title = parsed.title || 'CurveYield Audit';
  root.removeAttribute('role');
  root.removeAttribute('aria-live');
  root.replaceChildren(...parsed.body.childNodes);
}

const client = createAuditClient({ transport });
const app = createAuditApp({
  client,
  onState: commitState,
  focus: (targetId) => root.querySelector(`#${CSS.escape(targetId)}`)?.focus(),
  history: {
    push: (value) => history.pushState(null, '', value),
    replace: (value) => history.replaceState(null, '', value)
  }
});

function currentPath() {
  return `${location.pathname}${location.search}`;
}

root.addEventListener('click', (event) => {
  const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
  if (!link || link.target || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin) return;
  event.preventDefault();
  void app.navigate(`${url.pathname}${url.search}`);
});

addEventListener('popstate', () => { void app.navigate(currentPath(), { replaceHistory: true }); });
void app.navigate(currentPath(), { replaceHistory: true, allowStaleOnError: true });
