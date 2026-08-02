import test from 'node:test';
import assert from 'node:assert/strict';
import { createDirectRequest,sha256 } from '../packages/audit-github-direct-protocol/src/index.mjs';
import { createInjectedAuthorizationBroker } from '../packages/audit-github-direct-auth/src/index.mjs';
import { createDirectService,createServiceCommand } from '../packages/audit-github-direct-service/src/index.mjs';

const at='2026-08-01T23:40:00.000Z';
const later='2026-08-01T23:45:00.000Z';
const later2='2026-08-01T23:50:00.000Z';
function requestFor(target='a'.repeat(40),key=`request-${target[0]}`){return createDirectRequest({repositoryId:123,installationId:456,repositoryFullName:'curveyield/contract-automation',requesterId:'user-1',policyVersion:'direct-policy-v1',profileId:'hardhat-test-v1',parserVersion:'hardhat-test-parser-v1',resultContractVersion:'phase5-tool-result-v1',reportContractVersion:'audit-report-v1',targetCommitSha:target,requestedAt:at,idempotencyKey:key});}
function harness(){
  const calls=[],store=new Map(),publications=new Map();
  const transport={
    async getRepository(args){calls.push(['getRepository',args]);return {id:args.repositoryId}},
    async getCommit(args){calls.push(['getCommit',args]);return {sha:args.targetCommitSha}},
    async getBlob(args){calls.push(['getBlob',args]);return {sha:args.blobSha}},
    async getContents(args){calls.push(['getContents',args.path]);return store.get(args.path)??null},
    async applyLedgerMutation(args){
      const mutation=args.mutation;calls.push(['applyLedgerMutation',mutation.operation,mutation.path]);
      const existing=store.get(mutation.path);
      if(mutation.operation==='create-immutable'&&existing){
        if(sha256(existing.content)!==mutation.contentDigest){const e=new Error('immutable_conflict');e.code='immutable_conflict';throw e;}
        return {applied:false,nextBlobSha:existing.blobSha};
      }
      if(mutation.operation==='update-cas'&&(!existing||existing.blobSha!==mutation.expectedBlobSha)){const e=new Error('stale_blob_sha');e.code='stale_blob_sha';throw e;}
      const nextBlobSha=(store.size+1+calls.length).toString(16).padStart(40,'0');
      store.set(mutation.path,{content:mutation.content,blobSha:nextBlobSha});
      return {applied:true,nextBlobSha};
    },
    async getPublication(args){calls.push(['getPublication',args.kind]);return publications.get(`${args.kind}:${args.idempotencyKey}`)??null},
    async publish(plan){
      calls.push(['publish',plan.kind]);
      const key=`${plan.kind}:${plan.idempotencyKey}`;
      const prior=publications.get(key);
      if(prior&&JSON.stringify(prior)!==JSON.stringify(plan)){const e=new Error('publication_conflict');e.code='publication_conflict';throw e;}
      if(prior)return {action:'noop',publicationId:plan.publicationId};
      publications.set(key,plan);return {action:'create',publicationId:plan.publicationId};
    },
    async getArtifactMetadata(args){calls.push(['getArtifactMetadata',args.targetCommitSha]);return [{artifactId:'artifact-1',name:'result-json',sizeBytes:100,digest:`sha256:${'c'.repeat(64)}`,expired:false,createdAt:at,expiresAt:later}]}
  };
  const broker=createInjectedAuthorizationBroker({issueTransport:async input=>({authorizationKind:'github-token',repositoryId:input.repositoryId,installationId:input.installationId,repositoryFullName:input.repositoryFullName,targetCommitSha:input.targetCommitSha,issuedAt:at,expiresAt:later2,capabilities:input.capabilities,transport})});
  const read=(path)=>store.get(path)??null;
  const snapshotReader=async({kind,request})=>{
    const current=read(`.audit-direct/v1/current/${request.jobId}.json`);
    const index=read('.audit-direct/v1/indexes/jobs-v1.json');
    const admission=read(`.audit-direct/v1/manifests/${request.jobId}-admission.json`);
    const outcome=read(`.audit-direct/v1/manifests/${request.jobId}.json`);
    if(kind==='submit')return {currentIndex:index?.content??null,indexBlobSha:index?.blobSha??null,currentState:current?.content??null,currentBlobSha:current?.blobSha??null,admission:admission?.content??null,outcome:outcome?.content??null};
    if(kind==='current')return {currentState:current?.content??null,currentBlobSha:current?.blobSha??null};
    if(kind==='cancel')return {currentState:current?.content??null,currentBlobSha:current?.blobSha??null,currentIndex:index?.content??null,indexBlobSha:index?.blobSha??null,admission:admission?.content??null,outcome:outcome?.content??null};
    return {currentState:current?.content??null,currentBlobSha:current?.blobSha??null,currentIndex:index?.content??null,indexBlobSha:index?.blobSha??null,admission:admission?.content??null,outcome:outcome?.content??null};
  };
  return {calls,store,publications,service:createDirectService({authorizationBroker:broker,snapshotReader})};
}

