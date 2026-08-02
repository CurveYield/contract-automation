import test from 'node:test';
import assert from 'node:assert/strict';

import * as service from '../packages/audit-phase78-service/src/index.mjs';
import { createRelationSummary } from '../packages/audit-clean-room-reporting/src/relations.mjs';
import { createProvenanceReportProjection } from '../packages/audit-clean-room-reporting/src/provenance.mjs';
import { createForkReportProjection } from '../packages/audit-fork-reporting/src/fork-projections.mjs';
import { createMergeReportProjection } from '../packages/audit-clean-room-reporting/src/campaign-merge.mjs';
import { planImmutablePublication } from '../packages/audit-phase78-publication/src/plans.mjs';

const D = `sha256:${'1'.repeat(64)}`;
const E = `sha256:${'2'.repeat(64)}`;
const AT = '2026-08-02T10:00:00.000Z';

function request(overrides={}) {
  return {
    operation:'fork.checkpoint',
    tenantId:'tenant-a',
    workspaceId:'workspace-a',
    campaignId:'campaign-a',
    forkId:'fork-a',
    mergeId:null,
    requesterId:'requester-a',
    scopes:['audit:submit'],
    idempotencyKey:'idem-a',
    expectedVersion:3,
    expectedEtag:D,
    requestedAt:AT,
    payload:{checkpointId:'checkpoint-a',manifestDigest:E},
    ...overrides
  };
}

test('service request carries immutable attempt identity for fork operations', () => {
  const created = service.createServiceRequest({...request(), attemptId:'attempt-a'});
  assert.equal(created.attemptId, 'attempt-a');
});

test('checkpoint orchestration exposes repaired transient lifecycle and every failure boundary', () => {
  const req = service.createServiceRequest(request());
  const plan = service.planPhase78Operation({
    request:req,
    authorization:{allowed:true},
    current:{version:3,etag:D,state:'ready'}
  });
  assert.deepEqual(plan.lifecycle, ['ready','checkpointing','ready']);
  assert.deepEqual(
    plan.failureBoundaries,
    ['enter-transient','checkpoint-object','checkpoint-manifest','checkpoint-index','return-ready']
  );
  assert.ok(plan.operationSummary.classA >= 5);
});

test('hidden and cross-tenant fork authorization are byte-identical', () => {
  const req = service.createServiceRequest({...request(), operation:'fork.read', scopes:['audit:read'], expectedVersion:null, expectedEtag:null, payload:{}});
  const absent = service.authorizePhase78Operation(req, {forkState:null});
  const hidden = service.authorizePhase78Operation(req, {forkState:{tenantId:'tenant-b',forkId:'fork-a',attemptId:'attempt-a'}});
  assert.deepEqual(hidden, absent);
});

test('page cursor binds campaign fork attempt and visible view digest without exposing totals', () => {
  const cursor = service.createPageCursor({
    tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',
    forkId:'fork-a',attemptId:'attempt-a',resourceKind:'checkpoint',
    indexDigest:D,viewDigest:E,offset:0,pageSize:10,sortKey:'created-at-id'
  });
  assert.equal(cursor.attemptId,'attempt-a');
  const page = service.paginateDeterministically([],{tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',forkId:'fork-a',attemptId:'attempt-a',resourceKind:'checkpoint',indexDigest:D,viewDigest:E,pageSize:10,cursor:null});
  assert.equal(Object.hasOwn(page,'total'),false);
});

test('relation summary cannot signal hidden relation members or hidden group counts', () => {
  const duplicateRelations=[{members:[{campaignId:'campaign-visible',findingId:'finding-a'},{campaignId:'campaign-hidden',findingId:'finding-b'}]}];
  const summary=createRelationSummary({duplicateRelations,conflictRelations:[],visibleCampaignIds:['campaign-visible']});
  assert.deepEqual(summary,{schemaVersion:'audit-phase9-relation-summary-v2',duplicateGroups:0,conflictGroups:0,visibleMembers:0});
});

test('visible provenance projection is invariant to hidden nodes and source index digest', () => {
  const base={indexId:'index-a',mergeId:'merge-a',nodes:[{nodeId:'node-visible',campaignId:'campaign-visible',type:'finding',digest:D}],edges:[]};
  const first=createProvenanceReportProjection({index:{...base,indexDigest:D},nodeId:'node-visible',visibleCampaignIds:['campaign-visible'],reportedAt:AT});
  const second=createProvenanceReportProjection({index:{...base,indexDigest:E,nodes:[...base.nodes,{nodeId:'node-hidden',campaignId:'campaign-hidden',type:'finding',digest:E}]},nodeId:'node-visible',visibleCampaignIds:['campaign-visible'],reportedAt:AT});
  assert.equal(first.reportDigest,second.reportDigest);
  assert.equal(first.indexDigest,second.indexDigest);
});

test('fork report rejects a deleted state that fails the repaired core validator', () => {
  const invalidDeleted={forkId:'fork-a',tenantId:'tenant-a',attemptId:'attempt-a',requestDigest:D,state:'deleted',version:4,executionGate:'trusted_mock',adapterKind:'mock',chainId:1,blockNumber:1,blockHash:null};
  assert.throws(()=>createForkReportProjection({state:invalidDeleted,requestedBy:'requester-a',reportedAt:AT}),error=>error?.code==='invalid_tombstone');
});

test('merge report rejects an impossible self-asserted manifest and operation summary', () => {
  const impossible={manifestId:'merge-manifest-fake',manifestDigest:D,mergeId:'merge-a',requestDigest:E,finalState:'completed',terminalManifestDigests:[D,E],duplicateMapDigest:D,conflictMapDigest:E,provenanceIndexDigest:D,policyId:'policy-a',operationSummary:{classA:9999,classB:9999,retainedBytes:99_999_999,retentionDays:999,variant:'fake'},publishedAt:AT};
  assert.throws(()=>createMergeReportProjection({manifest:impossible,reportedAt:AT}),error=>['digest_mismatch','invalid_integer'].includes(error?.code));
});

test('publication keys bind fork and attempt identity', () => {
  const req=service.createServiceRequest(request());
  const plan=planImmutablePublication({request:req,records:[{kind:'checkpoint',id:'checkpoint-a',digest:D,bytes:10,retentionDays:1}]});
  assert.match(plan.operations[0].key,/\/forks\/fork-a\/attempts\/attempt-a\//);
});

test('service exports bounded provider error normalization', () => {
  assert.equal(typeof service.normalizePhase78ServiceError,'function');
  const normalized=service.normalizePhase78ServiceError(new Error('Bearer secret https://evil.example /home/runner/token'),{requestId:'svc-req-a',operation:'fork.read',at:AT});
  assert.equal(normalized.code,'internal_error');
  assert.equal(normalized.message,'Request failed');
  assert.equal(normalized.path,'$');
});
