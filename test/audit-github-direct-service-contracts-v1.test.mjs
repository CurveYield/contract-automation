import test from 'node:test';
import assert from 'node:assert/strict';
import { createDirectRequest } from '../packages/audit-github-direct-protocol/src/index.mjs';
import { createServiceCommand,validateServiceCommand,createServiceResult,createServiceError } from '../packages/audit-github-direct-service/src/index.mjs';

const at='2026-08-01T23:40:00.000Z';
const request=createDirectRequest({repositoryId:123,installationId:456,repositoryFullName:'curveyield/contract-automation',requesterId:'user-1',policyVersion:'direct-policy-v1',profileId:'hardhat-test-v1',parserVersion:'hardhat-test-parser-v1',resultContractVersion:'phase5-tool-result-v1',reportContractVersion:'audit-report-v1',targetCommitSha:'a'.repeat(40),requestedAt:at,idempotencyKey:'request-1'});

for(const input of [
  {kind:'submit',request,at,resultId:'result-1',reportId:'report-1',commentBody:'submitted'},
  {kind:'status',request,at},
  {kind:'cancel',request,at,reasonCode:'user-cancelled'},
  {kind:'report',request,at,resultId:'result-1',reportId:'report-1',commentBody:'report'},
  {kind:'capabilities',request,at},
  {kind:'verify-fixture',request,at,sourceCommitSha:request.targetCommitSha}
])test(`service command ${input.kind} is exact and replay-stable`,()=>{
  const first=createServiceCommand(input),second=createServiceCommand(structuredClone(input));
  assert.deepEqual(second,first);
  assert.deepEqual(validateServiceCommand(first),first);
  assert.equal(Object.isFrozen(first),true);
  assert.equal(first.targetCommitSha,undefined);
});

test('commands reject execution, URL, path, credential, and fallback fields',()=>{
  const base={kind:'status',request,at};
  for(const [key,value] of Object.entries({command:'npm test',url:'https://evil.test',path:'../../x',token:'ghs_secret',workflow:'x.yml',runner:'self-hosted',image:'node:latest',fallback:'cloudflare-audit-v1',executionEnabled:true})){
    assert.throws(()=>createServiceCommand({...base,[key]:value}),{code:'unknown_field'},key);
  }
});

test('service result is exact-SHA bound and explicitly disables fallback',()=>{
  const command=createServiceCommand({kind:'status',request,at});
  const result=createServiceResult({command,state:'completed',data:{ok:true},completedAt:at});
  assert.equal(result.jobId,request.jobId);
  assert.equal(result.targetCommitSha,request.targetCommitSha);
  assert.equal(result.cloudflareFallback,false);
  assert.equal(Object.isFrozen(result),true);
});

test('service errors are bounded and redact attacker text',()=>{
  const error=createServiceError({code:'transport_failure',retryable:true,at});
  assert.deepEqual(error,{schemaVersion:'github-direct-service-error-v1',modeId:'github-direct-audit-v1',code:'transport_failure',retryable:true,message:'GitHub Direct service operation failed',at});
  assert.doesNotMatch(JSON.stringify(error),/token|https?:|users|bearer/i);
});
