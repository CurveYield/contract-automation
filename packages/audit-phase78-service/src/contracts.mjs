import {SERVICE_OPERATIONS,SERVICE_STATUSES,ALL_SCOPES} from './constants.mjs';
import {exactKeys,plainObject,identifier,nullable,integer,digest,timestamp,stringArray,digestArray,canonicalClone,sha256,frozenClone,enumValue,boolean,boundedString,safeMessage,fail} from './boundary.mjs';

export const SERVICE_REQUEST_SCHEMA_V1='audit-phase9-service-request-v1';
export const SERVICE_REQUEST_SCHEMA_V2='audit-phase9-service-request-v2';
export const SERVICE_RESPONSE_SCHEMA_V1='audit-phase9-service-response-v1';
export const SERVICE_RESPONSE_SCHEMA_V2='audit-phase9-service-response-v2';
export const SERVICE_ERROR_SCHEMA_V1='audit-phase9-service-error-v1';
export const SERVICE_ERROR_SCHEMA_V2='audit-phase9-service-error-v2';

const REQUEST_INPUT_V1=['operation','tenantId','workspaceId','campaignId','forkId','mergeId','requesterId','scopes','idempotencyKey','expectedVersion','expectedEtag','requestedAt','payload'];
const REQUEST_INPUT_V2=['operation','tenantId','workspaceId','campaignId','forkId','attemptId','mergeId','requesterId','scopes','idempotencyKey','expectedVersion','expectedEtag','requestedAt','payload'];

function emptyPayload(value){exactKeys(value,[],'$.payload');return {};}
function validatePayload(operation,value){
 if(operation==='fork.create'){const v=exactKeys(value,['adapterKind','chainId','blockNumber','blockHash'],'$.payload');return{adapterKind:enumValue(v.adapterKind,['external','mock'],'$.payload.adapterKind'),chainId:integer(v.chainId,'$.payload.chainId',1,4_294_967_295),blockNumber:integer(v.blockNumber,'$.payload.blockNumber',0),blockHash:nullable(v.blockHash,(x,p)=>{if(typeof x!=='string'||!/^0x[0-9a-f]{64}$/.test(x))fail('invalid_block_hash',p);return x;},'$.payload.blockHash')};}
 if(operation==='fork.action'){const v=exactKeys(value,['actionId','actionType','payloadDigest'],'$.payload');return{actionId:identifier(v.actionId,'$.payload.actionId'),actionType:identifier(v.actionType,'$.payload.actionType'),payloadDigest:digest(v.payloadDigest,'$.payload.payloadDigest')};}
 if(operation==='fork.checkpoint'){const v=exactKeys(value,['checkpointId','manifestDigest'],'$.payload');return{checkpointId:identifier(v.checkpointId,'$.payload.checkpointId'),manifestDigest:digest(v.manifestDigest,'$.payload.manifestDigest')};}
 if(operation==='fork.export'){const v=exactKeys(value,['checkpointId','exportId'],'$.payload');return{checkpointId:identifier(v.checkpointId,'$.payload.checkpointId'),exportId:identifier(v.exportId,'$.payload.exportId')};}
 if(operation==='fork.restore'){const v=exactKeys(value,['checkpointId','restoreId','manifestDigest'],'$.payload');return{checkpointId:identifier(v.checkpointId,'$.payload.checkpointId'),restoreId:identifier(v.restoreId,'$.payload.restoreId'),manifestDigest:digest(v.manifestDigest,'$.payload.manifestDigest')};}
 if(operation==='fork.delete'){const v=exactKeys(value,['reason'],'$.payload');return{reason:identifier(v.reason,'$.payload.reason')};}
 if(operation==='campaign.create'){const v=exactKeys(value,['sourceDigest','policyId'],'$.payload');return{sourceDigest:digest(v.sourceDigest,'$.payload.sourceDigest'),policyId:identifier(v.policyId,'$.payload.policyId')};}
 if(operation==='share.create'){const v=exactKeys(value,['grantId','artifactId','artifactDigest'],'$.payload');return{grantId:identifier(v.grantId,'$.payload.grantId'),artifactId:identifier(v.artifactId,'$.payload.artifactId'),artifactDigest:digest(v.artifactDigest,'$.payload.artifactDigest')};}
 if(operation==='share.revoke'){const v=exactKeys(value,['grantId','reason'],'$.payload');return{grantId:identifier(v.grantId,'$.payload.grantId'),reason:identifier(v.reason,'$.payload.reason')};}
 if(operation==='merge.create'){const v=exactKeys(value,['terminalManifestDigests','policyId'],'$.payload'),terminalManifestDigests=digestArray(v.terminalManifestDigests,'$.payload.terminalManifestDigests',64);if(terminalManifestDigests.length<2)fail('insufficient_inputs','$.payload.terminalManifestDigests');return{terminalManifestDigests,policyId:identifier(v.policyId,'$.payload.policyId')};}
 if(operation==='provenance.read'){const v=exactKeys(value,['nodeId'],'$.payload');return{nodeId:identifier(v.nodeId,'$.payload.nodeId')};}
 if(operation==='report.read'){const v=exactKeys(value,['reportId'],'$.payload');return{reportId:identifier(v.reportId,'$.payload.reportId')};}
 if(operation==='report.publish'){const v=exactKeys(value,['reportId','reportDigest'],'$.payload');return{reportId:identifier(v.reportId,'$.payload.reportId'),reportDigest:digest(v.reportDigest,'$.payload.reportDigest')};}
 return emptyPayload(value);
}

