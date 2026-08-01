import {
  exactKeys, identifier, digest, timestamp, enumValue, integer, boolean,
  stringArray, denseArray, frozenClone, sha256, fail, safePath
} from '../../audit-clean-room-protocol/src/index.mjs';
import { validateTerminalCampaignManifest } from '../../audit-clean-room-campaigns/src/index.mjs';

export const MERGE_REQUEST_SCHEMA='phase8-merge-request-v1';
export const MERGE_STATE_SCHEMA='phase8-merge-state-v1';
export const MERGE_EVENT_SCHEMA='phase8-merge-event-v1';
export const DUPLICATE_RELATION_SCHEMA='phase8-duplicate-relation-v1';
export const CONFLICT_RELATION_SCHEMA='phase8-conflict-relation-v1';
export const MERGE_MANIFEST_SCHEMA='phase8-merge-manifest-v1';

export const MERGE_STATES=Object.freeze(['requested','validating','admitted','resolving_relations','building_provenance','publishing','completed','failed','cancelled','policy_rejected']);
const TRANSITIONS=Object.freeze({
  requested:['validating','cancelled'],validating:['admitted','failed','policy_rejected','cancelled'],admitted:['resolving_relations','failed','cancelled'],
  resolving_relations:['building_provenance','failed','cancelled'],building_provenance:['publishing','failed','cancelled'],publishing:['completed','failed'],
  completed:[],failed:[],cancelled:[],policy_rejected:[]
});

export function createMergeRequest(input){
  const v=exactKeys(input,['terminalManifests','policyId','requestedBy','requestedAt','idempotencyKey','expectedCurrentEtag'],'$');
  const manifests=denseArray(v.terminalManifests,'$.terminalManifests',64).map((item)=>validateTerminalCampaignManifest(item));
  if(manifests.length<2) fail('insufficient_inputs','$.terminalManifests');
  manifests.sort((a,b)=>a.campaignId.localeCompare(b.campaignId));
  if(new Set(manifests.map((item)=>item.campaignId)).size!==manifests.length) fail('duplicate_identity','$.terminalManifests');
  const first=manifests[0];
  for(let i=0;i<manifests.length;i+=1){
    const item=manifests[i];
    if(!item.mergeEligible) fail('campaign_ineligible',`$.terminalManifests[${i}].mergeEligible`);
    if(item.tenantId!==first.tenantId) fail('tenant_mismatch',`$.terminalManifests[${i}].tenantId`);
    if(item.workspaceId!==first.workspaceId) fail('workspace_mismatch',`$.terminalManifests[${i}].workspaceId`);
    if(item.workspaceSourceDigest!==first.workspaceSourceDigest) fail('source_mismatch',`$.terminalManifests[${i}].workspaceSourceDigest`);
  }
  const body={schemaVersion:MERGE_REQUEST_SCHEMA,tenantId:first.tenantId,workspaceId:first.workspaceId,workspaceSourceDigest:first.workspaceSourceDigest,
    campaignManifestRefs:manifests.map((item)=>({campaignId:item.campaignId,manifestId:item.manifestId,manifestDigest:item.manifestDigest})),
    policyId:identifier(v.policyId,'$.policyId'),requestedBy:identifier(v.requestedBy,'$.requestedBy'),requestedAt:timestamp(v.requestedAt,'$.requestedAt'),
    idempotencyKey:identifier(v.idempotencyKey,'$.idempotencyKey'),expectedCurrentEtag:digest(v.expectedCurrentEtag,'$.expectedCurrentEtag')};
  const requestDigest=sha256(body);
  return frozenClone({...body,mergeId:`merge-${requestDigest.slice(7,31)}`,requestDigest});
}

export function validateMergeRequest(input){
  const v=exactKeys(input,['schemaVersion','mergeId','requestDigest','tenantId','workspaceId','workspaceSourceDigest','campaignManifestRefs','policyId','requestedBy','requestedAt','idempotencyKey','expectedCurrentEtag'],'$');
  if(v.schemaVersion!==MERGE_REQUEST_SCHEMA) fail('invalid_schema','$.schemaVersion');
  identifier(v.mergeId,'$.mergeId');digest(v.requestDigest,'$.requestDigest');identifier(v.tenantId,'$.tenantId');identifier(v.workspaceId,'$.workspaceId');digest(v.workspaceSourceDigest,'$.workspaceSourceDigest');
  const refs=denseArray(v.campaignManifestRefs,'$.campaignManifestRefs',64).map((entry,index)=>{
    const r=exactKeys(entry,['campaignId','manifestId','manifestDigest'],`$.campaignManifestRefs[${index}]`);
    return {campaignId:identifier(r.campaignId,`$.campaignManifestRefs[${index}].campaignId`),manifestId:identifier(r.manifestId,`$.campaignManifestRefs[${index}].manifestId`),manifestDigest:digest(r.manifestDigest,`$.campaignManifestRefs[${index}].manifestDigest`)};
  });
  const sorted=[...refs].sort((a,b)=>a.campaignId.localeCompare(b.campaignId));
  if(JSON.stringify(refs)!==JSON.stringify(sorted)) fail('noncanonical_order','$.campaignManifestRefs');
  identifier(v.policyId,'$.policyId');identifier(v.requestedBy,'$.requestedBy');timestamp(v.requestedAt,'$.requestedAt');identifier(v.idempotencyKey,'$.idempotencyKey');digest(v.expectedCurrentEtag,'$.expectedCurrentEtag');
  const body={schemaVersion:v.schemaVersion,tenantId:v.tenantId,workspaceId:v.workspaceId,workspaceSourceDigest:v.workspaceSourceDigest,campaignManifestRefs:refs,policyId:v.policyId,requestedBy:v.requestedBy,requestedAt:v.requestedAt,idempotencyKey:v.idempotencyKey,expectedCurrentEtag:v.expectedCurrentEtag};
  const expected=sha256(body);
  if(v.requestDigest!==expected) fail('digest_mismatch','$.requestDigest');
  if(v.mergeId!==`merge-${expected.slice(7,31)}`) fail('identity_mismatch','$.mergeId');
  return frozenClone(v);
}

