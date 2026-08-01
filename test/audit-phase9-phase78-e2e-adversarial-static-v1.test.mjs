import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  createServiceRequest, validateServiceRequest, authorizePhase78Operation, planPhase78Operation, canonicalJson
} from '../packages/audit-phase78-service/src/index.mjs';
import { createForkReportProjection, createCheckpointReportProjection, createExportReportProjection } from '../packages/audit-fork-reporting/src/index.mjs';
import { createCampaignReportProjection, createMergeReportProjection, createHiddenReportProjection, createProvenanceReportProjection } from '../packages/audit-clean-room-reporting/src/index.mjs';
import { planImmutablePublication, planMutablePointerPublication, planPublicationRecovery } from '../packages/audit-phase78-publication/src/index.mjs';
const ts='2026-08-01T23:40:00.000Z';const d=(c)=>`sha256:${c.repeat(64)}`;
const payloads={
'fork.create':{adapterKind:'external',chainId:1,blockNumber:1,blockHash:null},'fork.read':{},'fork.action':{actionId:'action-a',actionType:'inspect-state',payloadDigest:d('a')},'fork.checkpoint':{checkpointId:'snapshot-a',manifestDigest:d('b')},'fork.export':{checkpointId:'snapshot-a',exportId:'export-a'},'fork.delete':{reason:'user-request'},'campaign.create':{sourceDigest:d('c'),policyId:'policy-a'},'campaign.read':{},'share.create':{grantId:'grant-a',artifactId:'artifact-a',artifactDigest:d('d')},'share.revoke':{grantId:'grant-a',reason:'owner-revoked'},'merge.create':{terminalManifestDigests:[d('1'),d('2')],policyId:'policy-a'},'merge.read':{},'provenance.read':{nodeId:'finding-a'},'report.read':{reportId:'report-a'},'report.publish':{reportId:'report-a',reportDigest:d('e')}
};
function service(operation,tenant='tenant-a',campaign='campaign-a',overrides={}){return createServiceRequest({operation,tenantId:tenant,workspaceId:`workspace-${tenant.at(-1)}`,campaignId:campaign,forkId:operation.startsWith('fork.')?`fork-${tenant.at(-1)}`:null,mergeId:operation.startsWith('merge.')?`merge-${tenant.at(-1)}`:null,requesterId:`user-${tenant.at(-1)}`,scopes:operation.startsWith('fork.')?['audit:read','audit:submit']:['campaign:read','campaign:write','campaign:merge','campaign:share-base'],idempotencyKey:`${operation}-${tenant}-${campaign}`,expectedVersion:null,expectedEtag:null,requestedAt:ts,payload:payloads[operation],...overrides});}

test('multi-tenant fork to checkpoint/export reporting remains scope-bound',()=>{
  for(const tenant of ['tenant-a','tenant-b']){
    const request=service('fork.create',tenant,`campaign-${tenant.at(-1)}`,{payload:{adapterKind:'external',chainId:1,blockNumber:1,blockHash:null}});
    const auth=authorizePhase78Operation(request,{forkState:null,allowCreate:true});const plan=planPhase78Operation({request,authorization:auth,current:null});assert.equal(plan.resultStatus,'awaiting_executor');
    const state={forkId:`fork-${tenant.at(-1)}`,tenantId:tenant,attemptId:`attempt-${tenant.at(-1)}`,requestDigest:request.requestDigest,state:'awaiting_executor',version:2,executionGate:'awaiting_executor',adapterKind:'external',chainId:1,blockNumber:1,blockHash:null,createdAt:ts,updatedAt:ts,lastTransitionId:'tr-a',lastFromState:'requested'};
    assert.equal(createForkReportProjection({state,requestedBy:`user-${tenant.at(-1)}`,reportedAt:ts}).tenantId,tenant);
    const cp=createCheckpointReportProjection({manifest:{checkpointId:`snapshot-${tenant.at(-1)}`,forkId:state.forkId,tenantId:tenant,attemptId:state.attemptId,objectKey:`forks/${state.forkId}/checkpoints/snapshot.bin`,sha256:'a'.repeat(64),bytes:1,createdAt:ts,expiresAt:'2026-08-02T23:40:00.000Z'},reportedAt:ts});
    const exp=createExportReportProjection({manifest:{exportId:`export-${tenant.at(-1)}`,forkId:state.forkId,tenantId:tenant,checkpointId:cp.checkpointId,sourceObjectKey:cp.objectKey,sourceSha256:cp.sha256,createdAt:ts,expiresAt:'2026-08-08T23:40:00.000Z'},reportedAt:ts});assert.equal(exp.tenantId,tenant);
  }
});

