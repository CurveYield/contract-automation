import {
  exactKeys, identifier, digest, timestamp, enumValue, integer,
  denseArray, frozenClone, sha256, fail
} from '../../audit-clean-room-protocol/src/index.mjs';
import { validateTerminalCampaignManifest } from '../../audit-clean-room-campaigns/src/index.mjs';

export const MERGE_REQUEST_SCHEMA='phase8-merge-request-v1';
export const MERGE_STATE_SCHEMA='phase8-merge-state-v1';
export const MERGE_EVENT_SCHEMA='phase8-merge-event-v1';
export const MERGE_STATES=Object.freeze([
  'requested','validating','admitted','resolving_relations','building_provenance',
  'publishing','completed','failed','cancelled','policy_rejected'
]);
const TRANSITIONS=Object.freeze({
  requested:['validating','cancelled'],
  validating:['admitted','failed','policy_rejected','cancelled'],
  admitted:['resolving_relations','failed','cancelled'],
  resolving_relations:['building_provenance','failed','cancelled'],
  building_provenance:['publishing','failed','cancelled'],
  publishing:['completed','failed'],completed:[],failed:[],cancelled:[],policy_rejected:[]
});

function normalizeManifestRefs(value,{requireCanonical=false}={}){
  const refs=denseArray(value,'$.campaignManifestRefs',64).map((entry,index)=>{
    const path=`$.campaignManifestRefs[${index}]`;
    const record=exactKeys(entry,['campaignId','manifestId','manifestDigest'],path);
    return {
      campaignId:identifier(record.campaignId,`${path}.campaignId`),
      manifestId:identifier(record.manifestId,`${path}.manifestId`),
      manifestDigest:digest(record.manifestDigest,`${path}.manifestDigest`)
    };
  });
  if(refs.length<2)fail('insufficient_inputs','$.campaignManifestRefs');
  for(const field of ['campaignId','manifestId','manifestDigest']){
    if(new Set(refs.map((item)=>item[field])).size!==refs.length)fail('duplicate_identity','$.campaignManifestRefs');
  }
  const sorted=[...refs].sort((a,b)=>a.campaignId.localeCompare(b.campaignId)||a.manifestId.localeCompare(b.manifestId));
  if(requireCanonical&&JSON.stringify(refs)!==JSON.stringify(sorted))fail('noncanonical_order','$.campaignManifestRefs');
  return sorted;
}

function mergeRequestBody(value,{requireCanonical=false}={}){
  const refs=normalizeManifestRefs(value.campaignManifestRefs,{requireCanonical});
  return {
    schemaVersion:MERGE_REQUEST_SCHEMA,
    tenantId:identifier(value.tenantId,'$.tenantId'),
    workspaceId:identifier(value.workspaceId,'$.workspaceId'),
    workspaceSourceDigest:digest(value.workspaceSourceDigest,'$.workspaceSourceDigest'),
    campaignManifestRefs:refs,
    policyId:identifier(value.policyId,'$.policyId'),
    requestedBy:identifier(value.requestedBy,'$.requestedBy'),
    requestedAt:timestamp(value.requestedAt,'$.requestedAt'),
    idempotencyKey:identifier(value.idempotencyKey,'$.idempotencyKey'),
    expectedCurrentEtag:digest(value.expectedCurrentEtag,'$.expectedCurrentEtag')
  };
}

export function createMergeRequest(input){
  const value=exactKeys(input,['terminalManifests','policyId','requestedBy','requestedAt','idempotencyKey','expectedCurrentEtag'],'$');
  const manifests=denseArray(value.terminalManifests,'$.terminalManifests',64).map((item)=>validateTerminalCampaignManifest(item));
  if(manifests.length<2)fail('insufficient_inputs','$.terminalManifests');
  manifests.sort((a,b)=>a.campaignId.localeCompare(b.campaignId));
  if(new Set(manifests.map((item)=>item.campaignId)).size!==manifests.length)fail('duplicate_identity','$.terminalManifests');
  const first=manifests[0];
  for(let index=0;index<manifests.length;index+=1){
    const item=manifests[index];
    if(!item.mergeEligible)fail('campaign_ineligible',`$.terminalManifests[${index}].mergeEligible`);
    if(item.tenantId!==first.tenantId)fail('tenant_mismatch',`$.terminalManifests[${index}].tenantId`);
    if(item.workspaceId!==first.workspaceId)fail('workspace_mismatch',`$.terminalManifests[${index}].workspaceId`);
    if(item.workspaceSourceDigest!==first.workspaceSourceDigest)fail('source_mismatch',`$.terminalManifests[${index}].workspaceSourceDigest`);
  }
  const body=mergeRequestBody({
    tenantId:first.tenantId,workspaceId:first.workspaceId,workspaceSourceDigest:first.workspaceSourceDigest,
    campaignManifestRefs:manifests.map((item)=>({campaignId:item.campaignId,manifestId:item.manifestId,manifestDigest:item.manifestDigest})),
    policyId:value.policyId,requestedBy:value.requestedBy,requestedAt:value.requestedAt,
    idempotencyKey:value.idempotencyKey,expectedCurrentEtag:value.expectedCurrentEtag
  });
  const requestDigest=sha256(body);
  return frozenClone({...body,mergeId:`merge-${requestDigest.slice(7,31)}`,requestDigest});
}

