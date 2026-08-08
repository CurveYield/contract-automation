export const TIER3_CONTROLLER_ADAPTER_VERSION_V1 = 'tier3-controller-adapter-v1';

const PROJECTION_SCHEMA_V1 = 'tier3-controller-projection-v1';
const REQUIRED_CONTROLLER_REPOSITORY_V1 = 'CurveYield/audit-controller';
const REQUIRED_CONTROLLER_COMPATIBILITY_COMMIT_V1 = '853b77b92018f4e42068cef6def56f9902a02f27';
const REQUIRED_PROCESS_ID_V1 = 'deep-assurance-v6';
const REQUIRED_INSTRUCTION_RELEASE_V1 = 'ai-auditor-deep-assurance-v6@16.13.0';
const REQUIRED_AUTOMATION_REPOSITORY_V1 = 'CurveYield/contract-automation';

const CAMPAIGN_STATUSES = new Set(['DRAFT', 'ACTIVE', 'COMPLETE']);
const PHASE_STATUSES = new Set([
  'PENDING',
  'PASS',
  'INFORMATIONAL_ISSUE_FOUND',
  'LOW_ISSUE_FOUND',
  'MEDIUM_ISSUE_FOUND',
  'HIGH_ISSUE_FOUND',
  'CRITICAL_ISSUE_FOUND',
  'FAIL',
]);
const LANE_STATUSES = new Set(['PENDING', 'READY', 'LEASED', 'SUBMITTED', 'ACCEPTED', 'REJECTED']);
const PROOF_STATUSES = new Set([
  'ACCEPTED',
  'MISSING',
  'STALE',
  'INCOMPLETE',
  'RELEASE_MISMATCH',
  'ROLE_PHASE_SESSION_MISMATCH',
  'REPLAY_CONFLICT',
  'BLOCKED',
]);
const FINDING_SEVERITIES = new Set(['INFORMATIONAL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const FINDING_STATUSES = new Set(['VALIDATED', 'UNRESOLVED', 'RESOLVED', 'DISMISSED', 'REMEDIATION_PENDING', 'REMEDIATED']);
const REMEDIATION_STATUSES = new Set(['PENDING', 'IN_PROGRESS', 'VERIFIED', 'REJECTED', 'NOT_REQUIRED']);
const REPORT_STATUSES = new Set(['NOT_READY', 'READY_FOR_PUBLICATION', 'PUBLISHED', 'BLOCKED', 'COMPLETE']);

function fail(path, message) {
  throw new TypeError(`${path} ${message}`);
}

function object(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'must be an object');
  return value;
}

function exactKeys(value, keys, path) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(path, `must contain exactly: ${expected.join(', ')}`);
  }
}

function string(value, path, maximum = 512) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum) {
    fail(path, `must be a non-empty string up to ${maximum} characters`);
  }
  return value;
}

function sha(value, path) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/.test(value)) fail(path, 'must be a lowercase full 40-character git SHA');
  return value;
}

function repository(value, path) {
  string(value, path, 200);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) fail(path, 'must be owner/repository');
  return value;
}

function enumValue(value, allowed, path) {
  if (!allowed.has(value)) fail(path, `has unsupported value ${String(value)}`);
  return value;
}

function nullableEnum(value, allowed, path) {
  if (value === null) return null;
  return enumValue(value, allowed, path);
}

function integer(value, path) {
  if (!Number.isSafeInteger(value) || value < 0) fail(path, 'must be a non-negative safe integer');
  return value;
}

function isoTimestamp(value, path) {
  string(value, path, 64);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) fail(path, 'must be a canonical ISO timestamp');
  return value;
}

function list(value, path, maximum, normalize) {
  if (!Array.isArray(value) || value.length > maximum) fail(path, `must be an array with at most ${maximum} entries`);
  return value.map((entry, index) => normalize(entry, `${path}[${index}]`));
}

function uniqueBy(entries, key, path) {
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry[key])) fail(path, `must not contain duplicate ${key} values`);
    seen.add(entry[key]);
  }
  return entries;
}

function normalizeController(value) {
  object(value, '$.controller');
  exactKeys(value, ['repository', 'compatibilityCommit', 'processId', 'instructionReleaseIdentity'], '$.controller');
  return {
    repository: repository(value.repository, '$.controller.repository'),
    compatibilityCommit: sha(value.compatibilityCommit, '$.controller.compatibilityCommit'),
    processId: string(value.processId, '$.controller.processId', 80),
    instructionReleaseIdentity: string(value.instructionReleaseIdentity, '$.controller.instructionReleaseIdentity', 160),
  };
}

function normalizeAutomation(value) {
  object(value, '$.automation');
  exactKeys(value, ['repository', 'compatibilityCommit'], '$.automation');
  return {
    repository: repository(value.repository, '$.automation.repository'),
    compatibilityCommit: sha(value.compatibilityCommit, '$.automation.compatibilityCommit'),
  };
}

