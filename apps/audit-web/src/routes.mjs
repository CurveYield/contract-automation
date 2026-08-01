const route = (name, pattern, title) => Object.freeze({
  name,
  pattern,
  title,
  focusTarget: 'main-heading',
  executionAvailable: false
});

export const AUDIT_ROUTES = Object.freeze([
  route('reports', /^\/reports\/?$/, 'Reports'),
  route('reportDetail', /^\/reports\/([^/?#]+)\/?$/, 'Report detail'),
  route('workspaces', /^\/workspaces\/?$/, 'Workspaces'),
  route('workspaceDetail', /^\/workspaces\/([^/?#]+)\/?$/, 'Workspace detail'),
  route('campaignDetail', /^\/campaigns\/([^/?#]+)\/?$/, 'Campaign detail'),
  route('jobDetail', /^\/jobs\/([^/?#]+)\/?$/, 'Job detail'),
  route('forkDetail', /^\/forks\/([^/?#]+)\/?$/, 'Persistent fork'),
  route('cleanRoomDetail', /^\/clean-room\/([^/?#]+)\/?$/, 'Clean-room campaign'),
  route('catalog', /^\/catalog\/?$/, 'Capability catalog'),
  route('diagnostics', /^\/diagnostics\/?$/, 'Operator diagnostics')
]);

const NOT_FOUND = route('notFound', /^$/, 'Page not found');

export function resolveAuditRoute(pathname) {
  const value = typeof pathname === 'string' ? pathname.slice(0, 2048) : '/';
  for (const candidate of AUDIT_ROUTES) {
    const match = candidate.pattern.exec(value);
    if (match) return Object.freeze({ ...candidate, params: Object.freeze(match[1] ? { id: decodeURIComponent(match[1]).slice(0, 160) } : {}) });
  }
  return Object.freeze({ ...NOT_FOUND, params: Object.freeze({}) });
}
