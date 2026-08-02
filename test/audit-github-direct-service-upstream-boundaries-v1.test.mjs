import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDirectRequest,createCapabilityManifest,sha256,DirectValidationError
} from '../packages/audit-github-direct-protocol/src/index.mjs';
import {
  createInjectedGitHubAdapter,planCheckPublication,planStatusPublication,
  validatePublicationPlan,createArtifactMetadata
} from '../packages/audit-github-direct-adapter/src/index.mjs';
import {
  planImmutableCreate
} from '../packages/audit-github-direct-ledger/src/index.mjs';
import {
  DIRECT_FIXTURE_ALLOWLIST,admitDirectJob,validateRunnerAdmission,
  orchestrateDirectJob,validateRunnerOutcome,planRunnerPublication,validateRunnerPublicationPlan
} from '../packages/audit-github-direct-runner/src/index.mjs';

const ts='2026-08-01T18:00:00.000Z',later='2026-08-01T18:05:00.000Z';
const sha='a'.repeat(40),blob='b'.repeat(40),d=(c)=>`sha256:${c.repeat(64)}`;
const requestFor=(target=sha,key='request-1')=>createDirectRequest({repositoryId:123,installationId:456,repositoryFullName:'curveyield/contract-automation',requesterId:'user-1',policyVersion:'direct-policy-v1',profileId:'hardhat-test-v1',parserVersion:'hardhat-test-parser-v1',resultContractVersion:'phase5-tool-result-v1',reportContractVersion:'audit-report-v1',targetCommitSha:target,requestedAt:ts,idempotencyKey:key});
const request=requestFor();
const capabilityFor=(requestInput=request)=>createCapabilityManifest({request:requestInput,authorizationKind:'github-token',capabilities:['read-source','write-control-ledger','publish-check','publish-comment','publish-status','read-artifact-metadata'],issuedAt:ts,expiresAt:later});
const identityFor=(r=request)=>({repositoryId:r.repositoryId,installationId:r.installationId,repositoryFullName:r.repositoryFullName,targetCommitSha:r.targetCommitSha});
function transport(overrides={}){
  const calls=[];
  return {calls,transport:{
    async getRepository(input){calls.push(['getRepository',input]);return {repositoryId:input.repositoryId,fullName:input.repositoryFullName};},
    async getCommit(input){calls.push(['getCommit',input]);return {sha:input.targetCommitSha};},
    async getBlob(input){calls.push(['getBlob',input]);return {blobSha:input.blobSha,sizeBytes:3};},
    async getContents(input){calls.push(['getContents',input]);return {path:input.path,blobSha:blob};},
    async applyLedgerMutation(input){calls.push(['applyLedgerMutation',input]);return {applied:true,nextBlobSha:input.mutation.nextContentBlobSha};},
    async getPublication(input){calls.push(['getPublication',input]);return null;},
    async publish(input){calls.push(['publish',input]);return {published:true,publicationId:input.publicationId};},
    async getArtifactMetadata(input){calls.push(['getArtifactMetadata',input]);return [{artifactId:'artifact-1',name:'results-json',sizeBytes:1024,digest:d('c'),expired:false,createdAt:ts,expiresAt:later}];},
    ...overrides
  }};
}
function expectBounded(error){return error instanceof DirectValidationError&&typeof error.code==='string'&&typeof error.path==='string';}

function rehashAdmission(value){
  const keys=['schemaVersion','modeId','jobId','repositoryId','installationId','repositoryFullName','targetCommitSha','sourceCommitSha','policyVersion','profileId','parserVersion','resultContractVersion','capabilityId','fixtureId','admissionState','reason','executionEnabled','modeledResultDigest','summary','admittedAt'];
  const core=Object.fromEntries(keys.map(key=>[key,value[key]]));
  value.admissionDigest=sha256(core);value.admissionId=`direct-admission-${value.admissionDigest.slice(7,31)}`;return value;
}
function rehashOutcome(value){
  const core={schemaVersion:value.schemaVersion,modeId:value.modeId,jobId:value.jobId,targetCommitSha:value.targetCommitSha,fixtureId:value.fixtureId,terminalState:value.terminalState,transitions:value.transitions,executionPerformed:value.executionPerformed,resultManifest:value.resultManifest,producedAt:value.producedAt};
  value.outcomeDigest=sha256(core);value.outcomeId=`direct-outcome-${value.outcomeDigest.slice(7,31)}`;return value;
}
function rehashRunnerPublication(value){
  const core={schemaVersion:value.schemaVersion,modeId:value.modeId,jobId:value.jobId,targetCommitSha:value.targetCommitSha,outcomeId:value.outcomeId,resultManifest:value.resultManifest,reportIndex:value.reportIndex,ledgerPlans:value.ledgerPlans,adapterPlans:value.adapterPlans,publishedAt:value.publishedAt};
  value.publicationDigest=sha256(core);value.publicationId=`direct-runner-publication-${value.publicationDigest.slice(7,31)}`;return value;
}

