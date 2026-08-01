import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createServiceRequest, authorizePhase78Operation, planPhase78Operation, createRetryPlan
} from '../packages/audit-phase78-service/src/index.mjs';
const ts='2026-08-01T23:40:00.000Z';
const d=(c)=>`sha256:${c.repeat(64)}`;
const payloads={
'fork.create':{adapterKind:'external',chainId:1,blockNumber:1,blockHash:null},'fork.read':{},'fork.action':{actionId:'action-a',actionType:'inspect-state',payloadDigest:d('a')},'fork.checkpoint':{checkpointId:'snapshot-a',manifestDigest:d('b')},'fork.export':{checkpointId:'snapshot-a',exportId:'export-a'},'fork.delete':{reason:'user-request'},'campaign.create':{sourceDigest:d('c'),policyId:'policy-a'},'campaign.read':{},'share.create':{grantId:'grant-a',artifactId:'artifact-a',artifactDigest:d('d')},'share.revoke':{grantId:'grant-a',reason:'owner-revoked'},'merge.create':{terminalManifestDigests:[d('1'),d('2')],policyId:'policy-a'},'merge.read':{},'provenance.read':{nodeId:'finding-a'},'report.read':{reportId:'report-a'},'report.publish':{reportId:'report-a',reportDigest:d('e')}
};
function req(operation,overrides={}){return createServiceRequest({operation,tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:operation.startsWith('fork.')?'campaign-a':'campaign-a',forkId:operation.startsWith('fork.')?'fork-a':null,mergeId:operation.startsWith('merge.')?'merge-a':null,requesterId:'user-a',scopes:operation.startsWith('fork.')?['audit:read','audit:submit']:['campaign:read','campaign:write','campaign:merge','campaign:share-base'],idempotencyKey:`key-${operation.replace('.','-')}`,expectedVersion:null,expectedEtag:null,requestedAt:ts,payload:payloads[operation],...overrides});}
const access={schemaVersion:'phase8-campaign-access-context-v1',tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',requesterId:'user-a',scopes:['campaign:read','campaign:write','campaign:merge','campaign:share-base'],workspaceSourceDigest:d('a'),campaignRole:'owner',campaignState:'active',policyId:'policy-a',decisionAt:ts};

test('fork operation authorization requires exact identity and scopes',()=>{
  assert.equal(authorizePhase78Operation(req('fork.read'),{forkState:{tenantId:'tenant-a',forkId:'fork-a',state:'ready'}}).allowed,true);
  assert.equal(authorizePhase78Operation(req('fork.delete'),{forkState:{tenantId:'tenant-a',forkId:'fork-a',state:'ready'}}).allowed,true);
  assert.equal(authorizePhase78Operation(req('fork.delete',{scopes:['audit:read']}),{forkState:{tenantId:'tenant-a',forkId:'fork-a',state:'ready'}}).reason,'scope_missing');
  assert.equal(authorizePhase78Operation(req('fork.read'),{forkState:{tenantId:'tenant-b',forkId:'fork-a',state:'ready'}}).reason,'tenant_mismatch');
  assert.equal(authorizePhase78Operation(req('fork.read'),{forkState:null}).reason,'resource_hidden');
});

test('campaign operations compose exact read/write/merge/share scope and role-state rules',()=>{
  const cases=[
    ['campaign.read','campaign:read',true],['campaign.create','campaign:write',true],['merge.create','campaign:merge',true],['share.create','campaign:share-base',true],['share.revoke','campaign:share-base',true]
  ];
  for(const [operation,scope] of cases){
    assert.equal(authorizePhase78Operation(req(operation),{accessContext:access}).allowed,true,operation);
    assert.equal(authorizePhase78Operation(req(operation,{scopes:access.scopes.filter(x=>x!==scope)}),{accessContext:{...access,scopes:access.scopes.filter(x=>x!==scope)}}).reason,'scope_missing',operation);
  }
  assert.equal(authorizePhase78Operation(req('campaign.read'),{accessContext:{...access,campaignState:'archived',campaignRole:'operator'}}).reason,'role_state_denied');
  assert.equal(authorizePhase78Operation(req('campaign.create'),{accessContext:{...access,campaignState:'terminal'}}).reason,'role_state_denied');
});

test('orchestration plans are pure, deterministic, execution-disabled, and operation-accounted',()=>{
  const request=req('fork.create',{payload:{adapterKind:'external',chainId:1,blockNumber:1,blockHash:null}});
  const authorization=authorizePhase78Operation(request,{forkState:null,allowCreate:true});
  const first=planPhase78Operation({request,authorization,current:null});
  const second=planPhase78Operation({request,authorization,current:null});
  assert.deepEqual(second,first);
  assert.equal(first.executionEnabled,false);
  assert.equal(first.resultStatus,'awaiting_executor');
  assert.equal(first.steps.some(step=>step.kind==='network'||step.kind==='execute'),false);
  assert.deepEqual(first.operationSummary,{classA:3,classB:1,free:0});
});

test('CAS plans reject stale writes, protect terminal states, and bind monotonic versions',()=>{
  const request=req('fork.delete',{expectedVersion:3,expectedEtag:d('e')});
  const authorization={allowed:true,reason:'allowed'};
  const plan=planPhase78Operation({request,authorization,current:{state:'ready',version:3,etag:d('e')}});
  assert.equal(plan.nextVersion,4);
  assert.throws(()=>planPhase78Operation({request,authorization,current:{state:'ready',version:4,etag:d('e')}}),{code:'stale_state'});
  assert.throws(()=>planPhase78Operation({request,authorization,current:{state:'deleted',version:3,etag:d('e')}}),{code:'terminal_state'});
});

test('retry plans converge by immutable request digest and reject conflicting replay',()=>{
  const request=req('merge.create',{expectedVersion:2,expectedEtag:d('e')});
  const first=createRetryPlan({request,current:{state:'publishing',version:2,etag:d('e')},completedWrites:[d('1')],failedStep:'publish-pointer'});
  const second=createRetryPlan({request,current:{state:'publishing',version:2,etag:d('e')},completedWrites:[d('1')],failedStep:'publish-pointer'});
  assert.deepEqual(second,first);
  assert.equal(first.retrySafe,true);
  assert.equal(first.maxAttempts,4);
  assert.throws(()=>createRetryPlan({request:{...request,requestDigest:d('f')},current:{state:'publishing',version:2,etag:d('e')},completedWrites:[d('1')],failedStep:'publish-pointer'}),{code:'request_digest_mismatch'});
});
