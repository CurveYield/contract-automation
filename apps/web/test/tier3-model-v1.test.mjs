import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/client.mjs';
import {
  deriveAuditProgressV1,
  deriveInstructionAuthorizationV1,
  deriveOperatorActionsV1,
  normalizeHostedAuditStateV1,
} from '../src/tier3-model-v1.mjs';

const compatibility = Object.freeze({
  schemaVersion: 'audit-controller-hosted-compatibility-v1',
  repository: 'CurveYield/audit-controller',
  mainRef: 'main',
  hostedStateSchemaVersion: 'hosted-operator-state-v1',
  activePointerSchemaVersion: 'deep-assurance-active-pointer-v2',
  controllerCommit: 'c'.repeat(40),
  skillReleaseIdentity: 'ai-auditor-deep-assurance-v6@16.13.0',
  automationRelease: 'contract-automation@round5-tier3-v1',
});

function hosted(overrides = {}) {
  const projection = {
    schemaVersion: 'hosted-operator-state-v1',
    controllerStateSchemaVersion: 2,
    compatibility: {
      controllerCommit: compatibility.controllerCommit,
      controllerRelease: 'audit-controller@hosted-tier3-v1',
      skillReleaseIdentity: compatibility.skillReleaseIdentity,
      automationRelease: compatibility.automationRelease,
    },
    campaign: {
      campaignId: 'camp-v1',
      processId: 'deep-assurance-v6',
      title: 'Tier 3 audit',
      status: 'ACTIVE',
      completionStatus: null,
      securityVerdict: null,
      terminalReason: null,
      source: { repository: 'CurveYield/example', commit: 'a'.repeat(40), revision: 1 },
      preflight: { status: 'READY', capabilities: { 'github-mailbox-v1': true } },
      instructionPolicyRequired: true,
      createdAt: '2026-08-07T19:00:00.000Z',
      updatedAt: '2026-08-07T20:00:00.000Z',
    },
    topology: {
      gateIds: ['scope-complete', 'manual-review-complete', 'remediation-review-complete'],
      laneRoleIds: ['scope-specification-auditor', 'manual-implementation-auditor'],
    },
    gates: [
      { gateId: 'scope-complete', phaseId: 'scope-and-provenance', title: 'Scope', mandatory: true, status: 'PASS', evidenceRefCount: 1, recordedAt: '2026-08-07T19:10:00.000Z' },
      { gateId: 'manual-review-complete', phaseId: 'manual-implementation-review', title: 'Manual', mandatory: true, status: 'MEDIUM_ISSUE_FOUND', evidenceRefCount: 2, recordedAt: '2026-08-07T19:30:00.000Z' },
      { gateId: 'remediation-review-complete', phaseId: 'remediation-review', title: 'Remediation', mandatory: true, status: 'PENDING', evidenceRefCount: 0, recordedAt: null },
    ],
    workers: [
      { workerId: 'worker-1', roleId: 'manual-implementation-auditor', capabilities: ['browser-agent-review-v1'], session: { productSurface: 'chatgpt-web', model: 'gpt-5.6-sol', sessionId: 'session-1', priorMaterialVisibility: 'clean-room', independenceClassification: 'isolated-correlated-ai-review' }, registeredAt: '2026-08-07T19:15:00.000Z' },
    ],
    assignments: [
      { assignmentId: 'assignment-1', roleId: 'manual-implementation-auditor', title: 'Manual review', mandatory: true, status: 'LEASED', requiredCapabilities: ['browser-agent-review-v1'], requiredEvidenceClasses: ['manual-review'], promptVersion: 'v1', cleanRoom: true, controllerOwned: false, instructionPhaseId: 'manual-implementation-review', revision: 1, sourceRevision: 1, assignedWorkerId: 'worker-1', leaseStartedAt: '2026-08-07T19:20:00.000Z', leaseExpiresAt: '2026-08-07T20:20:00.000Z', submission: null, review: null, reviewCount: 0, invalidationCount: 0, publishedAt: '2026-08-07T19:15:00.000Z' },
      { assignmentId: 'assignment-2', roleId: 'scope-specification-auditor', title: 'Scope review', mandatory: true, status: 'ACCEPTED', requiredCapabilities: [], requiredEvidenceClasses: [], promptVersion: 'v1', cleanRoom: true, controllerOwned: false, instructionPhaseId: 'scope-and-provenance', revision: 1, sourceRevision: 1, assignedWorkerId: 'worker-2', leaseStartedAt: null, leaseExpiresAt: null, submission: { workerId: 'worker-2', controllerId: null, summary: 'Complete', sourceRevision: 1, evidenceRefCount: 1, submittedAt: '2026-08-07T19:12:00.000Z' }, review: { reviewerWorkerId: 'worker-3', decision: 'ACCEPT', reason: null, revision: 1, reviewedAt: '2026-08-07T19:14:00.000Z' }, reviewCount: 1, invalidationCount: 0, publishedAt: '2026-08-07T19:01:00.000Z' },
    ],
    instructionProofs: [
      { proofKey: 'worker-1|session-1|manual-implementation-auditor|manual-implementation-review', skillReleaseIdentity: compatibility.skillReleaseIdentity, actorType: 'worker', actorId: 'worker-1', sessionId: 'session-1', roleId: 'manual-implementation-auditor', phaseId: 'manual-implementation-review', aggregateInstructionSetDigest: 'b'.repeat(64), acknowledgedAt: '2026-08-07T19:18:00.000Z' },
    ],
    findings: [{ findingId: 'F-1', title: 'Medium issue', severity: 'MEDIUM', status: 'UNRESOLVED', phaseId: 'manual-implementation-review', assignmentId: 'assignment-1', remediationStatus: 'PENDING' }],
    remediation: { status: 'PENDING', unresolvedHighCriticalCount: 0, reviewedAt: null },
    report: { status: 'IN_PROGRESS', completionStatus: null, securityVerdict: null, findingCount: 1, limitationCount: 0, evidenceCount: 3, exactReleaseCommit: null },
    publication: { status: 'PENDING' },
    userDelivery: { status: 'PENDING' },
    events: [],
    ...overrides,
  };
  return {
    pointer: {
      schemaVersion: 'deep-assurance-active-pointer-v2',
      projectSlug: 'vlsdt',
      status: 'ACTIVE',
      launchAuthorized: true,
      campaignId: projection.campaign.campaignId,
      campaignGenerationId: 'gen-v1',
      controllerBranch: 'campaign/vlsdt-v20-v1',
      workspacePath: 'campaigns/CurveYield-vlSDT-v20/',
      mailboxIssueNumber: 171,
      projectionPath: 'campaigns/CurveYield-vlSDT-v20/HOSTED-OPERATOR-STATE-v1.json',
      controllerCommit: projection.compatibility.controllerCommit,
      skillReleaseIdentity: projection.compatibility.skillReleaseIdentity,
    },
    projection,
    status: projection.campaign.status,
  };
}

