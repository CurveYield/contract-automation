import test from 'node:test';
import assert from 'node:assert/strict';
import { controllerDetailModelV2 } from '../src/controller-detail-model-v2.mjs';

test('detail model accepts current controller-operator-state-v2 and exposes bounded control-plane fields', () => {
  const detail = controllerDetailModelV2({
    schemaVersion: 'controller-operator-state-v2',
    campaign: { preflight: { capabilities: { 'github-mailbox-v1': true } } },
    gates: [{ gateId: 'g1', phaseId: 'phase-0', title: 'Phase 0', mandatory: true, status: 'PENDING', evidenceRefCount: 0, recordedAt: null }],
    workers: [],
    assignments: [{ assignmentId: 'a1', roleId: 'scope', title: 'scope', mandatory: true, status: 'BOOTSTRAP_FENCED', cleanRoom: true, controllerOwned: false, instructionPhaseId: 'phase-0', sourceRevision: 0, requiredCapabilities: [], requiredEvidenceClasses: [], submission: null, review: null, reviewCount: 0, invalidationCount: 0 }],
    instructionProofs: [{ actorType: 'controller', actorId: 'phase-0-orchestrator', roleId: 'orchestrator', phaseId: 'phase-0', skillReleaseIdentity: 'ai-auditor-deep-assurance-v6@16.14.0', aggregateInstructionSetDigest: '5'.repeat(64), acknowledgedAt: '2026-08-08T06:49:30Z' }],
    findings: [], events: [], remediation: null, report: null,
    controlPlane: { bootstrapStatus: 'BOOTSTRAP_FENCED', launchAuthorized: false, claimAuthorized: false, sourceAccessAuthorized: false, assignmentClaimsAuthorized: false, substantiveWorkAuthorized: false, failoverStatus: 'HEALTHY', authorityState: 'ACTIVE', primaryPollEnabledVerified: false, primaryTaskEnabled: false, requiredSkillPackageVersion: '16.14.0' },
  });
  assert.equal(detail.gates[0].status, 'PENDING');
  assert.equal(detail.assignments[0].status, 'BOOTSTRAP_FENCED');
  assert.equal(detail.instructionProofs[0].skillReleaseIdentity, 'ai-auditor-deep-assurance-v6@16.14.0');
  assert.deepEqual(detail.controlPlane, {
    bootstrapStatus: 'BOOTSTRAP_FENCED', launchAuthorized: false, claimAuthorized: false, sourceAccessAuthorized: false,
    assignmentClaimsAuthorized: false, substantiveWorkAuthorized: false, failoverStatus: 'HEALTHY', authorityState: 'ACTIVE',
    primaryPollEnabledVerified: false, primaryTaskEnabled: false, requiredSkillPackageVersion: '16.14.0',
  });
});

test('detail model rejects unknown operator schemas', () => {
  assert.throws(() => controllerDetailModelV2({ schemaVersion: 'unknown' }), /supported operator projection/i);
});
