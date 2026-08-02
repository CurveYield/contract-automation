import test from 'node:test';
import assert from 'node:assert/strict';
import { createDirectRequest,createCapabilityManifest } from '../packages/audit-github-direct-protocol/src/index.mjs';
import { admitDirectJob,orchestrateDirectJob } from '../packages/audit-github-direct-runner/src/index.mjs';
import { createReportingBundle,createSubmissionReportingBundle,createTerminalReportingBundle,createCancellationReportingBundle,validateReportingBundle,ingestArtifactMetadata,validateArtifactMetadataIndex } from '../packages/audit-github-direct-reporting/src/index.mjs';

const at='2026-08-01T23:40:00.000Z',later='2026-08-01T23:45:00.000Z';
function make(target='a'.repeat(40)){
  const request=createDirectRequest({repositoryId:123,installationId:456,repositoryFullName:'curveyield/contract-automation',requesterId:'user-1',policyVersion:'direct-policy-v1',profileId:'hardhat-test-v1',parserVersion:'hardhat-test-parser-v1',resultContractVersion:'phase5-tool-result-v1',reportContractVersion:'audit-report-v1',targetCommitSha:target,requestedAt:at,idempotencyKey:`request-${target[0]}`});
  const capability=createCapabilityManifest({request,authorizationKind:'github-token',capabilities:['read-source'],issuedAt:at,expiresAt:later});
  const admission=admitDirectJob({request,capabilityManifest:capability,sourceCommitSha:target,admittedAt:later});
  return {request,outcome:orchestrateDirectJob({request,admission,producedAt:later})};
}

test('non-fixture reporting is truthful and includes check/status/comment',()=>{
  const {request,outcome}=make();
  const bundle=createReportingBundle({request,outcome,resultId:'result-1',reportId:'report-1',commentBody:'Execution unavailable.',publishedAt:later});
  assert.deepEqual(bundle.publications.map(x=>x.kind),['check','status','comment']);
  assert.equal(bundle.publications[0].conclusion,'neutral');
  assert.equal(bundle.publications[1].state,'error');
  assert.equal(bundle.resultManifest.resultDigest,null);
  assert.deepEqual(validateReportingBundle(bundle),bundle);
});

test('fixture reporting succeeds only for modeled fixture',()=>{
  const {request,outcome}=make('f'.repeat(40));
  const bundle=createReportingBundle({request,outcome,resultId:'result-f',reportId:'report-f',commentBody:'Modeled fixture.',publishedAt:later});
  assert.equal(bundle.publications[0].conclusion,'success');
  assert.equal(bundle.publications[1].state,'success');
  assert.equal(outcome.executionPerformed,false);
});

test('artifact ingestion is metadata-only, bounded, and rejects extra bytes/URLs',()=>{
  const {request}=make();
  const item={artifactId:'artifact-1',name:'result-json',sizeBytes:1024,digest:`sha256:${'a'.repeat(64)}`,expired:false,createdAt:at,expiresAt:later};
  const index=ingestArtifactMetadata({request,items:[item]});
  assert.deepEqual(validateArtifactMetadataIndex(index),index);
  assert.doesNotMatch(JSON.stringify(index),/download|https?:|contentBody|artifactBytes/i);
  assert.throws(()=>ingestArtifactMetadata({request,items:[{...item,url:'https://evil.test'}]}),{code:'unknown_field'});
  assert.throws(()=>ingestArtifactMetadata({request,items:[{...item,sizeBytes:2_000_000_001}]}),{code:'invalid_integer'});
});


test('awaiting-executor submission publishes only one neutral Check',()=>{
  const {request}=make();
  const bundle=createSubmissionReportingBundle({request,publishedAt:later});
  assert.deepEqual(bundle.publications.map(x=>x.kind),['check']);
  assert.equal(bundle.publications[0].conclusion,'neutral');
  assert.match(bundle.publications[0].summary,/awaiting executor/i);
});

test('terminal unavailable reporting omits the already-published Check',()=>{
  const {request,outcome}=make();
  const bundle=createTerminalReportingBundle({request,outcome,resultId:'result-1',reportId:'report-1',commentBody:'Execution unavailable.',publishedAt:later});
  assert.deepEqual(bundle.publications.map(x=>x.kind),['status','comment']);
  assert.equal(bundle.publications[0].state,'error');
  assert.equal(bundle.resultManifest.executionState,'execution_plane_unavailable');
});

test('cancellation reporting is not executed and publishes status/comment only',()=>{
  const {request}=make();
  const bundle=createCancellationReportingBundle({request,stateVersion:4,publishedAt:later});
  assert.equal(bundle.resultManifest.outcome,'cancelled');
  assert.equal(bundle.resultManifest.executionState,'not_executed');
  assert.deepEqual(bundle.publications.map(x=>x.kind),['status','comment']);
  assert.equal(bundle.ledgerPlans.length,2);
});