test('normalizeHostedAuditStateV1 rejects mixed controller, skill or automation releases', () => {
  const good = normalizeHostedAuditStateV1(hosted(), compatibility);
  assert.equal(good.campaign.status, 'ACTIVE');
  assert.throws(() => normalizeHostedAuditStateV1(hosted({ compatibility: { ...hosted().projection.compatibility, controllerCommit: 'd'.repeat(40) } }), compatibility), /controller commit/i);
  assert.throws(() => normalizeHostedAuditStateV1(hosted({ compatibility: { ...hosted().projection.compatibility, skillReleaseIdentity: 'wrong-skill' } }), compatibility), /skill release/i);
  assert.throws(() => normalizeHostedAuditStateV1(hosted({ compatibility: { ...hosted().projection.compatibility, automationRelease: 'wrong-automation' } }), compatibility), /automation release/i);
});

test('progress preserves process FAIL separately from issue severity and final security verdict', () => {
  const active = normalizeHostedAuditStateV1(hosted(), compatibility);
  const activeProgress = deriveAuditProgressV1(active);
  assert.deepEqual(activeProgress.gates, { total: 3, concluded: 2, pending: 1, processFailed: 0, issueFound: 1 });
  assert.deepEqual(activeProgress.assignments, { total: 2, accepted: 1, submitted: 0, leased: 1, ready: 0, rejected: 0 });
  assert.equal(activeProgress.completionStatus, null);
  assert.equal(activeProgress.securityVerdict, null);

  const processFail = normalizeHostedAuditStateV1(hosted({
    gates: [{ gateId: 'scope-complete', phaseId: 'scope-and-provenance', title: 'Scope', mandatory: true, status: 'FAIL', evidenceRefCount: 1, recordedAt: '2026-08-07T20:01:00.000Z' }],
    campaign: { ...hosted().projection.campaign, status: 'ACTIVE', completionStatus: null, securityVerdict: null },
  }), compatibility);
  assert.equal(deriveAuditProgressV1(processFail).gates.processFailed, 1);
  assert.equal(processFail.campaign.securityVerdict, null);

  const pass = normalizeHostedAuditStateV1(hosted({ campaign: { ...hosted().projection.campaign, status: 'COMPLETE', completionStatus: 'COMPLETE', securityVerdict: 'PASS' } }), compatibility);
  const noGo = normalizeHostedAuditStateV1(hosted({ campaign: { ...hosted().projection.campaign, status: 'COMPLETE', completionStatus: 'COMPLETE', securityVerdict: 'NO_GO' } }), compatibility);
  assert.equal(pass.campaign.securityVerdict, 'PASS');
  assert.equal(noGo.campaign.securityVerdict, 'NO_GO');
});

