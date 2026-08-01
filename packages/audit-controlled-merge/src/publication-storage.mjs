import { exactKeys, identifier, digest, timestamp, enumValue, integer, stringArray, denseArray, frozenClone, sha256, fail, safePath } from '../../audit-clean-room-protocol/src/index.mjs';
import { validateMergeRequest } from './request-state.mjs';

export const MERGE_MANIFEST_SCHEMA='phase8-merge-manifest-v1';

export function createMergeManifest(input){
  const v=exactKeys(input,['mergeRequest','finalState','terminalManifestDigests','duplicateMapDigest','conflictMapDigest','provenanceIndexDigest','mergedReportRefs','policyId','operationSummary','publishedAt'],'$');
  const request=validateMergeRequest(v.mergeRequest);const finalState=enumValue(v.finalState,['completed','failed','cancelled','policy_rejected'],'$.finalState');
  const terminalManifestDigests=stringArray(v.terminalManifestDigests,'$.terminalManifestDigests',{maximum:64,item:digest});
  const mergedReportRefs=denseArray(v.mergedReportRefs,'$.mergedReportRefs',100_000).map((entry,index)=>{const r=exactKeys(entry,['referenceId','referenceDigest'],`$.mergedReportRefs[${index}]`);return {referenceId:identifier(r.referenceId,`$.mergedReportRefs[${index}].referenceId`),referenceDigest:digest(r.referenceDigest,`$.mergedReportRefs[${index}].referenceDigest`)};}).sort((a,b)=>a.referenceId.localeCompare(b.referenceId));
  const op=exactKeys(v.operationSummary,['classA','classB','retainedBytes','retentionDays','variant'],'$.operationSummary');
  const operationSummary={classA:integer(op.classA,'$.operationSummary.classA',0,1000),classB:integer(op.classB,'$.operationSummary.classB',0,1000),retainedBytes:integer(op.retainedBytes,'$.operationSummary.retainedBytes',0,20_000_000),retentionDays:integer(op.retentionDays,'$.operationSummary.retentionDays',1,90),variant:identifier(op.variant,'$.operationSummary.variant')};
  const body={schemaVersion:MERGE_MANIFEST_SCHEMA,mergeId:request.mergeId,requestDigest:request.requestDigest,finalState,terminalManifestDigests,duplicateMapDigest:digest(v.duplicateMapDigest,'$.duplicateMapDigest'),conflictMapDigest:digest(v.conflictMapDigest,'$.conflictMapDigest'),provenanceIndexDigest:digest(v.provenanceIndexDigest,'$.provenanceIndexDigest'),mergedReportRefs,policyId:identifier(v.policyId,'$.policyId'),operationSummary,publishedAt:timestamp(v.publishedAt,'$.publishedAt')};
  const manifestDigest=sha256(body);return frozenClone({...body,manifestId:`merge-manifest-${manifestDigest.slice(7,31)}`,manifestDigest});
}

export function validateMergeManifest(input){
  const v=exactKeys(input,['schemaVersion','manifestId','manifestDigest','mergeId','requestDigest','finalState','terminalManifestDigests','duplicateMapDigest','conflictMapDigest','provenanceIndexDigest','mergedReportRefs','policyId','operationSummary','publishedAt'],'$');
  if(v.schemaVersion!==MERGE_MANIFEST_SCHEMA)fail('invalid_schema','$.schemaVersion');
  identifier(v.manifestId,'$.manifestId');digest(v.manifestDigest,'$.manifestDigest');identifier(v.mergeId,'$.mergeId');digest(v.requestDigest,'$.requestDigest');
  enumValue(v.finalState,['completed','failed','cancelled','policy_rejected'],'$.finalState');stringArray(v.terminalManifestDigests,'$.terminalManifestDigests',{maximum:64,item:digest});digest(v.duplicateMapDigest,'$.duplicateMapDigest');digest(v.conflictMapDigest,'$.conflictMapDigest');digest(v.provenanceIndexDigest,'$.provenanceIndexDigest');
  denseArray(v.mergedReportRefs,'$.mergedReportRefs',100_000);identifier(v.policyId,'$.policyId');exactKeys(v.operationSummary,['classA','classB','retainedBytes','retentionDays','variant'],'$.operationSummary');timestamp(v.publishedAt,'$.publishedAt');
  const core={schemaVersion:v.schemaVersion,mergeId:v.mergeId,requestDigest:v.requestDigest,finalState:v.finalState,terminalManifestDigests:v.terminalManifestDigests,duplicateMapDigest:v.duplicateMapDigest,conflictMapDigest:v.conflictMapDigest,provenanceIndexDigest:v.provenanceIndexDigest,mergedReportRefs:v.mergedReportRefs,policyId:v.policyId,operationSummary:v.operationSummary,publishedAt:v.publishedAt};
  const expected=sha256(core);if(v.manifestDigest!==expected)fail('digest_mismatch','$.manifestDigest');if(v.manifestId!==`merge-manifest-${expected.slice(7,31)}`)fail('identity_mismatch','$.manifestId');return frozenClone(v);
}

