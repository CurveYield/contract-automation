import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDirectRequest, createDirectState, createCapabilityManifest,
  sha256, DirectValidationError
} from '../packages/audit-github-direct-protocol/src/index.mjs';
import {
  createPermissionManifest, validatePermissionManifest
} from '../packages/audit-github-direct-adapter/src/index.mjs';
import {
  createSubmissionReportingBundle, validateSubmissionReportingBundle,
  ingestArtifactMetadata, validateArtifactMetadataIndex
} from '../packages/audit-github-direct-reporting/src/index.mjs';
import {
  createServiceCommand, validateServiceCommand, createServiceResult,
  validateServiceResult, createServiceError, validateServiceError,
  createCompatibilityManifest, validateCompatibilityManifest,
  createReleaseManifest, validateReleaseManifest
} from '../packages/audit-github-direct-service/src/index.mjs';
import {
  buildLedgerPaths, planImmutableCreate, planCasUpdate,
  planPartialWriteRecovery
} from '../packages/audit-github-direct-ledger/src/index.mjs';

const at='2026-08-02T02:34:00.000Z';
const later='2026-08-02T02:44:00.000Z';
const blob='a'.repeat(40);
const digest=(c)=>`sha256:${c.repeat(64)}`;
function requestFor(overrides={}){return createDirectRequest({repositoryId:123,installationId:456,repositoryFullName:'curveyield/contract-automation',requesterId:'actor-123',policyVersion:'direct-policy-v1',profileId:'hardhat-test-v1',parserVersion:'hardhat-test-parser-v1',resultContractVersion:'phase5-tool-result-v1',reportContractVersion:'audit-report-v1',targetCommitSha:'a'.repeat(40),requestedAt:at,idempotencyKey:'round3-adversarial',...overrides});}
function expectBounded(fn){assert.throws(fn,(error)=>error instanceof DirectValidationError&&typeof error.code==='string'&&typeof error.path==='string');}

test('new public validators reject accessors, symbols, custom prototypes, and revoked proxies without invoking getters',()=>{
  const request=requestFor();
  const command=createServiceCommand({kind:'status',request,at:later});
  const result=createServiceResult({command,state:'completed',data:{ok:true},completedAt:later});
  let invoked=0;
  const accessor={...result};Object.defineProperty(accessor,'data',{enumerable:true,get(){invoked++;throw new Error('must-not-run')}});
  expectBounded(()=>validateServiceResult(accessor));assert.equal(invoked,0);
  const symbol={...result};symbol[Symbol('x')]=1;expectBounded(()=>validateServiceResult(symbol));
  expectBounded(()=>validateServiceResult(Object.assign(Object.create({polluted:true}),result)));
  const {proxy,revoke}=Proxy.revocable(result,{});revoke();expectBounded(()=>validateServiceResult(proxy));
});

test('service command and result matrices reject cross-repository/install/requester/SHA substitution',()=>{
  const request=requestFor();
  const command=createServiceCommand({kind:'status',request,at:later});
  for(const [key,value] of Object.entries({repositoryId:999,installationId:999,requesterId:'actor-other',targetCommitSha:'b'.repeat(40)})){
    const copy=structuredClone(command);copy.request[key]=value;expectBounded(()=>validateServiceCommand(copy));
  }
  const foreign=requestFor({targetCommitSha:'b'.repeat(40),idempotencyKey:'foreign'});
  const foreignState=createDirectState({request:foreign,state:'requested',version:0,updatedAt:later});
  assert.throws(()=>createServiceResult({command,state:'completed',data:{currentState:foreignState,currentBlobSha:blob},completedAt:later}),{code:'service_identity_mismatch'});
});

test('permission and reporting validators reject recomputed or nested identity drift',()=>{
  const request=requestFor();
  const capability=createCapabilityManifest({request,authorizationKind:'github-token',capabilities:['read-source'],issuedAt:at,expiresAt:later});
  const permissions=createPermissionManifest({capabilityManifest:capability});
  expectBounded(()=>validatePermissionManifest({...permissions,repositoryFullName:'other/repo'}));
  const submission=createSubmissionReportingBundle({request,publishedAt:later});
  expectBounded(()=>validateSubmissionReportingBundle({...submission,targetCommitSha:'b'.repeat(40)}));
  const artifacts=ingestArtifactMetadata({request,items:[{artifactId:'artifact-1',name:'audit-direct-result',sizeBytes:1,digest:digest('1'),expired:false,createdAt:at,expiresAt:later}]});
  expectBounded(()=>validateArtifactMetadataIndex({...artifacts,items:[artifacts.items[0],artifacts.items[0]]}));
});