export function createInitialMergeState(request,at){
  const r=validateMergeRequest(request);const updatedAt=timestamp(at,'$.at');
  const core={schemaVersion:MERGE_STATE_SCHEMA,mergeId:r.mergeId,state:'requested',version:0,updatedAt};
  return frozenClone({...core,etag:sha256(core)});
}

export function transitionMergeState(currentInput,input){
  const current=validateMergeState(currentInput);
  const v=exactKeys(input,['to','expectedEtag','at','reasonCode'],'$');
  const to=enumValue(v.to,MERGE_STATES,'$.to');
  if(v.expectedEtag!==current.etag) fail('stale_write','$.expectedEtag');
  if(!TRANSITIONS[current.state].includes(to)) fail('invalid_transition','$.to');
  const at=timestamp(v.at,'$.at');const reasonCode=identifier(v.reasonCode,'$.reasonCode');
  const nextCore={schemaVersion:MERGE_STATE_SCHEMA,mergeId:current.mergeId,state:to,version:current.version+1,updatedAt:at};
  const next=frozenClone({...nextCore,etag:sha256(nextCore)});
  const eventCore={schemaVersion:MERGE_EVENT_SCHEMA,mergeId:current.mergeId,from:current.state,to,version:next.version,reasonCode,at};
  const eventDigest=sha256(eventCore);
  const event=frozenClone({...eventCore,eventId:`merge-event-${eventDigest.slice(7,31)}`,eventDigest});
  return frozenClone({state:next,event});
}

export function validateMergeState(input){
  const v=exactKeys(input,['schemaVersion','mergeId','state','version','updatedAt','etag'],'$');
  if(v.schemaVersion!==MERGE_STATE_SCHEMA) fail('invalid_schema','$.schemaVersion');identifier(v.mergeId,'$.mergeId');enumValue(v.state,MERGE_STATES,'$.state');integer(v.version,'$.version',0,1000);timestamp(v.updatedAt,'$.updatedAt');digest(v.etag,'$.etag');
  const core={schemaVersion:v.schemaVersion,mergeId:v.mergeId,state:v.state,version:v.version,updatedAt:v.updatedAt};
  if(v.etag!==sha256(core)) fail('etag_mismatch','$.etag');return frozenClone(v);
}

function relationFinding(value,path){
  const v=exactKeys(value,['findingId','campaignId','identityKey','severity','status','remediation','location','materialDigest','evidenceRefs'],path);
  const evidenceRefs=denseArray(v.evidenceRefs,`${path}.evidenceRefs`,256).map((entry,index)=>{
    const r=exactKeys(entry,['id','digest'],`${path}.evidenceRefs[${index}]`);return {id:identifier(r.id,`${path}.evidenceRefs[${index}].id`),digest:digest(r.digest,`${path}.evidenceRefs[${index}].digest`)};
  }).sort((a,b)=>a.id.localeCompare(b.id));
  return {findingId:identifier(v.findingId,`${path}.findingId`),campaignId:identifier(v.campaignId,`${path}.campaignId`),identityKey:identifier(v.identityKey,`${path}.identityKey`),severity:identifier(v.severity,`${path}.severity`),status:identifier(v.status,`${path}.status`),remediation:identifier(v.remediation,`${path}.remediation`),location:identifier(v.location,`${path}.location`),materialDigest:digest(v.materialDigest,`${path}.materialDigest`),evidenceRefs};
}
function material(item){return {identityKey:item.identityKey,severity:item.severity,status:item.status,remediation:item.remediation,location:item.location,materialDigest:item.materialDigest};}
function member(item){return {campaignId:item.campaignId,findingId:item.findingId,materialDigest:item.materialDigest,evidenceRefs:item.evidenceRefs};}

