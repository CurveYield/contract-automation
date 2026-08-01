import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson } from '../packages/audit-clean-room-protocol/src/index.mjs';
import { createTerminalCampaignManifest, validateTerminalCampaignManifest, terminalEligibility } from '../packages/audit-clean-room-campaigns/src/index.mjs';
import {
  createMergeRequest, validateMergeRequest, createInitialMergeState, validateMergeState,
  transitionMergeState, buildRelationMaps, createDuplicateRelation, createConflictRelation
} from '../packages/audit-controlled-merge/src/index.mjs';

const ts='2026-08-01T16:00:00.000Z';
const t2='2026-08-01T16:01:00.000Z';
const d=(c)=>`sha256:${c.repeat(64)}`;
const ref=(id,c)=>({id,digest:d(c)});
const finding=(id,campaignId,overrides={})=>({findingId:id,campaignId,identityKey:'identity-a',severity:'high',status:'open',remediation:'upgrade',location:'contracts-a-sol-10',materialDigest:d('f'),evidenceRefs:[ref(`evidence-${campaignId}`,'e')],...overrides});
const manifestInput=(campaignId,overrides={})=>({
  tenantId:'tenant-a',workspaceId:'workspace-a',campaignId,workspaceSourceDigest:d('a'),baseArtifactDigest:d('b'),
  terminalState:'completed',completionKind:'findings',partialEvidence:false,truncated:false,policyId:'policy-a',profileVersions:['profile-a-v1'],
  layerRefs:[ref(`layer-${campaignId}`,'c')],jobRefs:[ref(`job-${campaignId}`,'d')],attemptRefs:[ref(`attempt-${campaignId}`,'e')],
  evidenceRefs:[ref(`evidence-${campaignId}`,'e')],reportRefs:[ref(`report-${campaignId}`,'d')],
  findings:[{findingId:`finding-${campaignId}`,identityKey:'identity-a',severity:'high',status:'open',remediation:'upgrade',location:'contracts-a-sol-10',materialDigest:d('f'),evidenceRefs:[ref(`evidence-${campaignId}`,'e')]}],
  completedAt:ts,...overrides
});

test('terminal manifest derives inventory, identity, digest, eligibility, and freeze',()=>{
  const manifest=createTerminalCampaignManifest(manifestInput('campaign-a'));
  assert.equal(manifest.inventorySummary.findingCount,1);
  assert.equal(manifest.inventorySummary.evidenceCount,1);
  assert.equal(manifest.inventorySummary.severity.high,1);
  assert.equal(manifest.mergeEligible,true);
  assert.equal(Object.isFrozen(manifest),true);
  assert.deepEqual(validateTerminalCampaignManifest(manifest),manifest);
});

test('terminal state and completion semantics are explicit',()=>{
  const cases=[
    ['completed','success',false,false,true],['completed','findings',false,false,true],['completed','partial',true,false,true],['completed','truncated',false,true,true],
    ['failed','failed',false,false,false],['cancelled','cancelled',false,false,false],['policy_rejected','policy_rejected',false,false,false]
  ];
  for(const [terminalState,completionKind,partialEvidence,truncated,eligible] of cases){
    const manifest=createTerminalCampaignManifest(manifestInput(`campaign-${terminalState}-${completionKind}`,{terminalState,completionKind,partialEvidence,truncated,findings:completionKind==='success'?[]:manifestInput('x').findings}));
    assert.equal(manifest.mergeEligible,eligible);
    assert.equal(terminalEligibility(manifest).eligible,eligible);
  }
  assert.throws(()=>createTerminalCampaignManifest(manifestInput('campaign-bad',{terminalState:'failed',completionKind:'success'})),{code:'terminal_contradiction'});
});

test('terminal inventory and identity drift are rejected',()=>{
  const manifest=createTerminalCampaignManifest(manifestInput('campaign-a'));
  const inventory=structuredClone(manifest);inventory.inventorySummary.findingCount=99;
  assert.throws(()=>validateTerminalCampaignManifest(inventory),{code:'inventory_mismatch'});
  const digestMutated=structuredClone(manifest);digestMutated.manifestDigest=d('0');
  assert.throws(()=>validateTerminalCampaignManifest(digestMutated),{code:'digest_mismatch'});
});

test('merge request sorts exact approved terminal manifests and is permutation invariant',()=>{
  const a=createTerminalCampaignManifest(manifestInput('campaign-a'));
  const b=createTerminalCampaignManifest(manifestInput('campaign-b'));
  const input={terminalManifests:[b,a],policyId:'policy-a',requestedBy:'user-a',requestedAt:ts,idempotencyKey:'request-a',expectedCurrentEtag:d('e')};
  const first=createMergeRequest(input);
  const reversed=createMergeRequest({...input,terminalManifests:[a,b]});
  assert.deepEqual(reversed,first);
  assert.deepEqual(first.campaignManifestRefs.map((x)=>x.campaignId),['campaign-a','campaign-b']);
  assert.deepEqual(validateMergeRequest(first),first);
});