function hasAttemptField(input,path='$'){
 const desc=plainObject(input,path);
 return Object.hasOwn(desc,'attemptId');
}

function requestBody(input){
 const v2=hasAttemptField(input);
 const v=exactKeys(input,v2?REQUEST_INPUT_V2:REQUEST_INPUT_V1,'$');
 const operation=enumValue(v.operation,SERVICE_OPERATIONS,'$.operation');
 const attemptId=v2?nullable(v.attemptId,identifier,'$.attemptId'):null;
 const body={
  schemaVersion:v2?SERVICE_REQUEST_SCHEMA_V2:SERVICE_REQUEST_SCHEMA_V1,
  operation,
  tenantId:identifier(v.tenantId,'$.tenantId'),
  workspaceId:identifier(v.workspaceId,'$.workspaceId'),
  campaignId:nullable(v.campaignId,identifier,'$.campaignId'),
  forkId:nullable(v.forkId,identifier,'$.forkId'),
  ...(v2?{attemptId}:{}),
  mergeId:nullable(v.mergeId,identifier,'$.mergeId'),
  requesterId:identifier(v.requesterId,'$.requesterId'),
  scopes:stringArray(v.scopes,'$.scopes',{allowed:ALL_SCOPES,maximum:ALL_SCOPES.length}),
  idempotencyKey:identifier(v.idempotencyKey,'$.idempotencyKey'),
  expectedVersion:nullable(v.expectedVersion,(x,p)=>integer(x,p,0),'$.expectedVersion'),
  expectedEtag:nullable(v.expectedEtag,digest,'$.expectedEtag'),
  requestedAt:timestamp(v.requestedAt,'$.requestedAt'),
  payload:validatePayload(operation,v.payload)
 };
 if((body.expectedVersion===null)!==(body.expectedEtag===null))fail('cas_contradiction','$.expectedVersion');
 if(operation.startsWith('fork.')){
  if(body.forkId===null)fail('missing_identity','$.forkId');
  if(v2&&body.attemptId===null)fail('missing_identity','$.attemptId');
 }else if(v2&&body.attemptId!==null)fail('identity_contradiction','$.attemptId');
 if(operation.startsWith('merge.')&&body.mergeId===null&&operation!=='merge.create')fail('missing_identity','$.mergeId');
 if(!operation.startsWith('fork.')&&body.campaignId===null&&operation!=='report.read')fail('missing_identity','$.campaignId');
 return body;
}

export function createServiceRequest(input){
 const body=requestBody(input),requestDigest=sha256(body);
 return frozenClone({...body,requestId:`svc-req-${requestDigest.slice(7,31)}`,requestDigest});
}

