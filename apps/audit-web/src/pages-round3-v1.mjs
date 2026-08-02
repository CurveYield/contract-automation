import {
  createGitHubDirectStatusViewModel, createOperationBudgetViewModel, createParserViewModel,
  createProfileViewModel, createQuotaViewModel, createReleaseProvenanceViewModel,
  createResultViewModel, createRetentionViewModel, lifecycleState
} from '../../../packages/audit-report-view-model/src/index.mjs';
import { escapeHtml, renderState } from './render.mjs';

const text = (value) => escapeHtml(value || '—');
const badge = (status, label = status) => `<span class="status" data-status="${escapeHtml(status)}">${escapeHtml(label || 'Unknown')}</span>`;
const identifier = (id) => {
  const safe = escapeHtml(id || 'unknown');
  return `<code class="identifier" tabindex="0" aria-label="Identifier ${safe}" data-copy-value="${safe}">${safe}</code>`;
};
const notice = () => '<p class="notice" role="note">Execution unavailable. This surface is read-only.</p>';

export function renderProfilesPage(inputs) {
  const profiles = Array.isArray(inputs) ? inputs.map(createProfileViewModel).filter((item) => item.id).sort((a, b) => a.id.localeCompare(b.id)) : [];
  if (!profiles.length) return renderState({ kind: 'empty', message: 'No profiles are visible.' });
  return `${notice()}<ul class="card-grid" role="list">${profiles.map((item) => `<li class="card"><h2><a href="/profiles/${encodeURIComponent(item.id)}">${escapeHtml(item.name || item.id)}</a></h2><p>${item.available ? badge('available', 'Available for discovery') : badge('unavailable', 'Unavailable')}</p><dl><div><dt>Version</dt><dd>${text(item.version)}</dd></div><div><dt>Parser</dt><dd>${item.parserId ? `<a href="/parsers/${encodeURIComponent(item.parserId)}">${escapeHtml(item.parserId)}</a>` : '—'}</dd></div></dl></li>`).join('')}</ul>`;
}

export function renderProfilePage(input) {
  const item = createProfileViewModel(input);
  return `${notice()}<section aria-labelledby="profile-summary"><h2 id="profile-summary">Profile summary</h2><dl><div><dt>Identifier</dt><dd>${identifier(item.id)}</dd></div><div><dt>Name</dt><dd>${text(item.name)}</dd></div><div><dt>Version</dt><dd>${text(item.version)}</dd></div><div><dt>Availability</dt><dd>${item.available ? badge('available', 'Available for discovery') : badge('unavailable', 'Unavailable')}</dd></div><div><dt>Parser</dt><dd>${item.parserId ? `<a href="/parsers/${encodeURIComponent(item.parserId)}">${escapeHtml(item.parserId)}</a>` : '—'}</dd></div></dl><p>${text(item.summary)}</p></section>`;
}

export function renderParserPage(input) {
  const item = createParserViewModel(input);
  return `${notice()}<section aria-labelledby="parser-summary"><h2 id="parser-summary">Parser summary</h2><dl><div><dt>Identifier</dt><dd>${identifier(item.id)}</dd></div><div><dt>Name</dt><dd>${text(item.name)}</dd></div><div><dt>Version</dt><dd>${text(item.version)}</dd></div><div><dt>Availability</dt><dd>${item.available ? badge('available', 'Available for discovery') : badge('unavailable', 'Unavailable')}</dd></div><div><dt>Profile</dt><dd>${item.profileId ? `<a href="/profiles/${encodeURIComponent(item.profileId)}">${escapeHtml(item.profileId)}</a>` : '—'}</dd></div></dl><p>${text(item.summary)}</p></section>`;
}

export function renderResultPage(input) {
  const item = createResultViewModel(input);
  return `${notice()}<section aria-labelledby="result-summary"><h2 id="result-summary">Result summary</h2><dl><div><dt>Identifier</dt><dd>${identifier(item.id)}</dd></div><div><dt>Status</dt><dd>${badge(item.status, lifecycleState(item.status).label)}</dd></div><div><dt>Profile</dt><dd>${item.profileId ? `<a href="/profiles/${encodeURIComponent(item.profileId)}">${escapeHtml(item.profileId)}</a>` : '—'}</dd></div><div><dt>Parser</dt><dd>${item.parserId ? `<a href="/parsers/${encodeURIComponent(item.parserId)}">${escapeHtml(item.parserId)}</a>` : '—'}</dd></div><div><dt>Report</dt><dd>${item.reportId ? `<a href="/reports/${encodeURIComponent(item.reportId)}">View report</a>` : '—'}</dd></div><div><dt>Evidence count</dt><dd>${item.evidenceCount}</dd></div></dl><p>${text(item.summary)}</p></section>`;
}

