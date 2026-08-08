import test from 'node:test';
import assert from 'node:assert/strict';
import { controllerViewModelV1 } from '../src/controller-view-v1.mjs';

const CONTROLLER_COMMIT = 'd4851886ece3e8793dcc2a99f97f6d34da10e1cd';
const SKILL_RELEASE = 'ai-auditor-deep-assurance-v6@16.13.0';

function compatibility() {
  return {
    adapterVersion: 'tier3-controller-adapter-v1',
    controller: {
      repository: 'CurveYield/audit-controller',
      compatibilityCommit: CONTROLLER_COMMIT,
      releaseIdentity: 'audit-controller@hosted-tier3-v1',
      processId: 'deep-assurance-v6',
      instructionReleaseIdentity: SKILL_RELEASE,
    },
    automation: {
      repository: 'CurveYield/contract-automation',
      releaseIdentity: 'contract-automation@round5-tier3-v1',
    },
    networkScope: { chains: ['ethereum', 'base'], defaultChain: 'base' },
  };
}

function active(overrides = {}) {
  const base = {
    ...compatibility(),
    project: {
      projectSlug: 'vlsdt',
      status: 'ACTIVE',
      launchAuthorized: true,
      campaignId: 'camp-v1',
      campaignGenerationId: 'gen-v1',
      controllerBranch: 'campaign/vlsdt-v20-v1',
      workspacePath: 'campaigns/CurveYield-vlSDT-v20/',
      mailboxIssueNumber: 171,
      projectionPath: 'campaigns/CurveYield-vlSDT-v20/HOSTED-OPERATOR-STATE-v1.json',
      controllerCommit: CONTROLLER_COMMIT,
      skillReleaseIdentity: SKILL_RELEASE,
    },
    campaign: {
      schemaVersion: 'hosted-operator-state-v1',
      controllerStateSchemaVersion: 2,
      compatibility: {
        controllerCommit: CONTROLLER_COMMIT,
        controllerRelease: 'audit-controller@hosted-tier3-v1',
        skillReleaseIdentity: SKILL_RELEASE,
        automationRelease: 'contract-automation@round5-tier3-v1',
      },
      campaign: {
        campaignId: 'camp-v1', processId: 'deep-assurance-v6', title: 'Tier 3 audit', status: 'ACTIVE',
        completionStatus: null, securityVerdict: null, terminalReason: null,
        source: { repository: 'CurveYield/Audits', commit: 'a'.repeat(40), revision: 2 },
        preflight: { status: 'READY', capabilities: { 'github-mailbox-v1': true, 'github-native-compile-v1': true } },
        instructionPolicyRequired: true,
        createdAt: '2026-08-08T04:00:00.000Z', updatedAt: '2026-08-08T04:20:00.000Z',
      },
      topology: {
        gateIds: ['manual-implementation-review-complete', 'remediation-review-complete'],
        laneRoleIds: ['manual-implementation-auditor', 'final-report-coordinator'],
      },
      gates: [
        { gateId: 'manual-implementation-review-complete', phaseId: 'manual-implementation-review', title: 'Manual review', mandatory: true, status: 'MEDIUM_ISSUE_FOUND', evidenceRefCount: 2, recordedAt: '2026-08-08T04:10:00.000Z' },
        { gateId: 'remediation-review-complete', phaseId: 'remediation-review', title: 'Remediation review', mandatory: true, status: 'PENDING', evidenceRefCount: 0, recordedAt: null },
      ],
      workers: [
        { workerId: 'worker-1', roleId: 'manual-implementation-auditor', capabilities: ['browser-agent-review-v1'], session: { productSurface: 'chatgpt-web', model: 'gpt-5.6-sol', sessionId: 'session-1', priorMaterialVisibility: 'clean-room', independenceClassification: 'isolated-correlated-ai-review' }, registeredAt: '2026-08-08T04:01:00.000Z' },
      ],
      assignments: [
        { assignmentId: 'a1', roleId: 'manual-implementation-auditor', title: 'Manual review', mandatory: true, status: 'SUBMITTED', requiredCapabilities: [], requiredEvidenceClasses: ['manual-review'], promptVersion: 'v1', cleanRoom: true, controllerOwned: false, instructionPhaseId: 'manual-implementation-review', revision: 1, sourceRevision: 2, assignedWorkerId: 'worker-1', leaseStartedAt: '2026-08-08T04:02:00.000Z', leaseExpiresAt: '2026-08-08T05:02:00.000Z', submission: { workerId: 'worker-1', controllerId: null, summary: 'One medium finding.', sourceRevision: 2, evidenceRefCount: 2, submittedAt: '2026-08-08T04:18:00.000Z' }, review: null, reviewCount: 0, invalidationCount: 0, publishedAt: '2026-08-08T04:02:00.000Z' },
      ],
      instructionProofs: [
        { proofKey: 'p1', skillReleaseIdentity: SKILL_RELEASE, actorType: 'worker', actorId: 'worker-1', sessionId: 'session-1', roleId: 'manual-implementation-auditor', phaseId: 'manual-implementation-review', aggregateInstructionSetDigest: 'b'.repeat(64), acknowledgedAt: '2026-08-08T04:01:30.000Z' },
      ],
      findings: [
        { findingId: 'F-1', title: 'Medium issue', severity: 'MEDIUM', status: 'UNRESOLVED', phaseId: 'manual-implementation-review', assignmentId: 'a1', remediationStatus: 'PENDING' },
      ],
      remediation: { status: 'PENDING', unresolvedHighCriticalCount: 0, reviewedAt: null },
      report: null,
      publication: { status: 'PENDING' },
      userDelivery: { status: 'PENDING' },
      events: [
        { sequence: 1, hash: '1'.repeat(64), previousHash: null, commandId: 'c1', type: 'campaign.created', actor: { type: 'controller', id: 'orchestrator' }, timestamp: '2026-08-08T04:00:00.000Z' },
      ],
    },
  };
  return { ...base, ...overrides };
}

