import {validateServiceRequest,exactKeys,denseArray,identifier,digest,integer,sha256,frozenClone,canonicalClone,fail} from '../../audit-phase78-service/src/index.mjs';
import {enforcePublicationQuota} from './quota.mjs';

function requestUsesV2(request){return request.schemaVersion==='audit-phase9-service-request-v2';}
function resourceScope(request){
 const segments=[`tenants/${request.tenantId}`,`workspaces/${request.workspaceId}`];
 if(request.campaignId!==null)segments.push(`campaigns/${request.campaignId}`);
 if(request.forkId!==null){
  if(!requestUsesV2(request)||request.attemptId===null)fail('missing_identity','$.request.attemptId');
  segments.push(`forks/${request.forkId}`,`attempts/${request.attemptId}`);
 }
 if(request.mergeId!==null)segments.push(`merges/${request.mergeId}`);
 return segments.join('/');
}
function keyFor(request,kind,id){
 if(!requestUsesV2(request))return `tenants/${request.tenantId}/workspaces/${request.workspaceId}/${kind}/${id}-v1.json`;
 return `${resourceScope(request)}/${kind}/${id}-v2.json`;
}
function scopeBody(request){
 return {
  tenantId:request.tenantId,workspaceId:request.workspaceId,campaignId:request.campaignId,
  forkId:request.forkId,attemptId:requestUsesV2(request)?request.attemptId:null,mergeId:request.mergeId,
  scopeDigest:sha256({tenantId:request.tenantId,workspaceId:request.workspaceId,campaignId:request.campaignId,
   forkId:request.forkId,attemptId:requestUsesV2(request)?request.attemptId:null,mergeId:request.mergeId})
 };
}
function finalize(kind,body,v2){
 const core={schemaVersion:`audit-phase9-${kind}-publication-plan-${v2?'v2':'v1'}`,...body};
 const planDigest=sha256(core);
 return frozenClone({...core,planId:`${kind}-plan-${planDigest.slice(7,31)}`,planDigest});
}
export function planImmutablePublication({request:requestInput,records}){
 const request=validateServiceRequest(requestInput),v2=requestUsesV2(request);
 const items=denseArray(records,'$.records',64).map((entry,i)=>{
  const v=exactKeys(entry,['kind','id','digest','bytes','retentionDays'],`$.records[${i}]`);
  return{kind:identifier(v.kind,`$.records[${i}].kind`),id:identifier(v.id,`$.records[${i}].id`),
   digest:digest(v.digest,`$.records[${i}].digest`),bytes:integer(v.bytes,`$.records[${i}].bytes`,1),
   retentionDays:integer(v.retentionDays,`$.records[${i}].retentionDays`,1,90)};
 }).sort((a,b)=>`${a.kind}\0${a.id}`.localeCompare(`${b.kind}\0${b.id}`));
 if(items.length<1)fail('missing_record','$.records');
 if(new Set(items.map(x=>`${x.kind}:${x.id}`)).size!==items.length)fail('duplicate_identity','$.records');
 const bytes=items.reduce((sum,x)=>sum+x.bytes,0),retentionDays=Math.max(...items.map(x=>x.retentionDays));
 enforcePublicationQuota({records:items.length,bytes,retentionDays,checkpoints:items.filter(x=>x.kind==='checkpoint').length,exports:items.filter(x=>x.kind==='export').length,pageSize:1});
 const preconditions=items.map(item=>({class:'class-b',method:'head',key:keyFor(request,item.kind,item.id),contentDigest:item.digest,mustBeAbsentOrExact:true}));
 const operations=items.map(item=>({class:'class-a',method:'put',key:keyFor(request,item.kind,item.id),digest:item.digest,contentDigest:item.digest,bytes:item.bytes,retentionDays:item.retentionDays,immutable:true,ifNoneMatch:'*'}));
 return finalize('immutable',{
  requestId:request.requestId,requestDigest:request.requestDigest,...(v2?scopeBody(request):{tenantId:request.tenantId,workspaceId:request.workspaceId}),
  preconditions,operations,summary:{classA:items.length,classB:items.length,free:0,bytes,records:items.length},
  usesPrefixListing:false,retrySafe:true,pointerLast:true
 },v2);
}
export function planMutablePointerPublication({request:requestInput,current,pointer}){
 const request=validateServiceRequest(requestInput),v2=requestUsesV2(request),
  c=exactKeys(current,['version','etag'],'$.current'),p=exactKeys(pointer,['kind','id','digest','bytes'],'$.pointer');
 const version=integer(c.version,'$.current.version',0),etag=digest(c.etag,'$.current.etag');
 if(request.expectedVersion===null||request.expectedVersion!==version||request.expectedEtag!==etag)fail('stale_state','$.current');
 const nextVersion=version+1,kind=identifier(p.kind,'$.pointer.kind'),id=identifier(p.id,'$.pointer.id'),
  pointerDigest=digest(p.digest,'$.pointer.digest'),bytes=integer(p.bytes,'$.pointer.bytes',1,20_000_000);
 const operationCore={class:'class-a',method:'put',key:keyFor(request,kind,id),contentDigest:pointerDigest,bytes,immutable:false,ifMatch:etag,nextVersion,phase:'pointer-last'};
 const operation={...operationCore,digest:sha256(operationCore)};
 return finalize('mutable-pointer',{
  requestId:request.requestId,requestDigest:request.requestDigest,...(v2?scopeBody(request):{tenantId:request.tenantId,workspaceId:request.workspaceId}),
  currentVersion:version,nextVersion,operations:[operation],summary:{classA:1,classB:0,free:0,bytes,records:1},
  usesPrefixListing:false,retrySafe:true,pointerLast:true
 },v2);
}
export function validatePublicationPlan(input){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('invalid_plan','$');
 const copy=canonicalClone(input),digestValue=copy.planDigest,id=copy.planId;
 delete copy.planDigest;delete copy.planId;
 const expected=sha256(copy);
 const match=/audit-phase9-(immutable|mutable-pointer)-publication-plan-v[12]/.exec(copy.schemaVersion);
 if(!match)fail('invalid_schema','$.schemaVersion');
 const prefix=match[1];
 if(digestValue!==expected)fail('digest_mismatch','$.planDigest');
 if(id!==`${prefix}-plan-${expected.slice(7,31)}`)fail('identity_mismatch','$.planId');
 return frozenClone(input);
}
