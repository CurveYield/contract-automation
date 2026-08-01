import { exactKeys, identifier, digest, timestamp, enumValue, integer, denseArray, frozenClone, sha256, fail } from '../../audit-clean-room-protocol/src/index.mjs';
import { validateTerminalCampaignManifest } from '../../audit-clean-room-campaigns/src/index.mjs';

export const MERGE_REQUEST_SCHEMA='phase8-merge-request-v1';
export const MERGE_STATE_SCHEMA='phase8-merge-state-v1';
export const MERGE_EVENT_SCHEMA='phase8-merge-event-v1';
export const MERGE_STATES=Object.freeze(['requested','validating','admitted','resolving_relations','building_provenance','publishing','completed','failed','cancelled','policy_rejected']);
const TRANSITIONS=Object.freeze({requested:['validating','cancelled'],validating:['admitted','failed','policy_rejected','cancelled'],admitted:['resolving_relations','failed','cancelled'],resolving_relations:['building_provenance','failed','cancelled'],building_provenance:['publishing','failed','cancelled'],publishing:['completed','failed'],completed:[],failed:[],cancelled:[],policy_rejected:[]});

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
  const body={schemaVersion:MERGE_REQUEST_SCHEMA,tenantId:first.tenantId,workspaceId:first.workspaceId,workspaceSourceDigest:first.workspaceSourceDigest,campaignManifestRefs:manifests.map((item)=>({campaignId:item.campaignId,manifestId:item.manifestId,manifestDigest:item.manifestDigest})),policyId:identifier(v.policyId,'$.policyId'),requestedBy:identifier(v.requestedBy,'$.requestedBy'),requestedAt:timestamp(v.requestedAt,'$.requestedAt'),idempotencyKey:identifier(v.idempotencyKey,'$.idempotencyKey'),expectedCurrentEtag:digest(v.expectedCurrentEtag,'$.expectedCurrentEtag')};
  const requestDigest=sha256(body);return frozenClone({...body,mergeId:`merge-${requestDigest.slice(7,31)}`,requestDigest});
}

export function validateMergeRequest(input){
  const v=exactKeys(input,['schemaVersion','mergeId','requestDigest','tenantId','workspaceId','workspaceSourceDigest','campaignManifestRefs','policyId','requestedBy','requestedAt','idempotencyKey','expectedCurrentEtag'],'$');if(v.schemaVersion!==MERGE_REQUEST_SCHEMA)fail('invalid_schema','$.schemaVersion');identifier(v.mergeId,'$.mergeId');digest(v.requestDigest,'$.requestDigest');identifier(v.tenantId,'$.tenantId');identifier(v.workspaceId,'$.workspaceId');digest(v.workspaceSourceDigest,'$.workspaceSourceDigest');
  const refs=denseArray(v.campaignManifestRefs,'$.campaignManifestRefs',64).map((entry,index)=>{const r=exactKeys(entry,['campaignId','manifestId','manifestDigest'],`$.campaignManifestRefs[${index}]`);return{campaignId:identifier(r.campaignId,`$.campaignManifestRefs[${index}].campaignId`),manifestId:identifier(r.manifestId,`$.campaignManifestRefs[${index}].manifestId`),manifestDigest:digest(r.manifestDigest,`$.campaignManifestRefs[${index}].manifestDigest`)};});
  const sorted=[...refs].sort((a,b)=>a.campaignId.localeCompare(b.campaignId));if(JSON.stringify(refs)!==JSON.stringify(sorted))fail('noncanonical_order','$.campaignManifestRefs');identifier(v.policyId,'$.policyId');identifier(v.requestedBy,'$.requestedBy');timestamp(v.requestedAt,'$.requestedAt');identifier(v.idempotencyKey,'$.idempotencyKey');digest(v.expectedCurrentEtag,'$.expectedCurrentEtag');
  const body={schemaVersion:v.schemaVersion,tenantId:v.tenantId,workspaceId:v.workspaceId,workspaceSourceDigest:v.workspaceSourceDigest,campaignManifestRefs:refs,policyId:v.policyId,requestedBy:v.requestedBy,requestedAt:v.requestedAt,idempotencyKey:v.idempotencyKey,expectedCurrentEtag:v.expectedCurrentEtag};const expected=sha256(body);if(v.requestDigest!==expected)fail('digest_mismatch','$.requestDigest');if(v.mergeId!==`merge-${expected.slice(7,31)}`)fail('identity_mismatch','$.mergeId');return frozenClone(v);
}

export function createInitialMergeState(request,at){const r=validateMergeRequest(request);const updatedAt=timestamp(at,'$.at');const core={schemaVersion:MERGE_STATE_SCHEMA,mergeId:r.mergeId,state:'requested',version:0,updatedAt};return frozenClone({...core,etag:sha256(core)});}
export function transitionMergeState(currentInput,input){const current=validateMergeState(currentInput);const v=exactKeys(input,['to','expectedEtag','at','reasonCode'],'$');const to=enumValue(v.to,MERGE_STATES,'$.to');if(v.expectedEtag!==current.etag)fail('stale_write','$.expectedEtag');if(!TRANSITIONS[current.state].includes(to))fail('invalid_transition','$.to');const at=timestamp(v.at,'$.at');const reasonCode=identifier(v.reasonCode,'$.reasonCode');const nextCore={schemaVersion:MERGE_STATE_SCHEMA,mergeId:current.mergeId,state:to,version:current.version+1,updatedAt:at};const next=frozenClone({...nextCore,etag:sha256(nextCore)});const eventCore={schemaVersion:MERGE_EVENT_SCHEMA,mergeId:current.mergeId,from:current.state,to,version:next.version,reasonCode,at};const eventDigest=sha256(eventCore);const event=frozenClone({...eventCore,eventId:`merge-event-${eventDigest.slice(7,31)}`,eventDigest});return frozenClone({state:next,event});}
export function validateMergeState(input){const v=exactKeys(input,['schemaVersion','mergeId','state','version','updatedAt','etag'],'$');if(v.schemaVersion!==MERGE_STATE_SCHEMA)fail('invalid_schema','$.schemaVersion');identifier(v.mergeId,'$.mergeId');enumValue(v.state,MERGE_STATES,'$.state');integer(v.version,'$.version',0,1000);timestamp(v.updatedAt,'$.updatedAt');digest(v.etag,'$.etag');const core={schemaVersion:v.schemaVersion,mergeId:v.mergeId,state:v.state,version:v.version,updatedAt:v.updatedAt};if(v.etag!==sha256(core))fail('etag_mismatch','$.etag');return frozenClone(v);}
export function validateMergeEvent(input){const v=exactKeys(input,['schemaVersion','eventId','eventDigest','mergeId','from','to','version','reasonCode','at'],'$');if(v.schemaVersion!==MERGE_EVENT_SCHEMA)fail('invalid_schema','$.schemaVersion');const core={schemaVersion:v.schemaVersion,mergeId:identifier(v.mergeId,'$.mergeId'),from:enumValue(v.from,MERGE_STATES,'$.from'),to:enumValue(v.to,MERGE_STATES,'$.to'),version:integer(v.version,'$.version',1,1000),reasonCode:identifier(v.reasonCode,'$.reasonCode'),at:timestamp(v.at,'$.at')};const expected=sha256(core);if(v.eventDigest!==expected)fail('digest_mismatch','$.eventDigest');if(v.eventId!==`merge-event-${expected.slice(7,31)}`)fail('identity_mismatch','$.eventId');return frozenClone({...core,eventId:v.eventId,eventDigest:v.eventDigest});}
