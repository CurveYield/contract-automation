import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createCampaignAccessContext, createShareGrant, createShareGrantRevocation, canonicalJson
} from '../packages/audit-clean-room-protocol/src/index.mjs';
import { decideResourceVisibility, enforceHiddenResourceNonInterference } from '../packages/audit-clean-room-access/src/index.mjs';
import { createTerminalCampaignManifest } from '../packages/audit-clean-room-campaigns/src/index.mjs';
import { createMergeRequest, buildRelationMaps, createMergeManifest, planMergeStorageTransaction } from '../packages/audit-controlled-merge/src/index.mjs';
import { createProvenanceNode, createProvenanceEdge, createProvenanceIndex, createMergedReportReference, traceAuthorizedOrigins } from '../packages/audit-provenance/src/index.mjs';

const fixture=async(name)=>JSON.parse(await readFile(new URL(`./fixtures/audit-phase8/${name}`,import.meta.url),'utf8'));
const ts='2026-08-01T16:00:00.000Z',later='2026-08-02T16:00:00.000Z',expired='2026-08-01T17:00:00.000Z';
const d=(c)=>`sha256:${c.repeat(64)}`;const ref=(id,c)=>({id,digest:d(c)});
const context=(tenantId,workspaceId,campaignId)=>createCampaignAccessContext({tenantId,workspaceId,campaignId,requesterId:`user-${tenantId}`,scopes:['campaign:read','campaign:merge','campaign:share-base'],workspaceSourceDigest:d(tenantId==='tenant-a'?'a':'c'),campaignRole:'owner',campaignState:'active',policyId:'policy-a',decisionAt:ts});
const terminal=(tenantId,workspaceId,sourceDigest,scenario)=>createTerminalCampaignManifest({tenantId,workspaceId,campaignId:scenario.campaignId,workspaceSourceDigest:sourceDigest,baseArtifactDigest:d('b'),terminalState:scenario.terminalState,completionKind:scenario.completionKind,partialEvidence:scenario.partialEvidence,truncated:scenario.truncated,policyId:'policy-a',profileVersions:['profile-a-v1'],layerRefs:[ref(`layer-${scenario.campaignId}`,'1')],jobRefs:[ref(`job-${scenario.campaignId}`,'2')],attemptRefs:[ref(`attempt-${scenario.campaignId}`,'3')],evidenceRefs:scenario.completionKind==='success'?[]:[ref(`evidence-${scenario.campaignId}`,'4')],reportRefs:[ref(`report-${scenario.campaignId}`,'5')],findings:scenario.completionKind==='success'?[]:[{findingId:`finding-${scenario.campaignId}`,identityKey:'identity-a',severity:'high',status:'open',remediation:'upgrade',location:'contracts-a-sol-10',materialDigest:d('6'),evidenceRefs:[ref(`evidence-${scenario.campaignId}`,'4')]}],completedAt:ts});

test('authoritative fixture inventory is complete, unique, and valid',async()=>{
  const manifest=await fixture('fixture-manifest-v1.json');
  assert.equal(manifest.fixtures.length,3);assert.equal(new Set(manifest.fixtures.map(x=>x.file)).size,3);
  for(const entry of manifest.fixtures){const value=await fixture(entry.file);assert.match(value.schemaVersion,/^phase8-/);}
});

test('same visible names in different tenant/workspace scopes remain non-interfering',async()=>{
  const data=await fixture('multi-tenant-campaigns-v1.json');
  const a=data.tenants[0].workspaces[1].campaigns[0],b=data.tenants[1].workspaces[0].campaigns[0];assert.equal(a.campaignId,b.campaignId);
  const ctx=context('tenant-a','workspace-a2',a.campaignId);
  const hidden=decideResourceVisibility({context:ctx,resource:{kind:'report',tenantId:'tenant-b',workspaceId:'workspace-b',campaignId:b.campaignId,resourceId:'report-shared-name',resourceDigest:d('d'),sourceDigest:d('c')},grants:[],revocations:[],at:ts});
  const absent=enforceHiddenResourceNonInterference(hidden),existing=enforceHiddenResourceNonInterference(hidden);
  assert.equal(canonicalJson(absent),canonicalJson(existing));assert.equal(hidden.resourceId,null);
});