test('renders a tombstone as explicitly no active campaign', () => {
  const view = controllerViewModelV1({
    ...compatibility(),
    project: {
      projectSlug: 'vlsdt', status: 'NO_ACTIVE_CAMPAIGN', reason: 'FULL_RESTART_REQUESTED',
      launchAuthorized: false, allPriorGenerationsAdmissible: false, scrubCommit: 'e'.repeat(40),
    },
    campaign: null,
  });
  assert.equal(view.activeCampaign, 'No active campaign');
  assert.equal(view.campaignSource, '—');
  assert.match(view.stateMessage, /FULL_RESTART_REQUESTED/);
  assert.match(view.phaseSummary, /not applicable/i);
});

test('renders active Tier 3 campaign state without conflating findings and process status', () => {
  const view = controllerViewModelV1(active());
  assert.equal(view.activeCampaign, 'camp-v1 · ACTIVE');
  assert.match(view.campaignSource, /CurveYield\/Audits/);
  assert.match(view.phaseSummary, /MEDIUM_ISSUE_FOUND/);
  assert.match(view.phaseSummary, /PENDING/);
  assert.match(view.laneSummary, /2 required lanes/);
  assert.match(view.instructionProofSummary, /1 accepted proof record/);
  assert.match(view.assignmentSummary, /1 SUBMITTED/);
  assert.match(view.findingSummary, /1 MEDIUM/);
  assert.match(view.remediationSummary, /0 unresolved High\/Critical/);
  assert.match(view.evidenceSummary, /4 bounded evidence references/);
  assert.match(view.finalizationSummary, /Completion: not complete/);
  assert.match(view.finalizationSummary, /Security verdict: not final/);
});

test('process FAIL remains a process state and does not manufacture a security verdict', () => {
  const value = active();
  value.campaign.gates[0].status = 'FAIL';
  value.campaign.findings = [];
  const view = controllerViewModelV1(value);
  assert.match(view.phaseSummary, /FAIL/);
  assert.equal(view.findingSummary, 'No projected findings.');
  assert.match(view.finalizationSummary, /Security verdict: not final/);
});

test('completed PASS and NO_GO remain separate from completion status', () => {
  for (const verdict of ['PASS', 'NO_GO']) {
    const value = active();
    value.campaign.campaign.status = 'COMPLETE';
    value.campaign.campaign.completionStatus = 'COMPLETE';
    value.campaign.campaign.securityVerdict = verdict;
    value.campaign.report = {
      status: 'COMPLETE', completionStatus: 'COMPLETE', securityVerdict: verdict,
      findingCount: 1, limitationCount: 0, evidenceCount: 7, exactReleaseCommit: 'c'.repeat(40),
    };
    const view = controllerViewModelV1(value);
    assert.match(view.finalizationSummary, /Completion: COMPLETE/);
    assert.match(view.finalizationSummary, new RegExp(`Security verdict: ${verdict}`));
  }
});