test('adapter validates a publication plan before any transport lookup',async()=>{
  const fake=transport(),adapter=createInjectedGitHubAdapter({capabilityManifest:capabilityFor(),transport:fake.transport});
  const plan=planCheckPublication({request,name:'Audit',summary:'Waiting',conclusion:'neutral',at:later});
  const invalid={...plan,schemaVersion:'wrong-v1'};
  await assert.rejects(()=>adapter.publish({...identityFor(),plan:invalid}),expectBounded);
  assert.deepEqual(fake.calls,[]);
});

test('publication validator rejects accessors and revoked proxies without reading kind',()=>{
  let invoked=0;
  const hostile={};Object.defineProperty(hostile,'kind',{enumerable:true,get(){invoked++;throw new Error('must-not-run')}});
  assert.throws(()=>validatePublicationPlan(hostile),expectBounded);
  assert.equal(invoked,0);
  const {proxy,revoke}=Proxy.revocable({kind:'check'},{});revoke();
  assert.throws(()=>validatePublicationPlan(proxy),expectBounded);
});

test('artifact transport items reject hostile schema access without invoking getters',async()=>{
  let invoked=0;
  const hostile={artifactId:'artifact-1',name:'results-json',sizeBytes:1,digest:d('c'),expired:false,createdAt:ts,expiresAt:later};
  Object.defineProperty(hostile,'schemaVersion',{enumerable:true,get(){invoked++;throw new Error('must-not-run')}});
  const fake=transport({async getArtifactMetadata(input){fake.calls.push(['getArtifactMetadata',input]);return [hostile];}});
  const adapter=createInjectedGitHubAdapter({capabilityManifest:capabilityFor(),transport:fake.transport});
  await assert.rejects(()=>adapter.getArtifactMetadata(identityFor()),expectBounded);
  assert.equal(invoked,0);
});

test('adapter validates and identity-binds all transport return shapes',async()=>{
  const cases=[
    ['getRepository',{async getRepository(){return {repositoryId:999,fullName:request.repositoryFullName};}},(a)=>a.getRepository(identityFor())],
    ['getCommit',{async getCommit(){return {sha:'c'.repeat(40)};}},(a)=>a.getCommit(identityFor())],
    ['getBlob',{async getBlob(){return {blobSha:'c'.repeat(40),sizeBytes:3};}},(a)=>a.getBlob({...identityFor(),blobSha:blob})],
    ['getContents',{async getContents(){return {path:'other.sol',blobSha:blob};}},(a)=>a.getContents({...identityFor(),path:'contracts/A.sol'})],
    ['applyLedgerMutation',{async applyLedgerMutation(){return {applied:true,nextBlobSha:'not-a-sha'};}},(a)=>a.applyLedgerMutation({...identityFor(),mutation:planImmutableCreate({path:`.audit-direct/v1/requests/${request.jobId}.json`,content:request})})]
  ];
  for(const [name,override,invoke] of cases){
    const fake=transport(override),adapter=createInjectedGitHubAdapter({capabilityManifest:capabilityFor(),transport:fake.transport});
    await assert.rejects(()=>invoke(adapter),expectBounded,name);
  }
  const fake=transport({async publish(){return {published:true,publicationId:'wrong',rawBody:'attacker'};}}),adapter=createInjectedGitHubAdapter({capabilityManifest:capabilityFor(),transport:fake.transport});
  const plan=planCheckPublication({request,name:'Audit',summary:'Waiting',conclusion:'neutral',at:later});
  await assert.rejects(()=>adapter.publish({...identityFor(),plan}),expectBounded);
});

