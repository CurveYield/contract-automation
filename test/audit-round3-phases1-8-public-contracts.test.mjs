import test from 'node:test';
import assert from 'node:assert/strict';
import { assertAuditId } from '../packages/audit-protocol/src/index.mjs';
import {
  FREE_DEVELOPMENT_FORK_CAPABILITY,
  validateForkRequest,
  validateForkTransition,
  forkCurrentKey,
  tenantForkIndexKey
} from '../packages/audit-fork-protocol/src/index.mjs';
import {
  createCleanRoomPolicy,
  validateCleanRoomPolicy,
  createCampaignAccessContext,
  validateCampaignAccessContext,
  createShareGrant,
  validateShareGrant
} from '../packages/audit-clean-room-protocol/src/index.mjs';
import {
  createTerminalCampaignManifest,
  validateTerminalCampaignManifest,
  terminalEligibility
} from '../packages/audit-clean-room-campaigns/src/index.mjs';
import * as controlledMerge from '../packages/audit-controlled-merge/src/index.mjs';
import {
  createProvenanceEvent,
  validateProvenanceChain,
  validateProvenanceEvent
} from '../packages/audit-provenance/src/index.mjs';

const IDs = {
  tenant: `ten_${'1'.repeat(32)}`,
  workspace: `ws_${'2'.repeat(32)}`,
  campaign: `cmp_${'3'.repeat(32)}`,
  attempt: `att_${'4'.repeat(32)}`,
  fork: `fork_${'5'.repeat(32)}`,
  snapshot: `snap_${'6'.repeat(32)}`
};
const NOW='2026-08-02T02:00:00.000Z';
const LATER='2026-08-02T03:00:00.000Z';
const DIG=(c)=>`sha256:${c.repeat(64)}`;

test('Phase 1 and Phase 7 share exact tenant/workspace/campaign/attempt/fork identities',()=>{
  for(const [kind,value] of Object.entries(IDs)) assert.equal(assertAuditId(value,kind),value);
  assert.equal(forkCurrentKey(IDs.fork),`forks/${IDs.fork}/current-v1.json`);
  assert.equal(tenantForkIndexKey(IDs.tenant),`indexes/tenant/${IDs.tenant}/forks-v1.json`);
});

test('Phase 7 external fork requests remain awaiting executor and capability-disabled',()=>{
  assert.equal(FREE_DEVELOPMENT_FORK_CAPABILITY.executionEnabled,false);
  assert.equal(FREE_DEVELOPMENT_FORK_CAPABILITY.realCreateState,'awaiting_executor');
  const request=validateForkRequest({
    schemaVersion:'fork-request-v1',tenantId:IDs.tenant,workspaceId:IDs.workspace,campaignId:IDs.campaign,
    forkId:IDs.fork,attemptId:IDs.attempt,profileId:'free-development-v1',policyVersion:'fork-policy-v1',
    requesterId:'round3-reviewer',scopes:['audit:submit'],chainId:1,blockNumber:1,
    adapterKind:'external',executionGate:'awaiting_executor',createdAt:NOW,idempotencyKey:'round3-fork'
  });
  assert.equal(request.executionGate,'awaiting_executor');
  assert.deepEqual(validateForkTransition('requested','awaiting_executor'),{from:'requested',to:'awaiting_executor'});
});

test('Phase 8 clean-room policy/access/grants preserve tenant-workspace-campaign identity',()=>{
  const policy=createCleanRoomPolicy({tenantId:IDs.tenant,workspaceId:IDs.workspace,allowedScopes:['campaign:read','campaign:merge'],maxCampaigns:10,maxMergeInputs:8,maxFindings:100,maxEvidence:200,maxRelations:100,maxBytes:1000000,retentionDays:30,issuedAt:NOW});
  assert.equal(validateCleanRoomPolicy(policy).policyId,policy.policyId);
  const access=createCampaignAccessContext({tenantId:IDs.tenant,workspaceId:IDs.workspace,campaignId:IDs.campaign,requesterId:'reviewer',scopes:['campaign:read'],workspaceSourceDigest:DIG('a'),campaignRole:'reviewer',campaignState:'active',policyId:policy.policyId,decisionAt:NOW});
  assert.equal(validateCampaignAccessContext(access).campaignId,IDs.campaign);
  const grant=createShareGrant({tenantId:IDs.tenant,workspaceId:IDs.workspace,sourceCampaignId:IDs.campaign,targetCampaignId:'cmp_target',artifactId:'artifact-1',artifactDigest:DIG('b'),sourceDigest:DIG('c'),issuedAt:NOW,expiresAt:LATER});
  assert.equal(validateShareGrant(grant).workspaceId,IDs.workspace);
});

test('Phase 8 terminal manifests expose immutable merge eligibility only for completed campaigns',()=>{
  const manifest=createTerminalCampaignManifest({tenantId:IDs.tenant,workspaceId:IDs.workspace,campaignId:IDs.campaign,workspaceSourceDigest:DIG('a'),baseArtifactDigest:DIG('b'),terminalState:'completed',completionKind:'success',partialEvidence:false,truncated:false,policyId:'policy-1',profileVersions:['phase1-v1'],layerRefs:[],jobRefs:[],attemptRefs:[],evidenceRefs:[],reportRefs:[],findings:[],completedAt:NOW});
  assert.equal(validateTerminalCampaignManifest(manifest).mergeEligible,true);
  assert.deepEqual(terminalEligibility(manifest),{schemaVersion:'phase8-terminal-eligibility-v1',campaignId:IDs.campaign,eligible:true,reason:'eligible',manifestId:manifest.manifestId});
});

test('Phase 8 controlled-merge public module remains nonempty and transport-free',()=>{
  const names=Object.keys(controlledMerge).sort();
  assert.ok(names.length>=3);
  assert.equal(names.some((name)=>/rpc|wallet|sign|broadcast|deploy|execute/i.test(name)),false);
});

test('Phase 8 provenance chain remains immutable and execution-disabled',()=>{
  const first=createProvenanceEvent({eventId:'event-1',sequence:1,tenantId:IDs.tenant,workspaceId:IDs.workspace,campaignId:IDs.campaign,subjectType:'campaign',subjectId:IDs.campaign,subjectDigest:DIG('d'),action:'completed',actorId:'reviewer',policyId:'policy-1',previousDigest:null,occurredAt:NOW});
  const second=createProvenanceEvent({eventId:'event-2',sequence:2,tenantId:IDs.tenant,workspaceId:IDs.workspace,campaignId:IDs.campaign,subjectType:'report',subjectId:'report-1',subjectDigest:DIG('e'),action:'published',actorId:'reviewer',policyId:'policy-1',previousDigest:first.eventDigest,occurredAt:LATER});
  assert.equal(validateProvenanceEvent(first).executionEnabled,false);
  const chain=validateProvenanceChain([second,first]);
  assert.equal(chain.headDigest,second.eventDigest);
  assert.equal(chain.executionEnabled,false);
  assert.equal(Object.isFrozen(chain),true);
});
