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

function workspaceId(value) {
  const result = String(value ?? '');
  if (!/^ws_[0-9a-f]{32}$/.test(result)) throw new TypeError('Workspace ID must be a valid Audit workspace ID');
  return result;
}

function profileId(value) {
  const result = String(value ?? '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]*$/.test(result)) throw new TypeError('Profile ID must be a lowercase versioned slug');
  return result;
}

function campaignId(value) {
  const result = String(value ?? '');
  if (!/^cmp_[0-9a-f]{32}$/.test(result)) throw new TypeError('Campaign ID must be a valid Audit campaign ID');
  return result;
}

function jobId(value) {
  const result = String(value ?? '');
  if (!/^ajob_[0-9a-f]{32}$/.test(result)) throw new TypeError('Job ID must be a valid Audit job ID');
  return result;
}

function attemptId(value) {
  const result = String(value ?? '');
  if (!/^att_[0-9a-f]{32}$/.test(result)) throw new TypeError('Attempt ID must be a valid Audit attempt ID');
  return result;
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

  async function sendJson(path, body) {
    return (await request(path, { method: 'POST', body: JSON.stringify(body) })).json();
  }

  return Object.freeze({
    async getCapabilities() {
      return (await request('/audit/v1/capabilities')).json();
    },
    async getReadiness() {
      return (await request('/audit/v1/readiness')).json();
    },
    async createWorkspaceUploadGrant(input) {
      return sendJson('/audit/v1/workspace-upload-grants', input);
    },
    async sealWorkspace(input) {
      return sendJson('/audit/v1/workspaces/seal', input);
    },
    async importGitHubWorkspace(input) {
      return sendJson('/audit/v1/workspaces/import-github', input);
    },
    async getWorkspace(id) {
      return (await request(`/audit/v1/workspaces/${workspaceId(id)}`)).json();
    },
    async getWorkspaceLayers(id) {
      return (await request(`/audit/v1/workspaces/${workspaceId(id)}/layers`)).json();
    },
    async attachWorkspaceLayer(id, input) {
      return sendJson(`/audit/v1/workspaces/${workspaceId(id)}/layers`, input);
    },
    async listProfiles() {
      return (await request('/audit/v1/profiles')).json();
    },
    async getProfile(id) {
      return (await request(`/audit/v1/profiles/${profileId(id)}`)).json();
    },
    async createCampaign(input) {
      return sendJson('/audit/v1/campaigns', input);
    },
    async getCampaign(id) {
      return (await request(`/audit/v1/campaigns/${campaignId(id)}`)).json();
    },
    async submitCampaignJob(id, input) {
      return sendJson(`/audit/v1/campaigns/${campaignId(id)}/jobs`, input);
    },
    async getJob(id) {
      return (await request(`/audit/v1/jobs/${jobId(id)}`)).json();
    },
    async cancelJob(id, input) {
      return sendJson(`/audit/v1/jobs/${jobId(id)}/cancel`, input);
    },
    async resumeJob(id, input) {
      return sendJson(`/audit/v1/jobs/${jobId(id)}/resume`, input);
    },
    async getJobLogs(id, attempt) {
      return (await request(`/audit/v1/jobs/${jobId(id)}/logs?attemptId=${encodeURIComponent(attemptId(attempt))}`)).json();
    },
    async getJobReports(id) {
      return (await request(`/audit/v1/jobs/${jobId(id)}/reports`)).json();
    }
  });
}
