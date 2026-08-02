import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertSafeGraph, sha256Hex } from '../packages/audit-fork-protocol/src/internals.mjs';
import { publishCheckpointOperation, exportCheckpointOperation, restoreCheckpointOperation } from '../packages/audit-forks/src/checkpoint-operations.mjs';
const ts='2026-08-02T02:40:00.000Z';
const ids={forkId:`fork_${'1'.repeat(32)}`,tenantId:`ten_${'2'.repeat(32)}`,attemptId:`att_${'3'.repeat(32)}`,checkpointId:`snap_${'4'.repeat(32)}`};
function serviceFixture({failWrite=false}={}){
  let current={...ids,state:'ready',etag:'etag-ready',chainId:1,blockNumber:10,blockHash:`0x${'a'.repeat(64)}`};
  const transitions=[];let writes=0;
  const service={
    transitions,
    storage:{
      async readIndex(_key,fallback){return{index:fallback};},
      async putImmutable(){writes++;if(failWrite&&writes===1)throw Object.assign(new Error('injected'),{code:'injected'});},
      async mergeIndex(){},
      async head(){return{size:3};},
      async get(){return null;}
    },
    async readForkForTenant(){return current;},
    async readCheckpointForTenant(){return{...ids,objectKey:`forks/${ids.forkId}/checkpoints/${ids.checkpointId}.bin`,sha256:'a'.repeat(64),bytes:3};},
    async transitionFork(input){transitions.push(input.to);current={...current,state:input.to,etag:`etag-${input.to}`,lastTransitionId:input.transitionId,lastFromState:input.from};return current;}
  };
  return service;
}
async function checkpointManifest(){const bytes=new Uint8Array([1,2,3]);return{bytes,manifest:{...ids,schemaVersion:'fork-checkpoint-manifest-v1',chainId:1,blockNumber:10,blockHash:`0x${'a'.repeat(64)}`,objectKey:`forks/${ids.forkId}/checkpoints/${ids.checkpointId}.bin`,sha256:await sha256Hex(bytes),bytes:3,contentType:'application/octet-stream',opaque:true,encryption:{mode:'client-managed',keyReference:'opaque'},createdAt:ts,expiresAt:'2026-08-03T02:40:00.000Z'}};}

test('RED: checkpoint publication enters checkpointing then returns ready',async()=>{
  const service=serviceFixture(),input=await checkpointManifest();
  await publishCheckpointOperation(service,input);
  assert.deepEqual(service.transitions,['checkpointing','ready']);
});

test('RED: checkpoint failure leaves recoverable checkpointing state',async()=>{
  const service=serviceFixture({failWrite:true}),input=await checkpointManifest();
  await assert.rejects(()=>publishCheckpointOperation(service,input),/injected/);
  assert.deepEqual(service.transitions,['checkpointing']);
});

test('RED: export enters exporting then returns ready',async()=>{
  const service=serviceFixture();
  await exportCheckpointOperation(service,{forkId:ids.forkId,tenantId:ids.tenantId,checkpointId:ids.checkpointId,schemaVersion:'fork-export-manifest-v1',exportId:'exp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',sourceObjectKey:`forks/${ids.forkId}/checkpoints/${ids.checkpointId}.bin`,sourceSha256:'a'.repeat(64),createdAt:ts,expiresAt:'2026-08-09T02:40:00.000Z'});
  assert.deepEqual(service.transitions,['exporting','ready']);
});

test('RED: restore enters restoring then returns ready',async()=>{
  const service=serviceFixture();
  await restoreCheckpointOperation(service,{...ids,schemaVersion:'fork-restore-manifest-v1',restoreId:'rst_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',sourceObjectKey:`forks/${ids.forkId}/checkpoints/${ids.checkpointId}.bin`,sourceSha256:'a'.repeat(64),requestedAt:ts});
  assert.deepEqual(service.transitions,['restoring','ready']);
});

test('RED: Phase 7 array getters are rejected without invocation',()=>{
  let calls=0;const value=[];Object.defineProperty(value,'0',{enumerable:true,get(){calls++;return 'x';}});value.length=1;
  assert.throws(()=>assertSafeGraph(value),{code:'unsafe_object'});
  assert.equal(calls,0);
});

test('RED: revoked Phase 7 arrays map to hostile reflection error',()=>{
  const {proxy,revoke}=Proxy.revocable([],{});revoke();
  assert.throws(()=>assertSafeGraph(proxy),{code:'hostile_reflection'});
});

test('RED: public fork and checkpoint readers require tenant and attempt scope',async()=>{
  const source=await readFile(new URL('../packages/audit-forks/src/service.mjs',import.meta.url),'utf8');
  assert.match(source,/readForkForTenant\s*\(tenantId,\s*forkId/);
  assert.match(source,/readCheckpointForTenant\s*\(tenantId,\s*attemptId,\s*forkId,\s*checkpointId/);
  assert.doesNotMatch(source,/\n\s*async readFork\s*\(forkId\)/);
  assert.doesNotMatch(source,/\n\s*readCheckpoint\s*\(forkId,\s*checkpointId\)/);
});
