import {
  exactKeys, identifier, digest, timestamp, enumValue, stringArray, integer,
  frozenClone, fail, validateCampaignAccessContext, validateShareGrant,
  validateShareGrantRevocation, safePath, sha256
} from '../../audit-clean-room-protocol/src/index.mjs';

export const ACCESS_DECISION_SCHEMA='phase8-access-decision-v1';
export const VISIBILITY_DECISION_SCHEMA='phase8-visibility-decision-v1';
export const HIDDEN_ENVELOPE_SCHEMA='phase8-hidden-resource-envelope-v1';
export const STORAGE_PLAN_SCHEMA='phase8-scoped-storage-plan-v1';

const RESOURCE_KINDS=['source_manifest','base_artifact','layer','job','attempt','log','artifact','evidence','report','fork_reference','notification','search_entry'];
const REQUIRED_SCOPES=['campaign:read','campaign:merge','campaign:share-base','campaign:write'];
const REASONS=['allowed','scope_missing','tenant_mismatch','workspace_mismatch','campaign_mismatch','grant_missing','grant_expired','grant_revoked','resource_hidden'];

function hasAll(actual,required){return required.every((scope)=>actual.includes(scope));}

export function authorizeCampaignAccess(contextInput,requestInput){
  const context=validateCampaignAccessContext(contextInput);
  const r=exactKeys(requestInput,['tenantId','workspaceId','campaignId','requiredScopes','resourceKind','at'],'$');
  const request={
    tenantId:identifier(r.tenantId,'$.tenantId'),workspaceId:identifier(r.workspaceId,'$.workspaceId'),campaignId:identifier(r.campaignId,'$.campaignId'),
    requiredScopes:stringArray(r.requiredScopes,'$.requiredScopes',{maximum:8,item:(x,p)=>enumValue(x,REQUIRED_SCOPES,p)}),
    resourceKind:enumValue(r.resourceKind,RESOURCE_KINDS,'$.resourceKind'),at:timestamp(r.at,'$.at')
  };
  let reason='allowed';
  if(context.tenantId!==request.tenantId) reason='tenant_mismatch';
  else if(context.workspaceId!==request.workspaceId) reason='workspace_mismatch';
  else if(context.campaignId!==request.campaignId) reason='campaign_mismatch';
  else if(!hasAll(context.scopes,request.requiredScopes)) reason='scope_missing';
  return frozenClone({
    schemaVersion:ACCESS_DECISION_SCHEMA,allowed:reason==='allowed',reason,
    tenantId:context.tenantId,workspaceId:context.workspaceId,campaignId:context.campaignId,
    requesterId:context.requesterId,policyId:context.policyId,resourceKind:request.resourceKind,decidedAt:request.at
  });
}

export function validateAccessDecision(input){
  const v=exactKeys(input,['schemaVersion','allowed','reason','tenantId','workspaceId','campaignId','requesterId','policyId','resourceKind','decidedAt'],'$');
  if(v.schemaVersion!==ACCESS_DECISION_SCHEMA) fail('invalid_schema','$.schemaVersion');
  if(typeof v.allowed!=='boolean') fail('invalid_boolean','$.allowed');
  enumValue(v.reason,REASONS,'$.reason');
  if(v.allowed!==(v.reason==='allowed')) fail('decision_contradiction','$.allowed');
  identifier(v.tenantId,'$.tenantId');identifier(v.workspaceId,'$.workspaceId');identifier(v.campaignId,'$.campaignId');identifier(v.requesterId,'$.requesterId');identifier(v.policyId,'$.policyId');
  enumValue(v.resourceKind,RESOURCE_KINDS,'$.resourceKind');timestamp(v.decidedAt,'$.decidedAt');
  return frozenClone(v);
}

function revoked(grant,revocations,at){
  return revocations.some((entry)=>{
    const value=validateShareGrantRevocation(entry);
    return value.grantId===grant.grantId&&value.grantDigest===grant.grantDigest&&value.revokedAt<=at;
  });
}

