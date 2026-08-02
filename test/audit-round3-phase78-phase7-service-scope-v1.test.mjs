import test from 'node:test';
import assert from 'node:assert/strict';
import { ForkService } from '../packages/audit-forks/src/index.mjs';
import { checkpointObjectKey, sha256Hex } from '../packages/audit-fork-protocol/src/index.mjs';

class ConditionalStore {
  #objects=new Map();
  #serial=0;
  async put(key,value,options={}){
    const current=this.#objects.get(key),condition=options.onlyIf??{};
    if(condition.etagDoesNotMatch==='*'&&current)throw Object.assign(new Error('precondition'),{code:'precondition_failed'});
    if(condition.etagMatches!==undefined&&current?.etag!==condition.etagMatches)throw Object.assign(new Error('precondition'),{code:'precondition_failed'});
    const bytes=value instanceof Uint8Array?new Uint8Array(value):new TextEncoder().encode(value);
    const record={value:typeof value==='string'?value:new Uint8Array(bytes),etag:`etag-${++this.#serial}`,size:bytes.byteLength};
    this.#objects.set(key,record);return{key,etag:record.etag,size:record.size};
  }
  async get(key){const value=this.#objects.get(key);return value?{key,...value,value:typeof value.value==='string'?value.value:new Uint8Array(value.value)}:null;}
  async head(key){const value=this.#objects.get(key);return value?{key,etag:value.etag,size:value.size}:null;}
  async delete(key){this.#objects.delete(key);}
}
const ids={tenantId:`ten_${'1'.repeat(32)}`,workspaceId:`ws_${'2'.repeat(32)}`,campaignId:`cmp_${'3'.repeat(32)}`,forkId:`fork_${'4'.repeat(32)}`,attemptId:`att_${'5'.repeat(32)}`};
const ts='2026-08-02T02:40:00.000Z';
function request(){return{schemaVersion:'fork-request-v1',...ids,profileId:'free-development-v1',policyVersion:'fork-policy-v1',requesterId:'usr',scopes:['audit:read','audit:submit'],chainId:1,blockNumber:10,blockHash:`0x${'a'.repeat(64)}`,adapterKind:'mock',executionGate:'trusted_mock',createdAt:ts,idempotencyKey:'scope'};}
async function checkpoint(){const bytes=new Uint8Array([1,2,3]),checkpointId=`snap_${'6'.repeat(32)}`;return{bytes,manifest:{schemaVersion:'fork-checkpoint-manifest-v1',checkpointId,forkId:ids.forkId,tenantId:ids.tenantId,attemptId:ids.attemptId,chainId:1,blockNumber:10,blockHash:`0x${'a'.repeat(64)}`,objectKey:checkpointObjectKey(ids.forkId,checkpointId),sha256:await sha256Hex(bytes),bytes:3,contentType:'application/octet-stream',opaque:true,encryption:{mode:'client-managed',keyReference:'opaque'},createdAt:ts,expiresAt:'2026-08-03T02:40:00.000Z'}};}

test('real ForkService exposes only tenant and attempt scoped read surfaces',async()=>{
  const service=new ForkService(new ConditionalStore());
  await service.createFork(request());
  assert.equal((await service.readRequestForTenant(ids.tenantId,ids.forkId)).tenantId,ids.tenantId);
  assert.equal((await service.readForkForTenant(ids.tenantId,ids.forkId)).state,'ready');
  await assert.rejects(()=>service.readRequestForTenant(`ten_${'9'.repeat(32)}`,ids.forkId),{code:'fork_request_not_found'});
  await assert.rejects(()=>service.readForkForTenant(`ten_${'9'.repeat(32)}`,ids.forkId),{code:'fork_not_found'});
  assert.equal('readFork' in service,false);
  assert.equal('readCheckpoint' in service,false);
});

test('real checkpoint reads collapse cross-tenant and wrong-attempt access to not found',async()=>{
  const service=new ForkService(new ConditionalStore());await service.createFork(request());const input=await checkpoint();await service.publishCheckpoint(input);
  assert.equal((await service.readCheckpointForTenant(ids.tenantId,ids.attemptId,ids.forkId,input.manifest.checkpointId)).checkpointId,input.manifest.checkpointId);
  await assert.rejects(()=>service.readCheckpointForTenant(`ten_${'9'.repeat(32)}`,ids.attemptId,ids.forkId,input.manifest.checkpointId),{code:'fork_not_found'});
  await assert.rejects(()=>service.readCheckpointForTenant(ids.tenantId,`att_${'9'.repeat(32)}`,ids.forkId,input.manifest.checkpointId),{code:'checkpoint_not_found'});
});

test('repaired checkpoint and export traces remain explicit and never list or copy storage',async()=>{
  const service=new ForkService(new ConditionalStore());await service.createFork(request());service.clearOperationTrace();const input=await checkpoint();await service.publishCheckpoint(input);
  const checkpointCounts=service.operationTrace().reduce((r,e)=>(r[e.billingClass]=(r[e.billingClass]??0)+1,r),{});
  assert.equal(service.operationTrace().some((entry)=>entry.method==='list'||entry.method==='copy'),false);
  service.clearOperationTrace();await service.exportCheckpoint({schemaVersion:'fork-export-manifest-v1',exportId:`exp_${'7'.repeat(32)}`,forkId:ids.forkId,tenantId:ids.tenantId,checkpointId:input.manifest.checkpointId,sourceObjectKey:input.manifest.objectKey,sourceSha256:input.manifest.sha256,createdAt:ts,expiresAt:'2026-08-09T02:40:00.000Z'});
  const exportCounts=service.operationTrace().reduce((r,e)=>(r[e.billingClass]=(r[e.billingClass]??0)+1,r),{});
  console.log(JSON.stringify({checkpointCounts,exportCounts}));
  assert.ok(checkpointCounts['class-a']>3&&checkpointCounts['class-b']>3);
  assert.ok(exportCounts['class-a']>2&&exportCounts['class-b']>3);
});

test('restore and deletion operation traces are explicit across ready and transient states',async()=>{
  const store=new ConditionalStore(),service=new ForkService(store);await service.createFork(request());const input=await checkpoint();await service.publishCheckpoint(input);
  service.clearOperationTrace();
  await service.restoreCheckpoint({schemaVersion:'fork-restore-manifest-v1',restoreId:`rst_${'8'.repeat(32)}`,forkId:ids.forkId,tenantId:ids.tenantId,attemptId:ids.attemptId,checkpointId:input.manifest.checkpointId,sourceObjectKey:input.manifest.objectKey,sourceSha256:input.manifest.sha256,requestedAt:'2026-08-02T03:00:00.000Z'});
  const restoreCounts=service.operationTrace().reduce((r,e)=>(r[e.billingClass]=(r[e.billingClass]??0)+1,r),{});
  service.clearOperationTrace();
  await service.deleteFork({forkId:ids.forkId,tenantId:ids.tenantId,attemptId:ids.attemptId,occurredAt:'2026-08-02T04:00:00.000Z',reason:'ready-delete'});
  const readyDeleteCounts=service.operationTrace().reduce((r,e)=>(r[e.billingClass]=(r[e.billingClass]??0)+1,r),{});

  const transientService=new ForkService(new ConditionalStore());const transientCurrent=await transientService.createFork(request());
  await transientService.transitionFork({forkId:ids.forkId,tenantId:ids.tenantId,attemptId:ids.attemptId,from:'ready',to:'checkpointing',expectedEtag:transientCurrent.etag,transitionId:'tr_manual_checkpointing',occurredAt:'2026-08-02T03:30:00.000Z'});
  transientService.clearOperationTrace();
  await transientService.deleteFork({forkId:ids.forkId,tenantId:ids.tenantId,attemptId:ids.attemptId,occurredAt:'2026-08-02T04:00:00.000Z',reason:'transient-delete'});
  const transientDeleteCounts=transientService.operationTrace().reduce((r,e)=>(r[e.billingClass]=(r[e.billingClass]??0)+1,r),{});
  console.log(JSON.stringify({restoreCounts,readyDeleteCounts,transientDeleteCounts}));
  assert.deepEqual(restoreCounts,{'class-b':11,'class-a':7});
  assert.deepEqual(readyDeleteCounts,{'class-b':9,'class-a':7,free:2});
  assert.deepEqual(transientDeleteCounts,{'class-b':9,'class-a':7});
});
