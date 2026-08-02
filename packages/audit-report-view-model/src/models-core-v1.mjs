import { readUiEntityData } from '../../audit-ui-contracts/src/index.mjs';
import {
  MAX_LONG_TEXT, MAX_REPORT_COLLECTION, dateText, deepFreeze, denseDataValues,
  redactDiagnosticText, safeDescriptors, statusText, toBoundedInteger,
  toSafeIdentifier, toSafeText, toSafeUrl
} from './safety-v1.mjs';
import { lifecycleState } from './lifecycle-v1.mjs';

function evidenceModel(input) {
  const data = readUiEntityData('evidence', input);
  return {
    id: toSafeIdentifier(data.id), title: toSafeText(data.title),
    severity: statusText(data.severity, 'informational'), url: toSafeUrl(data.url),
    summary: toSafeText(data.summary, MAX_LONG_TEXT), kind: statusText(data.kind, 'evidence'),
    referenceId: toSafeIdentifier(data.referenceId), visible: data.visible !== false
  };
}

function referenceModel(input) {
  if (typeof input === 'string' || typeof input === 'number') {
    const id = toSafeIdentifier(input);
    return { id, label: id, url: null, kind: 'reference' };
  }
  const descriptors = safeDescriptors(input);
  if (!descriptors) return { id: '', label: '', url: null, kind: 'reference' };
  const read = (key) => descriptors[key]?.enumerable && Object.hasOwn(descriptors[key], 'value') ? descriptors[key].value : undefined;
  const id = toSafeIdentifier(read('id'));
  return { id, label: toSafeText(read('label') || read('title') || id), url: toSafeUrl(read('url')), kind: statusText(read('kind'), 'reference') };
}

function canonicalReferences(input) {
  const byId = new Map();
  const conflicts = new Set();
  for (const item of denseDataValues(input, 50).map(referenceModel)) {
    if (!item.id || conflicts.has(item.id)) continue;
    const prior = byId.get(item.id);
    if (!prior) {
      byId.set(item.id, item);
      continue;
    }
    if (prior.label !== item.label || prior.url !== item.url || prior.kind !== item.kind) {
      byId.delete(item.id);
      conflicts.add(item.id);
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function createEvidenceViewModel(input) { return deepFreeze(evidenceModel(input)); }

export function createReportViewModel(input) {
  const data = readUiEntityData('report', input);
  const hidden = data.visible === false;
  const evidence = hidden ? [] : denseDataValues(data.evidence, 50).map(evidenceModel).filter((item) => item.id && item.visible).sort((a, b) => a.id.localeCompare(b.id));
  const references = hidden ? [] : canonicalReferences(data.references);
  const base = {
    id: hidden ? '' : toSafeIdentifier(data.id), title: hidden ? '' : toSafeText(data.title),
    status: hidden ? 'not-found' : statusText(data.status),
    createdAt: hidden ? null : dateText(data.createdAt), sourceUrl: hidden ? null : toSafeUrl(data.sourceUrl)
  };
  const extended = ['summary', 'workspaceId', 'campaignId', 'jobId', 'references'].some((key) => Object.hasOwn(data, key));
  return deepFreeze(extended ? {
    ...base, summary: hidden ? '' : toSafeText(data.summary, MAX_LONG_TEXT),
    workspaceId: hidden ? '' : toSafeIdentifier(data.workspaceId),
    campaignId: hidden ? '' : toSafeIdentifier(data.campaignId),
    jobId: hidden ? '' : toSafeIdentifier(data.jobId), references, evidence
  } : { ...base, evidence });
}

function jobModel(input) {
  const data = readUiEntityData('job', input);
  const state = lifecycleState(data.status);
  return {
    id: toSafeIdentifier(data.id), title: toSafeText(data.title || data.id), status: state.code,
    stateLabel: state.label, campaignId: toSafeIdentifier(data.campaignId), reportId: toSafeIdentifier(data.reportId),
    error: redactDiagnosticText(data.error, MAX_LONG_TEXT), resourceLimit: toBoundedInteger(data.resourceLimit, { max: 1_000_000 }),
    updatedAt: dateText(data.updatedAt), timeoutAt: dateText(data.timeoutAt), admittedAt: dateText(data.admittedAt),
    executionAvailable: false
  };
}
export function createJobViewModel(input) { return deepFreeze(jobModel(input)); }

export function createCampaignViewModel(input) {
  const data = readUiEntityData('campaign', input);
  const state = lifecycleState(data.status);
  const jobs = denseDataValues(data.jobs).map(jobModel).filter((item) => item.id).sort((a, b) => a.id.localeCompare(b.id));
  return deepFreeze({
    id: toSafeIdentifier(data.id), name: toSafeText(data.name), status: state.code, stateLabel: state.label,
    workspaceId: toSafeIdentifier(data.workspaceId), updatedAt: dateText(data.updatedAt), admittedAt: dateText(data.admittedAt),
    summary: toSafeText(data.summary, MAX_LONG_TEXT), jobs, executionAvailable: false
  });
}

export function createWorkspaceViewModel(input) {
  const data = readUiEntityData('workspace', input);
  const campaigns = denseDataValues(data.campaigns).map(createCampaignViewModel).filter((item) => item.id).sort((a, b) => a.id.localeCompare(b.id));
  return deepFreeze({
    id: toSafeIdentifier(data.id), name: toSafeText(data.name), status: statusText(data.status),
    tenantId: toSafeIdentifier(data.tenantId), updatedAt: dateText(data.updatedAt), campaigns
  });
}

export function createReportListViewModel(reports, options = {}) {
  const query = toSafeText(options.query, 120).toLowerCase();
  const status = statusText(options.status, 'all');
  const sort = ['created-desc', 'created-asc', 'title-asc', 'title-desc'].includes(options.sort) ? options.sort : 'created-desc';
  const pageSize = toBoundedInteger(options.pageSize, { min: 1, max: 100, fallback: 20 });
  const page = toBoundedInteger(options.page, { min: 1, max: 1_000_000, fallback: 1 });
  let items = denseDataValues(reports, MAX_REPORT_COLLECTION).map(createReportViewModel).filter((item) => item.id);
  if (query) items = items.filter((item) => `${item.id} ${item.title} ${item.summary || ''}`.toLowerCase().includes(query));
  if (status !== 'all') items = items.filter((item) => item.status === status);
  items.sort((a, b) => {
    if (sort === 'title-asc') return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
    if (sort === 'title-desc') return b.title.localeCompare(a.title) || a.id.localeCompare(b.id);
    const direction = sort === 'created-asc' ? 1 : -1;
    return direction * String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || a.id.localeCompare(b.id);
  });
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  return deepFreeze({ query, status, sort, page: currentPage, pageSize, total, pageCount, items: items.slice(start, start + pageSize) });
}