export function validateServiceRequest(input){
 const desc=plainObject(input,'$'),schema=desc.schemaVersion?.value;
 const v2=schema===SERVICE_REQUEST_SCHEMA_V2;
 if(!v2&&schema!==SERVICE_REQUEST_SCHEMA_V1)fail('invalid_schema','$.schemaVersion');
 const keys=v2?
  ['schemaVersion','operation','tenantId','workspaceId','campaignId','forkId','attemptId','mergeId','requesterId','scopes','idempotencyKey','expectedVersion','expectedEtag','requestedAt','payload','requestId','requestDigest']:
  ['schemaVersion','operation','tenantId','workspaceId','campaignId','forkId','mergeId','requesterId','scopes','idempotencyKey','expectedVersion','expectedEtag','requestedAt','payload','requestId','requestDigest'];
 const v=exactKeys(input,keys,'$');
 const rebuilt=createServiceRequest({
  operation:v.operation,tenantId:v.tenantId,workspaceId:v.workspaceId,campaignId:v.campaignId,
  forkId:v.forkId,...(v2?{attemptId:v.attemptId}:{}),mergeId:v.mergeId,requesterId:v.requesterId,
  scopes:v.scopes,idempotencyKey:v.idempotencyKey,expectedVersion:v.expectedVersion,expectedEtag:v.expectedEtag,
  requestedAt:v.requestedAt,payload:v.payload
 });
 if(v.requestDigest!==rebuilt.requestDigest)fail('digest_mismatch','$.requestDigest');
 if(v.requestId!==rebuilt.requestId)fail('identity_mismatch','$.requestId');
 return rebuilt;
}

function responseIdentity(request){
 return {
  tenantId:request.tenantId,workspaceId:request.workspaceId,campaignId:request.campaignId,
  forkId:request.forkId,...(request.schemaVersion===SERVICE_REQUEST_SCHEMA_V2?{attemptId:request.attemptId}:{}),
  mergeId:request.mergeId
 };
}

export function createServiceResponse({request:requestInput,status,resourceId,version,etag,body,completedAt}){
 const request=validateServiceRequest(requestInput),v2=request.schemaVersion===SERVICE_REQUEST_SCHEMA_V2;
 const core={
  schemaVersion:v2?SERVICE_RESPONSE_SCHEMA_V2:SERVICE_RESPONSE_SCHEMA_V1,
  requestId:request.requestId,operation:request.operation,
  ...(v2?responseIdentity(request):{}),
  status:enumValue(status,SERVICE_STATUSES,'$.status'),
  resourceId:nullable(resourceId,identifier,'$.resourceId'),
  version:nullable(version,(x,p)=>integer(x,p,0),'$.version'),
  etag:nullable(etag,digest,'$.etag'),body:canonicalClone(body),completedAt:timestamp(completedAt,'$.completedAt')
 };
 const responseDigest=sha256(core);
 return frozenClone({...core,responseDigest});
}

export function validateServiceResponse(input){
 const desc=plainObject(input,'$'),schema=desc.schemaVersion?.value,v2=schema===SERVICE_RESPONSE_SCHEMA_V2;
 if(!v2&&schema!==SERVICE_RESPONSE_SCHEMA_V1)fail('invalid_schema','$.schemaVersion');
 const keys=v2?
  ['schemaVersion','requestId','operation','tenantId','workspaceId','campaignId','forkId','attemptId','mergeId','status','resourceId','version','etag','body','completedAt','responseDigest']:
  ['schemaVersion','requestId','operation','status','resourceId','version','etag','body','completedAt','responseDigest'];
 const v=exactKeys(input,keys,'$');
 const core={
  schemaVersion:v.schemaVersion,requestId:identifier(v.requestId,'$.requestId'),
  operation:enumValue(v.operation,SERVICE_OPERATIONS,'$.operation'),
  ...(v2?{
   tenantId:identifier(v.tenantId,'$.tenantId'),workspaceId:identifier(v.workspaceId,'$.workspaceId'),
   campaignId:nullable(v.campaignId,identifier,'$.campaignId'),forkId:nullable(v.forkId,identifier,'$.forkId'),
   attemptId:nullable(v.attemptId,identifier,'$.attemptId'),mergeId:nullable(v.mergeId,identifier,'$.mergeId')
  }:{}),
  status:enumValue(v.status,SERVICE_STATUSES,'$.status'),resourceId:nullable(v.resourceId,identifier,'$.resourceId'),
  version:nullable(v.version,(x,p)=>integer(x,p,0),'$.version'),etag:nullable(v.etag,digest,'$.etag'),
  body:canonicalClone(v.body),completedAt:timestamp(v.completedAt,'$.completedAt')
 };
 if(v.responseDigest!==sha256(core))fail('digest_mismatch','$.responseDigest');
 return frozenClone({...core,responseDigest:digest(v.responseDigest,'$.responseDigest')});
}

