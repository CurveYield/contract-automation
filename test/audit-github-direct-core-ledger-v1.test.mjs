import test from 'node:test';
import assert from 'node:assert/strict';
import { createDirectRequest,createDirectState } from '../packages/audit-github-direct-protocol/src/index.mjs';
import {
  DIRECT_MODE_ID, CONTROL_BRANCH,
  buildLedgerPaths, planImmutableCreate, planCasUpdate,
  createJobIndex, planJobIndexUpdate,
  transitionLedgerState, planRequestPublication,
  planPartialWriteRecovery, validateLedgerMutation, validateJobIndex,
  validateLedgerTransition, validateRecoveryPlan, validateRequestPublicationPlan
} from '../packages/audit-github-direct-ledger/src/index.mjs';

const ts='2026-08-01T18:00:00.000Z',later='2026-08-01T18:05:00.000Z';
const sha='a'.repeat(40),blob='b'.repeat(40),blob2='c'.repeat(40);
const d=(c)=>`sha256:${c.repeat(64)}`;
const request=createDirectRequest({repositoryId:123,installationId:456,repositoryFullName:'curveyield/contract-automation',requesterId:'user-1',policyVersion:'direct-policy-v1',profileId:'hardhat-test-v1',parserVersion:'hardhat-test-parser-v1',resultContractVersion:'phase5-tool-result-v1',reportContractVersion:'audit-report-v1',targetCommitSha:sha,requestedAt:ts,idempotencyKey:'request-1'});

test('ledger paths are exact, confined, and caller paths are impossible',()=>{
  const paths=buildLedgerPaths({jobId:request.jobId,eventId:'event-1',resultId:'result-1',reportId:'report-1'});
  assert.deepEqual(paths,{
    request:`.audit-direct/v1/requests/${request.jobId}.json`,
    current:`.audit-direct/v1/current/${request.jobId}.json`,
    event:`.audit-direct/v1/events/${request.jobId}/event-1.json`,
    result:`.audit-direct/v1/results/${request.jobId}/result-1.json`,
    report:`.audit-direct/v1/reports/${request.jobId}/report-1.json`,
    manifest:`.audit-direct/v1/manifests/${request.jobId}.json`,
    jobIndex:'.audit-direct/v1/indexes/jobs-v1.json'
  });
  assert.equal(CONTROL_BRANCH,'audit-direct/control-v1');
  assert.throws(()=>buildLedgerPaths({jobId:'../escape',eventId:'event-1',resultId:'result-1',reportId:'report-1'}),{code:'invalid_identifier'});
  assert.throws(()=>buildLedgerPaths({jobId:request.jobId,eventId:'latest',resultId:'result-1',reportId:'report-1'}),{code:'invalid_identifier'});
});

test('immutable create plan is create-only, data-only, and deterministic',()=>{
  const content={schemaVersion:'example-v1',jobId:request.jobId};
  const first=planImmutableCreate({path:`.audit-direct/v1/requests/${request.jobId}.json`,content});
  const second=planImmutableCreate({path:`.audit-direct/v1/requests/${request.jobId}.json`,content});
  assert.deepEqual(second,first);
  assert.equal(first.modeId,DIRECT_MODE_ID);
  assert.equal(first.branch,CONTROL_BRANCH);
  assert.equal(first.operation,'create-immutable');
  assert.equal(first.expectedBlobSha,null);
  assert.equal(first.sideEffects,false);
  assert.throws(()=>planImmutableCreate({path:'outside/file.json',content}),{code:'ledger_path_violation'});
});

test('CAS update requires exact current blob SHA and rejects stale writes',()=>{
  const content={schemaVersion:'current-v1',version:1};
  const plan=planCasUpdate({path:`.audit-direct/v1/current/${request.jobId}.json`,content,currentBlobSha:blob,expectedBlobSha:blob});
  assert.equal(plan.operation,'update-cas');
  assert.equal(plan.expectedBlobSha,blob);
  assert.throws(()=>planCasUpdate({path:`.audit-direct/v1/current/${request.jobId}.json`,content,currentBlobSha:blob,expectedBlobSha:blob2}),{code:'stale_blob_sha'});
  assert.throws(()=>planCasUpdate({path:`.audit-direct/v1/current/${request.jobId}.json`,content,currentBlobSha:'main',expectedBlobSha:'main'}),{code:'invalid_blob_sha'});
});

