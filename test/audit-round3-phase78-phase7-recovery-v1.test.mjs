import test from 'node:test';
import assert from 'node:assert/strict';
import {
  publishCheckpointOperation,
  exportCheckpointOperation,
  restoreCheckpointOperation,
  deleteForkOperation
} from '../packages/audit-forks/src/checkpoint-operations.mjs';
import { sha256Hex } from '../packages/audit-fork-protocol/src/internals.mjs';

const ts='2026-08-02T02:40:00.000Z';
const ids={
  forkId:`fork_${'1'.repeat(32)}`,
  tenantId:`ten_${'2'.repeat(32)}`,
  attemptId:`att_${'3'.repeat(32)}`,
  checkpointId:`snap_${'4'.repeat(32)}`
};

function stable(value){
  if(value instanceof Uint8Array)return `bytes:${[...value].join(',')}`;
  return JSON.stringify(value);
}

function recoveryService({state='ready',failBoundary=null,failAfterTransition=false}={}){
  let current={
    ...ids,state,etag:`etag-${state}-0`,chainId:1,blockNumber:10,blockHash:`0x${'a'.repeat(64)}`,
    requestDigest:'b'.repeat(64),createdAt:ts,updatedAt:ts,
    lastTransitionId:`seed-${state}`,lastFromState:'ready',version:1
  };
  let failed=false,serial=0;
  const immutable=new Map(),indexes=new Map(),transitions=[],deletes=[];
  const maybeFail=(boundary)=>{
    if(!failed&&failBoundary===boundary){failed=true;throw Object.assign(new Error(`injected:${boundary}`),{code:'injected'});}
  };
  const service={
    transitions,immutable,indexes,deletes,
    storage:{
      async readIndex(key,fallback){return{index:indexes.has(key)?structuredClone(indexes.get(key)):structuredClone(fallback)};},
      async putImmutable(key,value){
        const boundary=key.endsWith('.bin')?'checkpoint-object':key.includes('checkpoint')?'checkpoint-manifest':key.includes('/exports/')?'export-manifest':key.includes('/restores/')?'restore-manifest':key.includes('tombstone')?'tombstone':'immutable';
        maybeFail(boundary);
        const encoded=stable(value);
        if(immutable.has(key)&&immutable.get(key)!==encoded)throw Object.assign(new Error('immutable conflict'),{code:'immutable_conflict'});
        immutable.set(key,encoded);
      },
      async mergeIndex(key,fallback,keyOf,entry,compare){
        const boundary=key.includes('checkpoints-v1')?'checkpoint-index':'export-index';
        maybeFail(boundary);
        const index=indexes.has(key)?structuredClone(indexes.get(key)):structuredClone(fallback);
        const position=index.entries.findIndex((item)=>keyOf(item)===keyOf(entry));
        if(position>=0)index.entries[position]=structuredClone(entry);else index.entries.push(structuredClone(entry));
        index.entries.sort(compare);index.updatedAt=entry.updatedAt;indexes.set(key,index);
        return index;
      },
      async head(){return{size:3};},
      async get(){return null;},
      async delete(key){deletes.push(key);}
    },
    async readForkForTenant(tenantId,forkId){
      if(tenantId!==current.tenantId||forkId!==current.forkId)throw Object.assign(new Error('not found'),{code:'fork_not_found'});
      return current;
    },
    async readCheckpointForTenant(tenantId,attemptId,forkId,checkpointId){
      if(tenantId!==ids.tenantId||attemptId!==ids.attemptId||forkId!==ids.forkId||checkpointId!==ids.checkpointId)throw Object.assign(new Error('not found'),{code:'checkpoint_not_found'});
      return {...ids,objectKey:`forks/${ids.forkId}/checkpoints/${ids.checkpointId}.bin`,sha256:'a'.repeat(64),bytes:3,blockNumber:10,blockHash:`0x${'a'.repeat(64)}`};
    },
    async transitionFork(input){
      const boundary=input.to==='checkpointing'?'checkpoint-enter':input.to==='exporting'?'export-enter':input.to==='restoring'?'restore-enter':input.to==='deleting'?'delete-enter':input.to==='deleted'?'delete-finish':input.from==='checkpointing'?'checkpoint-ready':input.from==='exporting'?'export-ready':input.from==='restoring'?'restore-ready':'transition';
      if(current.lastTransitionId===input.transitionId)return current;
      if(failAfterTransition&&failBoundary===boundary&&!failed){
        transitions.push(input.to);current={...current,state:input.to,etag:`etag-${input.to}-${++serial}`,lastTransitionId:input.transitionId,lastFromState:input.from,updatedAt:input.occurredAt,version:current.version+1};failed=true;throw Object.assign(new Error(`injected-after:${boundary}`),{code:'injected'});
      }
      maybeFail(boundary);
      if(current.state!==input.from||current.etag!==input.expectedEtag)throw Object.assign(new Error('stale'),{code:'stale_state'});
      transitions.push(input.to);current={...current,state:input.to,etag:`etag-${input.to}-${++serial}`,lastTransitionId:input.transitionId,lastFromState:input.from,updatedAt:input.occurredAt,version:current.version+1};
      if(input.to==='deleted')current={...current,deletedAt:input.occurredAt,tombstone:true};
      if(input.blockNumber!==undefined)current.blockNumber=input.blockNumber;
      if(input.blockHash!==undefined)current.blockHash=input.blockHash;
      return current;
    },
    current:()=>current
  };
  return service;
}

