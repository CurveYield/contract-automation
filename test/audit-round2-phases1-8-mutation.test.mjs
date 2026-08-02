import test from 'node:test';
import assert from 'node:assert/strict';
import { parseToolOutput } from '../packages/audit-tool-parsers/src/index.mjs';
import { validatePhase4ToolResult } from '../packages/audit-tool-result-contracts/src/index.mjs';
import { parsePhase5ToolResult } from '../packages/audit-phase5-parsers/src/index.mjs';
import { validatePhase5ToolResult } from '../packages/audit-phase5-result-contracts/src/index.mjs';
import { parseFormalObligationsBytes } from '../packages/audit-phase6-parsers/src/index.mjs';
import { createPhase6ToolResultEnvelope, validatePhase6ToolResult } from '../packages/audit-phase6-result-contracts/src/index.mjs';
import { validateForkRequest } from '../packages/audit-fork-protocol/src/index.mjs';
import { createCleanRoomPolicy, validateCleanRoomPolicy } from '../packages/audit-clean-room-protocol/src/index.mjs';

const bytes = (value) => new TextEncoder().encode(JSON.stringify(value));
function deleteEach(value, validate, expectedCode = 'missing_field') {
  let count = 0;
  for (const key of Object.keys(value)) {
    const mutated = structuredClone(value); delete mutated[key];
    assert.throws(() => validate(mutated), (error) => error?.code === expectedCode, key);
    count += 1;
  }
  return count;
}

test('Phase 4 every public result field is required', () => {
  const canonical = parseToolOutput('solidity-compile-v1', {resultJson:'{"contracts":{},"errors":[]}',stdout:'',stderr:'',exitCode:0,durationMs:1,terminationReason:'completed'});
  assert.equal(deleteEach(canonical, validatePhase4ToolResult), 17);
});

test('Phase 5 every public result field is required', () => {
  const canonical = parsePhase5ToolResult('hardhat-test-v1', {resultJson:'{"records":[]}',exitCode:0,durationMs:1,termination:'completed'});
  assert.equal(deleteEach(canonical, validatePhase5ToolResult), 15);
});

test('Phase 6 envelope identity substitutions are rejected one field at a time', () => {
  const capture={schemaVersion:'formal-obligations-capture-v1',trustedProducer:'curveyield-formal-capture-producer-v1',profileId:'formal-obligations-v1',toolVersion:'1.0.0',outcome:'proved',obligations:[],assertions:[],models:[],traces:[],counterexamples:[],diagnostics:[],sourceReferences:[],parserWarnings:[],truncated:false};
  const envelope=createPhase6ToolResultEnvelope('formal-obligations-v1',parseFormalObligationsBytes(bytes(capture)));
  const fields=['parserId','parserPackage','parserPackageVersion','captureSchemaVersion','resultSchemaVersion','toolVersion','trustedProducer'];
  for(const field of fields){const mutated=structuredClone(envelope);mutated[field]='substituted';assert.throws(()=>validatePhase6ToolResult(mutated),(error)=>error.code==='identity_mismatch'&&error.path===`$.${field}`);}
  assert.equal(fields.length,7);
});

test('Phase 7 request identity and gate mutations fail deterministically', () => {
  const canonical={schemaVersion:'fork-request-v1',tenantId:'ten_11111111111111111111111111111111',workspaceId:'ws_22222222222222222222222222222222',campaignId:'cmp_33333333333333333333333333333333',forkId:'fork_44444444444444444444444444444444',attemptId:'att_55555555555555555555555555555555',profileId:'free-development-v1',policyVersion:'fork-policy-v1',requesterId:'worker-2',scopes:['audit:submit'],chainId:1,blockNumber:1,adapterKind:'mock',executionGate:'trusted_mock',createdAt:'2026-08-01T16:00:00.000Z',idempotencyKey:'mutation'};
  const mutations=[['tenantId','bad'],['forkId','bad'],['scopes',['audit:read']],['executionGate','awaiting_executor'],['chainId',0]];
  for(const[field,value]of mutations){const mutated=structuredClone(canonical);mutated[field]=value;assert.throws(()=>validateForkRequest(mutated));}
  assert.equal(mutations.length,5);
});

test('Phase 8 policy digest and every immutable field mutation are rejected', () => {
  const policy=createCleanRoomPolicy({tenantId:'tenant-1',workspaceId:'workspace-1',allowedScopes:['campaign:read'],maxCampaigns:10,maxMergeInputs:8,maxFindings:100,maxEvidence:100,maxRelations:100,maxBytes:1000000,retentionDays:30,issuedAt:'2026-08-01T16:00:00.000Z'});
  const fields=['tenantId','workspaceId','maxCampaigns','maxMergeInputs','maxFindings','maxEvidence','maxRelations','maxBytes','retentionDays','issuedAt'];
  for(const field of fields){const mutated=structuredClone(policy);mutated[field]=typeof mutated[field]==='number'?mutated[field]+1:`${mutated[field]}x`;assert.throws(()=>validateCleanRoomPolicy(mutated));}
  const digest=structuredClone(policy);digest.policyDigest=`sha256:${'0'.repeat(64)}`;assert.throws(()=>validateCleanRoomPolicy(digest),(error)=>error.code==='digest_mismatch');
  assert.equal(fields.length+1,11);
});