test('job index is sorted, server-owned, frozen, and validates uniqueness',()=>{
  const index=createJobIndex({entries:[{jobId:'direct-job-b',targetCommitSha:'b'.repeat(40),state:'requested',currentPath:'.audit-direct/v1/current/direct-job-b.json',currentBlobSha:blob2},{jobId:'direct-job-a',targetCommitSha:sha,state:'validating',currentPath:'.audit-direct/v1/current/direct-job-a.json',currentBlobSha:blob}],updatedAt:ts});
  assert.deepEqual(index.entries.map((x)=>x.jobId),['direct-job-a','direct-job-b']);
  assert.equal(index.serverOwned,true);
  assert.equal(Object.isFrozen(index),true);
  assert.throws(()=>createJobIndex({entries:[index.entries[0],index.entries[0]],updatedAt:ts}),{code:'duplicate_identity'});
});

test('job index update is exact CAS and cannot accept caller-authored snapshots',()=>{
  const current=createJobIndex({entries:[],updatedAt:ts});
  const plan=planJobIndexUpdate({currentIndex:current,currentBlobSha:blob,expectedBlobSha:blob,entry:{jobId:request.jobId,targetCommitSha:sha,state:'requested',currentPath:`.audit-direct/v1/current/${request.jobId}.json`,currentBlobSha:blob2},updatedAt:later});
  assert.equal(plan.path,'.audit-direct/v1/indexes/jobs-v1.json');
  assert.equal(plan.operation,'update-cas');
  assert.equal(plan.content.entries.length,1);
  assert.throws(()=>planJobIndexUpdate({currentIndex:{...current,serverOwned:false},currentBlobSha:blob,expectedBlobSha:blob,entry:{jobId:request.jobId,targetCommitSha:sha,state:'requested',currentPath:`.audit-direct/v1/current/${request.jobId}.json`,currentBlobSha:blob2},updatedAt:later}),{code:'server_owned_index_required'});
});

test('request publication plans immutable request, first current pointer, and index CAS',()=>{
  const index=createJobIndex({entries:[],updatedAt:ts});
  const plan=planRequestPublication({request,currentIndex:index,indexBlobSha:blob,at:ts});
  assert.deepEqual(plan.operations.map((x)=>x.operation),['create-immutable','create-immutable','update-cas']);
  assert.equal(plan.operations[0].path,`.audit-direct/v1/requests/${request.jobId}.json`);
  assert.equal(plan.operations[1].path,`.audit-direct/v1/current/${request.jobId}.json`);
  assert.equal(plan.operations[2].path,'.audit-direct/v1/indexes/jobs-v1.json');
});

test('ledger transition state machine is monotonic, idempotent, and terminal-protected',()=>{
  const current=createDirectState({request,state:'requested',version:0,updatedAt:ts});
  const first=transitionLedgerState({request,currentState:current,currentBlobSha:blob,indexBlobSha:blob2,to:'validating',reasonCode:'validation-started',at:later,currentIndex:createJobIndex({entries:[],updatedAt:ts})});
  const replay=transitionLedgerState({request,currentState:current,currentBlobSha:blob,indexBlobSha:blob2,to:'validating',reasonCode:'validation-started',at:later,currentIndex:createJobIndex({entries:[],updatedAt:ts})});
  assert.deepEqual(replay,first);
  assert.equal(first.nextState.version,1);
  assert.deepEqual(first.operations.map((x)=>x.operation),['create-immutable','update-cas','update-cas']);
  assert.throws(()=>transitionLedgerState({request,currentState:createDirectState({request,state:'completed',version:4,updatedAt:ts}),currentBlobSha:blob,indexBlobSha:blob2,to:'validating',reasonCode:'bad',at:later,currentIndex:createJobIndex({entries:[],updatedAt:ts})}),{code:'terminal_state'});
  assert.throws(()=>transitionLedgerState({request,currentState:current,currentBlobSha:blob,indexBlobSha:blob2,to:'completed',reasonCode:'skip',at:later,currentIndex:createJobIndex({entries:[],updatedAt:ts})}),{code:'invalid_transition'});
});

