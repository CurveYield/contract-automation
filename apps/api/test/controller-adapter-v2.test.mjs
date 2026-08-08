import test from 'node:test';
import assert from 'node:assert/strict';
import { handleControllerRouteV2 } from '../src/controller-adapter-v2.mjs';

const pointer = {
  schemaVersion: 'deep-assurance-active-pointer-v2',
  projectSlug: 'vlsdt',
  campaignId: 'vlsdt-a47590c4dd9f68b7',
  campaignGenerationId: 'gen-61557f73826c0da823349c1cc21ae864',
  phaseSequence: 0,
  campaignIdentityImmutableAfterPhase0: true,
  status: 'ACTIVE',
  launchAuthorized: false,
  priorGenerationsAdmissible: false,
  sourceRepository: 'CurveYield/Audits',
  sourceCommit: '78b552bdf048a102d01f24804e273c02626327bf',
  sourceArchiveSha256: '455cba79e154efb88829ef965137e6e9d61a28835ab3b435d924ff404e13d1cd',
  controllerCampaignCreateReceipt: 'campaigns/CurveYield-vlSDT-v20/control/CONTROLLER_CAMPAIGN_CREATE_RECEIPT-v1.json',
  requiredSkillPackageVersion: '16.14.0',
  requiredEmbeddedReleaseIdentity: 'ai-auditor-deep-assurance-v6@16.14.0',
  requiredSkillManifestSha256: '86ab8d29696a25effca0501001e7dfd2e2ccecd1e64c07c951e5140eac9e6ac5',
  requiredSkillSha256: 'c5baff0c94dcd3fee616c70d58ef17c9c1c47582d6cbe0786b9089122c73ddc7',
  terminalPointerPath: '.deep-assurance/terminal/vlsdt-a47590c4dd9f68b7.json',
  agentPointers: { 0: '.deep-assurance/bootstrap/vlsdt-a47590c4dd9f68b7/agent-0.json', 1: '.deep-assurance/bootstrap/vlsdt-a47590c4dd9f68b7/agent-1.json' },
};

const receipt = {
  schemaVersion: 'controller-campaign-create-receipt-v1',
  campaignId: pointer.campaignId,
  campaignGenerationId: pointer.campaignGenerationId,
  controllerCommit: '48b031f06c7d7ed3573b42e371e123299722b451',
  reducerSchemaVersion: 2,
  campaignCreateCommandId: 'campaign-create-vlsdt-v1',
  campaignActivateCommandId: 'campaign-activate-vlsdt-v1',
  instructionProofKey: 'phase-0-orchestrator|session|orchestrator|phase-0',
  instructionProofAggregateDigest: '53d019e8bfd396d250cdc61bab1fccae4b76f18e3ae4e88015d046ee484b37c4',
  instructionProofFileReceiptCount: 20,
  instructionProofWitnessContentPersisted: false,
  instructionProofValidation: 'PASS_FULL_BYTE_WITNESS_V2',
  preflight: { status: 'READY', capabilities: {
    'github-mailbox-v1': true,
    'browser-agent-review-v1': true,
    'github-native-compile-v1': true,
    'github-native-simulate-v1': true,
    'artifact-evidence-validation-v1': true,
    'exact-release-verification-v1': true,
  } },
  source: { repository: pointer.sourceRepository, commit: pointer.sourceCommit },
  sourceArchiveSha256: pointer.sourceArchiveSha256,
  stateStatus: 'ACTIVE',
  campaignCreatedEventHash: '7'.repeat(64),
  campaignActivatedEventHash: 'f'.repeat(64),
  authoritativeStateSha256: '0'.repeat(64),
  authoritativeStatePersistence: 'BROWSER_CONTROLLER_RECONSTRUCTIBLE_FROM_PINNED_CATALOG_PROOF_RECEIPTS_AND_HASH_CHAIN',
  fullWitnessBytesPersisted: false,
  createdAt: '2026-08-08T06:49:30Z',
  activatedAt: '2026-08-08T06:49:31Z',
  validation: 'PASS_EXACT_CREATE_AND_ACTIVATE_SEMANTICS',
};