test('non-fixture submit publishes one Check and remains cancellable at awaiting_executor',async()=>{
  const h=harness(),request=requestFor();
  const command=createServiceCommand({kind:'submit',request,at:later,resultId:'result-1',reportId:'report-1',commentBody:'Execution unavailable.'});
  const result=await h.service.execute(command);
  assert.equal(result.state,'accepted');
  assert.equal(result.cloudflareFallback,false);
  assert.equal(result.data.admission.admissionState,'awaiting_executor');
  assert.equal(result.data.currentState.state,'awaiting_executor');
  assert.deepEqual(result.data.publications.map(x=>x.plan?.kind??x.kind),['check']);
  assert.ok(h.store.has(`.audit-direct/v1/manifests/${request.jobId}-admission.json`));
  assert.equal(h.store.has(`.audit-direct/v1/manifests/${request.jobId}.json`),false);
  assert.deepEqual(h.calls.filter(x=>x[0]==='publish').map(x=>x[1]),['check']);
});

test('fixture submit completes modeled result without execution',async()=>{
  const h=harness(),request=requestFor('f'.repeat(40),'fixture-request');
  const result=await h.service.execute(createServiceCommand({kind:'submit',request,at:later,resultId:'result-f',reportId:'report-f',commentBody:'Fixture modeled.'}));
  assert.equal(result.state,'completed');
  assert.equal(result.data.currentState.state,'completed');
  assert.equal(result.data.outcome.resultManifest.outcome,'modeled_fixture');
  assert.equal(result.data.outcome.executionPerformed,false);
  assert.deepEqual(result.data.bundle.publications.map(x=>x.kind),['check','status','comment']);
});

test('status and report advance an awaiting job truthfully to execution_plane_unavailable',async()=>{
  const h=harness(),request=requestFor();
  await h.service.execute(createServiceCommand({kind:'submit',request,at:later,resultId:'result-1',reportId:'report-1',commentBody:'Submitted.'}));
  const status=await h.service.execute(createServiceCommand({kind:'status',request,at:later2}));
  assert.equal(status.state,'completed');
  assert.equal(status.data.currentState.state,'awaiting_executor');
  const report=await h.service.execute(createServiceCommand({kind:'report',request,at:later2,resultId:'result-1',reportId:'report-1',commentBody:'Execution unavailable.'}));
  assert.equal(report.state,'execution_plane_unavailable');
  assert.equal(report.data.currentState.state,'execution_plane_unavailable');
  assert.equal(report.data.outcome.executionPerformed,false);
  assert.deepEqual(report.data.bundle.publications.map(x=>x.kind),['status','comment']);
  assert.deepEqual(h.calls.filter(x=>x[0]==='publish').map(x=>x[1]),['check','status','comment']);
  assert.equal(report.data.artifacts.items.length,1);
});

test('cancel from awaiting_executor publishes cancellation result, status, and comment',async()=>{
  const h=harness(),request=requestFor();
  await h.service.execute(createServiceCommand({kind:'submit',request,at:later,resultId:'result-1',reportId:'report-1',commentBody:'Submitted.'}));
  const cancel=await h.service.execute(createServiceCommand({kind:'cancel',request,at:later2,reasonCode:'user-cancelled'}));
  assert.equal(cancel.state,'cancelled');
  assert.equal(cancel.data.currentState.state,'cancelled');
  assert.equal(cancel.data.bundle.resultManifest.outcome,'cancelled');
  assert.deepEqual(cancel.data.bundle.publications.map(x=>x.kind),['status','comment']);
  assert.deepEqual(h.calls.filter(x=>x[0]==='publish').map(x=>x[1]),['check','status','comment']);
  assert.ok([...h.store.keys()].some(x=>x.includes('/results/')&&x.includes('cancel-result')));
  assert.ok([...h.store.keys()].some(x=>x.includes('/reports/')&&x.includes('cancel-report')));
});

test('capabilities and fixture verification use fixed service paths',async()=>{
  const h=harness(),request=requestFor();
  const caps=await h.service.execute(createServiceCommand({kind:'capabilities',request,at:later}));
  assert.equal(caps.state,'completed');
  const verify=await h.service.execute(createServiceCommand({kind:'verify-fixture',request,at:later,sourceCommitSha:request.targetCommitSha}));
  assert.equal(verify.state,'execution_plane_unavailable');
});

test('terminal report replay is time-stable while changed content conflicts',async()=>{
  const h=harness(),request=requestFor();
  await h.service.execute(createServiceCommand({kind:'submit',request,at:later,resultId:'result-1',reportId:'report-1',commentBody:'Submitted.'}));
  const first=await h.service.execute(createServiceCommand({kind:'report',request,at:later,resultId:'result-1',reportId:'report-1',commentBody:'Same.'}));
  assert.equal(first.state,'execution_plane_unavailable');
  const second=await h.service.execute(createServiceCommand({kind:'report',request,at:later2,resultId:'result-1',reportId:'report-1',commentBody:'Same.'}));
  assert.ok(second.data.publications.every(x=>x.action==='noop'));
  const conflict=await h.service.execute(createServiceCommand({kind:'report',request,at:later2,resultId:'result-1',reportId:'report-1',commentBody:'Different.'}));
  assert.equal(conflict.schemaVersion,'github-direct-service-error-v1');
  assert.equal(conflict.code,'publication_conflict');
  assert.doesNotMatch(JSON.stringify(conflict),/Different|token|https?:/i);
});
