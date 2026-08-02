import { createReportListViewModel, createReportViewModel } from '../../../packages/audit-report-view-model/src/index.mjs';
import { escapeHtml, renderState } from './render.mjs';
import { renderIdentifier, renderLink, statusBadge, textOrDash } from './page-helpers-v1.mjs';

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
  const related = [
    report.workspaceId ? `<div><dt>Workspace</dt><dd><a href="/workspaces/${encodeURIComponent(report.workspaceId)}">${escapeHtml(report.workspaceId)}</a></dd></div>` : '',
    report.campaignId ? `<div><dt>Campaign</dt><dd><a href="/campaigns/${encodeURIComponent(report.campaignId)}">${escapeHtml(report.campaignId)}</a></dd></div>` : '',
    report.jobId ? `<div><dt>Job</dt><dd><a href="/jobs/${encodeURIComponent(report.jobId)}">${escapeHtml(report.jobId)}</a></dd></div>` : ''
  ].join('');
  const references = report.references?.length
    ? `<ul class="reference-list" role="list">${report.references.map((item) => `<li>${renderLink(item.url, item.label || item.id)}<div>${renderIdentifier(item.id)}</div></li>`).join('')}</ul>`
    : renderState({ kind: 'empty', message: 'No report references are visible.' });
  const evidence = report.evidence.length
    ? `<div class="table-scroll" tabindex="0" aria-label="Scrollable evidence table"><table><caption>Evidence summary</caption><thead><tr><th scope="col">Evidence</th><th scope="col">Severity</th><th scope="col">Summary</th></tr></thead><tbody>${report.evidence.map((item) => `<tr><th scope="row">${renderLink(item.url, item.title || item.id)}<div>${renderIdentifier(item.id)}</div></th><td>${statusBadge(item.severity)}</td><td>${textOrDash(item.summary)}</td></tr>`).join('')}</tbody></table></div>`
    : renderState({ kind: 'empty', message: 'No evidence was published with this report.' });
  return `<section aria-labelledby="report-summary"><h2 id="report-summary">Report summary</h2><dl><div><dt>Identifier</dt><dd>${renderIdentifier(report.id)}</dd></div><div><dt>Status</dt><dd>${statusBadge(report.status)}</dd></div><div><dt>Created</dt><dd>${textOrDash(report.createdAt)}</dd></div>${related}</dl><p>${textOrDash(report.summary)}</p>${source}</section><section aria-labelledby="references-heading"><h2 id="references-heading">References</h2>${references}</section><section aria-labelledby="evidence-summary"><h2 id="evidence-summary">Evidence summary</h2>${evidence}</section>`;
}
