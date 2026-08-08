import test from 'node:test';
import assert from 'node:assert/strict';
import { controllerDetailModelV1 } from '../src/controller-detail-model-v1.mjs';

const SKILL_RELEASE = 'ai-auditor-deep-assurance-v6@16.13.0';

function projection() {
  return {
    schemaVersion: 'hosted-operator-state-v1',
    campaign: {
      campaignId: 'camp-v1',
      preflight: {
        status: 'READY',
        capabilities: {
          'github-native-simulate-v1': true,
          'browser-agent-review-v1': true,
          'github-native-compile-v1': false,
        },
      },
    },
    topology: {
      gateIds: ['manual-review', 'build-test'],
      laneRoleIds: ['manual-implementation-auditor', 'build-simulation-evidence-auditor'],
    },
    gates: [
      { gateId: 'manual-review', phaseId: 'manual-implementation-review', title: 'Manual review', mandatory: true, status: 'MEDIUM_ISSUE_FOUND', evidenceRefCount: 2, recordedAt: '2026-08-08T04:10:00.000Z' },
      { gateId: 'build-test', phaseId: 'build-and-test', title: 'Build and test', mandatory: true, status: 'PENDING', evidenceRefCount: 0, recordedAt: null },
    ],
    workers: [{
      workerId: 'worker-1', roleId: 'manual-implementation-auditor', capabilities: ['browser-agent-review-v1'],
      session: { productSurface: 'chatgpt-web', model: 'gpt-5.6-sol', sessionId: 'session-1', priorMaterialVisibility: 'clean-room', independenceClassification: 'isolated-correlated-ai-review' },
      registeredAt: '2026-08-08T04:01:00.000Z',
    }],
    assignments: [{
      assignmentId: 'assignment-1', roleId: 'manual-implementation-auditor', title: 'Manual implementation review', mandatory: true, status: 'SUBMITTED', requiredCapabilities: ['browser-agent-review-v1'], requiredEvidenceClasses: ['manual-review'], promptVersion: 'v1', cleanRoom: true, controllerOwned: false, instructionPhaseId: 'manual-implementation-review', revision: 2, sourceRevision: 3, assignedWorkerId: 'worker-1', leaseStartedAt: '2026-08-08T04:02:00.000Z', leaseExpiresAt: '2026-08-08T05:02:00.000Z', submission: { workerId: 'worker-1', controllerId: null, summary: 'One medium issue.', sourceRevision: 3, evidenceRefCount: 2, submittedAt: '2026-08-08T04:18:00.000Z' }, review: { reviewerWorkerId: 'worker-2', decision: 'REWORK', reason: 'Needs proof.', revision: 2, reviewedAt: '2026-08-08T04:20:00.000Z' }, reviewCount: 1, invalidationCount: 0, publishedAt: '2026-08-08T04:02:00.000Z',
    }],
    instructionProofs: [{
      proofKey: 'worker-1|session-1|manual-implementation-auditor|manual-implementation-review', skillReleaseIdentity: SKILL_RELEASE, actorType: 'worker', actorId: 'worker-1', sessionId: 'session-1', roleId: 'manual-implementation-auditor', phaseId: 'manual-implementation-review', aggregateInstructionSetDigest: 'b'.repeat(64), acknowledgedAt: '2026-08-08T04:01:30.000Z',
    }],
    findings: [{ findingId: 'F-1', title: 'Medium issue', severity: 'MEDIUM', status: 'UNRESOLVED', phaseId: 'manual-implementation-review', assignmentId: 'assignment-1', remediationStatus: 'PENDING' }],
    remediation: { status: 'PENDING', unresolvedHighCriticalCount: 0, reviewedAt: null },
    report: { status: 'BLOCKED', completionStatus: null, securityVerdict: null, findingCount: 1, limitationCount: 1, evidenceCount: 5, exactReleaseCommit: null },
    publication: { status: 'PENDING' },
    userDelivery: { status: 'PENDING' },
    events: [{ sequence: 9, hash: '1'.repeat(64), previousHash: '2'.repeat(64), commandId: 'command-9', type: 'review.returned_for_rework', actor: { type: 'worker', id: 'worker-2' }, timestamp: '2026-08-08T04:20:00.000Z' }],
  };
}

test('returns empty bounded detail sections for no active campaign', () => {
  const details = controllerDetailModelV1(null);
  assert.deepEqual(details, {
    capabilities: [], gates: [], workers: [], assignments: [], instructionProofs: [], findings: [], events: [],
    remediation: null, report: null,
  });
});

test('projects sortable operator details without raw evidence references or lease tokens', () => {
  const details = controllerDetailModelV1(projection());

  assert.deepEqual(details.capabilities, [
    { id: 'browser-agent-review-v1', ready: true },
    { id: 'github-native-compile-v1', ready: false },
    { id: 'github-native-simulate-v1', ready: true },
  ]);
  assert.deepEqual(details.gates[0], {
    gateId: 'manual-review', phaseId: 'manual-implementation-review', title: 'Manual review', mandatory: true,
    status: 'MEDIUM_ISSUE_FOUND', evidenceCount: 2, recordedAt: '2026-08-08T04:10:00.000Z',
  });
  assert.equal(details.workers[0].sessionId, 'session-1');
  assert.equal(details.workers[0].cleanRoomVisibility, 'clean-room');
  assert.equal(details.assignments[0].lease, '2026-08-08T04:02:00.000Z → 2026-08-08T05:02:00.000Z');
  assert.equal(details.assignments[0].submissionEvidenceCount, 2);
  assert.equal(details.assignments[0].reviewDecision, 'REWORK');
  assert.equal(details.instructionProofs[0].skillReleaseIdentity, SKILL_RELEASE);
  assert.equal(details.instructionProofs[0].digest, 'bbbbbbbbbbbb…');
  assert.equal(details.findings[0].severity, 'MEDIUM');
  assert.equal(details.remediation.unresolvedHighCriticalCount, 0);
  assert.equal(details.report.status, 'BLOCKED');
  assert.equal(details.report.securityVerdict, 'not final');
  assert.equal(details.events[0].sequence, 9);
  assert.equal(details.events[0].hash, '111111111111…');
  assert.equal(JSON.stringify(details).includes('evidenceRefs'), false);
  assert.equal(JSON.stringify(details).includes('leaseToken'), false);
});

test('bounds long operator summaries for safe table rendering', () => {
  const value = projection();
  value.assignments[0].submission.summary = 'x'.repeat(5000);
  value.assignments[0].review.reason = 'y'.repeat(5000);
  const details = controllerDetailModelV1(value);
  assert.equal(details.assignments[0].submissionSummary.length <= 403, true);
  assert.equal(details.assignments[0].reviewReason.length <= 403, true);
  assert.match(details.assignments[0].submissionSummary, /…$/);
});
