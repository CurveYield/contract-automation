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

export const AUDIT_ROUTES_V2 = Object.freeze([
  route('reports', /^\/reports\/?$/, 'Reports'),
  route('reportDetail', /^\/reports\/([^/?#]+)\/?$/, 'Report detail'),
  route('workspaces', /^\/workspaces\/?$/, 'Workspaces'),
  route('workspaceDetail', /^\/workspaces\/([^/?#]+)\/?$/, 'Workspace detail'),
  route('campaignDetail', /^\/campaigns\/([^/?#]+)\/?$/, 'Campaign detail'),
  route('jobDetail', /^\/jobs\/([^/?#]+)\/?$/, 'Job detail'),
  route('forkDetail', /^\/forks\/([^/?#]+)\/?$/, 'Persistent fork'),
  route('cleanRoomDetail', /^\/clean-room\/([^/?#]+)\/?$/, 'Clean-room campaign'),
  route('profiles', /^\/profiles\/?$/, 'Profiles'),
  route('profileDetail', /^\/profiles\/([^/?#]+)\/?$/, 'Profile detail'),
  route('parserDetail', /^\/parsers\/([^/?#]+)\/?$/, 'Parser detail'),
  route('resultDetail', /^\/results\/([^/?#]+)\/?$/, 'Result detail'),
  route('catalog', /^\/catalog\/?$/, 'Capability catalog'),
  route('githubDirectStatus', /^\/github-direct\/?$/, 'GitHub Direct Audit status'),
  route('operations', /^\/operations\/?$/, 'Operations'),
  route('diagnostics', /^\/diagnostics\/?$/, 'Operator diagnostics'),
  route('releaseProvenance', /^\/release\/?$/, 'Release provenance')
]);

const NOT_FOUND = route('notFound', /^$/, 'Page not found');
const SECRET_QUERY = /^(?:token|key|api[_-]?key|authorization|secret|signature|password)$/i;

function parseInput(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048 || value.includes('\\')) return null;
  const hashAt = value.indexOf('#');
  if (hashAt >= 0) return null;
  const queryAt = value.indexOf('?');
  const pathname = queryAt >= 0 ? value.slice(0, queryAt) : value;
  const queryText = queryAt >= 0 ? value.slice(queryAt + 1) : '';
  const query = {};
  try {
    const params = new URLSearchParams(queryText);
    let count = 0;
    for (const [key, item] of params) {
      if (count >= 20 || SECRET_QUERY.test(key)) continue;
      const safeKey = key.slice(0, 80);
      if (!Object.hasOwn(query, safeKey)) query[safeKey] = item.slice(0, 160);
      count += 1;
    }
  } catch {
    return null;
  }
  return { pathname, query: Object.freeze(query) };
}

export function resolveAuditRoute(input) {
  const parsed = parseInput(input);
  if (!parsed) return Object.freeze({ ...NOT_FOUND, params: Object.freeze({}), query: Object.freeze({}) });
  for (const candidate of AUDIT_ROUTES_V2) {
    const match = candidate.pattern.exec(parsed.pathname);
    if (!match) continue;
    let id;
    if (match[1]) {
      try {
        id = decodeURIComponent(match[1]).slice(0, 160);
      } catch {
        return Object.freeze({ ...NOT_FOUND, params: Object.freeze({}), query: parsed.query });
      }
    }
    return Object.freeze({ ...candidate, params: Object.freeze(id ? { id } : {}), query: parsed.query });
  }
  return Object.freeze({ ...NOT_FOUND, params: Object.freeze({}), query: parsed.query });
}