test('merge request rejects ineligible, cross-tenant, cross-workspace, source drift, and duplicates',()=>{
  const a=createTerminalCampaignManifest(manifestInput('campaign-a'));
  const base=(other)=>({terminalManifests:[a,other],policyId:'policy-a',requestedBy:'user-a',requestedAt:ts,idempotencyKey:'request-a',expectedCurrentEtag:d('e')});
  assert.throws(()=>createMergeRequest(base(createTerminalCampaignManifest(manifestInput('campaign-b',{terminalState:'failed',completionKind:'failed'})))),{code:'campaign_ineligible'});
  assert.throws(()=>createMergeRequest(base(createTerminalCampaignManifest(manifestInput('campaign-b',{tenantId:'tenant-b'})))),{code:'tenant_mismatch'});
  assert.throws(()=>createMergeRequest(base(createTerminalCampaignManifest(manifestInput('campaign-b',{workspaceId:'workspace-b'})))),{code:'workspace_mismatch'});
  assert.throws(()=>createMergeRequest(base(createTerminalCampaignManifest(manifestInput('campaign-b',{workspaceSourceDigest:d('c')})))),{code:'source_mismatch'});
  assert.throws(()=>createMergeRequest(base(a)),{code:'duplicate_identity'});
});

test('merge state machine enforces exact CAS and allowed transitions',()=>{
  const request=createMergeRequest({terminalManifests:[createTerminalCampaignManifest(manifestInput('campaign-a')),createTerminalCampaignManifest(manifestInput('campaign-b'))],policyId:'policy-a',requestedBy:'user-a',requestedAt:ts,idempotencyKey:'request-a',expectedCurrentEtag:d('e')});
  let state=createInitialMergeState(request,ts);assert.deepEqual(validateMergeState(state),state);
  const path=['validating','admitted','resolving_relations','building_provenance','publishing','completed'];
  for(const to of path){const result=transitionMergeState(state,{to,expectedEtag:state.etag,at:t2,reasonCode:`enter-${to}`});assert.equal(result.event.from,state.state);assert.equal(result.event.to,to);state=result.state;}
  assert.equal(state.state,'completed');
  assert.throws(()=>transitionMergeState(state,{to:'failed',expectedEtag:state.etag,at:t2,reasonCode:'late'}),{code:'invalid_transition'});
  const initial=createInitialMergeState(request,ts);assert.throws(()=>transitionMergeState(initial,{to:'validating',expectedEtag:d('0'),at:t2,reasonCode:'stale'}),{code:'stale_write'});
});

test('duplicate map preserves originals and is order-independent',()=>{
  const inputs=[finding('finding-a','campaign-a'),finding('finding-b','campaign-b')];
  const snapshot=structuredClone(inputs);
  const forward=buildRelationMaps(inputs),reverse=buildRelationMaps([...inputs].reverse());
  assert.equal(canonicalJson(forward),canonicalJson(reverse));
  assert.equal(forward.duplicateRelations.length,1);assert.equal(forward.conflictRelations.length,0);
  assert.equal(forward.duplicateRelations[0].members.length,2);
  assert.deepEqual(inputs,snapshot);
  assert.deepEqual(createDuplicateRelation(inputs),forward.duplicateRelations[0]);
});

test('conflict map preserves every competing value and stable field paths',()=>{
  const inputs=[finding('finding-a','campaign-a'),finding('finding-b','campaign-b',{severity:'critical',status:'accepted',remediation:'replace',materialDigest:d('9')})];
  const forward=buildRelationMaps(inputs),reverse=buildRelationMaps([...inputs].reverse());
  assert.equal(canonicalJson(forward),canonicalJson(reverse));
  assert.equal(forward.conflictRelations.length,1);
  assert.deepEqual(forward.conflictRelations[0].conflictFields,['severity','status','remediation','materialDigest']);
  assert.equal(forward.conflictRelations[0].values.length,2);
  assert.deepEqual(createConflictRelation(inputs),forward.conflictRelations[0]);
});

test('same comparison key may contain exact duplicate subgroup plus a conflict without first-wins loss',()=>{
  const inputs=[finding('finding-a','campaign-a'),finding('finding-b','campaign-b'),finding('finding-c','campaign-c',{severity:'critical',materialDigest:d('9')})];
  const maps=buildRelationMaps(inputs);
  assert.equal(maps.duplicateRelations.length,1);assert.equal(maps.conflictRelations.length,1);
  assert.equal(maps.conflictRelations[0].values.length,3);
  assert.deepEqual(maps.originalFindingDigests,[d('9'),d('f'),d('f')].sort());
});

test('relation inputs reject duplicate finding identities, cycles, custom prototypes, and oversized arrays',()=>{
  const one=finding('finding-a','campaign-a');
  assert.throws(()=>buildRelationMaps([one,structuredClone(one)]),{code:'duplicate_identity'});
  const cyclic=structuredClone(one);cyclic.evidenceRefs.push(cyclic);assert.throws(()=>buildRelationMaps([cyclic]),(error)=>['invalid_object','cycle','unknown_field'].includes(error.code));
  assert.throws(()=>buildRelationMaps([Object.assign(Object.create({}),one)]),{code:'invalid_prototype'});
  assert.throws(()=>buildRelationMaps(Array.from({length:100_001},(_,i)=>finding(`finding-${i}`,'campaign-a'))),{code:'collection_too_large'});
});