function normalizeNetworkScope(value) {
  object(value, '$.networkScope');
  exactKeys(value, ['chains', 'defaultChain'], '$.networkScope');
  if (!Array.isArray(value.chains) || JSON.stringify(value.chains) !== JSON.stringify(['ethereum', 'base'])) {
    fail('$.networkScope.chains', 'must equal exactly ["ethereum","base"] in that order');
  }
  if (value.defaultChain !== 'base') fail('$.networkScope.defaultChain', 'must equal base');
  return { chains: ['ethereum', 'base'], defaultChain: 'base' };
}

function normalizeSource(value, path) {
  object(value, path);
  exactKeys(value, ['repository', 'commit'], path);
  return {
    repository: repository(value.repository, `${path}.repository`),
    commit: sha(value.commit, `${path}.commit`),
  };
}

function normalizePhase(value, path) {
  object(value, path);
  exactKeys(value, ['phaseId', 'status'], path);
  return {
    phaseId: string(value.phaseId, `${path}.phaseId`, 120),
    status: enumValue(value.status, PHASE_STATUSES, `${path}.status`),
  };
}

function normalizeLane(value, path) {
  object(value, path);
  exactKeys(value, ['roleId', 'status'], path);
  return {
    roleId: string(value.roleId, `${path}.roleId`, 160),
    status: enumValue(value.status, LANE_STATUSES, `${path}.status`),
  };
}

function normalizeProof(value, path) {
  object(value, path);
  exactKeys(value, ['actorId', 'sessionId', 'roleId', 'phaseId', 'status'], path);
  return {
    actorId: string(value.actorId, `${path}.actorId`, 200),
    sessionId: string(value.sessionId, `${path}.sessionId`, 200),
    roleId: string(value.roleId, `${path}.roleId`, 160),
    phaseId: string(value.phaseId, `${path}.phaseId`, 120),
    status: enumValue(value.status, PROOF_STATUSES, `${path}.status`),
  };
}

function normalizeAssignment(value, path) {
  object(value, path);
  exactKeys(value, ['assignmentId', 'roleId', 'status'], path);
  return {
    assignmentId: string(value.assignmentId, `${path}.assignmentId`, 200),
    roleId: string(value.roleId, `${path}.roleId`, 160),
    status: enumValue(value.status, LANE_STATUSES, `${path}.status`),
  };
}

function normalizeFinding(value, path) {
  object(value, path);
  exactKeys(value, ['findingId', 'title', 'severity', 'status'], path);
  return {
    findingId: string(value.findingId, `${path}.findingId`, 200),
    title: string(value.title, `${path}.title`, 300),
    severity: enumValue(value.severity, FINDING_SEVERITIES, `${path}.severity`),
    status: enumValue(value.status, FINDING_STATUSES, `${path}.status`),
  };
}

function normalizeRemediation(value, path) {
  object(value, path);
  exactKeys(value, ['findingId', 'status'], path);
  return {
    findingId: string(value.findingId, `${path}.findingId`, 200),
    status: enumValue(value.status, REMEDIATION_STATUSES, `${path}.status`),
  };
}

function normalizeEvidence(value) {
  object(value, '$.campaign.evidence');
  exactKeys(value, ['acceptedCount', 'rejectedCount'], '$.campaign.evidence');
  return {
    acceptedCount: integer(value.acceptedCount, '$.campaign.evidence.acceptedCount'),
    rejectedCount: integer(value.rejectedCount, '$.campaign.evidence.rejectedCount'),
  };
}

function normalizeReport(value) {
  object(value, '$.campaign.report');
  exactKeys(value, ['status', 'complete', 'exactReleaseCommit'], '$.campaign.report');
  if (typeof value.complete !== 'boolean') fail('$.campaign.report.complete', 'must be boolean');
  const exactReleaseCommit = value.exactReleaseCommit === null
    ? null
    : sha(value.exactReleaseCommit, '$.campaign.report.exactReleaseCommit');
  return {
    status: enumValue(value.status, REPORT_STATUSES, '$.campaign.report.status'),
    complete: value.complete,
    exactReleaseCommit,
  };
}

