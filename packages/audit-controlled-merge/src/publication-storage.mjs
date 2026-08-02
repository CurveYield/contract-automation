import {
  exactKeys, identifier, digest, timestamp, enumValue, integer, stringArray,
  denseArray, frozenClone, sha256, fail, safePath
} from '../../audit-clean-room-protocol/src/index.mjs';
import { validateMergeRequest } from './request-state.mjs';

export const MERGE_MANIFEST_SCHEMA='phase8-merge-manifest-v1';

function terminalDigests(value,path='$.terminalManifestDigests'){
  const result=stringArray(value,path,{maximum:64,item:digest});
  if(result.length<2)fail('insufficient_inputs',path);
  return result;
}

function reportReferences(value,path='$.mergedReportRefs'){
  const result=denseArray(value,path,100_000).map((entry,index)=>{
    const p=`${path}[${index}]`;
    const r=exactKeys(entry,['referenceId','referenceDigest'],p);
    return {
      referenceId:identifier(r.referenceId,`${p}.referenceId`),
      referenceDigest:digest(r.referenceDigest,`${p}.referenceDigest`)
    };
  });
  if(new Set(result.map((item)=>item.referenceId)).size!==result.length)fail('duplicate_identity',path);
  const sorted=[...result].sort((a,b)=>a.referenceId.localeCompare(b.referenceId));
  if(JSON.stringify(result)!==JSON.stringify(sorted))fail('noncanonical_order',path);
  return result;
}

function operationSummary(value,path='$.operationSummary'){
  const op=exactKeys(value,['classA','classB','retainedBytes','retentionDays','variant'],path);
  return {
    classA:integer(op.classA,`${path}.classA`,0,1000),
    classB:integer(op.classB,`${path}.classB`,0,1000),
    retainedBytes:integer(op.retainedBytes,`${path}.retainedBytes`,0,20_000_000),
    retentionDays:integer(op.retentionDays,`${path}.retentionDays`,1,90),
    variant:identifier(op.variant,`${path}.variant`)
  };
}

function manifestBody(value){
  return {
    schemaVersion:MERGE_MANIFEST_SCHEMA,
    mergeId:identifier(value.mergeId,'$.mergeId'),
    requestDigest:digest(value.requestDigest,'$.requestDigest'),
    finalState:enumValue(value.finalState,['completed','failed','cancelled','policy_rejected'],'$.finalState'),
    terminalManifestDigests:terminalDigests(value.terminalManifestDigests),
    duplicateMapDigest:digest(value.duplicateMapDigest,'$.duplicateMapDigest'),
    conflictMapDigest:digest(value.conflictMapDigest,'$.conflictMapDigest'),
    provenanceIndexDigest:digest(value.provenanceIndexDigest,'$.provenanceIndexDigest'),
    mergedReportRefs:reportReferences(value.mergedReportRefs),
    policyId:identifier(value.policyId,'$.policyId'),
    operationSummary:operationSummary(value.operationSummary),
    publishedAt:timestamp(value.publishedAt,'$.publishedAt')
  };
}

export function createMergeManifest(input){
  const v=exactKeys(input,[
    'mergeRequest','finalState','terminalManifestDigests','duplicateMapDigest','conflictMapDigest',
    'provenanceIndexDigest','mergedReportRefs','policyId','operationSummary','publishedAt'
  ],'$');
  const request=validateMergeRequest(v.mergeRequest);
  if(v.policyId!==request.policyId)fail('policy_mismatch','$.policyId');
  const expectedDigests=request.campaignManifestRefs.map((item)=>item.manifestDigest).sort();
  const suppliedDigests=terminalDigests(v.terminalManifestDigests);
  if(JSON.stringify(expectedDigests)!==JSON.stringify(suppliedDigests))fail('manifest_input_mismatch','$.terminalManifestDigests');
  const body=manifestBody({
    mergeId:request.mergeId,
    requestDigest:request.requestDigest,
    finalState:v.finalState,
    terminalManifestDigests:suppliedDigests,
    duplicateMapDigest:v.duplicateMapDigest,
    conflictMapDigest:v.conflictMapDigest,
    provenanceIndexDigest:v.provenanceIndexDigest,
    mergedReportRefs:v.mergedReportRefs,
    policyId:v.policyId,
    operationSummary:v.operationSummary,
    publishedAt:v.publishedAt
  });
  const manifestDigest=sha256(body);
  return frozenClone({...body,manifestId:`merge-manifest-${manifestDigest.slice(7,31)}`,manifestDigest});
}

