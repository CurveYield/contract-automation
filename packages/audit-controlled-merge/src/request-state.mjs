import {
  exactKeys, identifier, digest, timestamp, enumValue, integer, denseArray,
  frozenClone, sha256, fail
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
  publishing:['completed','failed'],
  completed:[],failed:[],cancelled:[],policy_rejected:[]
});

function campaignManifestRefs(value,path='$.campaignManifestRefs'){
  const refs=denseArray(value,path,64).map((entry,index)=>{
    const p=`${path}[${index}]`;
    const r=exactKeys(entry,['campaignId','manifestId','manifestDigest'],p);
    return {
      campaignId:identifier(r.campaignId,`${p}.campaignId`),
      manifestId:identifier(r.manifestId,`${p}.manifestId`),
      manifestDigest:digest(r.manifestDigest,`${p}.manifestDigest`)
    };
  });
  if(refs.length<2)fail('insufficient_inputs',path);
  if(new Set(refs.map((item)=>item.campaignId)).size!==refs.length)fail('duplicate_identity',path);
  if(new Set(refs.map((item)=>item.manifestId)).size!==refs.length)fail('duplicate_identity',path);
  const sorted=[...refs].sort((a,b)=>a.campaignId.localeCompare(b.campaignId));
  if(JSON.stringify(refs)!==JSON.stringify(sorted))fail('noncanonical_order',path);
  return refs;
}

function requestBody(value){
  return {
    schemaVersion:MERGE_REQUEST_SCHEMA,
    tenantId:identifier(value.tenantId,'$.tenantId'),
    workspaceId:identifier(value.workspaceId,'$.workspaceId'),
    workspaceSourceDigest:digest(value.workspaceSourceDigest,'$.workspaceSourceDigest'),
    campaignManifestRefs:campaignManifestRefs(value.campaignManifestRefs),
    policyId:identifier(value.policyId,'$.policyId'),
    requestedBy:identifier(value.requestedBy,'$.requestedBy'),
    requestedAt:timestamp(value.requestedAt,'$.requestedAt'),
    idempotencyKey:identifier(value.idempotencyKey,'$.idempotencyKey'),
    expectedCurrentEtag:digest(value.expectedCurrentEtag,'$.expectedCurrentEtag')
  };
}

export function createMergeRequest(input){
  const v=exactKeys(input,['terminalManifests','policyId','requestedBy','requestedAt','idempotencyKey','expectedCurrentEtag'],'$');
  const manifests=denseArray(v.terminalManifests,'$.terminalManifests',64)
    .map((item)=>validateTerminalCampaignManifest(item))
    .sort((a,b)=>a.campaignId.localeCompare(b.campaignId));
  if(manifests.length<2)fail('insufficient_inputs','$.terminalManifests');
  if(new Set(manifests.map((item)=>item.campaignId)).size!==manifests.length)fail('duplicate_identity','$.terminalManifests');
  const first=manifests[0];
  for(let index=0;index<manifests.length;index+=1){
    const item=manifests[index];
    if(!item.mergeEligible)fail('campaign_ineligible',`$.terminalManifests[${index}].mergeEligible`);
    if(item.tenantId!==first.tenantId)fail('tenant_mismatch',`$.terminalManifests[${index}].tenantId`);
    if(item.workspaceId!==first.workspaceId)fail('workspace_mismatch',`$.terminalManifests[${index}].workspaceId`);
    if(item.workspaceSourceDigest!==first.workspaceSourceDigest)fail('source_mismatch',`$.terminalManifests[${index}].workspaceSourceDigest`);
  }
  const body=requestBody({
    tenantId:first.tenantId,
    workspaceId:first.workspaceId,
    workspaceSourceDigest:first.workspaceSourceDigest,
    campaignManifestRefs:manifests.map((item)=>({
      campaignId:item.campaignId,
      manifestId:item.manifestId,
      manifestDigest:item.manifestDigest
    })),
    policyId:v.policyId,
    requestedBy:v.requestedBy,
    requestedAt:v.requestedAt,
    idempotencyKey:v.idempotencyKey,
    expectedCurrentEtag:v.expectedCurrentEtag
  });
  const requestDigest=sha256(body);
  return frozenClone({...body,mergeId:`merge-${requestDigest.slice(7,31)}`,requestDigest});
}

