import test from 'node:test';
import assert from 'node:assert/strict';
import { handleControllerRouteV2 } from '../src/controller-adapter-v2.mjs';

const campaignId = 'vlsdt-a47590c4dd9f68b7';
const generationId = 'gen-61557f73826c0da823349c1cc21ae864';
const workspace = 'campaigns/CurveYield-vlSDT-v20/';
const receiptPath = `${workspace}control/CONTROLLER_CAMPAIGN_CREATE_RECEIPT-v1.json`;
const controllerCommit = '48b031f06c7d7ed3573b42e371e123299722b451';
const skillRelease = 'ai-auditor-deep-assurance-v6@16.14.0';

const pointer = {
  schemaVersion: 'deep-assurance-active-pointer-v2', projectSlug: 'vlsdt', campaignId, campaignGenerationId: generationId,
  phaseSequence: 0, campaignIdentityImmutableAfterPhase0: true, status: 'ACTIVE', launchAuthorized: false, priorGenerationsAdmissible: false,
  sourceRepository: 'CurveYield/Audits', sourceCommit: '78b552bdf048a102d01f24804e273c02626327bf', sourceArchiveSha256: '4'.repeat(64),
  controllerCampaignCreateReceipt: receiptPath, requiredSkillPackageVersion: '16.14.0', requiredEmbeddedReleaseIdentity: skillRelease,
};
const receipt = {
  schemaVersion: 'controller-campaign-create-receipt-v1', campaignId, campaignGenerationId: generationId, controllerCommit, reducerSchemaVersion: 2,
  campaignCreateCommandId: 'campaign-create-v1', campaignActivateCommandId: 'campaign-activate-v1',
  instructionProofKey: 'phase0-proof', instructionProofAggregateDigest: '5'.repeat(64),
  preflight: { status: 'READY', capabilities: Object.fromEntries([
    'github-mailbox-v1','browser-agent-review-v1','github-native-compile-v1','github-native-simulate-v1','artifact-evidence-validation-v1','exact-release-verification-v1'
  ].map((name) => [name, true])) },
  source: { repository: pointer.sourceRepository, commit: pointer.sourceCommit }, sourceArchiveSha256: pointer.sourceArchiveSha256,
  stateStatus: 'ACTIVE', campaignCreatedEventHash: '7'.repeat(64), campaignActivatedEventHash: '8'.repeat(64),
  createdAt: '2026-08-08T06:49:30Z', activatedAt: '2026-08-08T06:49:31Z',
};
const topology = {
  schemaVersion: 'deep-assurance-controller-topology-v1', campaignId, campaignGenerationId: generationId,
  controllerRepository: 'CurveYield/audit-controller', controllerCommit, campaignCreateReceipt: receiptPath,
  requiredGateCount: 10, requiredLaneCount: 7,
  gates: Array.from({ length: 10 }, (_, i) => ({ gateId: `gate-${i}`, phaseId: `phase-${i}` })),
  lanes: Array.from({ length: 7 }, (_, i) => ({ roleId: `role-${i}`, cleanRoom: i < 4, controllerOwned: i === 6 })),
  assignmentClaimsAuthorized: false, substantiveWorkAuthorized: false,
};
const assignmentPlan = {
  schemaVersion: 'deep-assurance-assignment-plan-v1', campaignId, campaignGenerationId: generationId,
  status: 'BOOTSTRAP_FENCED', claimAuthorized: false, sourceAccessAuthorized: false,
  assignments: Array.from({ length: 7 }, (_, i) => ({ assignmentId: `assignment-${i}`, roleId: `role-${i}`, cleanRoom: i < 4, controllerOwned: i === 6, initialPhaseId: `phase-${i}` })),
};
const failover = { schemaVersion: 'orchestrator-failover-state-v1', campaignId, campaignGenerationId: generationId, status: 'HEALTHY', primaryTaskEnabled: false };
const lease = { schemaVersion: 'orchestrator-lease-v1', campaignId, campaignGenerationId: generationId, controlCommit: controllerCommit, authorityState: 'ACTIVE', primaryPollEnabledVerified: false, primaryPollTaskId: 'do-not-render' };

function encoded(value) {
  return new Response(JSON.stringify({ encoding: 'base64', content: Buffer.from(JSON.stringify(value)).toString('base64') }), { status: 200 });
}
function makeEnv(pointerValue = pointer) {
  const records = new Map([
    ['.deep-assurance/active/vlsdt.json', pointerValue],
    [receiptPath, receipt],
    [`${workspace}control/CONTROLLER_TOPOLOGY-v1.json`, topology],
    [`${workspace}control/ASSIGNMENT_PLAN-v1.json`, assignmentPlan],
    [`${workspace}control/FAILOVER_STATE-v1.json`, failover],
    [`${workspace}control/ORCHESTRATOR_LEASE-v1.json`, lease],
  ]);
  return {
    CLIENT_API_KEY: 'client-key', AUDIT_CONTROLLER_GITHUB_TOKEN: 'controller-token', CORS_ORIGIN: 'https://preflight.curveyield.online',
    AUDIT_CONTROLLER_FETCH: async (url) => {
      const raw = decodeURIComponent(new URL(url).pathname.split('/contents/')[1] ?? '');
      return records.has(raw) ? encoded(records.get(raw)) : new Response('{}', { status: 404 });
    },
  };
}
function request(path) { return new Request(`https://api.example${path}`, { headers: { authorization: 'Bearer client-key' } }); }

test('current Phase 0 campaign returns bounded operator projection and fenced command routing', async () => {
  const response = await handleControllerRouteV2(request('/api/v1/controller/projects/vlsdt'), makeEnv());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.adapterVersion, 'tier3-controller-adapter-v2');
  assert.equal(body.controller.compatibilityCommit, controllerCommit);
  assert.equal(body.controller.instructionReleaseIdentity, skillRelease);
  assert.equal(body.project.status, 'ACTIVE');
  assert.equal(body.project.launchAuthorized, false);
  assert.deepEqual(body.project.commandRouting, { available: false, reason: 'PHASE0_BOOTSTRAP_FENCED' });
  assert.equal(body.campaign.schemaVersion, 'controller-operator-state-v2');
  assert.equal(body.campaign.gates.length, 10);
  assert.equal(body.campaign.assignments.length, 7);
  assert.equal(body.campaign.controlPlane.bootstrapStatus, 'BOOTSTRAP_FENCED');
  assert.equal(body.campaign.controlPlane.substantiveWorkAuthorized, false);
  assert.equal(body.campaign.controlPlane.failoverStatus, 'HEALTHY');
  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes('do-not-render'), false);
  assert.equal(serialized.includes('controller-token'), false);
});

test('stale skill pointer fails closed before rendering project state', async () => {
  const response = await handleControllerRouteV2(request('/api/v1/controller/projects/vlsdt'), makeEnv({ ...pointer, requiredSkillPackageVersion: '16.13.0', requiredEmbeddedReleaseIdentity: 'ai-auditor-deep-assurance-v6@16.13.0' }));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'controller_pointer_incompatible');
});

test('compatibility route advertises current controller and automation pins', async () => {
  const response = await handleControllerRouteV2(request('/api/v1/controller/compatibility'), makeEnv());
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.controller.compatibilityCommit, controllerCommit);
  assert.equal(body.automation.compatibilityCommit, 'ad11d7d5a623c1411cbabb4bb0cd9acf7975bce8');
});
