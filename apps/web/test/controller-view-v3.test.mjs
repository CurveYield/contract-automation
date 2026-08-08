import test from 'node:test';
import assert from 'node:assert/strict';
import { assertTier3BrowserCompatibilityV2, controllerViewModelV2 } from '../src/controller-view-v3.mjs';

const compatibility = {
  adapterVersion: 'tier3-controller-adapter-v2',
  controller: {
    repository: 'CurveYield/audit-controller', ref: 'main',
    compatibilityCommit: '48b031f06c7d7ed3573b42e371e123299722b451',
    releaseIdentity: 'audit-controller@48b031f06c7d7ed3573b42e371e123299722b451',
    processId: 'deep-assurance-v6', instructionReleaseIdentity: 'ai-auditor-deep-assurance-v6@16.14.0',
  },
  automation: {
    repository: 'CurveYield/contract-automation',
    compatibilityCommit: 'ad11d7d5a623c1411cbabb4bb0cd9acf7975bce8',
    releaseIdentity: 'contract-automation@ad11d7d5a623c1411cbabb4bb0cd9acf7975bce8',
  },
  networkScope: { chains: ['ethereum', 'base'], defaultChain: 'base' },
};

const active = {
  ...compatibility,
  project: {
    projectSlug: 'vlsdt', status: 'ACTIVE', campaignId: 'vlsdt-a47590c4dd9f68b7', campaignGenerationId: 'gen-v1',
    phaseSequence: 0, launchAuthorized: false, workspacePath: 'campaigns/CurveYield-vlSDT-v20/',
    controllerCommit: compatibility.controller.compatibilityCommit,
    skillReleaseIdentity: compatibility.controller.instructionReleaseIdentity,
    sourceRepository: 'CurveYield/Audits', sourceCommit: '7'.repeat(40),
    commandRouting: { available: false, reason: 'PHASE0_BOOTSTRAP_FENCED' },
  },
  campaign: {
    schemaVersion: 'controller-operator-state-v2',
    compatibility: {
      controllerCommit: compatibility.controller.compatibilityCommit,
      controllerRelease: compatibility.controller.releaseIdentity,
      skillReleaseIdentity: compatibility.controller.instructionReleaseIdentity,
      automationRelease: compatibility.automation.releaseIdentity,
    },
    campaign: {
      campaignId: 'vlsdt-a47590c4dd9f68b7', processId: 'deep-assurance-v6', title: 'vlsdt', status: 'ACTIVE',
      launchAuthorized: false, phaseSequence: 0, completionStatus: null, securityVerdict: null, terminalReason: null,
      source: { repository: 'CurveYield/Audits', commit: '7'.repeat(40), revision: 0, archiveSha256: '4'.repeat(64) },
      preflight: { status: 'READY', capabilities: { 'github-mailbox-v1': true } },
      instructionPolicyRequired: true, createdAt: '2026-08-08T06:49:30Z', updatedAt: '2026-08-08T06:49:31Z',
    },
    topology: { gateIds: Array.from({ length: 10 }, (_, i) => `gate-${i}`), laneRoleIds: Array.from({ length: 7 }, (_, i) => `role-${i}`) },
    gates: Array.from({ length: 10 }, (_, i) => ({ gateId: `gate-${i}`, phaseId: `phase-${i}`, title: `phase-${i}`, mandatory: true, status: 'PENDING', evidenceRefCount: 0, recordedAt: null })),
    workers: [],
    assignments: Array.from({ length: 7 }, (_, i) => ({ assignmentId: `assignment-${i}`, roleId: `role-${i}`, title: `role-${i}`, mandatory: true, status: 'BOOTSTRAP_FENCED', requiredCapabilities: [], requiredEvidenceClasses: [], promptVersion: null, cleanRoom: i < 4, controllerOwned: i === 6, instructionPhaseId: `phase-${i}`, revision: null, sourceRevision: 0, assignedWorkerId: null, leaseStartedAt: null, leaseExpiresAt: null, submission: null, review: null, reviewCount: 0, invalidationCount: 0, publishedAt: null })),
    instructionProofs: [{ proofKey: 'phase-0-proof', skillReleaseIdentity: 'ai-auditor-deep-assurance-v6@16.14.0', actorType: 'controller', actorId: 'phase-0-orchestrator', sessionId: null, roleId: 'orchestrator', phaseId: 'phase-0', aggregateInstructionSetDigest: '5'.repeat(64), acknowledgedAt: '2026-08-08T06:49:30Z' }],
    findings: [], remediation: null, report: null, publication: { status: 'PENDING' }, userDelivery: { status: 'PENDING' },
    events: [{ sequence: null, hash: '7'.repeat(64), previousHash: null, commandId: 'campaign-create', type: 'campaign.created', actor: { type: 'controller', id: 'phase-0-orchestrator' }, timestamp: '2026-08-08T06:49:30Z' }],
    controlPlane: {
      bootstrapStatus: 'BOOTSTRAP_FENCED', launchAuthorized: false, claimAuthorized: false, sourceAccessAuthorized: false,
      assignmentClaimsAuthorized: false, substantiveWorkAuthorized: false, failoverStatus: 'HEALTHY', authorityState: 'ACTIVE',
      primaryPollEnabledVerified: false, primaryTaskEnabled: false, requiredSkillPackageVersion: '16.14.0',
    },
  },
};

test('browser compatibility accepts current v16.14 adapter and rejects stale adapter', () => {
  assert.equal(assertTier3BrowserCompatibilityV2(compatibility), compatibility);
  assert.throws(() => assertTier3BrowserCompatibilityV2({ ...compatibility, adapterVersion: 'tier3-controller-adapter-v1' }), /incompatible/i);
});

test('active Phase 0 view distinguishes campaign ACTIVE from launch/substantive authorization', () => {
  const view = controllerViewModelV2(active);
  assert.match(view.stateMessage, /Phase 0/i);
  assert.match(view.stateMessage, /fenced/i);
  assert.match(view.activeCampaign, /ACTIVE/);
  assert.match(view.phaseSummary, /10 gates/i);
  assert.match(view.phaseSummary, /launch.*fenced/i);
  assert.match(view.laneSummary, /7 required lanes/i);
  assert.match(view.assignmentSummary, /7 BOOTSTRAP_FENCED/i);
  assert.match(view.instructionProofSummary, /1 accepted proof/i);
  assert.match(view.finalizationSummary, /not complete/i);
  assert.equal(view.commandAvailable, false);
  assert.equal(view.commandReason, 'PHASE0_BOOTSTRAP_FENCED');
});
