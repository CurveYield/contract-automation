import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DIRECT_MODE_ID, CONTROL_BRANCH, AUTOMATIC_FALLBACK, LIMITS,
  createDirectRequest, validateDirectRequest,
  createDirectState, validateDirectState,
  createDirectEvent, validateDirectEvent,
  createCapabilityManifest, validateCapabilityManifest,
  createResultManifest, validateResultManifest,
  createReportIndex, validateReportIndex,
  canonicalJson, canonicalClone, sha256, DirectValidationError
} from '../packages/audit-github-direct-protocol/src/index.mjs';

const ts='2026-08-01T18:00:00.000Z';
const later='2026-08-01T18:05:00.000Z';
const sha='a'.repeat(40);
const d=(c)=>`sha256:${c.repeat(64)}`;
const requestInput={repositoryId:123,installationId:456,repositoryFullName:'curveyield/contract-automation',requesterId:'user-1',policyVersion:'direct-policy-v1',profileId:'hardhat-test-v1',parserVersion:'hardhat-test-parser-v1',resultContractVersion:'phase5-tool-result-v1',reportContractVersion:'audit-report-v1',targetCommitSha:sha,requestedAt:ts,idempotencyKey:'request-1'};

test('mode identity is exact, distinct, and has no fallback',()=>{
  assert.equal(DIRECT_MODE_ID,'github-direct-audit-v1');
  assert.equal(CONTROL_BRANCH,'audit-direct/control-v1');
  assert.equal(AUTOMATIC_FALLBACK,false);
});

test('request is exact-SHA bound, deterministic, frozen, and validates',()=>{
  const first=createDirectRequest(requestInput);
  const second=createDirectRequest({...requestInput});
  assert.deepEqual(second,first);
  assert.equal(first.modeId,DIRECT_MODE_ID);
  assert.equal(first.targetCommitSha,sha);
  assert.equal(Object.isFrozen(first),true);
  assert.deepEqual(validateDirectRequest(first),first);
  assert.match(first.jobId,/^direct-job-[0-9a-f]{24}$/);
});

test('request rejects mutable refs, execution fields, credentials, and identity drift',()=>{
  assert.throws(()=>createDirectRequest({...requestInput,targetCommitSha:'main'}),{code:'invalid_commit_sha',path:'$.targetCommitSha'});
  assert.throws(()=>createDirectRequest({...requestInput,command:'npm test'}),{code:'unknown_field'});
  assert.throws(()=>createDirectRequest({...requestInput,token:'ghs_secret'}),{code:'unknown_field'});
  const valid=createDirectRequest(requestInput);
  assert.throws(()=>validateDirectRequest({...valid,repositoryId:999}),{code:'digest_mismatch'});
});

test('state current pointer is monotonic, exact-SHA bound, and validates',()=>{
  const request=createDirectRequest(requestInput);
  const state=createDirectState({request,state:'requested',version:0,updatedAt:ts});
  assert.equal(state.jobId,request.jobId);
  assert.equal(state.targetCommitSha,sha);
  assert.deepEqual(validateDirectState(state),state);
  assert.throws(()=>createDirectState({request,state:'requested',version:-0,updatedAt:ts}),{code:'invalid_integer'});
});

test('immutable events bind transition, version, reason, and target SHA',()=>{
  const request=createDirectRequest(requestInput);
  const event=createDirectEvent({request,from:'requested',to:'validating',version:1,reasonCode:'validation-started',at:later});
  assert.match(event.eventId,/^direct-event-[0-9a-f]{24}$/);
  assert.deepEqual(validateDirectEvent(event),event);
  assert.throws(()=>validateDirectEvent({...event,targetCommitSha:'b'.repeat(40)}),{code:'digest_mismatch'});
});

test('capability manifest contains authorization shape but no credentials',()=>{
  const request=createDirectRequest(requestInput);
  const manifest=createCapabilityManifest({request,authorizationKind:'github-token',capabilities:['read-source','write-control-ledger','publish-check'],issuedAt:ts,expiresAt:later});
  assert.deepEqual(manifest.capabilities,['publish-check','read-source','write-control-ledger']);
  assert.doesNotMatch(JSON.stringify(manifest),/(?:gh[ps]_[A-Za-z0-9]+|bearer\s+|secret\s*[:=]|authorization\s*:)/i);
  assert.deepEqual(validateCapabilityManifest(manifest),manifest);
});