function normalizeCampaign(value) {
  if (value === null) return null;
  object(value, '$.campaign');
  exactKeys(value, [
    'campaignId', 'title', 'status', 'completionStatus', 'securityVerdict', 'source', 'preflight',
    'phases', 'lanes', 'instructionProofs', 'assignments', 'findings', 'remediation',
    'evidence', 'report', 'updatedAt',
  ], '$.campaign');

  object(value.preflight, '$.campaign.preflight');
  exactKeys(value.preflight, ['status'], '$.campaign.preflight');
  if (value.preflight.status !== 'READY') fail('$.campaign.preflight.status', 'must equal READY for an admitted campaign');

  const phases = uniqueBy(list(value.phases, '$.campaign.phases', 11, normalizePhase), 'phaseId', '$.campaign.phases');
  const lanes = uniqueBy(list(value.lanes, '$.campaign.lanes', 12, normalizeLane), 'roleId', '$.campaign.lanes');
  const instructionProofs = list(value.instructionProofs, '$.campaign.instructionProofs', 500, normalizeProof);
  const assignments = uniqueBy(list(value.assignments, '$.campaign.assignments', 200, normalizeAssignment), 'assignmentId', '$.campaign.assignments');
  const findings = uniqueBy(list(value.findings, '$.campaign.findings', 1000, normalizeFinding), 'findingId', '$.campaign.findings');
  const remediation = uniqueBy(list(value.remediation, '$.campaign.remediation', 1000, normalizeRemediation), 'findingId', '$.campaign.remediation');
  const report = normalizeReport(value.report);

  const status = enumValue(value.status, CAMPAIGN_STATUSES, '$.campaign.status');
  const completionStatus = value.completionStatus === null
    ? null
    : enumValue(value.completionStatus, new Set(['COMPLETE']), '$.campaign.completionStatus');
  const securityVerdict = nullableEnum(value.securityVerdict, new Set(['PASS', 'NO_GO']), '$.campaign.securityVerdict');

  if (completionStatus === 'COMPLETE') {
    if (status !== 'COMPLETE') fail('$.campaign.status', 'must equal COMPLETE when completionStatus is COMPLETE');
    if (securityVerdict === null) fail('$.campaign.securityVerdict', 'must be PASS or NO_GO when completionStatus is COMPLETE');
    if (!report.complete || report.status !== 'COMPLETE' || report.exactReleaseCommit === null) {
      fail('$.campaign.report', 'must be a complete exact-release report when completionStatus is COMPLETE');
    }
  } else {
    if (status === 'COMPLETE') fail('$.campaign.completionStatus', 'must equal COMPLETE when campaign status is COMPLETE');
    if (securityVerdict !== null) fail('$.campaign.securityVerdict', 'must remain null until completionStatus is COMPLETE');
    if (report.complete || report.status === 'COMPLETE') fail('$.campaign.report', 'must not be complete before campaign completion');
  }

  return {
    campaignId: string(value.campaignId, '$.campaign.campaignId', 200),
    title: string(value.title, '$.campaign.title', 300),
    status,
    completionStatus,
    securityVerdict,
    source: normalizeSource(value.source, '$.campaign.source'),
    preflight: { status: 'READY' },
    phases,
    lanes,
    instructionProofs,
    assignments,
    findings,
    remediation,
    evidence: normalizeEvidence(value.evidence),
    report,
    updatedAt: isoTimestamp(value.updatedAt, '$.campaign.updatedAt'),
  };
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function normalizeControllerProjectionV1(value) {
  object(value, '$');
  exactKeys(value, ['schemaVersion', 'adapterVersion', 'controller', 'automation', 'networkScope', 'campaign'], '$');
  if (value.schemaVersion !== PROJECTION_SCHEMA_V1) fail('$.schemaVersion', `must equal ${PROJECTION_SCHEMA_V1}`);
  if (value.adapterVersion !== TIER3_CONTROLLER_ADAPTER_VERSION_V1) {
    fail('$.adapterVersion', `must equal ${TIER3_CONTROLLER_ADAPTER_VERSION_V1}`);
  }
  return deepFreeze({
    schemaVersion: PROJECTION_SCHEMA_V1,
    adapterVersion: TIER3_CONTROLLER_ADAPTER_VERSION_V1,
    controller: normalizeController(value.controller),
    automation: normalizeAutomation(value.automation),
    networkScope: normalizeNetworkScope(value.networkScope),
    campaign: normalizeCampaign(value.campaign),
  });
}

export function assertControllerCompatibilityV1(value) {
  const normalized = normalizeControllerProjectionV1(value);
  if (normalized.controller.repository !== REQUIRED_CONTROLLER_REPOSITORY_V1) {
    fail('$.controller.repository', `must equal ${REQUIRED_CONTROLLER_REPOSITORY_V1}`);
  }
  if (normalized.controller.compatibilityCommit !== REQUIRED_CONTROLLER_COMPATIBILITY_COMMIT_V1) {
    fail('$.controller.compatibilityCommit', `must equal ${REQUIRED_CONTROLLER_COMPATIBILITY_COMMIT_V1}`);
  }
  if (normalized.controller.processId !== REQUIRED_PROCESS_ID_V1) {
    fail('$.controller.processId', `must equal ${REQUIRED_PROCESS_ID_V1}`);
  }
  if (normalized.controller.instructionReleaseIdentity !== REQUIRED_INSTRUCTION_RELEASE_V1) {
    fail('$.controller.instructionReleaseIdentity', `must equal ${REQUIRED_INSTRUCTION_RELEASE_V1}`);
  }
  if (normalized.automation.repository !== REQUIRED_AUTOMATION_REPOSITORY_V1) {
    fail('$.automation.repository', `must equal ${REQUIRED_AUTOMATION_REPOSITORY_V1}`);
  }
  return normalized;
}
