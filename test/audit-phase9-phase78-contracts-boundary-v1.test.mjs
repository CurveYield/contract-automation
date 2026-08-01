import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SERVICE_OPERATIONS, createServiceRequest, validateServiceRequest,
  createServiceResponse, validateServiceResponse, createServiceError,
  validateServiceError, canonicalJson, sha256, LIMITS
} from '../packages/audit-phase78-service/src/index.mjs';

const ts='2026-08-01T23:40:00.000Z';
const d=(c)=>`sha256:${c.repeat(64)}`;
const base={
  operation:'fork.create', tenantId:'tenant-a', workspaceId:'workspace-a',
  campaignId:'campaign-a', forkId:'fork-a', mergeId:null, requesterId:'user-a',
  scopes:['audit:read','audit:submit'], idempotencyKey:'fork-create-a',
  expectedVersion:null, expectedEtag:null, requestedAt:ts,
  payload:{adapterKind:'external',chainId:1,blockNumber:21000000,blockHash:`0x${'a'.repeat(64)}`}
};

test('service operation inventory is exact and complete',()=>{
  assert.deepEqual(SERVICE_OPERATIONS,[
    'campaign.create','campaign.read','fork.action','fork.checkpoint','fork.create','fork.delete','fork.export','fork.read',
    'merge.create','merge.read','provenance.read','report.publish','report.read','share.create','share.revoke'
  ]);
});

test('request creation is canonical, frozen, deterministic, and validates',()=>{
  const first=createServiceRequest(base);
  const second=createServiceRequest({...base,scopes:[...base.scopes].reverse()});
  assert.deepEqual(second,first);
  assert.equal(Object.isFrozen(first.payload),true);
  assert.match(first.requestId,/^svc-req-[0-9a-f]{24}$/);
  assert.match(first.requestDigest,/^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(validateServiceRequest(first),first);
});

test('request validators reject unknown fields, missing identity, contradictory CAS, and forbidden payload intent',()=>{
  assert.throws(()=>createServiceRequest({...base,unknown:true}),{code:'unknown_field'});
  assert.throws(()=>createServiceRequest({...base,tenantId:'*'}),{code:'invalid_identifier'});
  assert.throws(()=>createServiceRequest({...base,expectedVersion:1,expectedEtag:null}),{code:'cas_contradiction'});
  for(const payload of [{rpcUrl:'https://x'},{privateKey:'x'},{command:'x'},{wallet:'x'},{broadcast:true},{deployment:'x'}])
    assert.throws(()=>createServiceRequest({...base,payload}),{code:'forbidden_field'});
});

test('response binds request identity, state truth, version, etag, and digest',()=>{
  const request=createServiceRequest(base);
  const response=createServiceResponse({request,status:'awaiting_executor',resourceId:'fork-a',version:1,etag:d('e'),body:{executionEnabled:false,state:'awaiting_executor'},completedAt:ts});
  assert.equal(response.requestId,request.requestId);
  assert.equal(response.operation,'fork.create');
  assert.equal(response.status,'awaiting_executor');
  assert.equal(response.body.executionEnabled,false);
  assert.deepEqual(validateServiceResponse(response),response);
  const drift=structuredClone(response);drift.body.state='ready';
  assert.throws(()=>validateServiceResponse(drift),{code:'digest_mismatch'});
});

test('error envelopes are bounded, stable, and never include hidden details',()=>{
  const request=createServiceRequest(base);
  const error=createServiceError({request,code:'stale_state',message:'Current state changed',retryable:true,path:'$.expectedEtag',at:ts});
  assert.deepEqual(validateServiceError(error),error);
  assert.deepEqual(Object.keys(error).sort(),['at','code','errorDigest','message','operation','path','requestId','retryable','schemaVersion'].sort());
  assert.throws(()=>createServiceError({request,code:'bad',message:'Authorization: Bearer secret',retryable:false,path:'$',at:ts}),{code:'unsafe_message'});
});

test('hostile object and array boundaries fail with stable bounded errors',()=>{
  const accessor={...base};Object.defineProperty(accessor,'tenantId',{enumerable:true,get(){throw new Error('must not run')}});
  assert.throws(()=>createServiceRequest(accessor),{code:'accessor_field'});
  const throwing=new Proxy({}, {ownKeys(){throw new Error('trap')}});
  assert.throws(()=>canonicalJson(throwing),{code:'hostile_reflection'});
  const {proxy,revoke}=Proxy.revocable([],{});revoke();
  assert.throws(()=>createServiceRequest({...base,scopes:proxy}),{code:'hostile_reflection'});
  const sparse=['audit:read'];sparse.length=2;
  assert.throws(()=>createServiceRequest({...base,scopes:sparse}),{code:'sparse_array'});
});

test('canonical byte limit is exact for ASCII and multibyte strings',()=>{
  const ascii='a'.repeat(LIMITS.bytes-2);
  assert.equal(new TextEncoder().encode(canonicalJson(ascii)).byteLength,LIMITS.bytes);
  assert.throws(()=>canonicalJson(`${ascii}a`),{code:'encoded_bytes_exceeded'});
  const multi='é'.repeat(Math.floor((LIMITS.bytes-2)/2));
  assert.equal(new TextEncoder().encode(canonicalJson(multi)).byteLength,LIMITS.bytes);
  assert.throws(()=>canonicalJson(`${multi}é`),{code:'encoded_bytes_exceeded'});
  assert.equal(sha256('abc'),'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
