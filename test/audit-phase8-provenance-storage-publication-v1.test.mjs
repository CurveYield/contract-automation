import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson } from '../packages/audit-clean-room-protocol/src/index.mjs';
import {
  createProvenanceNode, createProvenanceEdge, validateProvenanceEdge,
  createProvenanceIndex, validateProvenanceIndex, traceAuthorizedOrigins,
  createMergedReportReference, validateMergedReportReference
} from '../packages/audit-provenance/src/index.mjs';
import { createTerminalCampaignManifest } from '../packages/audit-clean-room-campaigns/src/index.mjs';
import {
  createMergeRequest, buildRelationMaps, createMergeManifest, validateMergeManifest,
  planMergeStorageTransaction, rebuildMergeIndex
} from '../packages/audit-controlled-merge/src/index.mjs';

const ts='2026-08-01T16:00:00.000Z';
const d=(c)=>`sha256:${c.repeat(64)}`;
const ref=(id,c)=>({id,digest:d(c)});
const terminal=(campaignId)=>createTerminalCampaignManifest({tenantId:'tenant-a',workspaceId:'workspace-a',campaignId,workspaceSourceDigest:d('a'),baseArtifactDigest:d('b'),terminalState:'completed',completionKind:'findings',partialEvidence:false,truncated:false,policyId:'policy-a',profileVersions:['profile-a-v1'],layerRefs:[ref(`layer-${campaignId}`,'c')],jobRefs:[ref(`job-${campaignId}`,'d')],attemptRefs:[ref(`attempt-${campaignId}`,'e')],evidenceRefs:[ref(`evidence-${campaignId}`,'e')],reportRefs:[ref(`report-${campaignId}`,'d')],findings:[{findingId:`finding-${campaignId}`,identityKey:'identity-a',severity:'high',status:'open',remediation:'upgrade',location:'contracts-a-sol-10',materialDigest:d('f'),evidenceRefs:[ref(`evidence-${campaignId}`,'e')]}],completedAt:ts});
const node=(nodeId,type,campaignId=null,overrides={})=>createProvenanceNode({nodeId,type,tenantId:'tenant-a',workspaceId:'workspace-a',campaignId,digest:d('1'),sourceRef:null,...overrides});

test('provenance graph is deterministic, frozen, and validates',()=>{
  const nodes=[node('source-a','source'),node('campaign-a','campaign','campaign-a'),node('finding-a','finding','campaign-a')];
  const edges=[createProvenanceEdge({type:'derived_from',from:'campaign-a',to:'source-a'}),createProvenanceEdge({type:'produced',from:'campaign-a',to:'finding-a'})];
  const first=createProvenanceIndex({tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:'merge-a',nodes,edges,createdAt:ts});
  const reversed=createProvenanceIndex({tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:'merge-a',nodes:[...nodes].reverse(),edges:[...edges].reverse(),createdAt:ts});
  assert.equal(canonicalJson(first),canonicalJson(reversed));
  assert.deepEqual(validateProvenanceIndex(first),first);
  assert.deepEqual(validateProvenanceEdge(edges[0]),edges[0]);
  assert.equal(Object.isFrozen(first.nodes),true);
});

test('provenance rejects dangling references, cross-scope nodes, conflicts, and cycles',()=>{
  const source=node('source-a','source');
  assert.throws(()=>createProvenanceIndex({tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:'merge-a',nodes:[source],edges:[createProvenanceEdge({type:'references',from:'missing-a',to:'source-a'})],createdAt:ts}),{code:'dangling_reference'});
  assert.throws(()=>createProvenanceIndex({tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:'merge-a',nodes:[source,node('source-a','source',null,{digest:d('2')})],edges:[],createdAt:ts}),{code:'conflicting_node'});
  assert.throws(()=>createProvenanceIndex({tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:'merge-a',nodes:[source,node('source-b','source',null,{tenantId:'tenant-b'})],edges:[],createdAt:ts}),{code:'tenant_mismatch'});
  const a=node('node-a','campaign','campaign-a'),b=node('node-b','finding','campaign-a');
  assert.throws(()=>createProvenanceIndex({tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:'merge-a',nodes:[a,b],edges:[createProvenanceEdge({type:'produced',from:'node-a',to:'node-b'}),createProvenanceEdge({type:'derived_from',from:'node-b',to:'node-a'})],createdAt:ts}),{code:'provenance_cycle'});
});

test('authorized origin tracing never reveals hidden campaigns',()=>{
  const nodes=[node('source-a','source'),node('campaign-a','campaign','campaign-a'),node('finding-a','finding','campaign-a'),node('campaign-b','campaign','campaign-b'),node('finding-b','finding','campaign-b')];
  const edges=[createProvenanceEdge({type:'derived_from',from:'campaign-a',to:'source-a'}),createProvenanceEdge({type:'produced',from:'campaign-a',to:'finding-a'}),createProvenanceEdge({type:'derived_from',from:'campaign-b',to:'source-a'}),createProvenanceEdge({type:'produced',from:'campaign-b',to:'finding-b'})];
  const index=createProvenanceIndex({tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:'merge-a',nodes,edges,createdAt:ts});
  const visible=traceAuthorizedOrigins(index,{nodeId:'finding-a',visibleCampaignIds:['campaign-a']});
  assert.equal(visible.nodes.some((item)=>item.campaignId==='campaign-b'),false);
  assert.equal(canonicalJson(traceAuthorizedOrigins(index,{nodeId:'finding-b',visibleCampaignIds:['campaign-a']})),canonicalJson(traceAuthorizedOrigins(index,{nodeId:'missing-a',visibleCampaignIds:['campaign-a']})));
});