export function decideResourceVisibility(input){
  const v=exactKeys(input,['context','resource','grants','revocations','at'],'$');
  const context=validateCampaignAccessContext(v.context);
  const resourceRaw=exactKeys(v.resource,['kind','tenantId','workspaceId','campaignId','resourceId','resourceDigest','sourceDigest'],'$.resource');
  const resource={kind:enumValue(resourceRaw.kind,RESOURCE_KINDS,'$.resource.kind'),tenantId:identifier(resourceRaw.tenantId,'$.resource.tenantId'),workspaceId:identifier(resourceRaw.workspaceId,'$.resource.workspaceId'),campaignId:identifier(resourceRaw.campaignId,'$.resource.campaignId'),resourceId:identifier(resourceRaw.resourceId,'$.resource.resourceId'),resourceDigest:digest(resourceRaw.resourceDigest,'$.resource.resourceDigest'),sourceDigest:digest(resourceRaw.sourceDigest,'$.resource.sourceDigest')};
  const at=timestamp(v.at,'$.at');
  if(!Array.isArray(v.grants)||!Array.isArray(v.revocations)) fail('invalid_array','$.grants');
  let visible=false;let reason='resource_hidden';let grantId=null;
  if(context.tenantId===resource.tenantId&&context.workspaceId===resource.workspaceId&&context.campaignId===resource.campaignId){visible=true;reason='allowed';}
  else if(context.tenantId===resource.tenantId&&context.workspaceId===resource.workspaceId&&resource.kind==='base_artifact'){
    for(const raw of v.grants){
      const grant=validateShareGrant(raw);
      if(grant.tenantId===context.tenantId&&grant.workspaceId===context.workspaceId&&grant.targetCampaignId===context.campaignId&&grant.sourceCampaignId===resource.campaignId&&grant.artifactId===resource.resourceId&&grant.artifactDigest===resource.resourceDigest&&grant.sourceDigest===resource.sourceDigest){
        if(grant.expiresAt<=at){reason='grant_expired';continue;}
        if(revoked(grant,v.revocations,at)){reason='grant_revoked';continue;}
        visible=true;reason='allowed';grantId=grant.grantId;break;
      }
    }
    if(!visible&&reason==='resource_hidden') reason='grant_missing';
  }
  return frozenClone({schemaVersion:VISIBILITY_DECISION_SCHEMA,visible,reason,resourceKind:resource.kind,tenantId:context.tenantId,workspaceId:context.workspaceId,campaignId:context.campaignId,resourceId:visible?resource.resourceId:null,grantId,decidedAt:at});
}

export function createHiddenResourceEnvelope(){
  return frozenClone({
    schemaVersion:HIDDEN_ENVELOPE_SCHEMA,status:'not_found',code:'resource_not_found',message:'Resource not found',
    items:[],total:0,facets:{},notifications:[],signedResource:null,relationHints:[],cacheTag:'hidden-v1',
    operationBudget:{classA:0,classB:0,bytes:0},timingClass:'constant-hidden-v1'
  });
}

export function enforceHiddenResourceNonInterference(visibilityDecision){
  const d=visibilityDecision;
  if(d?.schemaVersion!==VISIBILITY_DECISION_SCHEMA||d.visible!==false) fail('visibility_required','$.visibilityDecision');
  return createHiddenResourceEnvelope();
}

function scopedPrefix(tenantId,workspaceId,campaignId){return `tenants/${tenantId}/workspaces/${workspaceId}/campaigns/${campaignId}`;}

export function planScopedStorageKeys(input){
  const v=exactKeys(input,['tenantId','workspaceId','campaignId','mergeId'],'$');
  const tenantId=identifier(v.tenantId,'$.tenantId'),workspaceId=identifier(v.workspaceId,'$.workspaceId'),campaignId=identifier(v.campaignId,'$.campaignId');
  const mergeId=v.mergeId===null?null:identifier(v.mergeId,'$.mergeId');
  const prefix=scopedPrefix(tenantId,workspaceId,campaignId);
  const keys={terminalManifest:`${prefix}/terminal-manifest-v1.json`,campaignIndex:`tenants/${tenantId}/workspaces/${workspaceId}/indexes/campaigns-v1.json`,currentCampaign:`${prefix}/current-v1.json`,grantIndex:`tenants/${tenantId}/workspaces/${workspaceId}/indexes/share-grants-v1.json`,mergeCurrent:mergeId?`tenants/${tenantId}/workspaces/${workspaceId}/merges/${mergeId}/current-v1.json`:null};
  for(const [key,value] of Object.entries(keys)) if(value!==null) safePath(value,`$.keys.${key}`);
  return frozenClone({schemaVersion:STORAGE_PLAN_SCHEMA,tenantId,workspaceId,campaignId,mergeId,keys,usesPrefixListing:false});
}

export function planConditionalIndexUpdate(input){
  const v=exactKeys(input,['indexKey','currentEtag','expectedEtag','recordId','recordDigest','estimatedBytes'],'$');
  const indexKey=safePath(v.indexKey,'$.indexKey');
  if(v.currentEtag!==v.expectedEtag) fail('stale_write','$.expectedEtag');
  const recordId=identifier(v.recordId,'$.recordId'),recordDigest=digest(v.recordDigest,'$.recordDigest');
  const estimatedBytes=integer(v.estimatedBytes,'$.estimatedBytes',1,20_000_000);
  const nextEtag=sha256({indexKey,currentEtag:v.currentEtag,recordId,recordDigest,estimatedBytes});
  return frozenClone({schemaVersion:'phase8-index-mutation-plan-v1',indexKey,precondition:{etag:v.currentEtag},record:{recordId,recordDigest},nextEtag,operations:[{class:'B',method:'GetObject',key:indexKey},{class:'A',method:'PutObject',key:indexKey,ifMatch:v.currentEtag}],summary:{classA:1,classB:1,bytes:estimatedBytes},usesPrefixListing:false,serverOwnedIndex:true});
}