test('runner admission enforces complete fixture and unavailable truth correlations',()=>{
  const admission=admitDirectJob({request,capabilityManifest:capabilityFor(),sourceCommitSha:sha,admittedAt:later});
  const badReason=rehashAdmission({...structuredClone(admission),reason:'fixture_allowlisted'});
  assert.throws(()=>validateRunnerAdmission(badReason),expectBounded);
  const badSummary=rehashAdmission({...structuredClone(admission),summary:{findingCount:1,evidenceCount:0,artifactCount:0,truncated:false}});
  assert.throws(()=>validateRunnerAdmission(badSummary),expectBounded);
  const fixture=DIRECT_FIXTURE_ALLOWLIST.entries[0],fixtureRequest=requestFor(fixture.targetCommitSha,'fixture-request');
  const fixtureAdmission=admitDirectJob({request:fixtureRequest,capabilityManifest:capabilityFor(fixtureRequest),sourceCommitSha:fixture.targetCommitSha,admittedAt:later});
  const wrongFixture=rehashAdmission({...structuredClone(fixtureAdmission),fixtureId:'fixture-other-v1'});
  assert.throws(()=>validateRunnerAdmission(wrongFixture),expectBounded);
});

test('runner outcome enforces fixture/result execution truth and fixture payload',()=>{
  const admission=admitDirectJob({request,capabilityManifest:capabilityFor(),sourceCommitSha:sha,admittedAt:later});
  const outcome=orchestrateDirectJob({request,admission,producedAt:later});
  const fixture=DIRECT_FIXTURE_ALLOWLIST.entries[0],fixtureRequest=requestFor(fixture.targetCommitSha,'fixture-outcome');
  const fixtureAdmission=admitDirectJob({request:fixtureRequest,capabilityManifest:capabilityFor(fixtureRequest),sourceCommitSha:fixture.targetCommitSha,admittedAt:later});
  const fixtureOutcome=orchestrateDirectJob({request:fixtureRequest,admission:fixtureAdmission,producedAt:later});
  const invalid=rehashOutcome({...structuredClone(fixtureOutcome),fixtureId:null,terminalState:'execution_plane_unavailable',transitions:['admitted','awaiting_executor','execution_plane_unavailable']});
  assert.throws(()=>validateRunnerOutcome(invalid),expectBounded);
  const wrongFixture=rehashOutcome({...structuredClone(fixtureOutcome),fixtureId:'fixture-other-v1'});
  assert.throws(()=>validateRunnerOutcome(wrongFixture),expectBounded);
  assert.deepEqual(validateRunnerOutcome(outcome),outcome);
});

test('runner publication proves ledger content/paths and Check/status truth',()=>{
  const admission=admitDirectJob({request,capabilityManifest:capabilityFor(),sourceCommitSha:sha,admittedAt:later});
  const outcome=orchestrateDirectJob({request,admission,producedAt:later});
  const plan=planRunnerPublication({request,outcome,resultId:'result-1',reportId:'report-1',publishedAt:later});
  const wrongLedger=structuredClone(plan);
  wrongLedger.ledgerPlans[0]=planImmutableCreate({path:plan.ledgerPlans[0].path,content:plan.reportIndex});
  rehashRunnerPublication(wrongLedger);
  assert.throws(()=>validateRunnerPublicationPlan(wrongLedger),expectBounded);
  const wrongCheck=structuredClone(plan);
  wrongCheck.adapterPlans[0]=planCheckPublication({request,name:'CurveYield Direct Audit',summary:'Modeled repository fixture result published',conclusion:'success',at:later});
  rehashRunnerPublication(wrongCheck);
  assert.throws(()=>validateRunnerPublicationPlan(wrongCheck),expectBounded);
  const wrongStatus=structuredClone(plan);
  wrongStatus.adapterPlans[1]=planStatusPublication({request,state:'success',description:'Modeled fixture result available',context:'curveyield/direct-audit',at:later});
  rehashRunnerPublication(wrongStatus);
  assert.throws(()=>validateRunnerPublicationPlan(wrongStatus),expectBounded);
});