const topology = {
  schemaVersion: 'deep-assurance-controller-topology-v1',
  campaignId: pointer.campaignId,
  campaignGenerationId: pointer.campaignGenerationId,
  controllerRepository: 'CurveYield/audit-controller',
  controllerCommit: receipt.controllerCommit,
  campaignCreateReceipt: pointer.controllerCampaignCreateReceipt,
  authoritativeStateSha256: receipt.authoritativeStateSha256,
  requiredGateCount: 10,
  gates: Array.from({ length: 10 }, (_, index) => ({ gateId: `gate-${index + 1}`, phaseId: `phase-${index + 1}` })),
  requiredLaneCount: 7,
  lanes: Array.from({ length: 7 }, (_, index) => ({ roleId: `role-${index + 1}`, cleanRoom: index < 4, controllerOwned: index === 6 })),
  topologyCatalogPublished: true,
  phaseGateMutationRequiresFreshInstructionProof: true,
  assignmentClaimsAuthorized: false,
  substantiveWorkAuthorized: false,
};

const assignmentPlan = {
  schemaVersion: 'deep-assurance-assignment-plan-v1',
  campaignId: pointer.campaignId,
  campaignGenerationId: pointer.campaignGenerationId,
  status: 'BOOTSTRAP_FENCED',
  claimAuthorized: false,
  sourceAccessAuthorized: false,
  assignments: Array.from({ length: 7 }, (_, index) => ({
    assignmentId: `assignment-${index + 1}`,
    roleId: `role-${index + 1}`,
    defaultAgentNumber: index < 6 ? index + 1 : null,
    cleanRoom: index < 4,
    controllerOwned: index === 6,
    initialPhaseId: `phase-${index + 1}`,
  })),
  independentReviewerStandby: { agentNumber: 7, roleId: 'independent-review-replacement-auditor', assignmentClaimAuthorized: false },
  rawLeaseTokensPublished: false,
  assignmentPublishCommandsPendingWorkerBootstrapAndFreshPhaseProofs: true,
};

const failover = {
  schemaVersion: 'orchestrator-failover-state-v1', campaignId: pointer.campaignId, campaignGenerationId: pointer.campaignGenerationId,
  authorityRevision: 1, observedEpoch: 1, primaryDisableResult: 'IMMEDIATE_DISABLE_VERIFIED', primaryTaskEnabled: false,
  heartbeatEvidenceAdvisoryOnly: true, enabledPollCountAfterSwap: 0, status: 'HEALTHY', supportingObservationRefs: [],
};
const lease = {
  schemaVersion: 'orchestrator-lease-v1', campaignId: pointer.campaignId, campaignGenerationId: pointer.campaignGenerationId,
  authorityRevision: 1, authorityState: 'ACTIVE', controlCommit: receipt.controllerCommit, orchestratorEpoch: 1,
  primaryOrchestrator: 'phase-0-orchestrator', replacementOrchestrator: 'agent-0', primaryPollEnabledVerified: false,
  primaryPollLookupVerified: true, primaryPollTaskId: 'must-not-render-task-id', replacementPollTaskId: null,
  primaryPollBootstrapReceiptPath: 'campaigns/example/control/POLL_BOOTSTRAP_RECEIPT-orchestrator-v2.json',
  previousLeaseBlobSha: null, lastAuthorityMutationAt: '2026-08-08T06:30:56Z',
};

function envelope(value) {
  return new Response(JSON.stringify({ encoding: 'base64', content: Buffer.from(JSON.stringify(value)).toString('base64') }), { status: 200 });
}

