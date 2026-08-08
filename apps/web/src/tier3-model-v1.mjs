const HOSTED_STATE_SCHEMA_V1 = 'hosted-operator-state-v1';
const POINTER_SCHEMA_V2 = 'deep-assurance-active-pointer-v2';
const TOMBSTONE_SCHEMA_V1 = 'deep-assurance-active-pointer-tombstone-v1';
const COMPATIBILITY_SCHEMA_V1 = 'audit-controller-hosted-compatibility-v1';
const ISSUE_STATUSES = new Set([
  'INFORMATIONAL_ISSUE_FOUND',
  'LOW_ISSUE_FOUND',
  'MEDIUM_ISSUE_FOUND',
  'HIGH_ISSUE_FOUND',
  'CRITICAL_ISSUE_FOUND',
]);

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function assertString(value, name) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${name} must be a non-empty string`);
  return value;
}

function validateCompatibility(compatibility) {
  assertObject(compatibility, 'compatibility');
  if (compatibility.schemaVersion !== COMPATIBILITY_SCHEMA_V1) throw new TypeError('Hosted audit compatibility schema is unsupported');
  for (const field of ['hostedStateSchemaVersion', 'activePointerSchemaVersion', 'controllerCommit', 'skillReleaseIdentity', 'automationRelease']) {
    assertString(compatibility[field], `compatibility.${field}`);
  }
  if (compatibility.hostedStateSchemaVersion !== HOSTED_STATE_SCHEMA_V1) throw new TypeError('Hosted audit state schema is unsupported');
  if (compatibility.activePointerSchemaVersion !== POINTER_SCHEMA_V2) throw new TypeError('Hosted audit pointer schema is unsupported');
  return compatibility;
}

function validateTombstone(payload) {
  const pointer = assertObject(payload.pointer, 'payload.pointer');
  if (pointer.schemaVersion !== TOMBSTONE_SCHEMA_V1 || pointer.status !== 'NO_ACTIVE_CAMPAIGN' || pointer.launchAuthorized !== false) {
    throw new TypeError('Hosted audit tombstone is invalid');
  }
  if (payload.projection !== null) throw new TypeError('Inactive hosted audit state must not include a projection');
  return Object.freeze({
    hostedStatus: 'NO_ACTIVE_CAMPAIGN',
    pointer: structuredClone(pointer),
    projection: null,
    campaign: null,
    compatibility: null,
    gates: [],
    workers: [],
    assignments: [],
    instructionProofs: [],
    findings: [],
    remediation: null,
    report: null,
    publication: { status: 'PENDING' },
    userDelivery: { status: 'PENDING' },
    events: [],
  });
}

export function normalizeHostedAuditStateV1(payload, compatibility) {
  assertObject(payload, 'payload');
  const expected = validateCompatibility(compatibility);
  if (payload.status === 'NO_ACTIVE_CAMPAIGN') return validateTombstone(payload);

  const pointer = assertObject(payload.pointer, 'payload.pointer');
  const projection = assertObject(payload.projection, 'payload.projection');
  if (pointer.schemaVersion !== POINTER_SCHEMA_V2 || pointer.status !== 'ACTIVE' || pointer.launchAuthorized !== true) {
    throw new TypeError('Hosted audit active pointer is invalid');
  }
  if (projection.schemaVersion !== HOSTED_STATE_SCHEMA_V1) throw new TypeError('Hosted audit projection schema is unsupported');
  const projectedCompatibility = assertObject(projection.compatibility, 'projection.compatibility');
  const campaign = assertObject(projection.campaign, 'projection.campaign');

  if (projectedCompatibility.controllerCommit !== expected.controllerCommit || pointer.controllerCommit !== expected.controllerCommit) {
    throw new TypeError('Hosted audit controller commit does not match the browser compatibility contract');
  }
  if (projectedCompatibility.skillReleaseIdentity !== expected.skillReleaseIdentity || pointer.skillReleaseIdentity !== expected.skillReleaseIdentity) {
    throw new TypeError('Hosted audit skill release does not match the browser compatibility contract');
  }
  if (projectedCompatibility.automationRelease !== expected.automationRelease) {
    throw new TypeError('Hosted audit automation release does not match the browser compatibility contract');
  }
  if (pointer.campaignId !== campaign.campaignId) throw new TypeError('Hosted audit campaign does not match the active pointer');

  return Object.freeze({
    ...structuredClone(projection),
    hostedStatus: payload.status ?? campaign.status,
    pointer: structuredClone(pointer),
  });
}

export function deriveAuditProgressV1(state) {
  assertObject(state, 'state');
  const gates = Array.isArray(state.gates) ? state.gates : [];
  const assignments = Array.isArray(state.assignments) ? state.assignments : [];
  return Object.freeze({
    gates: {
      total: gates.length,
      concluded: gates.filter((gate) => gate?.status && gate.status !== 'PENDING').length,
      pending: gates.filter((gate) => !gate?.status || gate.status === 'PENDING').length,
      processFailed: gates.filter((gate) => gate?.status === 'FAIL').length,
      issueFound: gates.filter((gate) => ISSUE_STATUSES.has(gate?.status)).length,
    },
    assignments: {
      total: assignments.length,
      accepted: assignments.filter((assignment) => assignment?.status === 'ACCEPTED').length,
      submitted: assignments.filter((assignment) => assignment?.status === 'SUBMITTED').length,
      leased: assignments.filter((assignment) => assignment?.status === 'LEASED').length,
      ready: assignments.filter((assignment) => assignment?.status === 'READY').length,
      rejected: assignments.filter((assignment) => assignment?.status === 'REJECTED').length,
    },
    completionStatus: state.campaign?.completionStatus ?? null,
    securityVerdict: state.campaign?.securityVerdict ?? null,
  });
}

function exactProofMatch(proof, scope, release) {
  return proof?.actorType === scope.actorType
    && proof?.actorId === scope.actorId
    && proof?.sessionId === scope.sessionId
    && proof?.roleId === scope.roleId
    && proof?.phaseId === scope.phaseId
    && proof?.skillReleaseIdentity === release;
}

function relatedProofMatch(proof, scope) {
  return proof?.actorType === scope.actorType
    && proof?.actorId === scope.actorId
    && proof?.roleId === scope.roleId
    && proof?.phaseId === scope.phaseId;
}

export function deriveInstructionAuthorizationV1(state, scope) {
  assertObject(state, 'state');
  assertObject(scope, 'scope');
  if (state.campaign?.instructionPolicyRequired !== true) {
    return Object.freeze({ required: false, status: 'NOT_REQUIRED', proofKey: null });
  }
  for (const field of ['actorType', 'actorId', 'sessionId', 'roleId', 'phaseId']) assertString(scope[field], `scope.${field}`);
  const proofs = Array.isArray(state.instructionProofs) ? state.instructionProofs : [];
  const release = state.compatibility?.skillReleaseIdentity;
  const exact = proofs.find((proof) => exactProofMatch(proof, scope, release));
  if (exact) return Object.freeze({ required: true, status: 'ACCEPTED', proofKey: exact.proofKey ?? null });
  const related = proofs.find((proof) => relatedProofMatch(proof, scope));
  if (related) return Object.freeze({ required: true, status: 'STALE_OR_MISMATCHED', proofKey: related.proofKey ?? null });
  return Object.freeze({ required: true, status: 'MISSING', proofKey: null });
}

function deriveLeaseState(assignment, scope) {
  if (!assignment) return 'NOT_APPLICABLE';
  if (assignment.status !== 'LEASED') return assignment.status ?? 'UNKNOWN';
  if (assignment.assignedWorkerId && scope.actorType === 'worker' && assignment.assignedWorkerId !== scope.actorId) return 'OWNED_BY_OTHER';
  const expires = Date.parse(assignment.leaseExpiresAt ?? '');
  const now = Date.parse(scope.now ?? '');
  if (!Number.isFinite(expires) || !Number.isFinite(now)) return 'UNKNOWN';
  return now >= expires ? 'EXPIRED' : 'CURRENT';
}

export function deriveOperatorActionsV1(state, scope) {
  assertObject(state, 'state');
  assertObject(scope, 'scope');
  const authorization = deriveInstructionAuthorizationV1(state, scope);
  const assignment = scope.assignmentId
    ? (Array.isArray(state.assignments) ? state.assignments.find((entry) => entry?.assignmentId === scope.assignmentId) : null)
    : null;
  const leaseState = scope.assignmentId && !assignment ? 'NOT_FOUND' : deriveLeaseState(assignment, scope);
  const authorizationAllows = authorization.status === 'ACCEPTED' || authorization.status === 'NOT_REQUIRED';
  const leaseAllows = !scope.assignmentId || leaseState === 'CURRENT' || leaseState === 'NOT_APPLICABLE';
  const campaignMutable = state.campaign?.status !== 'COMPLETE';

  return Object.freeze({
    instructionAuthorization: authorization.status,
    leaseState,
    substantiveActionAdvisoryAllowed: authorizationAllows && leaseAllows && campaignMutable,
    controllerStillAuthoritative: true,
  });
}
