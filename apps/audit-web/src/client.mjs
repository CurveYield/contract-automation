export class AuditApiError extends Error {
  constructor(code, message, status, details) {
    super(String(message));
    this.name = 'AuditApiError';
    this.code = String(code);
    this.status = status;
    this.details = details;
  }
}

export function normalizeAuditApiUrl(value) {
  let url;
  try { url = new URL(String(value)); }
  catch { throw new TypeError('Audit API URL must be a valid https origin'); }
  if (url.protocol !== 'https:') throw new TypeError('Audit API URL must use https');
  if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new TypeError('Audit API URL must be an origin without credentials, path, query, or fragment');
  }
  return url.origin;
}

export function createAuditApiClient({ apiUrl, apiKey, fetcher = fetch }) {
  const baseUrl = normalizeAuditApiUrl(apiUrl);
  const credential = String(apiKey ?? '');

  async function request(path, init = {}) {
    if (!path.startsWith('/audit/v1/')) throw new TypeError('Audit client paths must remain under /audit/v1/');
    const headers = new Headers(init.headers ?? {});
    headers.set('authorization', `Bearer ${credential}`);
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
    const response = await fetcher(`${baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      let payload = {};
      try { payload = await response.json(); } catch {}
      throw new AuditApiError(
        payload?.error?.code ?? 'request_failed',
        payload?.error?.message ?? `Request failed with status ${response.status}`,
        response.status,
        payload?.error?.details
      );
    }
    return response;
  }

  return Object.freeze({
    async getCapabilities() {
      return (await request('/audit/v1/capabilities')).json();
    },
    async getReadiness() {
      return (await request('/audit/v1/readiness')).json();
    }
  });
}
