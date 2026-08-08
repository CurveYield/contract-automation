function text(value, fallback = '—') {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}
function integer(value, fallback = 0) {
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}
function truncate(value, maximum = 400) {
  const normalized = text(value, '—');
  return normalized.length <= maximum ? normalized : `${normalized.slice(0, maximum)}…`;
}
function shortDigest(value) {
  return typeof value === 'string' && value.length >= 12 ? `${value.slice(0, 12)}…` : text(value);
}
function list(value) { return Array.isArray(value) ? value : []; }

export function controllerDetailModelV2(projection) {
  if (projection === null || projection === undefined) {
    return Object.freeze({ capabilities: [], gates: [], workers: [], assignments: [], instructionProofs: [], findings: [], events: [], remediation: null, report: null, controlPlane: null });
  }
  if (!['hosted-operator-state-v1', 'controller-operator-state-v2'].includes(projection?.schemaVersion)) {
    throw new TypeError('controller detail model requires a supported operator projection');
  }
  const capabilities = Object.entries(projection?.campaign?.preflight?.capabilities ?? {})
    .filter(([id, ready]) => typeof id === 'string' && typeof ready === 'boolean')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, ready]) => Object.freeze({ id, ready }));
  const gates = list(projection.gates).map((gate) => Object.freeze({
    gateId: text(gate?.gateId), phaseId: text(gate?.phaseId), title: truncate(gate?.title, 240), mandatory: gate?.mandatory === true,
    status: text(gate?.status, 'UNKNOWN'), evidenceCount: integer(gate?.evidenceRefCount), recordedAt: text(gate?.recordedAt),
  }));
  const workers = list(projection.workers).map((worker) => Object.freeze({
    workerId: text(worker?.workerId), roleId: text(worker?.roleId), capabilities: list(worker?.capabilities).join(', ') || '—',
    productSurface: text(worker?.session?.productSurface), model: text(worker?.session?.model), sessionId: text(worker?.session?.sessionId),
    cleanRoomVisibility: text(worker?.session?.priorMaterialVisibility), independence: text(worker?.session?.independenceClassification), registeredAt: text(worker?.registeredAt),
  }));
  const assignments = list(projection.assignments).map((assignment) => Object.freeze({
    assignmentId: text(assignment?.assignmentId), roleId: text(assignment?.roleId), title: truncate(assignment?.title, 240), mandatory: assignment?.mandatory === true,
    status: text(assignment?.status, 'UNKNOWN'), cleanRoom: assignment?.cleanRoom === true, controllerOwned: assignment?.controllerOwned === true,
    instructionPhaseId: text(assignment?.instructionPhaseId), revision: Number.isSafeInteger(assignment?.revision) ? assignment.revision : null,
    sourceRevision: Number.isSafeInteger(assignment?.sourceRevision) ? assignment.sourceRevision : null, assignedWorkerId: text(assignment?.assignedWorkerId),
    lease: assignment?.leaseStartedAt || assignment?.leaseExpiresAt ? `${text(assignment?.leaseStartedAt)} → ${text(assignment?.leaseExpiresAt)}` : '—',
    requiredCapabilities: list(assignment?.requiredCapabilities).join(', ') || '—', requiredEvidenceClasses: list(assignment?.requiredEvidenceClasses).join(', ') || '—',
    submissionSummary: truncate(assignment?.submission?.summary), submissionEvidenceCount: integer(assignment?.submission?.evidenceRefCount), submittedAt: text(assignment?.submission?.submittedAt),
    reviewDecision: text(assignment?.review?.decision), reviewerWorkerId: text(assignment?.review?.reviewerWorkerId), reviewReason: truncate(assignment?.review?.reason),
    reviewedAt: text(assignment?.review?.reviewedAt), reviewCount: integer(assignment?.reviewCount), invalidationCount: integer(assignment?.invalidationCount),
  }));
  const instructionProofs = list(projection.instructionProofs).map((proof) => Object.freeze({
    actor: `${text(proof?.actorType)}:${text(proof?.actorId)}`, sessionId: text(proof?.sessionId), roleId: text(proof?.roleId), phaseId: text(proof?.phaseId),
    skillReleaseIdentity: text(proof?.skillReleaseIdentity), digest: shortDigest(proof?.aggregateInstructionSetDigest), acknowledgedAt: text(proof?.acknowledgedAt),
  }));
  const findings = list(projection.findings).map((finding) => Object.freeze({
    findingId: text(finding?.findingId), title: truncate(finding?.title, 320), severity: text(finding?.severity, 'UNKNOWN'), status: text(finding?.status, 'UNKNOWN'),
    phaseId: text(finding?.phaseId), assignmentId: text(finding?.assignmentId), remediationStatus: text(finding?.remediationStatus),
  }));
  const events = list(projection.events).map((event) => Object.freeze({
    sequence: Number.isSafeInteger(event?.sequence) ? event.sequence : null, type: text(event?.type), commandId: text(event?.commandId),
    actor: event?.actor && typeof event.actor === 'object' ? `${text(event.actor.type)}:${text(event.actor.id)}` : '—',
    hash: shortDigest(event?.hash), previousHash: event?.previousHash === null ? 'GENESIS' : shortDigest(event?.previousHash), timestamp: text(event?.timestamp),
  }));
  const remediation = projection?.remediation && typeof projection.remediation === 'object' ? Object.freeze({
    status: text(projection.remediation.status, 'UNKNOWN'),
    unresolvedHighCriticalCount: Number.isSafeInteger(projection.remediation.unresolvedHighCriticalCount) ? projection.remediation.unresolvedHighCriticalCount : null,
    reviewedAt: text(projection.remediation.reviewedAt),
  }) : null;
  const report = projection?.report && typeof projection.report === 'object' ? Object.freeze({
    status: text(projection.report.status, 'UNKNOWN'), completionStatus: text(projection.report.completionStatus, 'not complete'),
    securityVerdict: text(projection.report.securityVerdict, 'not final'), findingCount: Number.isSafeInteger(projection.report.findingCount) ? projection.report.findingCount : null,
    limitationCount: Number.isSafeInteger(projection.report.limitationCount) ? projection.report.limitationCount : null,
    evidenceCount: Number.isSafeInteger(projection.report.evidenceCount) ? projection.report.evidenceCount : null, exactReleaseCommit: text(projection.report.exactReleaseCommit),
  }) : null;
  const controlPlane = projection?.controlPlane && typeof projection.controlPlane === 'object' ? Object.freeze({
    bootstrapStatus: text(projection.controlPlane.bootstrapStatus, 'UNKNOWN'), launchAuthorized: projection.controlPlane.launchAuthorized === true,
    claimAuthorized: projection.controlPlane.claimAuthorized === true, sourceAccessAuthorized: projection.controlPlane.sourceAccessAuthorized === true,
    assignmentClaimsAuthorized: projection.controlPlane.assignmentClaimsAuthorized === true, substantiveWorkAuthorized: projection.controlPlane.substantiveWorkAuthorized === true,
    failoverStatus: text(projection.controlPlane.failoverStatus, 'UNKNOWN'), authorityState: text(projection.controlPlane.authorityState, 'UNKNOWN'),
    primaryPollEnabledVerified: projection.controlPlane.primaryPollEnabledVerified === true, primaryTaskEnabled: projection.controlPlane.primaryTaskEnabled === true,
    requiredSkillPackageVersion: text(projection.controlPlane.requiredSkillPackageVersion),
  }) : null;
  return Object.freeze({
    capabilities: Object.freeze(capabilities), gates: Object.freeze(gates), workers: Object.freeze(workers), assignments: Object.freeze(assignments),
    instructionProofs: Object.freeze(instructionProofs), findings: Object.freeze(findings), events: Object.freeze(events), remediation, report, controlPlane,
  });
}
