import {
  createCampaignViewModel,
  createCapabilityViewModel,
  createCatalogToolViewModel,
  createCleanRoomViewModel,
  createDiagnosticViewModel,
  createForkViewModel,
  createJobViewModel,
  createReportListViewModel,
  createReportViewModel,
  createWorkspaceViewModel
} from '../../../packages/audit-report-view-model/src/index.mjs';
import { escapeHtml, renderShell, renderState } from './render.mjs';

const safeHref = (url) => url ? escapeHtml(url) : null;
const textOrDash = (value) => escapeHtml(value || '—');
const statusBadge = (status, label = status) => `<span class="status" data-status="${escapeHtml(status)}">${escapeHtml(label || 'Unknown')}</span>`;
const readonlyNotice = () => '<p class="notice" role="note">Execution unavailable. This surface is read-only.</p>';

function renderLink(url, label) {
  const href = safeHref(url);
  return href ? `<a href="${href}" rel="noopener noreferrer">${escapeHtml(label)}</a>` : escapeHtml(label);
}

function renderIdentifier(id) {
  const safe = escapeHtml(id || 'unknown');
  return `<code class="identifier" tabindex="0" aria-label="Identifier ${safe}" data-copy-value="${safe}">${safe}</code>`;
}

export function renderReportsPage(reports, options = {}) {
  const model = createReportListViewModel(reports, options);
  const form = `<form class="filters" aria-label="Filter reports"><label>Search<input name="query" value="${escapeHtml(model.query)}" autocomplete="off"></label><label>Status<select name="status"><option value="all"${model.status === 'all' ? ' selected' : ''}>All</option><option value="published"${model.status === 'published' ? ' selected' : ''}>Published</option><option value="failed"${model.status === 'failed' ? ' selected' : ''}>Failed</option></select></label><label>Sort<select name="sort"><option value="created-desc"${model.sort === 'created-desc' ? ' selected' : ''}>Newest</option><option value="created-asc"${model.sort === 'created-asc' ? ' selected' : ''}>Oldest</option><option value="title-asc"${model.sort === 'title-asc' ? ' selected' : ''}>Title A–Z</option><option value="title-desc"${model.sort === 'title-desc' ? ' selected' : ''}>Title Z–A</option></select></label></form>`;
  if (!model.items.length) return `${form}${renderState({ kind: 'empty', message: 'No reports match the current filters.' })}`;
  const rows = model.items.map((report) => `<tr><th scope="row"><a href="/reports/${encodeURIComponent(report.id)}">${escapeHtml(report.title || report.id)}</a><div>${renderIdentifier(report.id)}</div></th><td>${statusBadge(report.status)}</td><td><time datetime="${escapeHtml(report.createdAt || '')}">${textOrDash(report.createdAt)}</time></td><td>${report.evidence.length}</td></tr>`).join('');
  const table = `<div class="table-scroll" tabindex="0" aria-label="Scrollable report table"><table><caption>${model.total} report${model.total === 1 ? '' : 's'}</caption><thead><tr><th scope="col">Report</th><th scope="col">Status</th><th scope="col">Created</th><th scope="col">Evidence</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  const pager = `<nav class="pagination" aria-label="Report pagination"><span>Page ${model.page} of ${model.pageCount}</span>${model.page > 1 ? `<a href="?page=${model.page - 1}">Previous</a>` : '<span aria-disabled="true">Previous</span>'}${model.page < model.pageCount ? `<a href="?page=${model.page + 1}">Next</a>` : '<span aria-disabled="true">Next</span>'}</nav>`;
  return `${form}${table}${pager}`;
}

export function renderReportDetailPage(input) {
  const report = createReportViewModel(input);
  const source = report.sourceUrl ? `<p><strong>Source:</strong> ${renderLink(report.sourceUrl, 'Open source')}</p>` : '';
  const evidence = report.evidence.length
    ? `<div class="table-scroll" tabindex="0" aria-label="Scrollable evidence table"><table><caption>Evidence summary</caption><thead><tr><th scope="col">Evidence</th><th scope="col">Severity</th><th scope="col">Summary</th></tr></thead><tbody>${report.evidence.map((item) => `<tr><th scope="row">${renderLink(item.url, item.title || item.id)}<div>${renderIdentifier(item.id)}</div></th><td>${statusBadge(item.severity)}</td><td>${textOrDash(item.summary)}</td></tr>`).join('')}</tbody></table></div>`
    : renderState({ kind: 'empty', message: 'No evidence was published with this report.' });
  return `<section aria-labelledby="report-summary"><h2 id="report-summary">Report summary</h2><dl><div><dt>Identifier</dt><dd>${renderIdentifier(report.id)}</dd></div><div><dt>Status</dt><dd>${statusBadge(report.status)}</dd></div><div><dt>Created</dt><dd>${textOrDash(report.createdAt)}</dd></div></dl>${source}</section><section aria-labelledby="evidence-summary"><h2 id="evidence-summary">Evidence summary</h2>${evidence}</section>`;
}

export function renderWorkspacesPage(inputs) {
  const workspaces = Array.isArray(inputs) ? inputs.map(createWorkspaceViewModel).filter((item) => item.id).sort((a, b) => a.id.localeCompare(b.id)) : [];
  if (!workspaces.length) return renderState({ kind: 'empty', message: 'No workspaces are visible.' });
  return `<ul class="card-grid" role="list">${workspaces.map((workspace) => `<li class="card"><h2><a href="/workspaces/${encodeURIComponent(workspace.id)}">${escapeHtml(workspace.name || workspace.id)}</a></h2><p>${statusBadge(workspace.status)}</p><p>${workspace.campaigns.length} campaign${workspace.campaigns.length === 1 ? '' : 's'}</p></li>`).join('')}</ul>`;
}

export function renderWorkspacePage(input) {
  const workspace = createWorkspaceViewModel(input);
  const campaigns = workspace.campaigns.length
    ? `<ul class="card-grid" role="list">${workspace.campaigns.map((campaign) => `<li class="card"><h3><a href="/campaigns/${encodeURIComponent(campaign.id)}">${escapeHtml(campaign.name || campaign.id)}</a></h3><p>${statusBadge(campaign.status, campaign.stateLabel)}</p><p>${campaign.jobs.length} job${campaign.jobs.length === 1 ? '' : 's'}</p></li>`).join('')}</ul>`
    : renderState({ kind: 'empty', message: 'No campaigns are visible in this workspace.' });
  return `<section aria-labelledby="workspace-summary"><h2 id="workspace-summary">Workspace summary</h2><dl><div><dt>Identifier</dt><dd>${renderIdentifier(workspace.id)}</dd></div><div><dt>Status</dt><dd>${statusBadge(workspace.status)}</dd></div><div><dt>Updated</dt><dd>${textOrDash(workspace.updatedAt)}</dd></div></dl></section><section aria-labelledby="campaigns-heading"><h2 id="campaigns-heading">Campaigns</h2>${campaigns}</section>`;
}

export function renderCampaignPage(input) {
  const campaign = createCampaignViewModel(input);
  const jobs = campaign.jobs.length
    ? `<div class="table-scroll" tabindex="0" aria-label="Scrollable job table"><table><caption>Campaign jobs</caption><thead><tr><th scope="col">Job</th><th scope="col">State</th><th scope="col">Report</th></tr></thead><tbody>${campaign.jobs.map((job) => `<tr><th scope="row"><a href="/jobs/${encodeURIComponent(job.id)}">${escapeHtml(job.title || job.id)}</a><div>${renderIdentifier(job.id)}</div></th><td>${statusBadge(job.status, job.stateLabel)}</td><td>${job.reportId ? `<a href="/reports/${encodeURIComponent(job.reportId)}">View report</a>` : '—'}</td></tr>`).join('')}</tbody></table></div>`
    : renderState({ kind: 'empty', message: 'No jobs are visible in this campaign.' });
  return `${readonlyNotice()}<section aria-labelledby="campaign-summary"><h2 id="campaign-summary">Campaign summary</h2><dl><div><dt>Identifier</dt><dd>${renderIdentifier(campaign.id)}</dd></div><div><dt>State</dt><dd>${statusBadge(campaign.status, campaign.stateLabel)}</dd></div><div><dt>Updated</dt><dd>${textOrDash(campaign.updatedAt)}</dd></div></dl><p>${textOrDash(campaign.summary)}</p></section><section aria-labelledby="jobs-heading"><h2 id="jobs-heading">Jobs</h2>${jobs}</section>`;
}

export function renderJobPage(input) {
  const job = createJobViewModel(input);
  const error = job.error ? `<section aria-labelledby="job-error"><h2 id="job-error">Failure summary</h2><p role="alert">${escapeHtml(job.error)}</p></section>` : '';
  const report = job.reportId ? `<a href="/reports/${encodeURIComponent(job.reportId)}">View published report</a>` : 'No report published';
  return `${readonlyNotice()}<section aria-labelledby="job-summary"><h2 id="job-summary">Job summary</h2><dl><div><dt>Identifier</dt><dd>${renderIdentifier(job.id)}</dd></div><div><dt>State</dt><dd>${statusBadge(job.status, job.stateLabel)}</dd></div><div><dt>Campaign</dt><dd>${job.campaignId ? `<a href="/campaigns/${encodeURIComponent(job.campaignId)}">${escapeHtml(job.campaignId)}</a>` : '—'}</dd></div><div><dt>Report</dt><dd>${report}</dd></div><div><dt>Resource limit</dt><dd>${job.resourceLimit || '—'}</dd></div><div><dt>Updated</dt><dd>${textOrDash(job.updatedAt)}</dd></div></dl></section>${error}`;
}

export function renderForkPage(input) {
  const fork = createForkViewModel(input);
  const checkpoints = fork.checkpoints.length
    ? `<div class="table-scroll" tabindex="0" aria-label="Scrollable checkpoint table"><table><caption>Checkpoints</caption><thead><tr><th scope="col">Checkpoint</th><th scope="col">Status</th><th scope="col">Created</th><th scope="col">Export</th></tr></thead><tbody>${fork.checkpoints.map((checkpoint) => `<tr><th scope="row">${escapeHtml(checkpoint.label)}<div>${renderIdentifier(checkpoint.id)}</div></th><td>${statusBadge(checkpoint.status)}</td><td>${textOrDash(checkpoint.createdAt)}</td><td>${checkpoint.exportUrl ? renderLink(checkpoint.exportUrl, 'Open export') : '—'}</td></tr>`).join('')}</tbody></table></div>`
    : renderState({ kind: 'empty', message: 'No checkpoints are visible.' });
  return `${readonlyNotice()}<section aria-labelledby="fork-summary"><h2 id="fork-summary">Persistent fork summary</h2><dl><div><dt>Identifier</dt><dd>${renderIdentifier(fork.id)}</dd></div><div><dt>Status</dt><dd>${statusBadge(fork.status)}</dd></div><div><dt>Export status</dt><dd>${statusBadge(fork.exportStatus)}</dd></div><div><dt>Delete status</dt><dd>${statusBadge(fork.deleteStatus)}</dd></div><div><dt>Retention expires</dt><dd>${textOrDash(fork.retentionExpiresAt)}</dd></div></dl></section><section aria-labelledby="checkpoints-heading"><h2 id="checkpoints-heading">Checkpoints</h2>${checkpoints}</section>`;
}

export function renderCleanRoomPage(input) {
  const campaign = createCleanRoomViewModel(input);
  const merges = campaign.merges.length ? `<ol>${campaign.merges.map((merge) => `<li>${renderIdentifier(merge)}</li>`).join('')}</ol>` : renderState({ kind: 'empty', message: 'No controlled merges are visible.' });
  const provenance = campaign.provenance.length
    ? `<div class="table-scroll" tabindex="0" aria-label="Scrollable provenance table"><table><caption>Visible provenance</caption><thead><tr><th scope="col">Source</th><th scope="col">Type</th><th scope="col">Revision</th></tr></thead><tbody>${campaign.provenance.map((item) => `<tr><th scope="row">${escapeHtml(item.label)}<div>${renderIdentifier(item.sourceId)}</div></th><td>${escapeHtml(item.sourceType)}</td><td>${renderIdentifier(item.commitSha)}</td></tr>`).join('')}</tbody></table></div>`
    : renderState({ kind: 'empty', message: 'No visible provenance is available.' });
  return `${readonlyNotice()}<section aria-labelledby="clean-summary"><h2 id="clean-summary">Clean-room summary</h2><dl><div><dt>Identifier</dt><dd>${renderIdentifier(campaign.id)}</dd></div><div><dt>Status</dt><dd>${statusBadge(campaign.status)}</dd></div></dl></section><section aria-labelledby="merges-heading"><h2 id="merges-heading">Controlled merges</h2>${merges}</section><section aria-labelledby="provenance-heading"><h2 id="provenance-heading">Provenance</h2>${provenance}</section>`;
}

export function renderCatalogPage(input = {}) {
  const capabilities = Array.isArray(input.capabilities) ? input.capabilities.map(createCapabilityViewModel).filter((item) => item.id).sort((a, b) => a.id.localeCompare(b.id)) : [];
  const tools = Array.isArray(input.tools) ? input.tools.map(createCatalogToolViewModel).filter((item) => item.id).sort((a, b) => a.id.localeCompare(b.id)) : [];
  const capabilityCards = capabilities.length ? `<ul class="card-grid" role="list">${capabilities.map((item) => `<li class="card"><h3>${escapeHtml(item.name || item.id)}</h3><p>${item.available ? statusBadge('available', 'Available for discovery') : statusBadge('unavailable', 'Unavailable')}</p><p>${textOrDash(item.summary || item.reason)}</p></li>`).join('')}</ul>` : renderState({ kind: 'empty', message: 'No capabilities are visible.' });
  const toolCards = tools.length ? `<ul class="card-grid" role="list">${tools.map((item) => `<li class="card"><h3>${escapeHtml(item.name || item.id)}</h3><p>${item.available ? statusBadge('available', 'Available for discovery') : statusBadge('unavailable', 'Unavailable')}</p><p>${textOrDash(item.summary)}</p><p><strong>Capabilities:</strong> ${item.capabilityIds.map(renderIdentifier).join(' ') || '—'}</p><p><strong>Tags:</strong> ${item.tags.map(escapeHtml).join(', ') || '—'}</p></li>`).join('')}</ul>` : renderState({ kind: 'empty', message: 'No tools are visible.' });
  return `<p class="notice" role="note">Execution is not enabled by this catalog. Availability describes discovery metadata only.</p><section aria-labelledby="capabilities-heading"><h2 id="capabilities-heading">Capabilities</h2>${capabilityCards}</section><section aria-labelledby="tools-heading"><h2 id="tools-heading">Tools</h2>${toolCards}</section>`;
}

export function renderDiagnosticsPage(inputs) {
  const diagnostics = Array.isArray(inputs) ? inputs.map(createDiagnosticViewModel).filter((item) => item.code).sort((a, b) => a.code.localeCompare(b.code)) : [];
  if (!diagnostics.length) return renderState({ kind: 'empty', message: 'No operator diagnostics are visible.' });
  return `<ul class="diagnostics" role="list">${diagnostics.map((item) => `<li class="diagnostic-card"><h2>${escapeHtml(item.code)}</h2><p role="alert">${escapeHtml(item.message)}</p><dl><div><dt>Correlation ID</dt><dd>${item.correlationId ? renderIdentifier(item.correlationId) : '—'}</dd></div><div><dt>Retry after</dt><dd>${item.retryAfterSeconds} seconds</dd></div><div><dt>Quota remaining</dt><dd>${item.quotaRemaining}</dd></div><div><dt>Retention</dt><dd>${item.retentionDays} days</dd></div><div><dt>Publication</dt><dd>${statusBadge(item.publicationStatus)}</dd></div><div><dt>Stale-state conflict</dt><dd>${item.staleState ? 'Yes' : 'No'}</dd></div></dl>${item.details ? `<details class="expandable"><summary>Show full details</summary><p>${escapeHtml(item.details)}</p></details>` : ''}</li>`).join('')}</ul>`;
}

const PAGE_CONFIG = Object.freeze({
  reports: ['Reports', 'reports', renderReportsPage],
  reportDetail: ['Report detail', 'reports', renderReportDetailPage],
  workspaces: ['Workspaces', 'workspaces', renderWorkspacesPage],
  workspaceDetail: ['Workspace detail', 'workspaces', renderWorkspacePage],
  campaignDetail: ['Campaign detail', 'workspaces', renderCampaignPage],
  jobDetail: ['Job detail', 'workspaces', renderJobPage],
  forkDetail: ['Persistent fork', 'workspaces', renderForkPage],
  cleanRoomDetail: ['Clean-room campaign', 'workspaces', renderCleanRoomPage],
  catalog: ['Capability catalog', 'catalog', renderCatalogPage],
  diagnostics: ['Operator diagnostics', 'diagnostics', renderDiagnosticsPage]
});

export function renderAuditPage(routeName, payload, options = {}) {
  const config = PAGE_CONFIG[routeName];
  if (!config) return renderShell({ title: 'Page not found', activeRoute: '', body: renderState({ kind: 'error', message: 'The requested page is not available.' }) });
  const [title, activeRoute, renderer] = config;
  return renderShell({ title, activeRoute, body: renderer(payload, options) });
}
