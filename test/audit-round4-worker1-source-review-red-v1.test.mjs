import test from 'node:test';
import assert from 'node:assert/strict';

import * as service from '../packages/audit-phase78-service/src/index.mjs';
import { createRelationSummary } from '../packages/audit-clean-room-reporting/src/relations.mjs';
import { createProvenanceReportProjection } from '../packages/audit-clean-room-reporting/src/provenance.mjs';
import { createForkReportProjection } from '../packages/audit-fork-reporting/src/fork-projections.mjs';
import { createMergeReportProjection } from '../packages/audit-clean-room-reporting/src/campaign-merge.mjs';
import { planImmutablePublication } from '../packages/audit-phase78-publication/src/plans.mjs';
import { createDuplicateRelation } from '../packages/audit-controlled-merge/src/index.mjs';
import { createProvenanceIndex } from '../packages/audit-provenance/src/index.mjs';

const D = `sha256:${'1'.repeat(64)}`;
const E = `sha256:${'2'.repeat(64)}`;
const RAW = '1'.repeat(64);
const CORE_TENANT = `ten_${'a'.repeat(32)}`;
const CORE_FORK = `fork_${'b'.repeat(32)}`;
const CORE_ATTEMPT = `att_${'c'.repeat(32)}`;
const AT = '2026-08-02T10:00:00.000Z';

function request(overrides={}) {
  return {
    operation:'fork.checkpoint',tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',
    forkId:'fork-a',attemptId:'attempt-a',mergeId:null,requesterId:'requester-a',scopes:['audit:submit'],
    idempotencyKey:'idem-a',expectedVersion:3,expectedEtag:D,requestedAt:AT,
    payload:{checkpointId:'checkpoint-a',manifestDigest:E},...overrides
  };
}

test('service request carries immutable attempt identity for fork operations', () => {
  const created = service.createServiceRequest(request());
  assert.equal(created.attemptId, 'attempt-a');
});

test('checkpoint orchestration exposes repaired transient lifecycle and every failure boundary', () => {
  const req = service.createServiceRequest(request());
  const plan = service.planPhase78Operation({request:req,authorization:{allowed:true},current:{version:3,etag:D,state:'ready'}});
  assert.deepEqual(plan.lifecycle, ['ready','checkpointing','ready']);
  assert.deepEqual(plan.failureBoundaries,['enter-transient','checkpoint-object','checkpoint-manifest','checkpoint-index','return-ready']);
  assert.ok(plan.operationSummary.classA >= 5);
});

test('hidden and cross-tenant fork authorization are byte-identical', () => {
  const req = service.createServiceRequest({...request(), operation:'fork.read', scopes:['audit:read'], expectedVersion:null, expectedEtag:null, payload:{}});
  const absent = service.authorizePhase78Operation(req, {forkState:null});
  const hidden = service.authorizePhase78Operation(req, {forkState:{tenantId:'tenant-b',forkId:'fork-a',attemptId:'attempt-a'}});
  assert.deepEqual(hidden, absent);
});

test('page cursor binds campaign fork attempt and visible view digest without exposing totals', () => {
  const cursor = service.createPageCursor({tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',forkId:'fork-a',attemptId:'attempt-a',mergeId:null,resourceKind:'checkpoint',indexDigest:D,viewDigest:E,offset:0,pageSize:10,sortKey:'created-at-id'});
  assert.equal(cursor.attemptId,'attempt-a');
  const page = service.paginateDeterministically([],{tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',forkId:'fork-a',attemptId:'attempt-a',mergeId:null,resourceKind:'checkpoint',indexDigest:D,viewDigest:E,pageSize:10,cursor:null});
  assert.equal(Object.hasOwn(page,'total'),false);
});

test('relation summary cannot signal hidden relation members or hidden group counts', () => {
  const duplicate=createDuplicateRelation([
    {findingId:'finding-a',campaignId:'campaign-visible',identityKey:'identity-a',severity:'high',status:'open',remediation:'fix-a',location:'file-a',materialDigest:D,evidenceRefs:[]},
    {findingId:'finding-b',campaignId:'campaign-hidden',identityKey:'identity-a',severity:'high',status:'open',remediation:'fix-a',location:'file-a',materialDigest:D,evidenceRefs:[]}
  ]);
  const summary=createRelationSummary({duplicateRelations:[duplicate],conflictRelations:[],visibleCampaignIds:['campaign-visible']});
  assert.deepEqual(summary,{schemaVersion:'audit-phase9-relation-summary-v2',duplicateGroups:0,conflictGroups:0,visibleMembers:0});
});

test('visible provenance projection is invariant to hidden nodes and source index digest', () => {
  const common={tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:'merge-a',createdAt:AT,edges:[]};
  const visibleNode={nodeId:'node-visible',type:'finding',tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-visible',digest:D,sourceRef:null};
  const hiddenNode={nodeId:'node-hidden',type:'finding',tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-hidden',digest:E,sourceRef:null};
  const first=createProvenanceReportProjection({index:createProvenanceIndex({...common,nodes:[visibleNode]}),nodeId:'node-visible',visibleCampaignIds:['campaign-visible'],reportedAt:AT});
  const second=createProvenanceReportProjection({index:createProvenanceIndex({...common,nodes:[visibleNode,hiddenNode]}),nodeId:'node-visible',visibleCampaignIds:['campaign-visible'],reportedAt:AT});
  assert.equal(first.reportDigest,second.reportDigest);
  assert.equal(first.indexDigest,second.indexDigest);
});

test('fork report rejects a deleted state that fails the repaired core validator', () => {
  const invalidDeleted={schemaVersion:'fork-state-v1',forkId:CORE_FORK,tenantId:CORE_TENANT,attemptId:CORE_ATTEMPT,requestDigest:RAW,state:'deleted',version:4,executionGate:'trusted_mock',adapterKind:'mock',chainId:1,blockNumber:1,blockHash:null,createdAt:AT,updatedAt:AT,lastTransitionId:'tr_delete_test',lastFromState:'deleting'};
  assert.throws(()=>createForkReportProjection({state:invalidDeleted,requestedBy:'requester-a',reportedAt:AT}),error=>error?.code==='invalid_tombstone');
});

test('merge report rejects an impossible self-asserted manifest and operation summary', () => {
  const impossible={schemaVersion:'phase8-merge-manifest-v1',manifestId:'merge-manifest-fake',manifestDigest:D,mergeId:'merge-a',requestDigest:E,finalState:'completed',terminalManifestDigests:[D,E],duplicateMapDigest:D,conflictMapDigest:E,provenanceIndexDigest:D,mergedReportRefs:[],policyId:'policy-a',operationSummary:{classA:9999,classB:9999,retainedBytes:99_999_999,retentionDays:999,variant:'fake'},publishedAt:AT};
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
