import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { InMemoryAuditStore } from './audit-phase7-in-memory-store-v1.mjs';
import { ForkService } from '../packages/audit-forks/src/index.mjs';
import { checkpointObjectKey, sha256Hex } from '../packages/audit-fork-protocol/src/index.mjs';
import { LIMITS, canonicalJson, sha256, createCleanRoomPolicy, createCampaignAccessContext, createShareGrant, createShareGrantRevocation } from '../packages/audit-clean-room-protocol/src/index.mjs';
import { decideResourceVisibility, enforceHiddenResourceNonInterference, planConditionalIndexUpdate } from '../packages/audit-clean-room-access/src/index.mjs';
import { createTerminalCampaignManifest } from '../packages/audit-clean-room-campaigns/src/index.mjs';
import { createMergeRequest, createInitialMergeState, transitionMergeState, buildRelationMaps, planMergeStorageTransaction } from '../packages/audit-controlled-merge/src/index.mjs';
import { createProvenanceNode, createProvenanceEdge, createProvenanceIndex, createMergedReportReference, traceAuthorizedOrigins } from '../packages/audit-provenance/src/index.mjs';

const ts='2026-08-01T16:00:00.000Z';
const d=(c)=>`sha256:${c.repeat(64)}`;
const ref=(id,c)=>({id,digest:d(c)});
const phase7Ids={tenantId:`ten_${'1'.repeat(32)}`,workspaceId:`ws_${'2'.repeat(32)}`,campaignId:`cmp_${'3'.repeat(32)}`,forkId:`fork_${'4'.repeat(32)}`,attemptId:`att_${'5'.repeat(32)}`,checkpointId:`snap_${'6'.repeat(32)}`};
function forkRequest(){const {checkpointId,...requestIds}=phase7Ids;return {schemaVersion:'fork-request-v1',...requestIds,profileId:'free-development-v1',policyVersion:'fork-policy-v1',requesterId:'usr',scopes:['audit:read','audit:submit'],chainId:1,blockNumber:21_000_000,blockHash:`0x${'a'.repeat(64)}`,adapterKind:'mock',executionGate:'trusted_mock',createdAt:'2026-08-01T00:00:00.000Z',idempotencyKey:'round1'};}
function context(overrides={}){return createCampaignAccessContext({tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',requesterId:'user-a',scopes:['campaign:read','campaign:merge','campaign:share-base'],workspaceSourceDigest:d('a'),campaignRole:'owner',campaignState:'active',policyId:'policy-a',decisionAt:ts,...overrides});}
function terminal(campaignId,overrides={}){return createTerminalCampaignManifest({tenantId:'tenant-a',workspaceId:'workspace-a',campaignId,workspaceSourceDigest:d('a'),baseArtifactDigest:d('b'),terminalState:'completed',completionKind:'findings',partialEvidence:false,truncated:false,policyId:'policy-a',profileVersions:['profile-a-v1'],layerRefs:[ref(`layer-${campaignId}`,'1')],jobRefs:[ref(`job-${campaignId}`,'2')],attemptRefs:[ref(`attempt-${campaignId}`,'3')],evidenceRefs:[ref(`evidence-${campaignId}`,'4')],reportRefs:[ref(`report-${campaignId}`,'5')],findings:[{findingId:`finding-${campaignId}`,identityKey:'identity-a',severity:'high',status:'open',remediation:'upgrade',location:'contracts-a-sol-10',materialDigest:d('6'),evidenceRefs:[ref(`evidence-${campaignId}`,'4')]}],completedAt:ts,...overrides});}

class FailOnceStore {
  constructor(predicate){this.inner=new InMemoryAuditStore();this.predicate=predicate;this.failed=false;}
  async put(key,value,options){if(!this.failed&&this.predicate('put',key,value)){this.failed=true;throw new Error('injected');}return this.inner.put(key,value,options);}
  async get(key){return this.inner.get(key);} async head(key){return this.inner.head(key);}
  async delete(key){if(!this.failed&&this.predicate('delete',key)){this.failed=true;throw new Error('injected');}return this.inner.delete(key);}
}

test('Phase 7 real requests remain awaiting_executor and trusted mock alone becomes ready',async()=>{
  const external=new ForkService(new InMemoryAuditStore());
  assert.equal((await external.createFork({...forkRequest(),adapterKind:'external',executionGate:'awaiting_executor'})).state,'awaiting_executor');
  const mock=new ForkService(new InMemoryAuditStore());
  assert.equal((await mock.createFork(forkRequest())).state,'ready');
});

test('Phase 7 deletion enters deleting before destructive work and exact retry converges',async()=>{
  const store=new FailOnceStore((method,key)=>method==='delete'&&key.includes('/checkpoints/')&&key.endsWith('.bin'));
  const service=new ForkService(store);await service.createFork(forkRequest());
  const bytes=new Uint8Array([1,2,3]);const objectKey=checkpointObjectKey(phase7Ids.forkId,phase7Ids.checkpointId);
  await service.publishCheckpoint({manifest:{schemaVersion:'fork-checkpoint-manifest-v1',checkpointId:phase7Ids.checkpointId,forkId:phase7Ids.forkId,tenantId:phase7Ids.tenantId,attemptId:phase7Ids.attemptId,chainId:1,blockNumber:21_000_000,blockHash:`0x${'a'.repeat(64)}`,objectKey,sha256:await sha256Hex(bytes),bytes:bytes.byteLength,contentType:'application/octet-stream',opaque:true,encryption:{mode:'client-managed',keyReference:'opaque'},createdAt:'2026-08-01T00:30:00.000Z',expiresAt:'2026-08-02T00:30:00.000Z'},bytes});
  const deletion={forkId:phase7Ids.forkId,tenantId:phase7Ids.tenantId,attemptId:phase7Ids.attemptId,occurredAt:'2026-08-01T02:00:00.000Z',reason:'round1'};
  await assert.rejects(()=>service.deleteFork(deletion),/injected/);assert.equal((await service.readFork({forkId:phase7Ids.forkId,tenantId:phase7Ids.tenantId,attemptId:phase7Ids.attemptId})).state,'deleting');
  assert.equal((await service.deleteFork(deletion)).state,'deleted');assert.equal((await service.deleteFork(deletion)).state,'deleted');
});

test('Phase 8 portable SHA-256 and encoded byte boundary are exact',()=>{
  assert.equal(sha256('abc'),'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const exact='a'.repeat(LIMITS.bytes-2);assert.equal(new TextEncoder().encode(canonicalJson(exact)).byteLength,LIMITS.bytes);
  assert.throws(()=>canonicalJson(`${exact}a`),{code:'encoded_bytes_exceeded'});
});

test('Phase 8 policy output is deterministic and recursively frozen',()=>{
  const input={tenantId:'tenant-a',workspaceId:'workspace-a',allowedScopes:['campaign:write','campaign:read','campaign:merge','campaign:share-base'],maxCampaigns:100,maxMergeInputs:16,maxFindings:1000,maxEvidence:2000,maxRelations:1000,maxBytes:2_000_000,retentionDays:90,issuedAt:ts};
  const first=createCleanRoomPolicy(input),second=createCleanRoomPolicy({...input,allowedScopes:[...input.allowedScopes].reverse()});
  assert.deepEqual(first,second);assert.equal(Object.isFrozen(first.allowedScopes),true);
});

test('Phase 8 visibility applies read scope and role-state matrix',()=>{
  const resource={kind:'report',tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',resourceId:'report-a',resourceDigest:d('b'),sourceDigest:d('a')};
  const allowed=new Set(['owner:active','owner:terminal','owner:archived','reviewer:active','reviewer:terminal','reviewer:archived','operator:active','operator:terminal','reader:active','reader:terminal','reader:archived']);
  for(const role of ['owner','reviewer','operator','reader'])for(const state of ['active','terminal','archived']){
    assert.equal(decideResourceVisibility({context:context({campaignRole:role,campaignState:state}),resource,grants:[],revocations:[],at:ts}).visible,allowed.has(`${role}:${state}`));
    assert.equal(decideResourceVisibility({context:context({campaignRole:role,campaignState:state,scopes:[]}),resource,grants:[],revocations:[],at:ts}).visible,false);
  }
});

test('Phase 8 exact base-artifact grant permits only matching immutable object and revocation hides it',()=>{
  const grant=createShareGrant({tenantId:'tenant-a',workspaceId:'workspace-a',sourceCampaignId:'campaign-b',targetCampaignId:'campaign-a',artifactId:'base-a',artifactDigest:d('b'),sourceDigest:d('a'),issuedAt:ts,expiresAt:'2026-08-03T16:00:00.000Z'});
  const resource={kind:'base_artifact',tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-b',resourceId:'base-a',resourceDigest:d('b'),sourceDigest:d('a')};
  assert.equal(decideResourceVisibility({context:context(),resource,grants:[grant],revocations:[],at:'2026-08-02T16:00:00.000Z'}).visible,true);
  const revocation=createShareGrantRevocation({grantId:grant.grantId,grantDigest:grant.grantDigest,revokedAt:'2026-08-02T16:00:00.000Z',reasonCode:'owner-revoked'});
  const hidden=decideResourceVisibility({context:context(),resource,grants:[grant],revocations:[revocation],at:'2026-08-02T16:00:00.000Z'});
  assert.equal(hidden.visible,false);assert.equal(enforceHiddenResourceNonInterference(hidden).total,0);
});

test('Phase 8 index key is server-derived and operation vocabulary is canonical',()=>{
  const etag=d('e');const plan=planConditionalIndexUpdate({tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',indexKind:'campaigns',currentEtag:etag,expectedEtag:etag,recordId:'campaign-a',recordDigest:d('c'),estimatedBytes:1024});
  assert.equal(plan.indexKey,'tenants/tenant-a/workspaces/workspace-a/indexes/campaigns-v1.json');assert.deepEqual(plan.operations.map((item)=>item.class),['class-b','class-a']);
  assert.throws(()=>planConditionalIndexUpdate({...plan,indexKey:'attacker'}),{code:'unknown_field'});
});

test('Phase 8 terminal and merge identity are input-order invariant',()=>{
  const a=terminal('campaign-a'),b=terminal('campaign-b');const common={policyId:'policy-a',requestedBy:'user-a',requestedAt:ts,idempotencyKey:'round1',expectedCurrentEtag:d('e')};
  assert.equal(canonicalJson(createMergeRequest({...common,terminalManifests:[a,b]})),canonicalJson(createMergeRequest({...common,terminalManifests:[b,a]})));
});

test('Phase 8 merge state CAS and terminal transition table reject stale or invalid writes',()=>{
  const request=createMergeRequest({terminalManifests:[terminal('campaign-a'),terminal('campaign-b')],policyId:'policy-a',requestedBy:'user-a',requestedAt:ts,idempotencyKey:'round1-state',expectedCurrentEtag:d('e')});
  let state=createInitialMergeState(request,ts);for(const to of ['validating','admitted','resolving_relations','building_provenance','publishing','completed'])state=transitionMergeState(state,{to,expectedEtag:state.etag,at:ts,reasonCode:`enter-${to}`}).state;
  assert.equal(state.state,'completed');assert.throws(()=>transitionMergeState(state,{to:'failed',expectedEtag:state.etag,at:ts,reasonCode:'late'}),{code:'invalid_transition'});
});

test('Phase 8 duplicate and conflict relations preserve all original finding digests',()=>{
  const f=(id,campaignId,overrides={})=>({findingId:id,campaignId,identityKey:'identity-a',severity:'high',status:'open',remediation:'upgrade',location:'contracts-a-sol-10',materialDigest:d('f'),evidenceRefs:[ref(`evidence-${campaignId}`,'e')],...overrides});
  const input=[f('finding-a','campaign-a'),f('finding-b','campaign-b'),f('finding-c','campaign-c',{severity:'critical',materialDigest:d('9')})];
  const maps=buildRelationMaps(input);assert.equal(maps.duplicateRelations.length,1);assert.equal(maps.conflictRelations.length,1);assert.equal(maps.originalFindingDigests.length,3);
  assert.equal(canonicalJson(maps),canonicalJson(buildRelationMaps([...input].reverse())));
});

test('Phase 8 provenance rejects dangling graphs and hides unauthorized origins',()=>{
  const source=createProvenanceNode({nodeId:'source-a',type:'source',tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:null,digest:d('a'),sourceRef:null});
  const campaign=createProvenanceNode({nodeId:'campaign-a',type:'campaign',tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',digest:d('b'),sourceRef:'source-a'});
  const finding=createProvenanceNode({nodeId:'finding-a',type:'finding',tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',digest:d('c'),sourceRef:'campaign-a'});
  const index=createProvenanceIndex({tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:'merge-a',nodes:[source,campaign,finding],edges:[createProvenanceEdge({type:'derived_from',from:'campaign-a',to:'source-a'}),createProvenanceEdge({type:'produced',from:'campaign-a',to:'finding-a'})],createdAt:ts});
  assert.equal(traceAuthorizedOrigins(index,{nodeId:'finding-a',visibleCampaignIds:[]}).status,'not_found');
  assert.throws(()=>createProvenanceIndex({tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:'merge-a',nodes:[source],edges:[createProvenanceEdge({type:'references',from:'missing-a',to:'source-a'})],createdAt:ts}),{code:'dangling_reference'});
});

test('Phase 8 report references reject executable, credential, URL, and host-path labels',()=>{
  const base={tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:'merge-a',sourceCampaignId:'campaign-a',sourceState:'complete',reportId:'report-a',reportDigest:d('d'),evidenceRefs:[ref('evidence-a','e')],createdAt:ts};
  for(const label of ['<script>x</script>','Authorization: Bearer token','PRIVATE_KEY=x','C:\\Users\\x','/home/x','https://x'])assert.throws(()=>createMergedReportReference({...base,label}),{code:'unsafe_report_content'});
});

test('Phase 8 typical merge storage plan is exactly 4A/4B and never lists prefixes',()=>{
  const etag=d('e');const plan=planMergeStorageTransaction({tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:'merge-a',terminalManifestIds:['campaign-a','campaign-b'],currentEtag:etag,expectedEtag:etag,retainedBytes:2_000_000,retentionDays:90,existingImmutableDigests:[],quota:{maxInputs:16,maxBytes:3_000_000,maxRetentionDays:90}});
  assert.deepEqual(plan.summary,{classA:4,classB:4,retainedBytes:2_000_000,retentionDays:90,variant:'typical-4a-4b-2mb-90d'});assert.equal(plan.usesPrefixListing,false);
});

test('Phase 7 and Phase 8 production trees remain execution-disabled and cross-phase isolated',async()=>{
  const roots=['packages/audit-fork-protocol','packages/audit-forks','packages/audit-fork-mock-adapter','packages/audit-clean-room-protocol','packages/audit-clean-room-access','packages/audit-clean-room-campaigns','packages/audit-controlled-merge','packages/audit-provenance'];
  const forbidden=/\b(?:fetch|spawn|exec|eval)\s*\(|from\s+['"]node:(?:child_process|net|http|https)['"]|AUDIT_EXECUTION_ENABLED\s*=\s*true|\b(?:new\s+WebSocket|broadcastTransaction\s*\(|deployContract\s*\()/;
  for(const root of roots){for(const name of await readdir(join(root,'src'))){if(!name.endsWith('.mjs'))continue;const source=await readFile(join(root,'src',name),'utf8');assert.doesNotMatch(source,forbidden,`${root}/${name}`);}}
});