import { readUiEntityData } from '../../audit-ui-contracts/src/index.mjs';

const MAX_TEXT = 240;
const MAX_LONG_TEXT = 2000;
const MAX_COLLECTION = 100;
const SECRET_QUERY_KEYS = new Set(['token', 'key', 'api_key', 'apikey', 'auth', 'authorization', 'signature', 'secret', 'password']);

function primitiveString(value) {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean'
    ? String(value)
    : '';
}

export function toSafeText(value, max = MAX_TEXT) {
  const normalized = primitiveString(value)
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .replace(/[<>]/g, '')
    .trim();
  return normalized.slice(0, Math.max(0, Math.min(max, MAX_LONG_TEXT)));
}

export function toSafeIdentifier(value) {
  return toSafeText(value, 160).replace(/\s+/g, '-');
}

export function toBoundedInteger(value, { min = 0, max = 1_000_000_000, fallback = 0 } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

export function toSafeUrl(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return null;
  const candidate = value.trim();
  if (candidate.startsWith('/') && !candidate.startsWith('//') && !candidate.includes('\\')) {
    try {
      const internal = new URL(candidate, 'https://audit.invalid');
      for (const key of internal.searchParams.keys()) {
        if (SECRET_QUERY_KEYS.has(key.toLowerCase())) return null;
      }
      return `${internal.pathname}${internal.search}${internal.hash}`;
    } catch {
      return null;
    }
  }
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    for (const key of url.searchParams.keys()) {
      if (SECRET_QUERY_KEYS.has(key.toLowerCase())) return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

function denseDataValues(value, limit = MAX_COLLECTION) {
  if (!Array.isArray(value)) return [];
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const values = [];
  const numericKeys = Object.keys(descriptors)
    .filter((key) => /^(?:0|[1-9]\d*)$/.test(key))
    .map(Number)
    .sort((a, b) => a - b);
  for (const index of numericKeys) {
    const descriptor = descriptors[String(index)];
    if (descriptor?.enumerable && Object.hasOwn(descriptor, 'value')) {
      values.push(descriptor.value);
      if (values.length >= limit) break;
    }
  }
  return values;
}

export function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function dateText(value) {
  const text = toSafeText(value, 80);
  return /^\d{4}-\d{2}-\d{2}T/.test(text) ? text : null;
}

function statusText(value, fallback = 'unknown') {
  const text = toSafeText(value, 64).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  return text || fallback;
}

export function lifecycleState(status) {
  const canonical = statusText(status);
  const labels = {
    pending: 'Pending',
    'awaiting-executor': 'Awaiting executor',
    running: 'In progress',
    completed: 'Completed',
    published: 'Published',
    failed: 'Failed',
    cancelled: 'Cancelled',
    'resource-limit': 'Resource limit reached',
    deleting: 'Deletion pending',
    deleted: 'Deleted',
    exporting: 'Export pending',
    exported: 'Exported',
    stale: 'Stale state'
  };
  return deepFreeze({ code: canonical, label: labels[canonical] ?? 'Unknown', terminal: ['completed', 'published', 'failed', 'cancelled', 'resource-limit', 'deleted', 'exported'].includes(canonical) });
}

function evidenceModel(input) {
  const data = readUiEntityData('evidence', input);
  return {
    id: toSafeIdentifier(data.id),
    title: toSafeText(data.title),
    severity: statusText(data.severity, 'informational'),
    url: toSafeUrl(data.url),
    summary: toSafeText(data.summary, MAX_LONG_TEXT),
    kind: statusText(data.kind, 'evidence')
  };
}

export function createEvidenceViewModel(input) {
  return deepFreeze(evidenceModel(input));
}

export function createReportViewModel(input) {
  const data = readUiEntityData('report', input);
  const evidence = denseDataValues(data.evidence)
    .map(evidenceModel)
    .filter((item) => item.id)
    .sort((a, b) => a.id.localeCompare(b.id));
  return deepFreeze({
    id: toSafeIdentifier(data.id),
    title: toSafeText(data.title),
    status: statusText(data.status),
    createdAt: dateText(data.createdAt),
    sourceUrl: toSafeUrl(data.sourceUrl),
    evidence
  });
}

function jobModel(input) {
  const data = readUiEntityData('job', input);
  const state = lifecycleState(data.status);
  return {
    id: toSafeIdentifier(data.id),
    title: toSafeText(data.title || data.id),
    status: state.code,
    stateLabel: state.label,
    campaignId: toSafeIdentifier(data.campaignId),
    reportId: toSafeIdentifier(data.reportId),
    error: toSafeText(data.error, MAX_LONG_TEXT),
    resourceLimit: toBoundedInteger(data.resourceLimit, { max: 1_000_000 }),
    updatedAt: dateText(data.updatedAt),
    executionAvailable: false
  };
}

export function createJobViewModel(input) {
  return deepFreeze(jobModel(input));
}

export function createCampaignViewModel(input) {
  const data = readUiEntityData('campaign', input);
  const state = lifecycleState(data.status);
  const jobs = denseDataValues(data.jobs)
    .map(jobModel)
    .filter((item) => item.id)
    .sort((a, b) => a.id.localeCompare(b.id));
  return deepFreeze({
    id: toSafeIdentifier(data.id),
    name: toSafeText(data.name),
    status: state.code,
    stateLabel: state.label,
    workspaceId: toSafeIdentifier(data.workspaceId),
    updatedAt: dateText(data.updatedAt),
    summary: toSafeText(data.summary, MAX_LONG_TEXT),
    jobs,
    executionAvailable: false
  });
}

export function createWorkspaceViewModel(input) {
  const data = readUiEntityData('workspace', input);
  const campaigns = denseDataValues(data.campaigns)
    .map(createCampaignViewModel)
    .filter((item) => item.id)
    .sort((a, b) => a.id.localeCompare(b.id));
  return deepFreeze({
    id: toSafeIdentifier(data.id),
    name: toSafeText(data.name),
    status: statusText(data.status),
    updatedAt: dateText(data.updatedAt),
    campaigns
  });
}

function checkpointModel(input) {
  const data = readUiEntityData('checkpoint', input);
  return {
    id: toSafeIdentifier(data.id),
    status: statusText(data.status),
    createdAt: dateText(data.createdAt),
    label: toSafeText(data.label || data.id),
    exportUrl: toSafeUrl(data.exportUrl)
  };
}

export function createForkViewModel(input) {
  const data = readUiEntityData('fork', input);
  const checkpoints = denseDataValues(data.checkpoints)
    .map(checkpointModel)
    .filter((item) => item.id)
    .sort((a, b) => a.id.localeCompare(b.id));
  return deepFreeze({
    id: toSafeIdentifier(data.id),
    name: toSafeText(data.name || data.id),
    status: statusText(data.status),
    exportStatus: statusText(data.exportStatus, 'not-requested'),
    deleteStatus: statusText(data.deleteStatus, 'not-requested'),
    retentionExpiresAt: dateText(data.retentionExpiresAt),
    checkpoints,
    executionAvailable: false
  });
}

function provenanceModel(input) {
  const data = readUiEntityData('provenance', input);
  return {
    id: toSafeIdentifier(data.id),
    sourceType: statusText(data.sourceType, 'unknown'),
    label: toSafeText(data.label || data.id),
    sourceId: toSafeIdentifier(data.sourceId),
    commitSha: toSafeIdentifier(data.commitSha),
    visible: data.visible === true
  };
}

export function createCleanRoomViewModel(input) {
  const data = readUiEntityData('cleanRoomCampaign', input);
  const visibleIds = new Set(denseDataValues(data.visibleResourceIds).map(toSafeIdentifier).filter(Boolean));
  const provenance = denseDataValues(data.provenance)
    .map(provenanceModel)
    .filter((item) => item.id && item.visible && (!visibleIds.size || visibleIds.has(item.sourceId)))
    .sort((a, b) => a.id.localeCompare(b.id));
  return deepFreeze({
    id: toSafeIdentifier(data.id),
    name: toSafeText(data.name),
    status: statusText(data.status),
    merges: denseDataValues(data.merges).map((value) => toSafeIdentifier(value)).filter(Boolean).sort(),
    provenance,
    executionAvailable: false
  });
}

export function createCapabilityViewModel(input) {
  const data = readUiEntityData('capability', input);
  return deepFreeze({
    id: toSafeIdentifier(data.id),
    name: toSafeText(data.name),
    available: data.available === true,
    summary: toSafeText(data.summary, MAX_LONG_TEXT),
    reason: toSafeText(data.reason, MAX_LONG_TEXT),
    category: statusText(data.category, 'general'),
    executionAvailable: false
  });
}

export function createCatalogToolViewModel(input) {
  const data = readUiEntityData('catalogTool', input);
  return deepFreeze({
    id: toSafeIdentifier(data.id),
    name: toSafeText(data.name),
    available: data.available === true,
    summary: toSafeText(data.summary, MAX_LONG_TEXT),
    capabilityIds: denseDataValues(data.capabilityIds).map(toSafeIdentifier).filter(Boolean).sort(),
    tags: denseDataValues(data.tags).map((value) => toSafeText(value, 64)).filter(Boolean).sort(),
    executionAvailable: false
  });
}

export function createDiagnosticViewModel(input) {
  const data = readUiEntityData('diagnostic', input);
  return deepFreeze({
    code: statusText(data.code, 'unknown-error').toUpperCase().slice(0, 80),
    message: toSafeText(data.message, MAX_LONG_TEXT),
    correlationId: toSafeIdentifier(data.correlationId),
    retryAfterSeconds: toBoundedInteger(data.retryAfterSeconds, { max: 86_400 }),
    quotaRemaining: toBoundedInteger(data.quotaRemaining, { max: 1_000_000_000 }),
    retentionDays: toBoundedInteger(data.retentionDays, { max: 3650 }),
    publicationStatus: statusText(data.publicationStatus, 'unknown'),
    staleState: data.staleState === true,
    details: toSafeText(data.details, MAX_LONG_TEXT)
  });
}

export function createReportListViewModel(reports, options = {}) {
  const query = toSafeText(options.query, 120).toLowerCase();
  const status = statusText(options.status, 'all');
  const sort = ['created-desc', 'created-asc', 'title-asc', 'title-desc'].includes(options.sort) ? options.sort : 'created-desc';
  const pageSize = toBoundedInteger(options.pageSize, { min: 1, max: 100, fallback: 20 });
  const page = toBoundedInteger(options.page, { min: 1, max: 1_000_000, fallback: 1 });
  let items = denseDataValues(reports, 1000).map(createReportViewModel).filter((item) => item.id);
  if (query) items = items.filter((item) => `${item.id} ${item.title}`.toLowerCase().includes(query));
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
  return deepFreeze({
    query,
    status,
    sort,
    page: currentPage,
    pageSize,
    total,
    pageCount,
    items: items.slice(start, start + pageSize)
  });
}