export function planMergeStorageTransaction(input){
  const v=exactKeys(input,['tenantId','workspaceId','mergeId','terminalManifestIds','currentEtag','expectedEtag','retainedBytes','retentionDays','existingImmutableDigests','quota'],'$');
  const tenantId=identifier(v.tenantId,'$.tenantId'),workspaceId=identifier(v.workspaceId,'$.workspaceId'),mergeId=identifier(v.mergeId,'$.mergeId');
  const ids=stringArray(v.terminalManifestIds,'$.terminalManifestIds',{maximum:64,item:identifier});if(ids.length<2)fail('insufficient_inputs','$.terminalManifestIds');
  if(v.currentEtag!==v.expectedEtag)fail('stale_write','$.expectedEtag');digest(v.currentEtag,'$.currentEtag');
  const retainedBytes=integer(v.retainedBytes,'$.retainedBytes',1,20_000_000),retentionDays=integer(v.retentionDays,'$.retentionDays',1,90);
  const quota=exactKeys(v.quota,['maxInputs','maxBytes','maxRetentionDays'],'$.quota');
  if(ids.length>integer(quota.maxInputs,'$.quota.maxInputs',2,64))fail('quota_exceeded','$.terminalManifestIds');
  if(retainedBytes>integer(quota.maxBytes,'$.quota.maxBytes',1,20_000_000))fail('quota_exceeded','$.retainedBytes');
  if(retentionDays>integer(quota.maxRetentionDays,'$.quota.maxRetentionDays',1,90))fail('quota_exceeded','$.retentionDays');
  const existing=stringArray(v.existingImmutableDigests,'$.existingImmutableDigests',{maximum:10,item:digest});
  const base=`tenants/${tenantId}/workspaces/${workspaceId}/merges/${mergeId}`;safePath(base,'$.base');
  const terminalReads=ids.map((id)=>({class:'class-b',method:'GetObject',key:`tenants/${tenantId}/workspaces/${workspaceId}/campaigns/${id}/terminal-manifest-v1.json`}));
  const operations=[...terminalReads,{class:'class-b',method:'GetObject',key:`${base}/current-v1.json`},{class:'class-b',method:'GetObject',key:`tenants/${tenantId}/workspaces/${workspaceId}/indexes/merges-v1.json`},
    {class:'class-a',method:'PutObject',key:`${base}/request-events-v1.json`,immutable:true},{class:'class-a',method:'PutObject',key:`${base}/relations-provenance-v1.json`,immutable:true},{class:'class-a',method:'PutObject',key:`${base}/manifest-v1.json`,immutable:true},{class:'class-a',method:'PutObject',key:`${base}/current-index-v1.json`,ifMatch:v.currentEtag}];
  const classA=operations.filter((op)=>op.class==='class-a').length,classB=operations.filter((op)=>op.class==='class-b').length;
  const variant=ids.length===2&&retainedBytes===2_000_000&&retentionDays===90&&existing.length===0?'typical-4a-4b-2mb-90d':existing.length?'idempotent-retry':'bounded-variant';
  return frozenClone({schemaVersion:'phase8-merge-storage-transaction-v1',tenantId,workspaceId,mergeId,operations,summary:{classA,classB,retainedBytes,retentionDays,variant},usesPrefixListing:false,conditionalWrites:true,serverOwnedIndexes:true,recovery:{existingImmutableDigests:existing,retrySafe:true}});
}



export function rebuildMergeIndex(input){
  const v=exactKeys(input,['tenantId','workspaceId','approvedEntries','rebuiltAt'],'$');const tenantId=identifier(v.tenantId,'$.tenantId'),workspaceId=identifier(v.workspaceId,'$.workspaceId');
  const entries=denseArray(v.approvedEntries,'$.approvedEntries',100_000).map((entry,index)=>{const p=`$.approvedEntries[${index}]`;const x=exactKeys(entry,['mergeId','manifestId','manifestDigest','visibleCampaignIds'],p);return{mergeId:identifier(x.mergeId,`${p}.mergeId`),manifestId:identifier(x.manifestId,`${p}.manifestId`),manifestDigest:digest(x.manifestDigest,`${p}.manifestDigest`),visibleCampaignIds:stringArray(x.visibleCampaignIds,`${p}.visibleCampaignIds`,{maximum:64,item:identifier})};}).sort((a,b)=>a.mergeId.localeCompare(b.mergeId));
  if(new Set(entries.map((entry)=>entry.mergeId)).size!==entries.length)fail('duplicate_identity','$.approvedEntries');const body={schemaVersion:'phase8-merge-index-v1',tenantId,workspaceId,entries,rebuiltAt:timestamp(v.rebuiltAt,'$.rebuiltAt'),source:'approved-immutable-manifests',usesPrefixListing:false};const indexDigest=sha256(body);return frozenClone({...body,indexId:`merge-index-${indexDigest.slice(7,31)}`,indexDigest});
}