function assertResponseIdentity(response,request,kind){
 if(response.requestId!==request.requestId||response.operation!==request.operation)fail(`${kind}_identity_mismatch`,'$');
 const requestV2=request.schemaVersion===SERVICE_REQUEST_SCHEMA_V2;
 const expectedSchema=kind==='response'?(requestV2?SERVICE_RESPONSE_SCHEMA_V2:SERVICE_RESPONSE_SCHEMA_V1):(requestV2?SERVICE_ERROR_SCHEMA_V2:SERVICE_ERROR_SCHEMA_V1);
 if(response.schemaVersion!==expectedSchema)fail(`${kind}_identity_mismatch`,'$.schemaVersion');
 if(!requestV2)return;
 for(const field of ['tenantId','workspaceId','campaignId','forkId','attemptId','mergeId']){
  if(response[field]!==request[field])fail(`${kind}_identity_mismatch`, `$.${field}`);
 }
}

export function validateServiceResponseForRequest(responseInput,requestInput){
 const request=validateServiceRequest(requestInput),response=validateServiceResponse(responseInput);
 assertResponseIdentity(response,request,'response');
 return response;
}

export function createServiceError({request:requestInput,code,message,retryable,path,at}){
 const request=validateServiceRequest(requestInput),v2=request.schemaVersion===SERVICE_REQUEST_SCHEMA_V2;
 const core={
  schemaVersion:v2?SERVICE_ERROR_SCHEMA_V2:SERVICE_ERROR_SCHEMA_V1,requestId:request.requestId,
  operation:request.operation,...(v2?responseIdentity(request):{}),code:identifier(code,'$.code'),
  message:safeMessage(message,'$.message'),retryable:boolean(retryable,'$.retryable'),
  path:boundedString(path,'$.path',160),at:timestamp(at,'$.at')
 };
 return frozenClone({...core,errorDigest:sha256(core)});
}

export function validateServiceError(input){
 const desc=plainObject(input,'$'),schema=desc.schemaVersion?.value,v2=schema===SERVICE_ERROR_SCHEMA_V2;
 if(!v2&&schema!==SERVICE_ERROR_SCHEMA_V1)fail('invalid_schema','$.schemaVersion');
 const keys=v2?
  ['schemaVersion','requestId','operation','tenantId','workspaceId','campaignId','forkId','attemptId','mergeId','code','message','retryable','path','at','errorDigest']:
  ['schemaVersion','requestId','operation','code','message','retryable','path','at','errorDigest'];
 const v=exactKeys(input,keys,'$');
 const core={
  schemaVersion:v.schemaVersion,requestId:identifier(v.requestId,'$.requestId'),
  operation:enumValue(v.operation,SERVICE_OPERATIONS,'$.operation'),
  ...(v2?{
   tenantId:identifier(v.tenantId,'$.tenantId'),workspaceId:identifier(v.workspaceId,'$.workspaceId'),
   campaignId:nullable(v.campaignId,identifier,'$.campaignId'),forkId:nullable(v.forkId,identifier,'$.forkId'),
   attemptId:nullable(v.attemptId,identifier,'$.attemptId'),mergeId:nullable(v.mergeId,identifier,'$.mergeId')
  }:{}),
  code:identifier(v.code,'$.code'),message:safeMessage(v.message,'$.message'),
  retryable:boolean(v.retryable,'$.retryable'),path:boundedString(v.path,'$.path',160),
  at:timestamp(v.at,'$.at')
 };
 if(v.errorDigest!==sha256(core))fail('digest_mismatch','$.errorDigest');
 return frozenClone({...core,errorDigest:digest(v.errorDigest,'$.errorDigest')});
}

export function validateServiceErrorForRequest(errorInput,requestInput){
 const request=validateServiceRequest(requestInput),error=validateServiceError(errorInput);
 assertResponseIdentity(error,request,'error');
 return error;
}
