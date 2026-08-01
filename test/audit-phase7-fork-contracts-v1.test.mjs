import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FREE_DEVELOPMENT_FORK_CAPABILITY,
  FORK_STATES,
  FORK_TRANSITIONS,
  checkpointObjectKey,
  canonicalJson,
  validateCheckpointManifest,
  validateExportManifest,
  validateForkActionResult,
  validateForkEvent,
  validateForkQuotaCapability,
  validateForkRequest,
  validateForkState,
  validateForkTransition,
  validateMockAdapterRequest,
  validateMockAdapterResult,
  validateRestoreManifest,
  validateForkTombstone
} from '../packages/audit-fork-protocol/src/index.mjs';
const ids={tenantId:'ten_'+'1'.repeat(32),workspaceId:'ws_'+'2'.repeat(32),campaignId:'cmp_'+'3'.repeat(32),forkId:'fork_'+'4'.repeat(32),attemptId:'att_'+'5'.repeat(32),checkpointId:'snap_'+'6'.repeat(32)};
const digest='a'.repeat(64);
test('all versioned Phase 7 public contracts validate exact keys',()=>{
  const request=validateForkRequest({schemaVersion:'fork-request-v1',tenantId:ids.tenantId,workspaceId:ids.workspaceId,campaignId:ids.campaignId,forkId:ids.forkId,attemptId:ids.attemptId,profileId:'free-development-v1',policyVersion:'fork-policy-v1',requesterId:'usr_alice',scopes:['audit:read','audit:submit'],chainId:1,blockNumber:21000000,adapterKind:'external',executionGate:'awaiting_executor',createdAt:'2026-08-01T00:00:00.000Z',idempotencyKey:'create-1'});
  assert.equal('blockHash' in request,false);
  const state=validateForkState({schemaVersion:'fork-state-v1',forkId:ids.forkId,tenantId:ids.tenantId,attemptId:ids.attemptId,requestDigest:digest,state:'awaiting_executor',version:2,executionGate:'awaiting_executor',adapterKind:'external',chainId:1,blockNumber:21000000,blockHash:null,createdAt:'2026-08-01T00:00:00.000Z',updatedAt:'2026-08-01T00:00:00.000Z',lastTransitionId:'tr_admit_abc',lastFromState:'requested'});
  assert.equal(state.state,'awaiting_executor');
  assert.equal(validateForkEvent({schemaVersion:'fork-event-v1',eventId:'evt_0002',forkId:ids.forkId,tenantId:ids.tenantId,attemptId:ids.attemptId,requestDigest:digest,from:'requested',to:'awaiting_executor',version:2,transitionId:'tr_admit_abc',occurredAt:'2026-08-01T00:00:00.000Z'}).version,2);
  assert.equal(validateForkActionResult({schemaVersion:'fork-action-result-v1',forkId:ids.forkId,actionId:'act_one',status:'succeeded',blockNumber:21000000,timestamp:1700000000,deterministicDigest:digest,result:{value:'0x00'}}).status,'succeeded');
  assert.deepEqual(validateForkQuotaCapability(FREE_DEVELOPMENT_FORK_CAPABILITY),FREE_DEVELOPMENT_FORK_CAPABILITY);
  assert.equal(validateMockAdapterRequest({schemaVersion:'fork-mock-request-v1',operation:'create',forkId:ids.forkId,chainId:1,blockNumber:21000000,timestamp:1700000000,seed:'seed',mode:'success'}).operation,'create');
  assert.equal(validateMockAdapterResult({schemaVersion:'fork-mock-result-v1',operation:'create',forkId:ids.forkId,status:'ready',chainId:1,blockNumber:21000000,timestamp:1700000000,deterministicDigest:digest,result:{executionEnabled:false}}).status,'ready');
});
test('checkpoint and export contracts enforce one-day and seven-day retention',()=>{
  const checkpoint={schemaVersion:'fork-checkpoint-manifest-v1',checkpointId:ids.checkpointId,forkId:ids.forkId,tenantId:ids.tenantId,attemptId:ids.attemptId,chainId:1,blockNumber:21000000,objectKey:checkpointObjectKey(ids.forkId,ids.checkpointId),sha256:digest,bytes:250000000,contentType:'application/octet-stream',opaque:true,encryption:{mode:'platform-opaque',keyReference:'opaque'},createdAt:'2026-08-01T00:00:00.000Z',expiresAt:'2026-08-02T00:00:00.000Z'};
  assert.equal(validateCheckpointManifest(checkpoint).bytes,250000000);
  assert.throws(()=>validateCheckpointManifest({...checkpoint,bytes:1000000001}),{code:'invalid_limit'});
  assert.throws(()=>validateCheckpointManifest({...checkpoint,expiresAt:'2026-08-02T00:00:01.000Z'}),{code:'invalid_retention'});
  const exported={schemaVersion:'fork-export-manifest-v1',exportId:'exp_'+'7'.repeat(32),forkId:ids.forkId,tenantId:ids.tenantId,checkpointId:ids.checkpointId,sourceObjectKey:checkpoint.objectKey,sourceSha256:digest,createdAt:'2026-08-01T00:00:00.000Z',expiresAt:'2026-08-08T00:00:00.000Z'};
  assert.equal(validateExportManifest(exported).checkpointId,ids.checkpointId);
  assert.throws(()=>validateExportManifest({...exported,expiresAt:'2026-08-08T00:00:01.000Z'}),{code:'invalid_retention'});
});
test('transition truth table is complete and terminal states cannot advance',()=>{
  for(const from of FORK_STATES){
    for(const to of FORK_STATES){
      if(FORK_TRANSITIONS[from].includes(to)) assert.deepEqual(validateForkTransition(from,to),{from,to});
      else assert.throws(()=>validateForkTransition(from,to),{code:'invalid_transition'});
    }
  }
  assert.equal(canonicalJson(FORK_TRANSITIONS),canonicalJson(structuredClone(FORK_TRANSITIONS)));
});

test('restore and deletion manifests pin exact source identity and tombstone metadata',()=>{
  const restore=validateRestoreManifest({schemaVersion:'fork-restore-manifest-v1',restoreId:'rst_'+'8'.repeat(32),forkId:ids.forkId,tenantId:ids.tenantId,attemptId:ids.attemptId,checkpointId:ids.checkpointId,sourceObjectKey:checkpointObjectKey(ids.forkId,ids.checkpointId),sourceSha256:digest,requestedAt:'2026-08-01T01:00:00.000Z'});
  assert.equal(restore.checkpointId,ids.checkpointId);
  const tombstone=validateForkTombstone({schemaVersion:'fork-tombstone-v1',forkId:ids.forkId,tenantId:ids.tenantId,attemptId:ids.attemptId,reason:'user-request',deletedAt:'2026-08-01T02:00:00.000Z',requestDigest:digest});
  assert.equal(tombstone.reason,'user-request');
  assert.throws(()=>validateRestoreManifest({...restore,sourceObjectKey:'forks/other.bin'}),{code:'invalid_object_key'});
});
