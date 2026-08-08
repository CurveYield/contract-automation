import test from 'node:test';
import assert from 'node:assert/strict';
import { controllerDetailModelV1 } from '../src/controller-detail-model-v1.mjs';

const SKILL_RELEASE = 'ai-auditor-deep-assurance-v6@16.13.0';

function base(overrides = {}) {
  return {
    schemaVersion: 'hosted-operator-state-v1',
    campaign: { preflight: { capabilities: {} } },
    gates: [], workers: [], assignments: [], instructionProofs: [], findings: [], events: [],
    remediation: null, report: null,
    ...overrides,
  };
}

test('detail capabilities and gates', () => {
  const details = controllerDetailModelV1(base({
    campaign: { preflight: { capabilities: {
      'github-native-simulate-v1': true,
      'browser-agent-review-v1': true,
      'github-native-compile-v1': false,
    } } },
    gates: [{ gateId: 'g1', phaseId: 'p1', title: 'Gate', mandatory: true, status: 'MEDIUM_ISSUE_FOUND', evidenceRefCount: 2, recordedAt: '2026-08-08T04:10:00.000Z' }],
  }));
  assert.deepEqual(details.capabilities, [
    { id: 'browser-agent-review-v1', ready: true },
    { id: 'github-native-compile-v1', ready: false },
    { id: 'github-native-simulate-v1', ready: true },
  ]);
  assert.deepEqual(details.gates[0], {
    gateId: 'g1', phaseId: 'p1', title: 'Gate', mandatory: true, status: 'MEDIUM_ISSUE_FOUND', evidenceCount: 2, recordedAt: '2026-08-08T04:10:00.000Z',
  });
});

test('detail workers assignments and instruction proofs', () => {
  const details = controllerDetailModelV1(base({
    workers: [{ workerId: 'w1', roleId: 'role', capabilities: ['cap'], session: { productSurface: 'chatgpt-web', model: 'gpt-5.6-sol', sessionId: 's1', priorMaterialVisibility: 'clean-room', independenceClassification: 'isolated' }, registeredAt: 't1' }],
    assignments: [{ assignmentId: 'a1', roleId: 'role', title: 'Assignment', mandatory: true, status: 'SUBMITTED', requiredCapabilities: ['cap'], requiredEvidenceClasses: ['manual'], promptVersion: 'v1', cleanRoom: true, controllerOwned: false, instructionPhaseId: 'phase', revision: 2, sourceRevision: 3, assignedWorkerId: 'w1', leaseStartedAt: 'start', leaseExpiresAt: 'end', submission: { summary: 'summary', evidenceRefCount: 2, submittedAt: 'submitted' }, review: { decision: 'REWORK', reviewerWorkerId: 'w2', reason: 'reason', reviewedAt: 'reviewed' }, reviewCount: 1, invalidationCount: 0 }],
    instructionProofs: [{ actorType: 'worker', actorId: 'w1', sessionId: 's1', roleId: 'role', phaseId: 'phase', skillReleaseIdentity: SKILL_RELEASE, aggregateInstructionSetDigest: 'b'.repeat(64), acknowledgedAt: 'ack' }],
  }));
  assert.equal(details.workers[0].sessionId, 's1');
  assert.equal(details.workers[0].cleanRoomVisibility, 'clean-room');
  assert.equal(details.assignments[0].lease, 'start → end');
  assert.equal(details.assignments[0].submissionEvidenceCount, 2);
  assert.equal(details.assignments[0].reviewDecision, 'REWORK');
  assert.equal(details.instructionProofs[0].skillReleaseIdentity, SKILL_RELEASE);
  assert.equal(details.instructionProofs[0].digest, 'bbbbbbbbbbbb…');
});

test('detail findings remediation report and events', () => {
  const details = controllerDetailModelV1(base({
    findings: [{ findingId: 'F-1', title: 'Finding', severity: 'MEDIUM', status: 'UNRESOLVED', phaseId: 'phase', assignmentId: 'a1', remediationStatus: 'PENDING' }],
    remediation: { status: 'PENDING', unresolvedHighCriticalCount: 0, reviewedAt: null },
    report: { status: 'BLOCKED', completionStatus: null, securityVerdict: null, findingCount: 1, limitationCount: 1, evidenceCount: 5, exactReleaseCommit: null },
    events: [{ sequence: 9, hash: '1'.repeat(64), previousHash: '2'.repeat(64), commandId: 'c9', type: 'review.returned_for_rework', actor: { type: 'worker', id: 'w2' }, timestamp: 't9' }],
  }));
  assert.equal(details.findings[0].severity, 'MEDIUM');
  assert.equal(details.remediation.unresolvedHighCriticalCount, 0);
  assert.equal(details.report.status, 'BLOCKED');
  assert.equal(details.report.securityVerdict, 'not final');
  assert.equal(details.events[0].sequence, 9);
  assert.equal(details.events[0].hash, '111111111111…');
});