test('instruction authorization reports ACCEPTED, MISSING and STALE_OR_MISMATCHED without inventing authority', () => {
  const state = normalizeHostedAuditStateV1(hosted(), compatibility);
  assert.equal(deriveInstructionAuthorizationV1(state, { actorType: 'worker', actorId: 'worker-1', sessionId: 'session-1', roleId: 'manual-implementation-auditor', phaseId: 'manual-implementation-review' }).status, 'ACCEPTED');
  assert.equal(deriveInstructionAuthorizationV1(state, { actorType: 'worker', actorId: 'worker-9', sessionId: 'session-9', roleId: 'manual-implementation-auditor', phaseId: 'manual-implementation-review' }).status, 'MISSING');
  assert.equal(deriveInstructionAuthorizationV1(state, { actorType: 'worker', actorId: 'worker-1', sessionId: 'replacement-session', roleId: 'manual-implementation-auditor', phaseId: 'manual-implementation-review' }).status, 'STALE_OR_MISMATCHED');
});

test('operator actions block expired leases and missing proof while treating UI availability as advisory', () => {
  const state = normalizeHostedAuditStateV1(hosted(), compatibility);
  const allowed = deriveOperatorActionsV1(state, {
    actorType: 'worker', actorId: 'worker-1', sessionId: 'session-1', roleId: 'manual-implementation-auditor', phaseId: 'manual-implementation-review', assignmentId: 'assignment-1', now: '2026-08-07T20:10:00.000Z',
  });
  assert.equal(allowed.instructionAuthorization, 'ACCEPTED');
  assert.equal(allowed.leaseState, 'CURRENT');
  assert.equal(allowed.substantiveActionAdvisoryAllowed, true);
  assert.equal(allowed.controllerStillAuthoritative, true);

  const expired = deriveOperatorActionsV1(state, {
    actorType: 'worker', actorId: 'worker-1', sessionId: 'session-1', roleId: 'manual-implementation-auditor', phaseId: 'manual-implementation-review', assignmentId: 'assignment-1', now: '2026-08-07T20:30:00.000Z',
  });
  assert.equal(expired.leaseState, 'EXPIRED');
  assert.equal(expired.substantiveActionAdvisoryAllowed, false);

  const missingProof = deriveOperatorActionsV1(state, {
    actorType: 'worker', actorId: 'worker-9', sessionId: 'session-9', roleId: 'manual-implementation-auditor', phaseId: 'manual-implementation-review', assignmentId: 'assignment-1', now: '2026-08-07T20:10:00.000Z',
  });
  assert.equal(missingProof.instructionAuthorization, 'MISSING');
  assert.equal(missingProof.substantiveActionAdvisoryAllowed, false);
});

test('API client exposes authenticated Tier 3 compatibility, project and command methods', async () => {
  const calls = [];
  const fetcher = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/api/v1/audit/compatibility')) return new Response(JSON.stringify(compatibility), { status: 200 });
    if (String(url).endsWith('/api/v1/audit/projects/vlsdt')) return new Response(JSON.stringify(hosted()), { status: 200 });
    if (String(url).endsWith('/api/v1/audit/projects/vlsdt/commands')) return new Response(JSON.stringify({ accepted: true, commentId: 9, commandId: 'cmd-9' }), { status: 202 });
    return new Response('{}', { status: 404 });
  };
  const api = createApiClient({ apiUrl: 'https://api.example', apiKey: 'client-key', fetcher });

  assert.equal((await api.getAuditCompatibility()).schemaVersion, 'audit-controller-hosted-compatibility-v1');
  assert.equal((await api.getAuditProject('vlsdt')).projection.campaign.campaignId, 'camp-v1');
  assert.deepEqual(await api.submitAuditCommand('vlsdt', { schemaVersion: 1, commandId: 'cmd-9', type: 'campaign.activate', actor: { type: 'controller', id: 'controller-1' }, payload: {} }), { accepted: true, commentId: 9, commandId: 'cmd-9' });

  assert.equal(calls.length, 3);
  for (const call of calls) assert.equal(new Headers(call.init.headers).get('authorization'), 'Bearer client-key');
  assert.equal(JSON.parse(calls[2].init.body).command.commandId, 'cmd-9');
});
