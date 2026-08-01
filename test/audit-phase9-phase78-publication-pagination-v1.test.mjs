import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createServiceRequest, createPageCursor, validatePageCursor, paginateDeterministically
} from '../packages/audit-phase78-service/src/index.mjs';
import {
  planImmutablePublication, planMutablePointerPublication, planPublicationRecovery,
  validatePublicationPlan, enforcePublicationQuota
} from '../packages/audit-phase78-publication/src/index.mjs';
const ts='2026-08-01T23:40:00.000Z';const d=(c)=>`sha256:${c.repeat(64)}`;
const request=createServiceRequest({operation:'report.publish',tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',forkId:null,mergeId:'merge-a',requesterId:'user-a',scopes:['campaign:read','campaign:write'],idempotencyKey:'publish-a',expectedVersion:3,expectedEtag:d('e'),requestedAt:ts,payload:{reportId:'report-a',reportDigest:d('a')}});

test('immutable publication plans are deterministic and conflict-safe',()=>{
  const plan=planImmutablePublication({request,records:[{kind:'evidence',id:'evidence-a',digest:d('1'),bytes:1024,retentionDays:90},{kind:'report',id:'report-a',digest:d('2'),bytes:2048,retentionDays:90}]});
  assert.deepEqual(validatePublicationPlan(plan),plan);
  assert.deepEqual(plan.summary,{classA:2,classB:2,free:0,bytes:3072,records:2});
  assert.equal(plan.operations.filter(op=>op.class==='class-a').every(op=>op.immutable===true&&op.ifNoneMatch==='*'),true);
  assert.equal(plan.usesPrefixListing,false);
});

test('mutable pointer plans require current blob-SHA CAS and monotonic version',()=>{
  const plan=planMutablePointerPublication({request,current:{version:3,etag:d('e')},pointer:{kind:'campaign-current',id:'campaign-a',digest:d('3'),bytes:512}});
  assert.equal(plan.nextVersion,4);
  assert.equal(plan.operations[0].ifMatch,d('e'));
  assert.throws(()=>planMutablePointerPublication({request,current:{version:4,etag:d('e')},pointer:{kind:'campaign-current',id:'campaign-a',digest:d('3'),bytes:512}}),{code:'stale_state'});
});

test('quota enforcement covers records, bytes, retention, checkpoints, exports, and pages',()=>{
  assert.deepEqual(enforcePublicationQuota({records:2,bytes:3072,retentionDays:90,checkpoints:8,exports:8,pageSize:100}),{records:2,bytes:3072,retentionDays:90,checkpoints:8,exports:8,pageSize:100});
  assert.throws(()=>enforcePublicationQuota({records:65,bytes:1,retentionDays:1,checkpoints:1,exports:1,pageSize:1}),{code:'quota_exceeded'});
  assert.throws(()=>enforcePublicationQuota({records:1,bytes:20000001,retentionDays:1,checkpoints:1,exports:1,pageSize:1}),{code:'quota_exceeded'});
  assert.throws(()=>enforcePublicationQuota({records:1,bytes:1,retentionDays:91,checkpoints:1,exports:1,pageSize:1}),{code:'quota_exceeded'});
});

test('partial-write recovery skips exact immutable writes and retries CAS pointer last',()=>{
  const plan=planPublicationRecovery({request,plannedDigests:[d('1'),d('2'),d('3')],completedDigests:[d('1'),d('2')],failedStep:'pointer-cas'});
  assert.deepEqual(plan.remainingDigests,[d('3')]);
  assert.equal(plan.retryPointerLast,true);
  assert.equal(plan.retrySafe,true);
  assert.throws(()=>planPublicationRecovery({request,plannedDigests:[d('1')],completedDigests:[d('9')],failedStep:'immutable-write'}),{code:'recovery_conflict'});
});

test('cursor contracts are deterministic, tamper-evident, scope-bound, and malformed-safe',()=>{
  const cursor=createPageCursor({tenantId:'tenant-a',workspaceId:'workspace-a',resourceKind:'reports',indexDigest:d('a'),offset:100,pageSize:25,sortKey:'created-at-id'});
  assert.deepEqual(validatePageCursor(cursor),cursor);
  const tampered={...cursor,offset:101};assert.throws(()=>validatePageCursor(tampered),{code:'cursor_digest_mismatch'});
  assert.throws(()=>validatePageCursor('garbage'),{code:'invalid_cursor'});
});

test('pagination is stable under input reversal and never lists prefixes',()=>{
  const items=Array.from({length:55},(_,i)=>({id:`report-${String(i).padStart(3,'0')}`,createdAt:`2026-08-01T23:${String(i%60).padStart(2,'0')}:00.000Z`,digest:d((i%10).toString())}));
  const options={tenantId:'tenant-a',workspaceId:'workspace-a',resourceKind:'reports',indexDigest:d('a'),pageSize:20,cursor:null};
  const first=paginateDeterministically(items,options);const reversed=paginateDeterministically([...items].reverse(),options);
  assert.deepEqual(reversed,first);
  assert.equal(first.items.length,20);assert.ok(first.nextCursor);assert.equal(first.usesPrefixListing,false);
  const second=paginateDeterministically(items,{...options,cursor:first.nextCursor});assert.equal(second.items[0].id,first.items[19].id.replace('019','020'));
});
