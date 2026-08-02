import { readUiEntityData } from '../../audit-ui-contracts/src/index.mjs';
import {
  MAX_LONG_TEXT, MAX_TEXT, dateText, deepFreeze, denseDataValues, redactDiagnosticText,
  statusText, toBoundedInteger, toSafeIdentifier, toSafeText
} from './safety-v1.mjs';

export function createCapabilityViewModel(input) {
  const data = readUiEntityData('capability', input);
  return deepFreeze({
    id: toSafeIdentifier(data.id), name: toSafeText(data.name), available: data.available === true,
    summary: toSafeText(data.summary, MAX_LONG_TEXT), reason: toSafeText(data.reason, MAX_LONG_TEXT),
    category: statusText(data.category, 'general'), version: toSafeText(data.version, 80), executionAvailable: false
  });
}

export function createCatalogToolViewModel(input) {
  const data = readUiEntityData('catalogTool', input);
  return deepFreeze({
    id: toSafeIdentifier(data.id), name: toSafeText(data.name), available: data.available === true,
    summary: toSafeText(data.summary, MAX_LONG_TEXT),
    capabilityIds: denseDataValues(data.capabilityIds).map(toSafeIdentifier).filter(Boolean).sort(),
    tags: denseDataValues(data.tags).map((value) => toSafeText(value, 64)).filter(Boolean).sort(),
    profileId: toSafeIdentifier(data.profileId), parserId: toSafeIdentifier(data.parserId), executionAvailable: false
  });
}

function quotaLike(kind, input) {
  const data = readUiEntityData(kind, input);
  return {
    id: toSafeIdentifier(data.id), remaining: toBoundedInteger(data.remaining), limit: toBoundedInteger(data.limit),
    used: toBoundedInteger(data.used), resetsAt: dateText(data.resetsAt), scope: toSafeIdentifier(data.scope)
  };
}
export function createQuotaViewModel(input) { return deepFreeze(quotaLike('quota', input)); }
export function createOperationBudgetViewModel(input) {
  const data = readUiEntityData('operationBudget', input);
  return deepFreeze({ ...quotaLike('operationBudget', input), operation: statusText(data.operation, 'unknown') });
}
export function createRetentionViewModel(input) {
  const data = readUiEntityData('retention', input);
  return deepFreeze({
    id: toSafeIdentifier(data.id), days: toBoundedInteger(data.days, { max: 3650 }), expiresAt: dateText(data.expiresAt),
    policy: toSafeText(data.policy, 160), scope: toSafeIdentifier(data.scope)
  });
}

export function createProfileViewModel(input) {
  const data = readUiEntityData('profile', input);
  return deepFreeze({
    id: toSafeIdentifier(data.id), name: toSafeText(data.name), version: toSafeText(data.version, 80),
    available: data.available === true, summary: toSafeText(data.summary, MAX_LONG_TEXT),
    toolVersion: toSafeText(data.toolVersion, 80), parserId: toSafeIdentifier(data.parserId), executionAvailable: false
  });
}
export function createParserViewModel(input) {
  const data = readUiEntityData('parser', input);
  return deepFreeze({
    id: toSafeIdentifier(data.id), name: toSafeText(data.name), version: toSafeText(data.version, 80),
    available: data.available === true, summary: toSafeText(data.summary, MAX_LONG_TEXT),
    profileId: toSafeIdentifier(data.profileId), executionAvailable: false
  });
}
export function createResultViewModel(input) {
  const data = readUiEntityData('result', input);
  return deepFreeze({
    id: toSafeIdentifier(data.id), status: statusText(data.status), profileId: toSafeIdentifier(data.profileId),
    parserId: toSafeIdentifier(data.parserId), summary: toSafeText(data.summary, MAX_LONG_TEXT),
    reportId: toSafeIdentifier(data.reportId), createdAt: dateText(data.createdAt),
    evidenceCount: toBoundedInteger(data.evidenceCount, { max: 1_000_000 }), executionAvailable: false
  });
}
export function createGitHubDirectStatusViewModel(input) {
  const data = readUiEntityData('githubDirectStatus', input);
  return deepFreeze({
    id: toSafeIdentifier(data.id), status: statusText(data.status), repository: toSafeText(data.repository, 240),
    targetSha: toSafeIdentifier(data.targetSha), checkStatus: statusText(data.checkStatus), reportId: toSafeIdentifier(data.reportId),
    updatedAt: dateText(data.updatedAt), reason: redactDiagnosticText(data.reason, MAX_LONG_TEXT), executionAvailable: false
  });
}
export function createReleaseProvenanceViewModel(input) {
  const data = readUiEntityData('releaseProvenance', input);
  return deepFreeze({
    id: toSafeIdentifier(data.id), version: toSafeText(data.version, 80), candidateSha: toSafeIdentifier(data.candidateSha),
    startingSha: toSafeIdentifier(data.startingSha),
    compatibilityVersions: denseDataValues(data.compatibilityVersions).map((item) => toSafeText(item, 120)).filter(Boolean).sort(),
    createdAt: dateText(data.createdAt), status: statusText(data.status), executionAvailable: false
  });
}

export function createDiagnosticViewModel(input) {
  const data = readUiEntityData('diagnostic', input);
  return deepFreeze({
    code: statusText(data.code, 'unknown-error').toUpperCase().slice(0, 80),
    message: redactDiagnosticText(data.message, MAX_LONG_TEXT), correlationId: toSafeIdentifier(data.correlationId),
    retryAfterSeconds: toBoundedInteger(data.retryAfterSeconds, { max: 86_400 }),
    quotaRemaining: toBoundedInteger(data.quotaRemaining, { max: 1_000_000_000 }),
    retentionDays: toBoundedInteger(data.retentionDays, { max: 3650 }),
    publicationStatus: statusText(data.publicationStatus, 'unknown'), staleState: data.staleState === true,
    details: redactDiagnosticText(data.details, MAX_LONG_TEXT), retryPlan: redactDiagnosticText(data.retryPlan, MAX_TEXT),
    transportState: statusText(data.transportState, 'unknown'), reportId: toSafeIdentifier(data.reportId)
  });
}
