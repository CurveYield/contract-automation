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

function list(value) {
  return Array.isArray(value) ? value : [];
}

function capabilities(projection) {
  const record = projection?.campaign?.preflight?.capabilities;
  if (!record || typeof record !== 'object' || Array.isArray(record)) return [];
  return Object.entries(record)
    .filter(([id, ready]) => typeof id === 'string' && typeof ready === 'boolean')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, ready]) => Object.freeze({ id, ready }));
}

function gates(projection) {
  return list(projection?.gates).map((gate) => Object.freeze({
    gateId: text(gate?.gateId),
    phaseId: text(gate?.phaseId),
    title: truncate(gate?.title, 240),
    mandatory: gate?.mandatory === true,
    status: text(gate?.status, 'UNKNOWN'),
    evidenceCount: integer(gate?.evidenceRefCount),
    recordedAt: text(gate?.recordedAt),
  }));
}

function workers(projection) {
  return list(projection?.workers).map((worker) => Object.freeze({
    workerId: text(worker?.workerId),
    roleId: text(worker?.roleId),
    capabilities: list(worker?.capabilities).filter((entry) => typeof entry === 'string').join(', ') || '—',
    productSurface: text(worker?.session?.productSurface),
    model: text(worker?.session?.model),
    sessionId: text(worker?.session?.sessionId),
    cleanRoomVisibility: text(worker?.session?.priorMaterialVisibility),
    independence: text(worker?.session?.independenceClassification),
    registeredAt: text(worker?.registeredAt),
  }));
}

function assignments(projection) {
  return list(projection?.assignments).map((assignment) => Object.freeze({
    assignmentId: text(assignment?.assignmentId),
    roleId: text(assignment?.roleId),
    title: truncate(assignment?.title, 240),
    mandatory: assignment?.mandatory === true,
    status: text(assignment?.status, 'UNKNOWN'),
    cleanRoom: assignment?.cleanRoom === true,
    controllerOwned: assignment?.controllerOwned === true,
    instructionPhaseId: text(assignment?.instructionPhaseId),
    revision: Number.isSafeInteger(assignment?.revision) ? assignment.revision : null,
    sourceRevision: Number.isSafeInteger(assignment?.sourceRevision) ? assignment.sourceRevision : null,
    assignedWorkerId: text(assignment?.assignedWorkerId),
    lease: assignment?.leaseStartedAt || assignment?.leaseExpiresAt
      ? `${text(assignment?.leaseStartedAt)} → ${text(assignment?.leaseExpiresAt)}`
      : '—',
    requiredCapabilities: list(assignment?.requiredCapabilities).filter((entry) => typeof entry === 'string').join(', ') || '—',
    requiredEvidenceClasses: list(assignment?.requiredEvidenceClasses).filter((entry) => typeof entry === 'string').join(', ') || '—',
    submissionSummary: truncate(assignment?.submission?.summary),
    submissionEvidenceCount: integer(assignment?.submission?.evidenceRefCount),
    submittedAt: text(assignment?.submission?.submittedAt),
    reviewDecision: text(assignment?.review?.decision),
    reviewerWorkerId: text(assignment?.review?.reviewerWorkerId),
    reviewReason: truncate(assignment?.review?.reason),
    reviewedAt: text(assignment?.review?.reviewedAt),
    reviewCount: integer(assignment?.reviewCount),
    invalidationCount: integer(assignment?.invalidationCount),
  }));
}

function instructionProofs(projection) {
  return list(projection?.instructionProofs).map((proof) => Object.freeze({
    actor: `${text(proof?.actorType)}:${text(proof?.actorId)}`,
    sessionId: text(proof?.sessionId),
    roleId: text(proof?.roleId),
    phaseId: text(proof?.phaseId),
    skillReleaseIdentity: text(proof?.skillReleaseIdentity),
    digest: shortDigest(proof?.aggregateInstructionSetDigest),
    acknowledgedAt: text(proof?.acknowledgedAt),
  }));
}

function findings(projection) {
  return list(projection?.findings).map((finding) => Object.freeze({
    findingId: text(finding?.findingId),
    title: truncate(finding?.title, 320),
    severity: text(finding?.severity, 'UNKNOWN'),
    status: text(finding?.status, 'UNKNOWN'),
    phaseId: text(finding?.phaseId),
    assignmentId: text(finding?.assignmentId),
    remediationStatus: text(finding?.remediationStatus),
  }));
}

function remediation(projection) {
  if (!projection?.remediation || typeof projection.remediation !== 'object') return null;
  return Object.freeze({
    status: text(projection.remediation.status, 'UNKNOWN'),
    unresolvedHighCriticalCount: Number.isSafeInteger(projection.remediation.unresolvedHighCriticalCount)
      ? projection.remediation.unresolvedHighCriticalCount
      : null,
    reviewedAt: text(projection.remediation.reviewedAt),
  });
}

function report(projection) {
  if (!projection?.report || typeof projection.report !== 'object') return null;
  return Object.freeze({
    status: text(projection.report.status, 'UNKNOWN'),
    completionStatus: text(projection.report.completionStatus, 'not complete'),
    securityVerdict: text(projection.report.securityVerdict, 'not final'),
    findingCount: Number.isSafeInteger(projection.report.findingCount) ? projection.report.findingCount : null,
    limitationCount: Number.isSafeInteger(projection.report.limitationCount) ? projection.report.limitationCount : null,
    evidenceCount: Number.isSafeInteger(projection.report.evidenceCount) ? projection.report.evidenceCount : null,
    exactReleaseCommit: text(projection.report.exactReleaseCommit),
  });
}

function events(projection) {
  return list(projection?.events).map((event) => Object.freeze({
    sequence: Number.isSafeInteger(event?.sequence) ? event.sequence : null,
    type: text(event?.type),
    commandId: text(event?.commandId),
    actor: event?.actor && typeof event.actor === 'object'
      ? `${text(event.actor.type)}:${text(event.actor.id)}`
      : '—',
    hash: shortDigest(event?.hash),
    previousHash: event?.previousHash === null ? 'GENESIS' : shortDigest(event?.previousHash),
    timestamp: text(event?.timestamp),
  }));
}

export function controllerDetailModelV1(projection) {
  if (projection === null || projection === undefined) {
    return Object.freeze({
      capabilities: [],
      gates: [],
      workers: [],
      assignments: [],
      instructionProofs: [],
      findings: [],
      events: [],
      remediation: null,
      report: null,
    });
  }
  if (projection?.schemaVersion !== 'hosted-operator-state-v1') {
    throw new TypeError('controller detail model requires hosted-operator-state-v1');
  }
  return Object.freeze({
    capabilities: Object.freeze(capabilities(projection)),
    gates: Object.freeze(gates(projection)),
    workers: Object.freeze(workers(projection)),
    assignments: Object.freeze(assignments(projection)),
    instructionProofs: Object.freeze(instructionProofs(projection)),
    findings: Object.freeze(findings(projection)),
    events: Object.freeze(events(projection)),
    remediation: remediation(projection),
    report: report(projection),
  });
}