export function validateMergeRequest(input){
  const v=exactKeys(input,[
    'schemaVersion','mergeId','requestDigest','tenantId','workspaceId','workspaceSourceDigest',
    'campaignManifestRefs','policyId','requestedBy','requestedAt','idempotencyKey','expectedCurrentEtag'
  ],'$');
  if(v.schemaVersion!==MERGE_REQUEST_SCHEMA)fail('invalid_schema','$.schemaVersion');
  const body=requestBody(v);
  const expected=sha256(body);
  if(digest(v.requestDigest,'$.requestDigest')!==expected)fail('digest_mismatch','$.requestDigest');
  if(identifier(v.mergeId,'$.mergeId')!==`merge-${expected.slice(7,31)}`)fail('identity_mismatch','$.mergeId');
  return frozenClone({...body,mergeId:v.mergeId,requestDigest:v.requestDigest});
}

export function createInitialMergeState(request,at){
  const r=validateMergeRequest(request);
  const updatedAt=timestamp(at,'$.at');
  const core={schemaVersion:MERGE_STATE_SCHEMA,mergeId:r.mergeId,state:'requested',version:0,updatedAt};
  return frozenClone({...core,etag:sha256(core)});
}

export function transitionMergeState(currentInput,input){
  const current=validateMergeState(currentInput);
  const v=exactKeys(input,['to','expectedEtag','at','reasonCode'],'$');
  const to=enumValue(v.to,MERGE_STATES,'$.to');
  if(v.expectedEtag!==current.etag)fail('stale_write','$.expectedEtag');
  if(!TRANSITIONS[current.state].includes(to))fail('invalid_transition','$.to');
  const at=timestamp(v.at,'$.at');
  const reasonCode=identifier(v.reasonCode,'$.reasonCode');
  const nextCore={schemaVersion:MERGE_STATE_SCHEMA,mergeId:current.mergeId,state:to,version:current.version+1,updatedAt:at};
  const next=frozenClone({...nextCore,etag:sha256(nextCore)});
  const eventCore={schemaVersion:MERGE_EVENT_SCHEMA,mergeId:current.mergeId,from:current.state,to,version:next.version,reasonCode,at};
  const eventDigest=sha256(eventCore);
  const event=frozenClone({...eventCore,eventId:`merge-event-${eventDigest.slice(7,31)}`,eventDigest});
  return frozenClone({state:next,event});
}

export function validateMergeState(input){
  const v=exactKeys(input,['schemaVersion','mergeId','state','version','updatedAt','etag'],'$');
  if(v.schemaVersion!==MERGE_STATE_SCHEMA)fail('invalid_schema','$.schemaVersion');
  const core={
    schemaVersion:v.schemaVersion,
    mergeId:identifier(v.mergeId,'$.mergeId'),
    state:enumValue(v.state,MERGE_STATES,'$.state'),
    version:integer(v.version,'$.version',0,1000),
    updatedAt:timestamp(v.updatedAt,'$.updatedAt')
  };
  const etag=digest(v.etag,'$.etag');
  if(etag!==sha256(core))fail('etag_mismatch','$.etag');
  return frozenClone({...core,etag});
}

export function validateMergeEvent(input){
  const v=exactKeys(input,['schemaVersion','eventId','eventDigest','mergeId','from','to','version','reasonCode','at'],'$');
  if(v.schemaVersion!==MERGE_EVENT_SCHEMA)fail('invalid_schema','$.schemaVersion');
  const core={
    schemaVersion:v.schemaVersion,
    mergeId:identifier(v.mergeId,'$.mergeId'),
    from:enumValue(v.from,MERGE_STATES,'$.from'),
    to:enumValue(v.to,MERGE_STATES,'$.to'),
    version:integer(v.version,'$.version',1,1000),
    reasonCode:identifier(v.reasonCode,'$.reasonCode'),
    at:timestamp(v.at,'$.at')
  };
  const expected=sha256(core);
  if(digest(v.eventDigest,'$.eventDigest')!==expected)fail('digest_mismatch','$.eventDigest');
  if(identifier(v.eventId,'$.eventId')!==`merge-event-${expected.slice(7,31)}`)fail('identity_mismatch','$.eventId');
  return frozenClone({...core,eventId:v.eventId,eventDigest:v.eventDigest});
}