test('partial-write recovery skips exact immutable writes and converges remaining plans',()=>{
  const plans=[
    planImmutableCreate({path:`.audit-direct/v1/requests/${request.jobId}.json`,content:request}),
    planImmutableCreate({path:`.audit-direct/v1/events/${request.jobId}/event-1.json`,content:{id:'event-1'}}),
    planCasUpdate({path:`.audit-direct/v1/current/${request.jobId}.json`,content:{version:1},currentBlobSha:blob,expectedBlobSha:blob})
  ];
  const recovered=planPartialWriteRecovery({plans,observed:[{path:plans[0].path,contentDigest:plans[0].contentDigest,blobSha:blob}],currentBlobShas:{[plans[2].path]:blob}});
  assert.equal(recovered.converged,false);
  assert.deepEqual(recovered.remaining.map((x)=>x.path),[plans[1].path,plans[2].path]);
  const done=planPartialWriteRecovery({plans,observed:[{path:plans[0].path,contentDigest:plans[0].contentDigest,blobSha:blob},{path:plans[1].path,contentDigest:plans[1].contentDigest,blobSha:blob2}],currentBlobShas:{[plans[2].path]:plans[2].nextContentBlobSha}});
  assert.equal(done.converged,true);
  assert.deepEqual(done.remaining,[]);
});

test('partial-write recovery rejects conflicting immutable content and stale pointers',()=>{
  const immutable=planImmutableCreate({path:`.audit-direct/v1/requests/${request.jobId}.json`,content:request});
  assert.throws(()=>planPartialWriteRecovery({plans:[immutable],observed:[{path:immutable.path,contentDigest:d('f'),blobSha:blob}],currentBlobShas:{}}),{code:'immutable_conflict'});
  const cas=planCasUpdate({path:`.audit-direct/v1/current/${request.jobId}.json`,content:{version:1},currentBlobSha:blob,expectedBlobSha:blob});
  assert.throws(()=>planPartialWriteRecovery({plans:[cas],observed:[],currentBlobShas:{[cas.path]:blob2}}),{code:'stale_blob_sha'});
});

test('ledger plans reject one-field mutations and never perform prefix discovery',()=>{
  const plan=planImmutableCreate({path:`.audit-direct/v1/requests/${request.jobId}.json`,content:request});
  assert.equal(plan.usesPrefixListing,false);
  for(const key of Object.keys(plan)){
    const copy=structuredClone(plan);copy[key]=key==='sideEffects'?!copy[key]:'wrong';
    assert.notDeepEqual(copy,plan);
  }
  assert.doesNotMatch(JSON.stringify({path:plan.path,content:plan.content}),/list|discover|prefix/i);
});


test('ledger output validators enforce replay identity and one-field mutations',()=>{
  const index=createJobIndex({entries:[],updatedAt:ts});
  const immutable=planImmutableCreate({path:`.audit-direct/v1/requests/${request.jobId}.json`,content:request});
  const publication=planRequestPublication({request,currentIndex:index,indexBlobSha:blob,at:ts});
  const current=createDirectState({request,state:'requested',version:0,updatedAt:ts});
  const transition=transitionLedgerState({request,currentState:current,currentBlobSha:blob,indexBlobSha:blob2,to:'validating',reasonCode:'validation-started',at:later,currentIndex:index});
  const recovery=planPartialWriteRecovery({plans:[immutable],observed:[],currentBlobShas:{}});
  const pairs=[[immutable,validateLedgerMutation],[index,validateJobIndex],[publication,validateRequestPublicationPlan],[transition,validateLedgerTransition],[recovery,validateRecoveryPlan]];
  let mutations=0;
  for(const [value,validate] of pairs){
    assert.deepEqual(validate(value),value);
    for(const key of Object.keys(value)){
      const copy=structuredClone(value);
      if(key.endsWith('Digest'))copy[key]=d('f');
      else if(key.endsWith('Sha'))copy[key]='d'.repeat(40);
      else if(typeof copy[key]==='boolean')copy[key]=!copy[key];
      else if(Array.isArray(copy[key]))copy[key]=[...copy[key],copy[key][0]??{}];
      else if(typeof copy[key]==='object'&&copy[key]!==null)copy[key]={...copy[key],extra:true};
      else copy[key]='wrong';
      assert.throws(()=>validate(copy),(error)=>typeof error.code==='string'&&typeof error.path==='string');
      mutations++;
    }
  }
  assert.ok(mutations>=28);
});

test('partial recovery boundary rejects hostile maps and non-ledger paths',()=>{
  const immutable=planImmutableCreate({path:`.audit-direct/v1/requests/${request.jobId}.json`,content:request});
  const hostile=new Proxy({}, {ownKeys(){throw new Error('trap')}});
  assert.throws(()=>planPartialWriteRecovery({plans:[immutable],observed:[],currentBlobShas:hostile}),{code:'hostile_reflection'});
  assert.throws(()=>planPartialWriteRecovery({plans:[immutable],observed:[{path:'outside.json',contentDigest:immutable.contentDigest,blobSha:blob}],currentBlobShas:{}}),{code:'ledger_path_violation'});
});