test('result manifest truthfully distinguishes modeled fixture and unavailable execution',()=>{
  const request=createDirectRequest(requestInput);
  const fixture=createResultManifest({request,outcome:'modeled_fixture',executionState:'fixture_modeled',resultDigest:d('b'),summary:{findingCount:1,evidenceCount:1,artifactCount:0,truncated:false},producedAt:later});
  const unavailable=createResultManifest({request,outcome:'execution_unavailable',executionState:'execution_plane_unavailable',resultDigest:null,summary:{findingCount:0,evidenceCount:0,artifactCount:0,truncated:false},producedAt:later});
  assert.deepEqual(validateResultManifest(fixture),fixture);
  assert.deepEqual(validateResultManifest(unavailable),unavailable);
  assert.throws(()=>createResultManifest({request,outcome:'success',executionState:'execution_plane_unavailable',resultDigest:d('c'),summary:{findingCount:0,evidenceCount:0,artifactCount:0,truncated:false},producedAt:later}),{code:'execution_truth_mismatch'});
});

test('report index sorts immutable references and rejects replay drift',()=>{
  const request=createDirectRequest(requestInput);
  const index=createReportIndex({request,entries:[{reportId:'report-b',reportDigest:d('b'),kind:'machine-json'},{reportId:'report-a',reportDigest:d('a'),kind:'human-markdown'}],publishedAt:later});
  assert.deepEqual(index.entries.map((x)=>x.reportId),['report-a','report-b']);
  assert.deepEqual(validateReportIndex(index),index);
  assert.throws(()=>validateReportIndex({...index,entries:[...index.entries].reverse()}),{code:'noncanonical_order'});
});

test('ordinary/null objects and dense arrays are accepted; hostile shapes reject safely',()=>{
  const nullInput=Object.assign(Object.create(null),requestInput);
  assert.equal(createDirectRequest(nullInput).jobId,createDirectRequest(requestInput).jobId);
  assert.throws(()=>createDirectRequest(Object.assign(Object.create({x:1}),requestInput)),{code:'invalid_prototype'});
  const accessor={...requestInput};Object.defineProperty(accessor,'repositoryId',{get(){throw new Error('must-not-run')},enumerable:true});
  assert.throws(()=>createDirectRequest(accessor),{code:'accessor_field'});
  const {proxy,revoke}=Proxy.revocable({...requestInput},{});revoke();
  assert.throws(()=>createDirectRequest(proxy),{code:'hostile_reflection'});
  const cyclic={a:null};cyclic.a=cyclic;assert.throws(()=>canonicalClone(cyclic),{code:'cycle'});
});

test('canonical serialization enforces exact UTF-8 bytes and SHA vectors',()=>{
  assert.equal(sha256('abc'),'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const exact='a'.repeat(LIMITS.bytes-2);
  assert.equal(new TextEncoder().encode(canonicalJson(exact)).byteLength,LIMITS.bytes);
  assert.throws(()=>canonicalJson(`${exact}a`),{code:'encoded_bytes_exceeded'});
});

test('all public validators reject one-field mutations with bounded errors',()=>{
  const request=createDirectRequest(requestInput);
  const state=createDirectState({request,state:'requested',version:0,updatedAt:ts});
  const event=createDirectEvent({request,from:'requested',to:'validating',version:1,reasonCode:'validation-started',at:later});
  const capability=createCapabilityManifest({request,authorizationKind:'github-token',capabilities:['read-source'],issuedAt:ts,expiresAt:later});
  const result=createResultManifest({request,outcome:'execution_unavailable',executionState:'execution_plane_unavailable',resultDigest:null,summary:{findingCount:0,evidenceCount:0,artifactCount:0,truncated:false},producedAt:later});
  const report=createReportIndex({request,entries:[],publishedAt:later});
  const pairs=[[request,validateDirectRequest],[state,validateDirectState],[event,validateDirectEvent],[capability,validateCapabilityManifest],[result,validateResultManifest],[report,validateReportIndex]];
  let mutations=0;
  for(const [value,validate] of pairs){
    for(const key of Object.keys(value)){
      const copy=structuredClone(value);
      if(key.endsWith('Digest')) copy[key]=d('f');
      else if(key.endsWith('Sha')) copy[key]='b'.repeat(40);
      else if(typeof copy[key]==='number') copy[key]=-0;
      else if(typeof copy[key]==='boolean') copy[key]=!copy[key];
      else if(Array.isArray(copy[key])) copy[key]=[...copy[key],copy[key][0]??'bad'];
      else if(copy[key]===null) copy[key]='not-null';
      else if(typeof copy[key]==='object') copy[key]={...copy[key],extra:true};
      else copy[key]='wrong';
      assert.throws(()=>validate(copy),(error)=>error instanceof DirectValidationError&&typeof error.code==='string'&&typeof error.path==='string');
      mutations++;
    }
  }
  assert.ok(mutations>=60);
});
