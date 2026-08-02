import { createCapabilityViewModel, createCatalogToolViewModel, createDiagnosticViewModel } from '../../../packages/audit-report-view-model/src/index.mjs';
import { escapeHtml, renderState } from './render.mjs';
import { renderIdentifier, statusBadge, textOrDash } from './page-helpers-v1.mjs';

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
