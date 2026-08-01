import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDirectRequest, createCapabilityManifest
} from '../packages/audit-github-direct-protocol/src/index.mjs';
import {
  DIRECT_FIXTURE_ALLOWLIST, validateFixtureAllowlist,
  admitDirectJob, validateRunnerAdmission,
  orchestrateDirectJob, validateRunnerOutcome,
  planRunnerPublication, validateRunnerPublicationPlan
} from '../packages/audit-github-direct-runner/src/index.mjs';

const ts='2026-08-01T18:00:00.000Z';
const later='2026-08-01T18:05:00.000Z';
const d=(c)=>`sha256:${c.repeat(64)}`;
const requestFor=(targetCommitSha='a'.repeat(40),overrides={})=>createDirectRequest({
  repositoryId:123,installationId:456,repositoryFullName:'curveyield/contract-automation',requesterId:'user-1',
  policyVersion:'direct-policy-v1',profileId:'hardhat-test-v1',parserVersion:'hardhat-test-parser-v1',
  resultContractVersion:'phase5-tool-result-v1',reportContractVersion:'audit-report-v1',targetCommitSha,
  requestedAt:ts,idempotencyKey:`request-${targetCommitSha.slice(0,8)}`,...overrides
});
const capabilityFor=(request,capabilities=['read-source','write-control-ledger','publish-check','publish-status'])=>createCapabilityManifest({
  request,authorizationKind:'github-token',capabilities,issuedAt:ts,expiresAt:later
});

test('repository-owned fixture allowlist is immutable, validated, and not request-expandable',()=>{
  assert.equal(Object.isFrozen(DIRECT_FIXTURE_ALLOWLIST),true);
  assert.equal(Object.isFrozen(DIRECT_FIXTURE_ALLOWLIST.entries),true);
  assert.deepEqual(validateFixtureAllowlist(DIRECT_FIXTURE_ALLOWLIST),DIRECT_FIXTURE_ALLOWLIST);
  assert.equal(DIRECT_FIXTURE_ALLOWLIST.entries.length,1);
  assert.throws(()=>requestFor('f'.repeat(40),{fixtureId:'fixture-hardhat-empty-v1'}),{code:'unknown_field'});
  assert.throws(()=>requestFor('f'.repeat(40),{allowFixture:true}),{code:'unknown_field'});
});

test('non-fixture exact-SHA request admits only to awaiting_executor with execution disabled',()=>{
  const request=requestFor();
  const admission=admitDirectJob({request,capabilityManifest:capabilityFor(request),sourceCommitSha:request.targetCommitSha,admittedAt:later});
  assert.equal(admission.admissionState,'awaiting_executor');
  assert.equal(admission.reason,'execution_plane_unavailable');
  assert.equal(admission.fixtureId,null);
  assert.equal(admission.executionEnabled,false);
  assert.deepEqual(validateRunnerAdmission(admission),admission);
});

test('exact repository-owned fixture admits only to deterministic modeled fixture outcome',()=>{
  const fixture=DIRECT_FIXTURE_ALLOWLIST.entries[0];
  const request=requestFor(fixture.targetCommitSha,{idempotencyKey:'fixture-request-1'});
  const admission=admitDirectJob({request,capabilityManifest:capabilityFor(request),sourceCommitSha:fixture.targetCommitSha,admittedAt:later});
  assert.equal(admission.admissionState,'fixture_modeled');
  assert.equal(admission.fixtureId,fixture.fixtureId);
  assert.equal(admission.modeledResultDigest,fixture.modeledResultDigest);
  assert.equal(admission.executionEnabled,false);
});

test('admission rejects source SHA, identity, contract, policy, and capability drift',()=>{
  const request=requestFor();
  const capability=capabilityFor(request);
  assert.throws(()=>admitDirectJob({request,capabilityManifest:capability,sourceCommitSha:'b'.repeat(40),admittedAt:later}),{code:'source_sha_mismatch'});
  const other=requestFor('b'.repeat(40),{idempotencyKey:'request-b'});
  assert.throws(()=>admitDirectJob({request,capabilityManifest:capabilityFor(other),sourceCommitSha:request.targetCommitSha,admittedAt:later}),{code:'capability_request_mismatch'});
  assert.throws(()=>admitDirectJob({request,capabilityManifest:capabilityFor(request,['read-source']),sourceCommitSha:request.targetCommitSha,admittedAt:later}),{code:'capability_missing'});
  const policyDrift=requestFor(request.targetCommitSha,{policyVersion:'other-policy-v1'});
  assert.equal(admitDirectJob({request:policyDrift,capabilityManifest:capabilityFor(policyDrift),sourceCommitSha:policyDrift.targetCommitSha,admittedAt:later}).fixtureId,null);
});