function env() {
  const table = new Map([
    ['.deep-assurance/active/vlsdt.json', pointer],
    [pointer.controllerCampaignCreateReceipt, receipt],
    ['campaigns/CurveYield-vlSDT-v20/control/CONTROLLER_TOPOLOGY-v1.json', topology],
    ['campaigns/CurveYield-vlSDT-v20/control/ASSIGNMENT_PLAN-v1.json', assignmentPlan],
    ['campaigns/CurveYield-vlSDT-v20/control/FAILOVER_STATE-v1.json', failover],
    ['campaigns/CurveYield-vlSDT-v20/control/ORCHESTRATOR_LEASE-v1.json', lease],
  ]);
  return {
    CLIENT_API_KEY: 'client-key', AUDIT_CONTROLLER_GITHUB_TOKEN: 'controller-token', CORS_ORIGIN: 'https://preflight.curveyield.online',
    AUDIT_CONTROLLER_FETCH: async (url) => {
      const marker = '/contents/';
      const raw = decodeURIComponent(new URL(url).pathname.split(marker)[1] ?? '');
      const value = table.get(raw);
      return value ? envelope(value) : new Response('{}', { status: 404 });
    },
  };
}

function request(path) {
  return new Request(`https://api.example${path}`, { headers: { authorization: 'Bearer client-key' } });
}

test('compatibility route advertises current v16.14 release', async () => {
  const response = await handleControllerRouteV2(request('/api/v1/controller/compatibility'), env());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.adapterVersion, 'tier3-controller-adapter-v2');
  assert.equal(body.controller.compatibilityCommit, receipt.controllerCommit);
  assert.equal(body.controller.instructionReleaseIdentity, 'ai-auditor-deep-assurance-v6@16.14.0');
  assert.equal(body.automation.compatibilityCommit, 'ad11d7d5a623c1411cbabb4bb0cd9acf7975bce8');
});

test('current Phase 0 pointer returns bounded active projection instead of incompatibility', async () => {
  const response = await handleControllerRouteV2(request('/api/v1/controller/projects/vlsdt'), env());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.project.status, 'ACTIVE');
  assert.equal(body.project.launchAuthorized, false);
  assert.equal(body.project.phaseSequence, 0);
  assert.equal(body.project.controllerCommit, receipt.controllerCommit);
  assert.deepEqual(body.project.commandRouting, { available: false, reason: 'PHASE0_BOOTSTRAP_FENCED' });
  assert.equal(body.campaign.schemaVersion, 'controller-operator-state-v2');
  assert.equal(body.campaign.campaign.campaignId, pointer.campaignId);
  assert.equal(body.campaign.campaign.preflight.status, 'READY');
  assert.equal(body.campaign.controlPlane.bootstrapStatus, 'BOOTSTRAP_FENCED');
  assert.equal(body.campaign.controlPlane.claimAuthorized, false);
  assert.equal(body.campaign.controlPlane.sourceAccessAuthorized, false);
  assert.equal(body.campaign.controlPlane.substantiveWorkAuthorized, false);
  assert.equal(body.campaign.controlPlane.failoverStatus, 'HEALTHY');
  assert.equal(body.campaign.controlPlane.authorityState, 'ACTIVE');
  assert.equal(body.campaign.gates.length, 10);
  assert.equal(body.campaign.assignments.length, 7);
  assert.equal(body.campaign.instructionProofs.length, 1);
  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes('must-not-render-task-id'), false);
  assert.equal(serialized.includes('controller-token'), false);
});

test('pointer/receipt release mismatch fails closed', async () => {
  const bad = env();
  bad.AUDIT_CONTROLLER_FETCH = async (url) => {
    const marker = '/contents/';
    const raw = decodeURIComponent(new URL(url).pathname.split(marker)[1] ?? '');
    if (raw === '.deep-assurance/active/vlsdt.json') return envelope(pointer);
    if (raw === pointer.controllerCampaignCreateReceipt) return envelope({ ...receipt, controllerCommit: 'a'.repeat(40) });
    return new Response('{}', { status: 404 });
  };
  const response = await handleControllerRouteV2(request('/api/v1/controller/projects/vlsdt'), bad);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'controller_pointer_incompatible');
});