test('merged report references preserve source identity and reject active content or secret paths',()=>{
  for(const sourceState of ['complete','partial','cancelled','policy_rejected']){
    const value=createMergedReportReference({tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:'merge-a',sourceCampaignId:`campaign-${sourceState}`,sourceState,reportId:`report-${sourceState}`,reportDigest:d('d'),evidenceRefs:[ref(`evidence-${sourceState}`,'e')],label:`Report ${sourceState}`,createdAt:ts});
    assert.deepEqual(validateMergedReportReference(value),value);
  }
  const base={tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:'merge-a',sourceCampaignId:'campaign-a',sourceState:'complete',reportId:'report-a',reportDigest:d('d'),evidenceRefs:[ref('evidence-a','e')],createdAt:ts};
  for(const label of ['<script>alert(1)</script>','Authorization: Bearer token','PRIVATE_KEY=secret','C:\\Users\\alice\\key.txt','/home/alice/key','https://signed.example/x'])assert.throws(()=>createMergedReportReference({...base,label}),{code:'unsafe_report_content'});
});

test('merge manifest is deterministic and validates exact relation/provenance/report references',()=>{
  const a=terminal('campaign-a'),b=terminal('campaign-b');
  const request=createMergeRequest({terminalManifests:[a,b],policyId:'policy-a',requestedBy:'user-a',requestedAt:ts,idempotencyKey:'request-a',expectedCurrentEtag:d('e')});
  const relations=buildRelationMaps([{findingId:'finding-a',campaignId:'campaign-a',identityKey:'identity-a',severity:'high',status:'open',remediation:'upgrade',location:'contracts-a-sol-10',materialDigest:d('f'),evidenceRefs:[ref('evidence-a','e')]},{findingId:'finding-b',campaignId:'campaign-b',identityKey:'identity-a',severity:'high',status:'open',remediation:'upgrade',location:'contracts-a-sol-10',materialDigest:d('f'),evidenceRefs:[ref('evidence-b','e')]}]);
  const provenance=createProvenanceIndex({tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:request.mergeId,nodes:[node('source-a','source'),node('campaign-a','campaign','campaign-a')],edges:[createProvenanceEdge({type:'derived_from',from:'campaign-a',to:'source-a'})],createdAt:ts});
  const report=createMergedReportReference({tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:request.mergeId,sourceCampaignId:'campaign-a',sourceState:'complete',reportId:'report-a',reportDigest:d('d'),evidenceRefs:[ref('evidence-a','e')],label:'Campaign A report',createdAt:ts});
  const common={mergeRequest:request,finalState:'completed',duplicateMapDigest:relations.duplicateMapDigest,conflictMapDigest:relations.conflictMapDigest,provenanceIndexDigest:provenance.indexDigest,mergedReportRefs:[{referenceId:report.referenceId,referenceDigest:report.referenceDigest}],policyId:'policy-a',operationSummary:{classA:4,classB:4,retainedBytes:2_000_000,retentionDays:90,variant:'typical-4a-4b-2mb-90d'},publishedAt:ts};
  const first=createMergeManifest({...common,terminalManifestDigests:[b.manifestDigest,a.manifestDigest]});
  const second=createMergeManifest({...common,terminalManifestDigests:[a.manifestDigest,b.manifestDigest]});
  assert.deepEqual(second,first);assert.deepEqual(validateMergeManifest(first),first);
  const drift=structuredClone(first);drift.provenanceIndexDigest=d('9');assert.throws(()=>validateMergeManifest(drift),{code:'digest_mismatch'});
});

test('merge storage planning accounts for inputs, retry, quotas, CAS, and canonical billing classes',()=>{
  const typical=planMergeStorageTransaction({tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:'merge-a',terminalManifestIds:['campaign-a','campaign-b'],currentEtag:d('e'),expectedEtag:d('e'),retainedBytes:2_000_000,retentionDays:90,existingImmutableDigests:[],quota:{maxInputs:16,maxBytes:3_000_000,maxRetentionDays:90}});
  assert.deepEqual(typical.summary,{classA:4,classB:4,retainedBytes:2_000_000,retentionDays:90,variant:'typical-4a-4b-2mb-90d'});
  assert.deepEqual(new Set(typical.operations.map((item)=>item.class)),new Set(['class-a','class-b']));
  assert.equal(typical.usesPrefixListing,false);
  const retry=planMergeStorageTransaction({tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:'merge-a',terminalManifestIds:['campaign-a','campaign-b','campaign-c'],currentEtag:d('e'),expectedEtag:d('e'),retainedBytes:2_500_000,retentionDays:60,existingImmutableDigests:[d('1')],quota:{maxInputs:16,maxBytes:3_000_000,maxRetentionDays:90}});
  assert.equal(retry.summary.classB,5);assert.equal(retry.summary.variant,'idempotent-retry');assert.equal(retry.recovery.retrySafe,true);
  assert.throws(()=>planMergeStorageTransaction({...typical,expectedCurrentEtag:d('f')}));
});

test('approved immutable manifests rebuild deterministic server-owned merge index',()=>{
  const input={tenantId:'tenant-a',workspaceId:'workspace-a',approvedEntries:[{mergeId:'merge-b',manifestId:'manifest-b',manifestDigest:d('b'),visibleCampaignIds:['campaign-b']},{mergeId:'merge-a',manifestId:'manifest-a',manifestDigest:d('a'),visibleCampaignIds:['campaign-a']}],rebuiltAt:ts};
  const first=rebuildMergeIndex(input),second=rebuildMergeIndex({...input,approvedEntries:[...input.approvedEntries].reverse()});
  assert.deepEqual(second,first);assert.equal(first.usesPrefixListing,false);assert.equal(first.source,'approved-immutable-manifests');
});
