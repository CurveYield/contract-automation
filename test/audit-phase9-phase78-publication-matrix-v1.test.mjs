import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  SERVICE_OPERATIONS, createServiceRequest, validateServiceRequest,
  createPageCursor, paginateDeterministically
} from '../packages/audit-phase78-service/src/index.mjs';
import {
  createCheckpointReportProjection, createExportReportProjection
} from '../packages/audit-fork-reporting/src/index.mjs';
import { createMergeReportProjection } from '../packages/audit-clean-room-reporting/src/index.mjs';
import {
  PUBLICATION_LIMITS, enforcePublicationQuota, planPublicationRecovery
} from '../packages/audit-phase78-publication/src/index.mjs';

const fixture=JSON.parse(await readFile(new URL('./fixtures/audit-phase9-phase78/operation-payloads-v1.json',import.meta.url),'utf8'));
const ts='2026-08-01T23:40:00.000Z';
const d=(c)=>`sha256:${c.repeat(64)}`;
function request(operation,payload){
  return createServiceRequest({
    operation,tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',
    forkId:operation.startsWith('fork.')?'fork-a':null,
    mergeId:operation.startsWith('merge.')?'merge-a':null,
    requesterId:'user-a',
    scopes:operation.startsWith('fork.')?['audit:read','audit:submit']:['campaign:read','campaign:write','campaign:merge','campaign:share-base'],
    idempotencyKey:`matrix-${operation.replace('.','-')}`,expectedVersion:null,expectedEtag:null,requestedAt:ts,payload
  });
}

test('all fifteen operation payload contracts accept exact fixtures and reject one-field expansion',()=>{
  assert.deepEqual(Object.keys(fixture.payloads).sort(),[...SERVICE_OPERATIONS].sort());
  let mutations=0;
  for(const operation of SERVICE_OPERATIONS){
    const payload=fixture.payloads[operation];
    assert.deepEqual(validateServiceRequest(request(operation,payload)).payload,payload);
    assert.throws(()=>request(operation,{...payload,unexpected:true}),(error)=>['unknown_field','forbidden_field'].includes(error.code),operation);
    mutations+=1;
  }
  assert.equal(mutations,15);
});

test('quota maxima pass and every independent overage rejects',()=>{
  const maximum={...PUBLICATION_LIMITS};
  assert.deepEqual(enforcePublicationQuota(maximum),maximum);
  for(const key of Object.keys(maximum)){
    assert.throws(()=>enforcePublicationQuota({...maximum,[key]:maximum[key]+1}),{code:'quota_exceeded'});
  }
});

test('publication recovery converges at every partial immutable-write boundary',()=>{
  const req=request('report.publish',fixture.payloads['report.publish']);
  const planned=[d('1'),d('2'),d('3')];
  for(let completed=0;completed<=planned.length;completed+=1){
    const input={request:req,plannedDigests:planned,completedDigests:planned.slice(0,completed),failedStep:completed===planned.length?'pointer-cas':'immutable-write'};
    const first=planPublicationRecovery(input),second=planPublicationRecovery(input);
    assert.deepEqual(second,first);
    assert.deepEqual(first.remainingDigests,planned.slice(completed));
  }
});

test('checkpoint and export projections reject unsafe object keys',()=>{
  const checkpoint={checkpointId:'snapshot-a',forkId:'fork-a',tenantId:'tenant-a',attemptId:'attempt-a',objectKey:'../secret.bin',sha256:'a'.repeat(64),bytes:1,createdAt:ts,expiresAt:'2026-08-02T23:40:00.000Z'};
  assert.throws(()=>createCheckpointReportProjection({manifest:checkpoint,reportedAt:ts}),{code:'invalid_object_key'});
  const exported={exportId:'export-a',forkId:'fork-a',tenantId:'tenant-a',checkpointId:'snapshot-a',sourceObjectKey:'https://example.invalid/object',sourceSha256:'a'.repeat(64),createdAt:ts,expiresAt:'2026-08-08T23:40:00.000Z'};
  assert.throws(()=>createExportReportProjection({manifest:exported,reportedAt:ts}),{code:'invalid_object_key'});
});

test('merge reporting rejects revoked and throwing digest arrays with stable hostile reflection',()=>{
  const manifest={manifestId:'merge-manifest-a',manifestDigest:d('b'),mergeId:'merge-a',requestDigest:d('c'),finalState:'completed',terminalManifestDigests:[d('1'),d('2')],duplicateMapDigest:d('3'),conflictMapDigest:d('4'),provenanceIndexDigest:d('5'),mergedReportRefs:[],policyId:'policy-a',operationSummary:{classA:4,classB:4},publishedAt:ts};
  const {proxy,revoke}=Proxy.revocable([],{});revoke();
  assert.throws(()=>createMergeReportProjection({manifest:{...manifest,terminalManifestDigests:proxy},reportedAt:ts}),{code:'hostile_reflection'});
  const throwing=new Proxy([], {ownKeys(){throw new Error('trap')}});
  assert.throws(()=>createMergeReportProjection({manifest:{...manifest,terminalManifestDigests:throwing},reportedAt:ts}),{code:'hostile_reflection'});
});

test('cursor scope substitution and deterministic page boundaries reject or converge',()=>{
  const items=Array.from({length:101},(_,i)=>({id:`report-${String(i).padStart(3,'0')}`,createdAt:`2026-08-01T${String(Math.floor(i/60)).padStart(2,'0')}:${String(i%60).padStart(2,'0')}:00.000Z`,digest:d((i%10).toString())}));
  const options={tenantId:'tenant-a',workspaceId:'workspace-a',resourceKind:'reports',indexDigest:d('a'),pageSize:100,cursor:null};
  const first=paginateDeterministically(items,options);
  assert.equal(first.items.length,100);assert.ok(first.nextCursor);
  assert.throws(()=>paginateDeterministically(items,{...options,tenantId:'tenant-b',cursor:first.nextCursor}),{code:'cursor_scope_mismatch'});
  const last=paginateDeterministically(items,{...options,cursor:first.nextCursor});
  assert.equal(last.items.length,1);assert.equal(last.nextCursor,null);
});