export function renderGitHubDirectStatusPage(input) {
  const item = createGitHubDirectStatusViewModel(input);
  return `${notice()}<section aria-labelledby="github-direct-summary"><h2 id="github-direct-summary">GitHub Direct Audit status</h2><dl><div><dt>Identifier</dt><dd>${identifier(item.id)}</dd></div><div><dt>Status</dt><dd>${badge(item.status, lifecycleState(item.status).label)}</dd></div><div><dt>Repository</dt><dd>${text(item.repository)}</dd></div><div><dt>Target revision</dt><dd>${identifier(item.targetSha)}</dd></div><div><dt>Check status</dt><dd>${badge(item.checkStatus)}</dd></div><div><dt>Report</dt><dd>${item.reportId ? `<a href="/reports/${encodeURIComponent(item.reportId)}">View report</a>` : '—'}</dd></div><div><dt>Updated</dt><dd>${text(item.updatedAt)}</dd></div></dl>${item.reason ? `<p>${escapeHtml(item.reason)}</p>` : ''}</section>`;
}

function quotaTable(items, title) {
  if (!items.length) return renderState({ kind: 'empty', message: `No ${title.toLowerCase()} data is visible.` });
  return `<div class="table-scroll" tabindex="0" aria-label="Scrollable ${escapeHtml(title.toLowerCase())} table"><table><caption>${escapeHtml(title)}</caption><thead><tr><th scope="col">Identifier</th><th scope="col">Remaining</th><th scope="col">Used</th><th scope="col">Limit</th><th scope="col">Scope</th></tr></thead><tbody>${items.map((item) => `<tr><th scope="row">${identifier(item.id)}</th><td>${item.remaining}</td><td>${item.used}</td><td>${item.limit}</td><td>${text(item.scope)}</td></tr>`).join('')}</tbody></table></div>`;
}

export function renderOperationsPage(input = {}) {
  const quotas = Array.isArray(input.quotas) ? input.quotas.map(createQuotaViewModel).filter((item) => item.id).sort((a, b) => a.id.localeCompare(b.id)) : [];
  const retention = Array.isArray(input.retention) ? input.retention.map(createRetentionViewModel).filter((item) => item.id).sort((a, b) => a.id.localeCompare(b.id)) : [];
  const budgets = Array.isArray(input.operationBudgets) ? input.operationBudgets.map(createOperationBudgetViewModel).filter((item) => item.id).sort((a, b) => a.id.localeCompare(b.id)) : [];
  const retentionView = retention.length ? `<ul class="card-grid" role="list">${retention.map((item) => `<li class="card"><h3>${identifier(item.id)}</h3><p><strong>${item.days} days</strong></p><p>${text(item.policy)}</p><p>Scope: ${text(item.scope)}</p></li>`).join('')}</ul>` : renderState({ kind: 'empty', message: 'No retention data is visible.' });
  const budgetView = budgets.length ? `<div class="table-scroll" tabindex="0"><table><caption>Operation budget</caption><thead><tr><th scope="col">Identifier</th><th scope="col">Operation</th><th scope="col">Remaining</th><th scope="col">Used</th><th scope="col">Limit</th></tr></thead><tbody>${budgets.map((item) => `<tr><th scope="row">${identifier(item.id)}</th><td>${text(item.operation)}</td><td>${item.remaining}</td><td>${item.used}</td><td>${item.limit}</td></tr>`).join('')}</tbody></table></div>` : renderState({ kind: 'empty', message: 'No operation-budget data is visible.' });
  return `${notice()}<section aria-labelledby="quota-heading"><h2 id="quota-heading">Quota</h2>${quotaTable(quotas, 'Quota')}</section><section aria-labelledby="retention-heading"><h2 id="retention-heading">Retention</h2>${retentionView}</section><section aria-labelledby="budget-heading"><h2 id="budget-heading">Operation budget</h2>${budgetView}</section>`;
}

export function renderReleaseProvenancePage(input) {
  const item = createReleaseProvenanceViewModel(input);
  const versions = item.compatibilityVersions.length ? `<ul>${item.compatibilityVersions.map((version) => `<li>${escapeHtml(version)}</li>`).join('')}</ul>` : renderState({ kind: 'empty', message: 'No compatibility versions are recorded.' });
  return `${notice()}<section aria-labelledby="release-summary"><h2 id="release-summary">Release provenance</h2><dl><div><dt>Identifier</dt><dd>${identifier(item.id)}</dd></div><div><dt>Version</dt><dd>${text(item.version)}</dd></div><div><dt>Status</dt><dd>${badge(item.status)}</dd></div><div><dt>Starting SHA</dt><dd>${identifier(item.startingSha)}</dd></div><div><dt>Candidate SHA</dt><dd>${identifier(item.candidateSha)}</dd></div><div><dt>Created</dt><dd>${text(item.createdAt)}</dd></div></dl><h3>Compatibility versions</h3>${versions}</section>`;
}