test('campaign to merge report and publication converges after partial failure',()=>{
  const request=service('report.publish','tenant-a','campaign-a',{mergeId:'merge-a',expectedVersion:2,expectedEtag:d('e'),payload:{reportId:'report-a',reportDigest:d('a')}});
  const campaign=createCampaignReportProjection({manifest:{manifestId:'terminal-a',manifestDigest:d('1'),tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',terminalState:'completed',completionKind:'findings',partialEvidence:false,truncated:false,mergeEligible:true,inventorySummary:{findingCount:1,evidenceCount:1,severity:{critical:0,high:1,moderate:0,low:0,unknown:0}},completedAt:ts},reportedAt:ts});
  const merge=createMergeReportProjection({manifest:{manifestId:'merge-manifest-a',manifestDigest:d('2'),mergeId:'merge-a',requestDigest:d('3'),finalState:'completed',terminalManifestDigests:[campaign.manifestDigest,d('4')],duplicateMapDigest:d('5'),conflictMapDigest:d('6'),provenanceIndexDigest:d('7'),mergedReportRefs:[],policyId:'policy-a',operationSummary:{classA:4,classB:4,retainedBytes:2000000,retentionDays:90,variant:'typical'},publishedAt:ts},reportedAt:ts});
  const immutable=planImmutablePublication({request,records:[{kind:'campaign-report',id:campaign.reportId,digest:campaign.reportDigest,bytes:1000,retentionDays:90},{kind:'merge-report',id:merge.reportId,digest:merge.reportDigest,bytes:2000,retentionDays:90}]});
  const pointer=planMutablePointerPublication({request,current:{version:2,etag:d('e')},pointer:{kind:'merge-current',id:'merge-a',digest:merge.reportDigest,bytes:256}});
  const recovery=planPublicationRecovery({request,plannedDigests:immutable.operations.map(x=>x.digest).concat(pointer.operations.map(x=>x.digest)),completedDigests:[immutable.operations[0].digest],failedStep:'immutable-write'});
  assert.equal(recovery.retrySafe,true);assert.equal(recovery.remainingDigests.length,2);
});

test('cross-tenant substitutions and hidden-name collisions remain indistinguishable',()=>{
  const request=service('campaign.read','tenant-a','campaign-shared');
  const denied=authorizePhase78Operation(request,{accessContext:{tenantId:'tenant-b',workspaceId:'workspace-b',campaignId:'campaign-shared',requesterId:'user-a',scopes:['campaign:read'],campaignRole:'owner',campaignState:'active'}});
  assert.equal(denied.allowed,false);
  assert.equal(canonicalJson(createHiddenReportProjection({resourceKind:'campaign',reportedAt:ts,internalReason:'tenant_mismatch'})),canonicalJson(createHiddenReportProjection({resourceKind:'campaign',reportedAt:ts,internalReason:'missing'})));
});

test('one-field mutation corpus rejects every public request identity field',()=>{
  const request=service('fork.read');let count=0;
  for(const key of Object.keys(request)){
    const copy=structuredClone(request);
    if(key==='schemaVersion')copy[key]='wrong';else if(key.endsWith('Digest'))copy[key]=d('f');else if(key==='requestedAt')copy[key]='bad';else if(typeof copy[key]==='number')copy[key]=-0;else if(typeof copy[key]==='boolean')copy[key]=!copy[key];else if(Array.isArray(copy[key]))copy[key]=[];else if(key==='payload')copy[key]={command:'x'};else if(copy[key]&&typeof copy[key]==='object')copy[key]={unexpected:true};else copy[key]='*';
    assert.throws(()=>validateServiceRequest(copy),error=>typeof error?.code==='string');count++;
  }
  assert.ok(count>=16);
});


test('oversized provenance graphs reject before traversal',()=>{
  const index={indexId:'provenance-a',indexDigest:d('a'),mergeId:'merge-a',nodes:Array(200001).fill({nodeId:'node-a',campaignId:null,type:'source',digest:d('1')}),edges:[]};
  assert.throws(()=>createProvenanceReportProjection({index,nodeId:'node-a',visibleCampaignIds:[],reportedAt:ts}),{code:'collection_too_large'});
});

test('production modules have no prohibited execution capability',async()=>{
  const roots=['packages/audit-phase78-service','packages/audit-fork-reporting','packages/audit-clean-room-reporting','packages/audit-phase78-publication'];
  const forbidden=[/\bfetch\s*\(/,/node:child_process/,/node:net/,/node:http/,/node:https/,/WebSocket/,/\bprocess\s*\./,/\beval\s*\(/,/new Function\s*\(/,/\b(?:npm|pnpm|yarn|docker|podman|kubectl)\b/,/privateKey|mnemonic|broadcastTransaction|deployContract|rpcUrl|https?:\/\//,/executionEnabled\s*:\s*true/];
  let files=0;
  for(const root of roots){for(const name of await readdir(join(root,'src'))){if(!name.endsWith('.mjs'))continue;files++;const text=await readFile(join(root,'src',name),'utf8');for(const pattern of forbidden)assert.doesNotMatch(text,pattern,`${root}/${name}`);}}
  assert.ok(files>=10);
});