export function validateMergeManifest(input){
  const v=exactKeys(input,[
    'schemaVersion','manifestId','manifestDigest','mergeId','requestDigest','finalState',
    'terminalManifestDigests','duplicateMapDigest','conflictMapDigest','provenanceIndexDigest',
    'mergedReportRefs','policyId','operationSummary','publishedAt'
  ],'$');
  if(v.schemaVersion!==MERGE_MANIFEST_SCHEMA)fail('invalid_schema','$.schemaVersion');
  const body=manifestBody(v);
  const expected=sha256(body);
  if(digest(v.manifestDigest,'$.manifestDigest')!==expected)fail('digest_mismatch','$.manifestDigest');
  if(identifier(v.manifestId,'$.manifestId')!==`merge-manifest-${expected.slice(7,31)}`)fail('identity_mismatch','$.manifestId');
  return frozenClone({...body,manifestId:v.manifestId,manifestDigest:v.manifestDigest});
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
  const operations=[...terminalReads,
    {class:'class-b',method:'GetObject',key:`${base}/current-v1.json`},
    {class:'class-b',method:'GetObject',key:`tenants/${tenantId}/workspaces/${workspaceId}/indexes/merges-v1.json`},
    {class:'class-a',method:'PutObject',key:`${base}/request-events-v1.json`,immutable:true},
    {class:'class-a',method:'PutObject',key:`${base}/relations-provenance-v1.json`,immutable:true},
    {class:'class-a',method:'PutObject',key:`${base}/manifest-v1.json`,immutable:true},
    {class:'class-a',method:'PutObject',key:`${base}/current-index-v1.json`,ifMatch:v.currentEtag}
  ];
  const classA=operations.filter((op)=>op.class==='class-a').length,classB=operations.filter((op)=>op.class==='class-b').length;
  const variant=ids.length===2&&retainedBytes===2_000_000&&retentionDays===90&&existing.length===0?'typical-4a-4b-2mb-90d':existing.length?'idempotent-retry':'bounded-variant';
  return frozenClone({schemaVersion:'phase8-merge-storage-transaction-v1',tenantId,workspaceId,mergeId,operations,summary:{classA,classB,retainedBytes,retentionDays,variant},usesPrefixListing:false,conditionalWrites:true,serverOwnedIndexes:true,recovery:{existingImmutableDigests:existing,retrySafe:true}});
}

export function rebuildMergeIndex(input){
  const v=exactKeys(input,['tenantId','workspaceId','approvedEntries','rebuiltAt'],'$');
  const tenantId=identifier(v.tenantId,'$.tenantId'),workspaceId=identifier(v.workspaceId,'$.workspaceId');
  const entries=denseArray(v.approvedEntries,'$.approvedEntries',100_000).map((entry,index)=>{
    const p=`$.approvedEntries[${index}]`;
    const x=exactKeys(entry,['mergeId','manifestId','manifestDigest','visibleCampaignIds'],p);
    return {
      mergeId:identifier(x.mergeId,`${p}.mergeId`),
      manifestId:identifier(x.manifestId,`${p}.manifestId`),
      manifestDigest:digest(x.manifestDigest,`${p}.manifestDigest`),
      visibleCampaignIds:stringArray(x.visibleCampaignIds,`${p}.visibleCampaignIds`,{maximum:64,item:identifier})
    };
  }).sort((a,b)=>a.mergeId.localeCompare(b.mergeId));
  if(new Set(entries.map((entry)=>entry.mergeId)).size!==entries.length)fail('duplicate_identity','$.approvedEntries');
  const body={schemaVersion:'phase8-merge-index-v1',tenantId,workspaceId,entries,rebuiltAt:timestamp(v.rebuiltAt,'$.rebuiltAt'),source:'approved-immutable-manifests',usesPrefixListing:false};
  const indexDigest=sha256(body);
  return frozenClone({...body,indexId:`merge-index-${indexDigest.slice(7,31)}`,indexDigest});
}