test('active sharing is exact while revoked and expired grants are indistinguishable from hidden targets',()=>{
  const ctx=context('tenant-a','workspace-a','campaign-a2');
  const grant=createShareGrant({tenantId:'tenant-a',workspaceId:'workspace-a',sourceCampaignId:'campaign-a1',targetCampaignId:'campaign-a2',artifactId:'base-artifact-a',artifactDigest:d('b'),sourceDigest:d('a'),issuedAt:ts,expiresAt:'2026-08-03T16:00:00.000Z'});
  const resource={kind:'base_artifact',tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a1',resourceId:'base-artifact-a',resourceDigest:d('b'),sourceDigest:d('a')};
  assert.equal(decideResourceVisibility({context:ctx,resource,grants:[grant],revocations:[],at:later}).visible,true);
  const revocation=createShareGrantRevocation({grantId:grant.grantId,grantDigest:grant.grantDigest,revokedAt:later,reasonCode:'owner-revoked'});
  assert.equal(decideResourceVisibility({context:ctx,resource,grants:[grant],revocations:[revocation],at:later}).visible,false);
  const expiring=createShareGrant({tenantId:'tenant-a',workspaceId:'workspace-a',sourceCampaignId:'campaign-a1',targetCampaignId:'campaign-a2',artifactId:'base-artifact-a',artifactDigest:d('b'),sourceDigest:d('a'),issuedAt:ts,expiresAt:expired});
  assert.equal(decideResourceVisibility({context:ctx,resource,grants:[expiring],revocations:[],at:later}).visible,false);
});

test('all terminal campaign states are represented truthfully and only completed states are merge eligible',async()=>{
  const data=await fixture('multi-tenant-campaigns-v1.json');const workspace=data.tenants[0].workspaces[0];
  const manifests=workspace.campaigns.map(x=>terminal('tenant-a','workspace-a',workspace.sourceDigest,x));
  assert.deepEqual(manifests.map(x=>x.completionKind),['findings','findings','partial','truncated','failed','cancelled']);
  assert.deepEqual(manifests.map(x=>x.mergeEligible),[true,true,true,true,false,false]);
});

test('authorized same-source campaigns merge while cross-scope and failed campaigns are rejected',async()=>{
  const data=await fixture('multi-tenant-campaigns-v1.json');const ws=data.tenants[0].workspaces[0];
  const a=terminal('tenant-a','workspace-a',ws.sourceDigest,ws.campaigns[0]),b=terminal('tenant-a','workspace-a',ws.sourceDigest,ws.campaigns[1]);
  const request=createMergeRequest({terminalManifests:[b,a],policyId:'policy-a',requestedBy:'user-a',requestedAt:ts,idempotencyKey:'merge-request-a',expectedCurrentEtag:d('e')});assert.deepEqual(request.campaignManifestRefs.map(x=>x.campaignId),['campaign-a1','campaign-a2']);
  const foreign=terminal('tenant-b','workspace-b',d('c'),{campaignId:'campaign-foreign',completionKind:'success',terminalState:'completed',partialEvidence:false,truncated:false});
  assert.throws(()=>createMergeRequest({terminalManifests:[a,foreign],policyId:'policy-a',requestedBy:'user-a',requestedAt:ts,idempotencyKey:'bad-a',expectedCurrentEtag:d('e')}),{code:'tenant_mismatch'});
  const failed=terminal('tenant-a','workspace-a',ws.sourceDigest,ws.campaigns[4]);assert.throws(()=>createMergeRequest({terminalManifests:[a,failed],policyId:'policy-a',requestedBy:'user-a',requestedAt:ts,idempotencyKey:'bad-b',expectedCurrentEtag:d('e')}),{code:'campaign_ineligible'});
});

test('relations, provenance, publication, and storage complete an inert end-to-end merge',async()=>{
  const relationsFixture=await fixture('relation-scenarios-v1.json');const relations=buildRelationMaps(relationsFixture.findings);
  assert.equal(relations.duplicateRelations.length,1);assert.equal(relations.conflictRelations.length,1);
  const data=await fixture('multi-tenant-campaigns-v1.json'),ws=data.tenants[0].workspaces[0];const a=terminal('tenant-a','workspace-a',ws.sourceDigest,ws.campaigns[0]),b=terminal('tenant-a','workspace-a',ws.sourceDigest,ws.campaigns[1]);
  const request=createMergeRequest({terminalManifests:[a,b],policyId:'policy-a',requestedBy:'user-a',requestedAt:ts,idempotencyKey:'merge-request-a',expectedCurrentEtag:d('e')});
  const nodes=[createProvenanceNode({nodeId:'source-a',type:'source',tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:null,digest:d('a'),sourceRef:null}),createProvenanceNode({nodeId:'campaign-a1',type:'campaign',tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a1',digest:a.manifestDigest,sourceRef:'source-a'}),createProvenanceNode({nodeId:'finding-a1',type:'finding',tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a1',digest:d('d'),sourceRef:'campaign-a1'})];
  const provenance=createProvenanceIndex({tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:request.mergeId,nodes,edges:[createProvenanceEdge({type:'derived_from',from:'campaign-a1',to:'source-a'}),createProvenanceEdge({type:'produced',from:'campaign-a1',to:'finding-a1'})],createdAt:ts});
  const report=createMergedReportReference({tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:request.mergeId,sourceCampaignId:'campaign-a1',sourceState:'complete',reportId:'report-a1',reportDigest:d('5'),evidenceRefs:[ref('evidence-a1','4')],label:'Campaign A1 report',createdAt:ts});
  const storage=planMergeStorageTransaction({tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:request.mergeId,terminalManifestIds:['campaign-a1','campaign-a2'],currentEtag:d('e'),expectedEtag:d('e'),retainedBytes:2_000_000,retentionDays:90,existingImmutableDigests:[],quota:{maxInputs:16,maxBytes:3_000_000,maxRetentionDays:90}});
  const manifest=createMergeManifest({mergeRequest:request,finalState:'completed',terminalManifestDigests:[a.manifestDigest,b.manifestDigest],duplicateMapDigest:relations.duplicateMapDigest,conflictMapDigest:relations.conflictMapDigest,provenanceIndexDigest:provenance.indexDigest,mergedReportRefs:[{referenceId:report.referenceId,referenceDigest:report.referenceDigest}],policyId:'policy-a',operationSummary:storage.summary,publishedAt:ts});
  assert.equal(manifest.finalState,'completed');assert.deepEqual(storage.summary,{classA:4,classB:4,retainedBytes:2_000_000,retentionDays:90,variant:'typical-4a-4b-2mb-90d'});
  assert.equal(traceAuthorizedOrigins(provenance,{nodeId:'finding-a1',visibleCampaignIds:['campaign-a1']}).status,'ok');
});

test('stale writes, partial immutable retries, and dangling provenance remain deterministic',()=>{
  const base={tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:'merge-a',terminalManifestIds:['campaign-a1','campaign-a2','campaign-a3'],currentEtag:d('e'),expectedEtag:d('e'),retainedBytes:2_500_000,retentionDays:60,existingImmutableDigests:[d('1')],quota:{maxInputs:16,maxBytes:3_000_000,maxRetentionDays:90}};
  const first=planMergeStorageTransaction(base),replay=planMergeStorageTransaction(base);assert.deepEqual(replay,first);assert.equal(first.recovery.retrySafe,true);assert.equal(first.summary.classB,5);
  assert.throws(()=>planMergeStorageTransaction({...base,expectedEtag:d('0')}),{code:'stale_write'});
  const source=createProvenanceNode({nodeId:'source-a',type:'source',tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:null,digest:d('a'),sourceRef:null});
  assert.throws(()=>createProvenanceIndex({tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:'merge-a',nodes:[source],edges:[createProvenanceEdge({type:'references',from:'missing-a',to:'source-a'})],createdAt:ts}),{code:'dangling_reference'});
});

test('full finding and campaign input reversal is byte-stable',async()=>{
  const relationsFixture=await fixture('relation-scenarios-v1.json');assert.equal(canonicalJson(buildRelationMaps(relationsFixture.findings)),canonicalJson(buildRelationMaps([...relationsFixture.findings].reverse())));
  const data=await fixture('multi-tenant-campaigns-v1.json'),ws=data.tenants[0].workspaces[0];const manifests=ws.campaigns.slice(0,2).map(x=>terminal('tenant-a','workspace-a',ws.sourceDigest,x));
  const common={policyId:'policy-a',requestedBy:'user-a',requestedAt:ts,idempotencyKey:'merge-request-a',expectedCurrentEtag:d('e')};
  assert.equal(canonicalJson(createMergeRequest({...common,terminalManifests:manifests})),canonicalJson(createMergeRequest({...common,terminalManifests:[...manifests].reverse()})));
});