export function validateMergeRequest(input){
  const value=exactKeys(input,[
    'schemaVersion','mergeId','requestDigest','tenantId','workspaceId','workspaceSourceDigest',
    'campaignManifestRefs','policyId','requestedBy','requestedAt','idempotencyKey','expectedCurrentEtag'
  ],'$');
  if(value.schemaVersion!==MERGE_REQUEST_SCHEMA)fail('invalid_schema','$.schemaVersion');
  const body=mergeRequestBody(value,{requireCanonical:true});
  const expected=sha256(body);
  if(digest(value.requestDigest,'$.requestDigest')!==expected)fail('digest_mismatch','$.requestDigest');
  if(identifier(value.mergeId,'$.mergeId')!==`merge-${expected.slice(7,31)}`)fail('identity_mismatch','$.mergeId');
  return frozenClone({...body,mergeId:value.mergeId,requestDigest:value.requestDigest});
}

export function createInitialMergeState(request,at){
  const normalized=validateMergeRequest(request),updatedAt=timestamp(at,'$.at');
  const core={schemaVersion:MERGE_STATE_SCHEMA,mergeId:normalized.mergeId,state:'requested',version:0,updatedAt};
  return frozenClone({...core,etag:sha256(core)});
}
export function transitionMergeState(currentInput,input){
  const current=validateMergeState(currentInput),value=exactKeys(input,['to','expectedEtag','at','reasonCode'],'$');
  const to=enumValue(value.to,MERGE_STATES,'$.to');
  if(value.expectedEtag!==current.etag)fail('stale_write','$.expectedEtag');
  if(!TRANSITIONS[current.state].includes(to))fail('invalid_transition','$.to');
  const at=timestamp(value.at,'$.at'),reasonCode=identifier(value.reasonCode,'$.reasonCode');
  const nextCore={schemaVersion:MERGE_STATE_SCHEMA,mergeId:current.mergeId,state:to,version:current.version+1,updatedAt:at};
  const next=frozenClone({...nextCore,etag:sha256(nextCore)});
  const eventCore={schemaVersion:MERGE_EVENT_SCHEMA,mergeId:current.mergeId,from:current.state,to,version:next.version,reasonCode,at};
  const eventDigest=sha256(eventCore);
  return frozenClone({state:next,event:{...eventCore,eventId:`merge-event-${eventDigest.slice(7,31)}`,eventDigest}});
}
export function validateMergeState(input){
  const value=exactKeys(input,['schemaVersion','mergeId','state','version','updatedAt','etag'],'$');
  if(value.schemaVersion!==MERGE_STATE_SCHEMA)fail('invalid_schema','$.schemaVersion');
  const core={schemaVersion:value.schemaVersion,mergeId:identifier(value.mergeId,'$.mergeId'),state:enumValue(value.state,MERGE_STATES,'$.state'),version:integer(value.version,'$.version',0,1000),updatedAt:timestamp(value.updatedAt,'$.updatedAt')};
  const etag=digest(value.etag,'$.etag');if(etag!==sha256(core))fail('etag_mismatch','$.etag');
  return frozenClone({...core,etag});
}
export function validateMergeEvent(input){
  const value=exactKeys(input,['schemaVersion','eventId','eventDigest','mergeId','from','to','version','reasonCode','at'],'$');
  if(value.schemaVersion!==MERGE_EVENT_SCHEMA)fail('invalid_schema','$.schemaVersion');
  const core={schemaVersion:value.schemaVersion,mergeId:identifier(value.mergeId,'$.mergeId'),from:enumValue(value.from,MERGE_STATES,'$.from'),to:enumValue(value.to,MERGE_STATES,'$.to'),version:integer(value.version,'$.version',1,1000),reasonCode:identifier(value.reasonCode,'$.reasonCode'),at:timestamp(value.at,'$.at')};
  const expected=sha256(core);
  if(digest(value.eventDigest,'$.eventDigest')!==expected)fail('digest_mismatch','$.eventDigest');
  if(identifier(value.eventId,'$.eventId')!==`merge-event-${expected.slice(7,31)}`)fail('identity_mismatch','$.eventId');
  return frozenClone({...core,eventId:value.eventId,eventDigest:value.eventDigest});
}