test('one-field mutations of public command/result/error/release contracts produce bounded failures',()=>{
  const request=requestFor();
  const command=createServiceCommand({kind:'status',request,at:later});
  const result=createServiceResult({command,state:'completed',data:{ok:true},completedAt:later});
  const error=createServiceError({code:'transport_failure',retryable:true,at:later});
  const compatibility=createCompatibilityManifest({candidateSha:'a'.repeat(40),workflowSha:'b'.repeat(40),publishedAt:later});
  const release=createReleaseManifest({candidateSha:'a'.repeat(40),approvedCoreSha:'b'.repeat(40),workflowSha:'c'.repeat(40),protectedBlobDigest:digest('9'),publishedAt:later});
  const pairs=[[command,validateServiceCommand],[result,validateServiceResult],[error,validateServiceError],[compatibility,validateCompatibilityManifest],[release,validateReleaseManifest]];
  let mutations=0;
  for(const [value,validate] of pairs){
    for(const key of Object.keys(value)){
      const copy=structuredClone(value);
      if(key.endsWith('Sha'))copy[key]='z'.repeat(40);
      else if(key.endsWith('Digest'))copy[key]=digest('f');
      else if(typeof copy[key]==='boolean')copy[key]='not-boolean';
      else if(typeof copy[key]==='number')copy[key]=-0;
      else if(copy[key]===null)copy[key]='bad';
      else if(Array.isArray(copy[key]))copy[key]=[...copy[key],'bad'];
      else if(typeof copy[key]==='object')copy[key]={...copy[key],extra:true};
      else copy[key]='wrong';
      expectBounded(()=>validate(copy));mutations++;
    }
  }
  assert.ok(mutations>=40);
});

test('credential-key corpus is rejected recursively from service results',()=>{
  const request=requestFor();
  const command=createServiceCommand({kind:'status',request,at:later});
  const names=['token','accessToken','secret','client_secret','authorization','credential','password','mnemonic','privateKey','private_key'];
  for(const name of names){
    assert.throws(()=>createServiceResult({command,state:'completed',data:{ok:true,nested:{[name]:'value'}},completedAt:later}),(error)=>['credential_field','unknown_field'].includes(error?.code));
  }
});

test('partial-write recovery rejects duplicates, unrelated observations, conflicts, and stale CAS',()=>{
  const paths=buildLedgerPaths({jobId:'direct-job-1',eventId:'event-1',resultId:'result-1',reportId:'report-1'});
  const immutable=planImmutableCreate({path:paths.request,content:{schemaVersion:'fixture-v1',value:1}});
  const current=planCasUpdate({path:paths.current,content:{schemaVersion:'fixture-v1',value:2},currentBlobSha:blob,expectedBlobSha:blob});
  const observed={path:immutable.path,contentDigest:immutable.contentDigest,blobSha:'b'.repeat(40)};
  assert.throws(()=>planPartialWriteRecovery({plans:[immutable],observed:[observed,observed],currentBlobShas:{}}),{code:'duplicate_identity'});
  assert.throws(()=>planPartialWriteRecovery({plans:[immutable],observed:[{...observed,path:paths.event}],currentBlobShas:{}}),{code:'unrelated_observation'});
  assert.throws(()=>planPartialWriteRecovery({plans:[immutable],observed:[{...observed,contentDigest:digest('f')}],currentBlobShas:{}}),{code:'immutable_conflict'});
  assert.throws(()=>planPartialWriteRecovery({plans:[current],observed:[],currentBlobShas:{[current.path]:'c'.repeat(40)}}),{code:'stale_blob_sha'});
});

test('arbitrary path, URL, command, runner, image, and execution fields remain impossible at command boundary',()=>{
  const request=requestFor();
  for(const [key,value] of Object.entries({path:'../../x',url:'https://evil.example',command:'npm test',runner:'self-hosted',image:'latest',execute:true,cloudflareFallback:true})){
    assert.throws(()=>createServiceCommand({kind:'status',request,at:later,[key]:value}),{code:'unknown_field'});
  }
});