test('non-fixture orchestration truthfully stops at execution_plane_unavailable',()=>{
  const request=requestFor();
  const admission=admitDirectJob({request,capabilityManifest:capabilityFor(request),sourceCommitSha:request.targetCommitSha,admittedAt:later});
  const outcome=orchestrateDirectJob({request,admission,producedAt:later});
  assert.equal(outcome.terminalState,'execution_plane_unavailable');
  assert.deepEqual(outcome.transitions,['admitted','awaiting_executor','execution_plane_unavailable']);
  assert.equal(outcome.executionPerformed,false);
  assert.equal(outcome.resultManifest.outcome,'execution_unavailable');
  assert.equal(outcome.resultManifest.resultDigest,null);
  assert.deepEqual(validateRunnerOutcome(outcome),outcome);
});

test('fixture orchestration models accepted inert result without executing submitted code',()=>{
  const fixture=DIRECT_FIXTURE_ALLOWLIST.entries[0];
  const request=requestFor(fixture.targetCommitSha,{idempotencyKey:'fixture-request-2'});
  const admission=admitDirectJob({request,capabilityManifest:capabilityFor(request),sourceCommitSha:request.targetCommitSha,admittedAt:later});
  const outcome=orchestrateDirectJob({request,admission,producedAt:later});
  assert.equal(outcome.terminalState,'completed');
  assert.deepEqual(outcome.transitions,['admitted','fixture_running','publishing','completed']);
  assert.equal(outcome.executionPerformed,false);
  assert.equal(outcome.resultManifest.outcome,'modeled_fixture');
  assert.equal(outcome.resultManifest.resultDigest,fixture.modeledResultDigest);
});

test('request data cannot select commands, workflows, runner labels, images, URLs, or execution flags',()=>{
  for(const [key,value] of Object.entries({command:'npm test',script:'./run.sh',workflow:'audit.yml',runnerLabel:'self-hosted',image:'node:latest',url:'https://example.test',rpcEndpoint:'https://rpc.test',executionEnabled:true})){
    assert.throws(()=>requestFor('a'.repeat(40),{[key]:value}),{code:'unknown_field'},key);
  }
});

test('publication plan creates immutable result/report ledger records and truthful Check/status plans',()=>{
  const request=requestFor();
  const admission=admitDirectJob({request,capabilityManifest:capabilityFor(request),sourceCommitSha:request.targetCommitSha,admittedAt:later});
  const outcome=orchestrateDirectJob({request,admission,producedAt:later});
  const plan=planRunnerPublication({request,outcome,resultId:'result-1',reportId:'report-1',publishedAt:later});
  assert.deepEqual(plan.ledgerPlans.map((entry)=>entry.operation),['create-immutable','create-immutable']);
  assert.deepEqual(plan.adapterPlans.map((entry)=>entry.kind),['check','status']);
  assert.equal(plan.adapterPlans[0].conclusion,'neutral');
  assert.equal(plan.adapterPlans[1].state,'error');
  assert.doesNotMatch(JSON.stringify(plan),/successfully executed|executionEnabled\s*[:=]\s*true/i);
  assert.deepEqual(validateRunnerPublicationPlan(plan),plan);
});

test('fixture publication uses success only for modeled fixture and remains replay-stable',()=>{
  const fixture=DIRECT_FIXTURE_ALLOWLIST.entries[0];
  const request=requestFor(fixture.targetCommitSha,{idempotencyKey:'fixture-request-3'});
  const admission=admitDirectJob({request,capabilityManifest:capabilityFor(request),sourceCommitSha:request.targetCommitSha,admittedAt:later});
  const outcome=orchestrateDirectJob({request,admission,producedAt:later});
  const first=planRunnerPublication({request,outcome,resultId:'result-fixture',reportId:'report-fixture',publishedAt:later});
  const replay=planRunnerPublication({request,outcome,resultId:'result-fixture',reportId:'report-fixture',publishedAt:later});
  assert.deepEqual(replay,first);
  assert.equal(first.adapterPlans[0].conclusion,'success');
  assert.equal(first.adapterPlans[1].state,'success');
});

test('runner admission/outcome/publication reject one-field mutations with bounded errors',()=>{
  const request=requestFor();
  const admission=admitDirectJob({request,capabilityManifest:capabilityFor(request),sourceCommitSha:request.targetCommitSha,admittedAt:later});
  const outcome=orchestrateDirectJob({request,admission,producedAt:later});
  const publication=planRunnerPublication({request,outcome,resultId:'result-1',reportId:'report-1',publishedAt:later});
  const pairs=[[admission,validateRunnerAdmission],[outcome,validateRunnerOutcome],[publication,validateRunnerPublicationPlan]];
  let mutations=0;
  for(const [value,validate] of pairs){
    for(const key of Object.keys(value)){
      const copy=structuredClone(value);
      if(key.endsWith('Digest'))copy[key]=d('f');
      else if(key.endsWith('Sha'))copy[key]='b'.repeat(40);
      else if(typeof copy[key]==='boolean')copy[key]=!copy[key];
      else if(Array.isArray(copy[key]))copy[key]=[...copy[key],'wrong'];
      else if(copy[key]===null)copy[key]='wrong';
      else if(typeof copy[key]==='object')copy[key]={...copy[key],extra:true};
      else copy[key]='wrong';
      assert.throws(()=>validate(copy),(error)=>typeof error.code==='string'&&typeof error.path==='string');
      mutations++;
    }
  }
  assert.ok(mutations>=25);
});
