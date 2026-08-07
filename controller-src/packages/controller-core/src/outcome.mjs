import {
  AssignmentStatus,
  DEEP_ASSURANCE_GATE_CATALOG,
  DEEP_ASSURANCE_LANE_CATALOG,
  DEEP_ASSURANCE_RELEASE_AND_REPORT_GATE_ID,
  GateStatus,
  SecurityVerdict,
} from './constants.mjs';

function compareExactTopology(actual, expected, noun) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((id) => !actualSet.has(id));
  const unexpected = actual.filter((id) => !expectedSet.has(id));
  if (missing.length > 0 || unexpected.length > 0 || actual.length !== actualSet.size) {
    const details = [
      missing.length > 0 ? `missing ${noun}: ${missing.join(', ')}` : null,
      unexpected.length > 0 ? `unexpected ${noun}: ${unexpected.join(', ')}` : null,
      actual.length !== actualSet.size ? `duplicate ${noun}` : null,
    ].filter(Boolean).join('; ');
    return `mandatory topology mismatch (${details})`;
  }
  return null;
}

export function evaluateOutcome(state, { terminal = false, publicationReadiness = false } = {}) {
  const gates = Object.values(state.gates ?? {});
  const assignments = Object.values(state.assignments ?? {});
  const gateTopologyError = compareExactTopology(
    gates.map((gate) => gate.gateId),
    DEEP_ASSURANCE_GATE_CATALOG.map((gate) => gate.gateId),
    'gate',
  );
  if (gateTopologyError) {
    return { completionStatus: null, securityVerdict: null, ready: false, reason: gateTopologyError };
  }
  const laneTopologyError = compareExactTopology(
    assignments.map((assignment) => assignment.roleId),
    DEEP_ASSURANCE_LANE_CATALOG.map((lane) => lane.roleId),
    'lane',
  );
  if (laneTopologyError) {
    return { completionStatus: null, securityVerdict: null, ready: false, reason: laneTopologyError };
  }

  const nonMandatoryGate = gates.find((gate) => gate.mandatory !== true);
  if (nonMandatoryGate) {
    return { completionStatus: null, securityVerdict: null, ready: false, reason: `gate ${nonMandatoryGate.gateId} is not mandatory` };
  }
  const pendingGates = gates.filter((gate) => gate.status === GateStatus.PENDING);
  if (publicationReadiness) {
    const releaseAndReportGate = gates.find((gate) => gate.gateId === DEEP_ASSURANCE_RELEASE_AND_REPORT_GATE_ID);
    if (releaseAndReportGate?.status !== GateStatus.PENDING) {
      return {
        completionStatus: null,
        securityVerdict: null,
        ready: false,
        reason: `publication readiness requires ${DEEP_ASSURANCE_RELEASE_AND_REPORT_GATE_ID} to remain PENDING until publication is recorded`,
      };
    }
    const unfinishedPrepublicationGate = pendingGates.find(
      (gate) => gate.gateId !== DEEP_ASSURANCE_RELEASE_AND_REPORT_GATE_ID,
    );
    if (unfinishedPrepublicationGate) {
      return {
        completionStatus: null,
        securityVerdict: null,
        ready: false,
        reason: `mandatory prepublication gate ${unfinishedPrepublicationGate.gateId} is ${unfinishedPrepublicationGate.status}`,
      };
    }
  } else if (pendingGates.length > 0) {
    const [unfinishedGate] = pendingGates;
    return { completionStatus: null, securityVerdict: null, ready: false, reason: `mandatory gate ${unfinishedGate.gateId} is ${unfinishedGate.status}` };
  }

  const nonMandatoryAssignment = assignments.find((assignment) => assignment.mandatory !== true);
  if (nonMandatoryAssignment) {
    return { completionStatus: null, securityVerdict: null, ready: false, reason: `assignment ${nonMandatoryAssignment.assignmentId} is not mandatory` };
  }
  const unfinishedAssignment = assignments.find((assignment) => assignment.status !== AssignmentStatus.ACCEPTED);
  if (unfinishedAssignment) {
    return { completionStatus: null, securityVerdict: null, ready: false, reason: `mandatory assignment ${unfinishedAssignment.assignmentId} is ${unfinishedAssignment.status}` };
  }

  const failedGate = gates.find((gate) => gate.status === GateStatus.FAIL);
  const result = failedGate
    ? { completionStatus: 'COMPLETE', securityVerdict: SecurityVerdict.NO_GO, ready: true, reason: 'one or more mandatory security gates failed' }
    : { completionStatus: 'COMPLETE', securityVerdict: SecurityVerdict.PASS, ready: true, reason: 'all mandatory work concluded without a failed security gate' };

  if (terminal && state.publication?.status !== 'PUBLISHED') {
    return { ...result, completionStatus: null, ready: false, reason: 'publication is required before terminal completion' };
  }
  if (terminal && state.userDelivery?.status !== 'DELIVERED') {
    return { ...result, completionStatus: null, ready: false, reason: 'final user delivery is required before terminal completion' };
  }
  return result;
}
