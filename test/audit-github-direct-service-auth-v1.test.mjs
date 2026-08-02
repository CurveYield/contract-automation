import test from 'node:test';
import assert from 'node:assert/strict';
import { createDirectRequest } from '../packages/audit-github-direct-protocol/src/index.mjs';
import { createInjectedAuthorizationBroker,AUTH_TRANSPORT_METHODS } from '../packages/audit-github-direct-auth/src/index.mjs';

const at='2026-08-01T23:40:00.000Z',later='2026-08-01T23:45:00.000Z';
const request=createDirectRequest({repositoryId:123,installationId:456,repositoryFullName:'curveyield/contract-automation',requesterId:'user-1',policyVersion:'direct-policy-v1',profileId:'hardhat-test-v1',parserVersion:'hardhat-test-parser-v1',resultContractVersion:'phase5-tool-result-v1',reportContractVersion:'audit-report-v1',targetCommitSha:'a'.repeat(40),requestedAt:at,idempotencyKey:'request-1'});
const transport=Object.fromEntries(AUTH_TRANSPORT_METHODS.map(name=>[name,async()=>null]));

test('injected authorization returns token-free manifest plus opaque transport',async()=>{
  const calls=[];
  const broker=createInjectedAuthorizationBroker({issueTransport:async input=>{calls.push(input);return {authorizationKind:'github-token',repositoryId:input.repositoryId,installationId:input.installationId,repositoryFullName:input.repositoryFullName,targetCommitSha:input.targetCommitSha,issuedAt:at,expiresAt:later,capabilities:input.capabilities,transport}}});
  const session=await broker.authorize(request,['read-source','publish-check']);
  assert.deepEqual(session.capabilityManifest.capabilities,['publish-check','read-source']);
  assert.equal(session.transport,transport);
  assert.deepEqual(calls[0],{repositoryId:123,installationId:456,repositoryFullName:'curveyield/contract-automation',targetCommitSha:request.targetCommitSha,requesterId:'user-1',capabilities:['publish-check','read-source']});
  assert.doesNotMatch(JSON.stringify(session),/ghs_|bearer|authorization|secret|token\s*[:=]/i);
});

test('authorization rejects identity, capability, expiry, and transport drift',async()=>{
  const variants=[
    x=>({...x,repositoryId:999}),
    x=>({...x,targetCommitSha:'b'.repeat(40)}),
    x=>({...x,capabilities:['read-source']}),
    x=>({...x,expiresAt:at}),
    x=>({...x,transport:{...transport,extra:async()=>null}})
  ];
  for(const mutate of variants){
    const broker=createInjectedAuthorizationBroker({issueTransport:async input=>mutate({authorizationKind:'github-token',repositoryId:input.repositoryId,installationId:input.installationId,repositoryFullName:input.repositoryFullName,targetCommitSha:input.targetCommitSha,issuedAt:at,expiresAt:later,capabilities:input.capabilities,transport})});
    await assert.rejects(()=>broker.authorize(request,['read-source','publish-check']));
  }
});

test('authorization provider shape is exact',()=>{
  assert.throws(()=>createInjectedAuthorizationBroker({issueTransport:async()=>null,token:'secret'}),{code:'unknown_field'});
});

test('authorization transport rejects accessors and revoked proxies without invoking getters',async()=>{
  let getterCalls=0;
  const accessor={...transport};
  Object.defineProperty(accessor,'publish',{enumerable:true,get(){getterCalls++;throw new Error('must-not-run')}});
  const accessorBroker=createInjectedAuthorizationBroker({issueTransport:async input=>({authorizationKind:'github-token',repositoryId:input.repositoryId,installationId:input.installationId,repositoryFullName:input.repositoryFullName,targetCommitSha:input.targetCommitSha,issuedAt:at,expiresAt:later,capabilities:input.capabilities,transport:accessor})});
  await assert.rejects(()=>accessorBroker.authorize(request,['read-source']),{code:'accessor_field'});
  assert.equal(getterCalls,0);
  const {proxy,revoke}=Proxy.revocable(transport,{});revoke();
  const proxyBroker=createInjectedAuthorizationBroker({issueTransport:async input=>({authorizationKind:'github-token',repositoryId:input.repositoryId,installationId:input.installationId,repositoryFullName:input.repositoryFullName,targetCommitSha:input.targetCommitSha,issuedAt:at,expiresAt:later,capabilities:input.capabilities,transport:proxy})});
  await assert.rejects(()=>proxyBroker.authorize(request,['read-source']),{code:'hostile_reflection'});
});
