import { escapeHtml } from './render.mjs';

export const safeHref = (url) => url ? escapeHtml(url) : null;
export const textOrDash = (value) => escapeHtml(value || '—');
export const statusBadge = (status, label = status) => `<span class="status" data-status="${escapeHtml(status)}">${escapeHtml(label || 'Unknown')}</span>`;
export const readonlyNotice = () => '<p class="notice" role="note">Execution unavailable. This surface is read-only.</p>';
export function renderLink(url, label) {
  const href = safeHref(url);
  return href ? `<a href="${href}" rel="noopener noreferrer">${escapeHtml(label)}</a>` : escapeHtml(label);
}
export function renderIdentifier(id) {
  const safe = escapeHtml(id || 'unknown');
  return `<code class="identifier" tabindex="0" aria-label="Identifier ${safe}" data-copy-value="${safe}">${safe}</code>`;
}
