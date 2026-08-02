import { createCampaignViewModel, createJobViewModel, createWorkspaceViewModel } from '../../../packages/audit-report-view-model/src/index.mjs';
import { escapeHtml, renderState } from './render.mjs';
import { readonlyNotice, renderIdentifier, statusBadge, textOrDash } from './page-helpers-v1.mjs';

export function renderWorkspacesPage(inputs) {
  const workspaces = Array.isArray(inputs) ? inputs.map(createWorkspaceViewModel).filter((item) => item.id).sort((a, b) => a.id.localeCompare(b.id)) : [];
  if (!workspaces.length) return renderState({ kind: 'empty', message: 'No workspaces are visible.' });
  return `<ul class="card-grid" role="list">${workspaces.map((workspace) => `<li class="card"><h2><a href="/workspaces/${encodeURIComponent(workspace.id)}">${escapeHtml(workspace.name || workspace.id)}</a></h2><p>${statusBadge(workspace.status)}</p><p>${workspace.campaigns.length} campaign${workspace.campaigns.length === 1 ? '' : 's'}</p></li>`).join('')}</ul>`;
}
export function renderWorkspacePage(input) {
  const workspace = createWorkspaceViewModel(input);
  const campaigns = workspace.campaigns.length ? `<ul class="card-grid" role="list">${workspace.campaigns.map((campaign) => `<li class="card"><h3><a href="/campaigns/${encodeURIComponent(campaign.id)}">${escapeHtml(campaign.name || campaign.id)}</a></h3><p>${statusBadge(campaign.status, campaign.stateLabel)}</p><p>${campaign.jobs.length} job${campaign.jobs.length === 1 ? '' : 's'}</p></li>`).join('')}</ul>` : renderState({ kind: 'empty', message: 'No campaigns are visible in this workspace.' });
  return `<section aria-labelledby="workspace-summary"><h2 id="workspace-summary">Workspace summary</h2><dl><div><dt>Identifier</dt><dd>${renderIdentifier(workspace.id)}</dd></div><div><dt>Status</dt><dd>${statusBadge(workspace.status)}</dd></div><div><dt>Updated</dt><dd>${textOrDash(workspace.updatedAt)}</dd></div></dl></section><section aria-labelledby="campaigns-heading"><h2 id="campaigns-heading">Campaigns</h2>${campaigns}</section>`;
}
export function renderCampaignPage(input) {
  const campaign = createCampaignViewModel(input);
  const jobs = campaign.jobs.length ? `<div class="table-scroll" tabindex="0" aria-label="Scrollable job table"><table><caption>Campaign jobs</caption><thead><tr><th scope="col">Job</th><th scope="col">State</th><th scope="col">Report</th></tr></thead><tbody>${campaign.jobs.map((job) => `<tr><th scope="row"><a href="/jobs/${encodeURIComponent(job.id)}">${escapeHtml(job.title || job.id)}</a><div>${renderIdentifier(job.id)}</div></th><td>${statusBadge(job.status, job.stateLabel)}</td><td>${job.reportId ? `<a href="/reports/${encodeURIComponent(job.reportId)}">View report</a>` : '—'}</td></tr>`).join('')}</tbody></table></div>` : renderState({ kind: 'empty', message: 'No jobs are visible in this campaign.' });
  return `${readonlyNotice()}<section aria-labelledby="campaign-summary"><h2 id="campaign-summary">Campaign summary</h2><dl><div><dt>Name</dt><dd>${textOrDash(campaign.name)}</dd></div><div><dt>Identifier</dt><dd>${renderIdentifier(campaign.id)}</dd></div><div><dt>State</dt><dd>${statusBadge(campaign.status, campaign.stateLabel)}</dd></div><div><dt>Updated</dt><dd>${textOrDash(campaign.updatedAt)}</dd></div></dl><p>${textOrDash(campaign.summary)}</p></section><section aria-labelledby="jobs-heading"><h2 id="jobs-heading">Jobs</h2>${jobs}</section>`;
}
export function renderJobPage(input) {
  const job = createJobViewModel(input);
  const error = job.error ? `<section aria-labelledby="job-error"><h2 id="job-error">Failure summary</h2><p role="alert">${escapeHtml(job.error)}</p></section>` : '';
  const report = job.reportId ? `<a href="/reports/${encodeURIComponent(job.reportId)}">View published report</a>` : 'No report published';
  return `${readonlyNotice()}<section aria-labelledby="job-summary"><h2 id="job-summary">Job summary</h2><dl><div><dt>Identifier</dt><dd>${renderIdentifier(job.id)}</dd></div><div><dt>State</dt><dd>${statusBadge(job.status, job.stateLabel)}</dd></div><div><dt>Campaign</dt><dd>${job.campaignId ? `<a href="/campaigns/${encodeURIComponent(job.campaignId)}">${escapeHtml(job.campaignId)}</a>` : '—'}</dd></div><div><dt>Report</dt><dd>${report}</dd></div><div><dt>Resource limit</dt><dd>${job.resourceLimit || '—'}</dd></div><div><dt>Updated</dt><dd>${textOrDash(job.updatedAt)}</dd></div></dl></section>${error}`;
}