async function checkpointInput(checkpointId=ids.checkpointId){
  const bytes=new Uint8Array([1,2,3]);
  return{bytes,manifest:{...ids,checkpointId,schemaVersion:'fork-checkpoint-manifest-v1',chainId:1,blockNumber:10,blockHash:`0x${'a'.repeat(64)}`,objectKey:`forks/${ids.forkId}/checkpoints/${checkpointId}.bin`,sha256:await sha256Hex(bytes),bytes:3,contentType:'application/octet-stream',opaque:true,encryption:{mode:'client-managed',keyReference:'opaque'},createdAt:ts,expiresAt:'2026-08-03T02:40:00.000Z'}};
}
function exportInput(exportId='exp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'){
  return{forkId:ids.forkId,tenantId:ids.tenantId,checkpointId:ids.checkpointId,schemaVersion:'fork-export-manifest-v1',exportId,sourceObjectKey:`forks/${ids.forkId}/checkpoints/${ids.checkpointId}.bin`,sourceSha256:'a'.repeat(64),createdAt:ts,expiresAt:'2026-08-09T02:40:00.000Z'};
}
function restoreInput(restoreId='rst_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'){
  return{...ids,schemaVersion:'fork-restore-manifest-v1',restoreId,sourceObjectKey:`forks/${ids.forkId}/checkpoints/${ids.checkpointId}.bin`,sourceSha256:'a'.repeat(64),requestedAt:ts};
}

for(const boundary of ['checkpoint-enter','checkpoint-object','checkpoint-manifest','checkpoint-index','checkpoint-ready']){
  test(`checkpoint exact retry converges after ${boundary}`,async()=>{
    const service=recoveryService({failBoundary:boundary}),input=await checkpointInput();
    await assert.rejects(()=>publishCheckpointOperation(service,input),/injected/);
    assert.equal(service.current().state,boundary==='checkpoint-enter'?'ready':'checkpointing');
    await publishCheckpointOperation(service,input);
    assert.equal(service.current().state,'ready');
    assert.equal([...service.immutable.keys()].filter((key)=>key.includes('/checkpoints/')).length,2);
    assert.equal([...service.indexes.values()][0].entries.length,1);
  });
}

test('checkpoint retry reconciles a current-state write that succeeded before the transition event/index failed',async()=>{
  const service=recoveryService({failBoundary:'checkpoint-ready',failAfterTransition:true}),input=await checkpointInput();
  await assert.rejects(()=>publishCheckpointOperation(service,input),/injected-after/);
  assert.equal(service.current().state,'ready');
  await publishCheckpointOperation(service,input);
  assert.equal(service.current().state,'ready');
  assert.equal([...service.indexes.values()][0].entries.length,1);
});

for(const boundary of ['export-enter','export-manifest','export-index','export-ready']){
  test(`export exact retry converges after ${boundary}`,async()=>{
    const service=recoveryService({failBoundary:boundary}),input=exportInput();
    await assert.rejects(()=>exportCheckpointOperation(service,input),/injected/);
    assert.equal(service.current().state,boundary==='export-enter'?'ready':'exporting');
    await exportCheckpointOperation(service,input);
    assert.equal(service.current().state,'ready');
    assert.equal([...service.immutable.keys()].filter((key)=>key.includes('/exports/')).length,1);
    assert.equal([...service.indexes.values()][0].entries.length,1);
  });
}

for(const boundary of ['restore-enter','restore-manifest','restore-ready']){
  test(`restore exact retry converges after ${boundary}`,async()=>{
    const service=recoveryService({failBoundary:boundary}),input=restoreInput();
    await assert.rejects(()=>restoreCheckpointOperation(service,input),/injected/);
    assert.equal(service.current().state,boundary==='restore-enter'?'ready':'restoring');
    await restoreCheckpointOperation(service,input);
    assert.equal(service.current().state,'ready');
    assert.equal([...service.immutable.keys()].filter((key)=>key.includes('/restores/')).length,1);
  });
}

test('conflicting checkpoint retry cannot reuse an active transient lifecycle',async()=>{
  const service=recoveryService({failBoundary:'checkpoint-object'}),first=await checkpointInput();
  await assert.rejects(()=>publishCheckpointOperation(service,first),/injected/);
  const secondId=`snap_${'5'.repeat(32)}`,second=await checkpointInput(secondId);
  await assert.rejects(()=>publishCheckpointOperation(service,second),{code:'operation_conflict'});
  assert.equal(service.current().state,'checkpointing');
});

for(const state of ['checkpointing','exporting','restoring']){
  test(`deletion may start from ${state} and converges to deleted`,async()=>{
    const service=recoveryService({state});
    const result=await deleteForkOperation(service,{...ids,occurredAt:ts,reason:'cleanup'});
    assert.equal(result.state,'deleted');
    assert.deepEqual(service.transitions,['deleting','deleted']);
    assert.equal([...service.immutable.keys()].some((key)=>key.includes('tombstone')),true);
  });
}
