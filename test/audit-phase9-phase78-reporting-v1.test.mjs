import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson } from '../packages/audit-phase78-service/src/index.mjs';
import {
  createForkReportProjection, createCheckpointReportProjection, createExportReportProjection,
  createDeleteReportProjection, createAwaitingExecutorProjection
} from '../packages/audit-fork-reporting/src/index.mjs';
import {
  createCampaignReportProjection, createMergeReportProjection, createProvenanceReportProjection,
  createHiddenReportProjection, createRelationSummary
} from '../packages/audit-clean-room-reporting/src/index.mjs';
const ts='2026-08-01T23:40:00.000Z';
const d=(c)=>`sha256:${c.repeat(64)}`;

test('fork projections report truthful awaiting_executor and never imply execution',()=>{
  const state={forkId:'fork-a',tenantId:'tenant-a',attemptId:'attempt-a',requestDigest:d('a'),state:'awaiting_executor',version:2,executionGate:'awaiting_executor',adapterKind:'external',chainId:1,blockNumber:21000000,blockHash:null,createdAt:ts,updatedAt:ts,lastTransitionId:'tr-a',lastFromState:'requested'};
  const report=createForkReportProjection({state,requestedBy:'user-a',reportedAt:ts});
  assert.equal(report.status,'awaiting_executor');
  assert.equal(report.executionEnabled,false);
  assert.equal(report.ready,false);
  assert.deepEqual(createAwaitingExecutorProjection({forkId:'fork-a',tenantId:'tenant-a',reportedAt:ts}),createAwaitingExecutorProjection({forkId:'fork-a',tenantId:'tenant-a',reportedAt:ts}));
});

test('checkpoint/export/delete reports pin immutable identity and retention truth',()=>{
  const checkpoint=createCheckpointReportProjection({manifest:{checkpointId:'snapshot-a',forkId:'fork-a',tenantId:'tenant-a',attemptId:'attempt-a',objectKey:'forks/fork-a/checkpoints/snapshot-a.bin',sha256:'a'.repeat(64),bytes:250000000,createdAt:ts,expiresAt:'2026-08-02T23:40:00.000Z'},reportedAt:ts});
  assert.equal(checkpoint.retentionSeconds,86400);
  const exported=createExportReportProjection({manifest:{exportId:'export-a',forkId:'fork-a',tenantId:'tenant-a',checkpointId:'snapshot-a',sourceObjectKey:'forks/fork-a/checkpoints/snapshot-a.bin',sourceSha256:'a'.repeat(64),createdAt:ts,expiresAt:'2026-08-08T23:40:00.000Z'},reportedAt:ts});
  assert.equal(exported.copiesBytes,false);
  assert.equal(exported.retentionSeconds,604800);
  const deleted=createDeleteReportProjection({state:{forkId:'fork-a',tenantId:'tenant-a',attemptId:'attempt-a',requestDigest:d('a'),state:'deleted',version:4,deletedAt:ts,tombstone:true},tombstone:{reason:'user-request',deletedAt:ts},reportedAt:ts});
  assert.equal(deleted.terminal,true);
  assert.equal(deleted.tombstone,true);
});

test('campaign and merge report projections preserve explicit partial/truncated/failure truth',()=>{
  const campaign=createCampaignReportProjection({manifest:{manifestId:'terminal-a',manifestDigest:d('a'),tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',terminalState:'completed',completionKind:'partial',partialEvidence:true,truncated:false,mergeEligible:true,inventorySummary:{findingCount:2,evidenceCount:1,severity:{critical:0,high:1,moderate:1,low:0,unknown:0}},completedAt:ts},reportedAt:ts});
  assert.equal(campaign.partialEvidence,true);
  assert.equal(campaign.complete,false);
  const merge=createMergeReportProjection({manifest:{manifestId:'merge-manifest-a',manifestDigest:d('b'),mergeId:'merge-a',requestDigest:d('c'),finalState:'completed',terminalManifestDigests:[d('1'),d('2')],duplicateMapDigest:d('3'),conflictMapDigest:d('4'),provenanceIndexDigest:d('5'),mergedReportRefs:[],policyId:'policy-a',operationSummary:{classA:4,classB:4,retainedBytes:2000000,retentionDays:90,variant:'typical'},publishedAt:ts},reportedAt:ts});
  assert.equal(merge.sourceCampaignCount,2);
  assert.equal(merge.operationSummary.classA,4);
});

test('hidden report projections are byte-identical for absent and unauthorized resources',()=>{
  const absent=createHiddenReportProjection({resourceKind:'report',reportedAt:ts});
  const hidden=createHiddenReportProjection({resourceKind:'report',reportedAt:ts,internalReason:'tenant_mismatch',internalCount:99});
  assert.equal(canonicalJson(absent),canonicalJson(hidden));
  assert.deepEqual(absent,{schemaVersion:'audit-phase9-hidden-report-v1',status:'not_found',code:'resource_not_found',message:'Resource not found',items:[],total:0,facets:{},relations:[],notifications:[],signedResource:null,operationBudget:{classA:0,classB:0,free:0,bytes:0},cacheTag:'hidden-v1',timingClass:'constant-hidden-v1'});
});

test('relation summaries never expose hidden identities or counts',()=>{
  const visible=createRelationSummary({duplicateRelations:[{relationId:'duplicate-a',members:[{campaignId:'campaign-a'},{campaignId:'campaign-b'}]}],conflictRelations:[{relationId:'conflict-a',values:[{campaignId:'campaign-a'},{campaignId:'campaign-c'}]}],visibleCampaignIds:['campaign-a']});
  assert.deepEqual(visible,{schemaVersion:'audit-phase9-relation-summary-v1',duplicateGroups:1,conflictGroups:1,visibleMembers:2,hiddenMembersPresent:true});
  assert.equal(JSON.stringify(visible).includes('campaign-b'),false);
});

test('provenance projections return only authorized nodes and stable not-found envelopes',()=>{
  const index={indexId:'provenance-a',indexDigest:d('a'),mergeId:'merge-a',nodes:[{nodeId:'source-a',campaignId:null,type:'source',digest:d('1')},{nodeId:'finding-a',campaignId:'campaign-a',type:'finding',digest:d('2')},{nodeId:'finding-b',campaignId:'campaign-b',type:'finding',digest:d('3')}],edges:[{edgeId:'edge-a',from:'source-a',to:'finding-a',type:'produced'},{edgeId:'edge-b',from:'source-a',to:'finding-b',type:'produced'}]};
  const report=createProvenanceReportProjection({index,nodeId:'finding-a',visibleCampaignIds:['campaign-a'],reportedAt:ts});
  assert.equal(report.nodes.some(node=>node.campaignId==='campaign-b'),false);
  assert.equal(canonicalJson(createProvenanceReportProjection({index,nodeId:'finding-b',visibleCampaignIds:['campaign-a'],reportedAt:ts})),canonicalJson(createProvenanceReportProjection({index,nodeId:'missing-a',visibleCampaignIds:['campaign-a'],reportedAt:ts})));
});