export function buildRelationMaps(input){
  const findings=denseArray(input,'$',100_000).map((entry,index)=>relationFinding(entry,`$[${index}]`));
  findings.sort((a,b)=>`${a.identityKey}\u0000${a.campaignId}\u0000${a.findingId}`.localeCompare(`${b.identityKey}\u0000${b.campaignId}\u0000${b.findingId}`));
  const unique=new Set();for(const item of findings){const key=`${item.campaignId}\u0000${item.findingId}`;if(unique.has(key)) fail('duplicate_identity','$');unique.add(key);}
  const groups=new Map();for(const item of findings){if(!groups.has(item.identityKey))groups.set(item.identityKey,[]);groups.get(item.identityKey).push(item);}
  const duplicateRelations=[];const conflictRelations=[];
  for(const [identityKey,items] of [...groups.entries()].sort(([a],[b])=>a.localeCompare(b))){
    if(items.length<2)continue;
    const variants=new Map();for(const item of items){const key=JSON.stringify(material(item));if(!variants.has(key))variants.set(key,[]);variants.get(key).push(item);}
    for(const variantItems of variants.values()) if(variantItems.length>1){
      const members=variantItems.map(member).sort((a,b)=>`${a.campaignId}\u0000${a.findingId}`.localeCompare(`${b.campaignId}\u0000${b.findingId}`));
      const core={schemaVersion:DUPLICATE_RELATION_SCHEMA,identityKey,material:material(variantItems[0]),members};const relationDigest=sha256(core);
      duplicateRelations.push(frozenClone({...core,relationId:`duplicate-${relationDigest.slice(7,31)}`,relationDigest}));
    }
    if(variants.size>1){
      const values=items.map((item)=>({campaignId:item.campaignId,findingId:item.findingId,severity:item.severity,status:item.status,remediation:item.remediation,location:item.location,materialDigest:item.materialDigest,evidenceRefs:item.evidenceRefs})).sort((a,b)=>`${a.campaignId}\u0000${a.findingId}`.localeCompare(`${b.campaignId}\u0000${b.findingId}`));
      const fields=['severity','status','remediation','location','materialDigest'].filter((field)=>new Set(values.map((item)=>item[field])).size>1);
      const core={schemaVersion:CONFLICT_RELATION_SCHEMA,identityKey,conflictFields:fields,values};const relationDigest=sha256(core);
      conflictRelations.push(frozenClone({...core,relationId:`conflict-${relationDigest.slice(7,31)}`,relationDigest}));
    }
  }
  duplicateRelations.sort((a,b)=>a.relationId.localeCompare(b.relationId));conflictRelations.sort((a,b)=>a.relationId.localeCompare(b.relationId));
  const duplicateMapDigest=sha256(duplicateRelations),conflictMapDigest=sha256(conflictRelations);
  return frozenClone({schemaVersion:'phase8-relation-maps-v1',duplicateRelations,conflictRelations,duplicateMapDigest,conflictMapDigest,originalFindingDigests:findings.map((item)=>item.materialDigest).sort()});
}

export function createDuplicateRelation(input){const maps=buildRelationMaps(input);if(maps.duplicateRelations.length!==1||maps.conflictRelations.length)fail('relation_shape','$.input');return maps.duplicateRelations[0];}
export function createConflictRelation(input){const maps=buildRelationMaps(input);if(maps.conflictRelations.length!==1)fail('relation_shape','$.input');return maps.conflictRelations[0];}

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
  const terminalReads=ids.slice(0,2).map((id)=>({class:'B',method:'GetObject',key:`tenants/${tenantId}/workspaces/${workspaceId}/campaigns/${id}/terminal-manifest-v1.json`}));
  const operations=[...terminalReads,{class:'B',method:'GetObject',key:`${base}/current-v1.json`},{class:'B',method:'GetObject',key:`tenants/${tenantId}/workspaces/${workspaceId}/indexes/merges-v1.json`},
    {class:'A',method:'PutObject',key:`${base}/request-events-v1.json`,immutable:true},{class:'A',method:'PutObject',key:`${base}/relations-provenance-v1.json`,immutable:true},{class:'A',method:'PutObject',key:`${base}/manifest-v1.json`,immutable:true},{class:'A',method:'PutObject',key:`${base}/current-index-v1.json`,ifMatch:v.currentEtag}];
  const classA=operations.filter((op)=>op.class==='A').length,classB=operations.filter((op)=>op.class==='B').length;
  const variant=ids.length===2&&retainedBytes===2_000_000&&retentionDays===90&&existing.length===0?'typical-4a-4b-2mb-90d':existing.length?'idempotent-retry':'bounded-variant';
  return frozenClone({schemaVersion:'phase8-merge-storage-transaction-v1',tenantId,workspaceId,mergeId,operations,summary:{classA,classB,retainedBytes,retentionDays,variant},usesPrefixListing:false,conditionalWrites:true,serverOwnedIndexes:true,recovery:{existingImmutableDigests:existing,retrySafe:true}});
}
