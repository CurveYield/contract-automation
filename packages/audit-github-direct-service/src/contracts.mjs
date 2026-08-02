import {
  exactKeys, validateDirectRequest, identifier, boundedString, timestamp, commitSha,
  enumValue, frozenClone, fail, plainObject, canonicalClone, booleanValue
} from '../../audit-github-direct-protocol/src/index.mjs';

export const SERVICE_COMMANDS=Object.freeze(['submit','status','cancel','report','capabilities','verify-fixture']);
const SERVICE_STATES=Object.freeze(['accepted','completed','cancelled','execution_plane_unavailable','failed']);
const ERROR_CODES=Object.freeze(['invalid_command','authorization_denied','transport_failure','stale_state','publication_conflict','execution_plane_unavailable','internal_error']);
const COMMON=['kind','request','at'];
const EXTRA=Object.freeze({submit:['resultId','reportId','commentBody'],status:[],cancel:['reasonCode'],report:['resultId','reportId','commentBody'],capabilities:[],'verify-fixture':['sourceCommitSha']});
const RESULT_KEYS=Object.freeze({
  submit:new Set(['requestPlan','admission','outcome','currentState','transitions','bundle','publications','artifacts']),
  status:new Set(['currentState','currentBlobSha','ok']),
  cancel:new Set(['transition','currentState','bundle','publications']),
  report:new Set(['currentState','outcome','bundle','publications','artifacts']),
  capabilities:new Set(['schemaVersion','modeId','capabilityId','repositoryId','installationId','repositoryFullName','targetCommitSha','permissions','permissionId','permissionDigest']),
  'verify-fixture':new Set(['sourceCommitSha','fixtureId','modeledResultDigest','executionPerformed'])
});
const STATE_BY_COMMAND=Object.freeze({
  submit:new Set(['accepted','completed','execution_plane_unavailable']),
  status:new Set(['completed']),
  cancel:new Set(['cancelled']),
  report:new Set(['completed','cancelled','execution_plane_unavailable']),
  capabilities:new Set(['completed']),
  'verify-fixture':new Set(['completed','execution_plane_unavailable'])
});
const CREDENTIAL_KEY=/(?:token|secret|authorization|credential|password|mnemonic|private.?key)/i;
function rejectCredentialFields(value,path='$.data'){
  if(value===null||typeof value!=='object')return;
  if(Array.isArray(value)){value.forEach((item,index)=>rejectCredentialFields(item,`${path}[${index}]`));return;}
  for(const [key,item] of Object.entries(value)){if(CREDENTIAL_KEY.test(key))fail('credential_field',`${path}.${key}`);rejectCredentialFields(item,`${path}.${key}`);}
}
function validateResultData(kind,state,value){
  if(!STATE_BY_COMMAND[kind].has(state))fail('service_state_mismatch','$.state');
  const data=canonicalClone(value),desc=plainObject(data,'$.data'),keys=Object.keys(desc),allowed=RESULT_KEYS[kind];
  rejectCredentialFields(data);
  for(const key of keys)if(!allowed.has(key))fail('unknown_field',`$.data.${key}`);
  if(kind==='status'){
    const legacy=keys.length===1&&keys[0]==='ok';
    const snapshot=keys.length===2&&keys.includes('currentState')&&keys.includes('currentBlobSha');
    if(!legacy&&!snapshot)fail('service_data_shape','$.data');
    if(legacy)booleanValue(data.ok,'$.data.ok');
  }
  if(kind==='verify-fixture'){
    const wanted=['executionPerformed','fixtureId','modeledResultDigest','sourceCommitSha'].sort();
    if(JSON.stringify([...keys].sort())!==JSON.stringify(wanted))fail('service_data_shape','$.data');
    commitSha(data.sourceCommitSha,'$.data.sourceCommitSha');
    if(data.executionPerformed!==false)fail('execution_boundary_violation','$.data.executionPerformed');
  }
  return frozenClone(data);
}
export function createServiceCommand(input){const descriptors=plainObject(input,'$');if(!descriptors.kind)fail('missing_field','$.kind');const kind=enumValue(descriptors.kind.value,SERVICE_COMMANDS,'$.kind'),v=exactKeys(input,[...COMMON,...EXTRA[kind]],'$'),request=validateDirectRequest(v.request),at=timestamp(v.at,'$.at'),command={schemaVersion:'github-direct-service-command-v1',modeId:'github-direct-audit-v1',kind,request,at};if(kind==='submit'||kind==='report'){command.resultId=identifier(v.resultId,'$.resultId');command.reportId=identifier(v.reportId,'$.reportId');command.commentBody=boundedString(v.commentBody,'$.commentBody',16_000);}else if(kind==='cancel')command.reasonCode=identifier(v.reasonCode,'$.reasonCode');else if(kind==='verify-fixture')command.sourceCommitSha=commitSha(v.sourceCommitSha,'$.sourceCommitSha');return frozenClone(command);}
export function validateServiceCommand(value){const descriptors=plainObject(value,'$');if(!descriptors.kind)fail('missing_field','$.kind');const kind=enumValue(descriptors.kind.value,SERVICE_COMMANDS,'$.kind'),v=exactKeys(value,['schemaVersion','modeId',...COMMON,...EXTRA[kind]],'$');if(v.schemaVersion!=='github-direct-service-command-v1')fail('invalid_schema','$.schemaVersion');if(v.modeId!=='github-direct-audit-v1')fail('invalid_mode','$.modeId');return createServiceCommand(Object.fromEntries([...COMMON,...EXTRA[kind]].map(key=>[key,v[key]])));}
export function createServiceResult(input){const v=exactKeys(input,['command','state','data','completedAt'],'$'),command=validateServiceCommand(v.command),state=enumValue(v.state,SERVICE_STATES,'$.state'),data=validateResultData(command.kind,state,v.data),completedAt=timestamp(v.completedAt,'$.completedAt');return frozenClone({schemaVersion:'github-direct-service-result-v1',modeId:'github-direct-audit-v1',commandKind:command.kind,jobId:command.request.jobId,targetCommitSha:command.request.targetCommitSha,state,data,completedAt,cloudflareFallback:false});}
export function validateServiceResult(input){const v=exactKeys(input,['schemaVersion','modeId','commandKind','jobId','targetCommitSha','state','data','completedAt','cloudflareFallback'],'$');if(v.schemaVersion!=='github-direct-service-result-v1')fail('invalid_schema','$.schemaVersion');if(v.modeId!=='github-direct-audit-v1')fail('invalid_mode','$.modeId');const commandKind=enumValue(v.commandKind,SERVICE_COMMANDS,'$.commandKind'),state=enumValue(v.state,SERVICE_STATES,'$.state'),jobId=identifier(v.jobId,'$.jobId'),targetCommitSha=commitSha(v.targetCommitSha,'$.targetCommitSha'),data=validateResultData(commandKind,state,v.data),completedAt=timestamp(v.completedAt,'$.completedAt');if(v.cloudflareFallback!==false)fail('fallback_boundary_violation','$.cloudflareFallback');return frozenClone({schemaVersion:v.schemaVersion,modeId:v.modeId,commandKind,jobId,targetCommitSha,state,data,completedAt,cloudflareFallback:false});}
export function createServiceError(input){const v=exactKeys(input,['code','retryable','at'],'$'),code=enumValue(v.code,ERROR_CODES,'$.code');if(typeof v.retryable!=='boolean')fail('invalid_boolean','$.retryable');const at=timestamp(v.at,'$.at');return frozenClone({schemaVersion:'github-direct-service-error-v1',modeId:'github-direct-audit-v1',code,retryable:v.retryable,message:'GitHub Direct service operation failed',at});}
export function validateServiceError(input){const v=exactKeys(input,['schemaVersion','modeId','code','retryable','message','at'],'$');if(v.schemaVersion!=='github-direct-service-error-v1')fail('invalid_schema','$.schemaVersion');if(v.modeId!=='github-direct-audit-v1')fail('invalid_mode','$.modeId');const code=enumValue(v.code,ERROR_CODES,'$.code'),retryable=booleanValue(v.retryable,'$.retryable'),at=timestamp(v.at,'$.at');if(v.message!=='GitHub Direct service operation failed')fail('service_error_message','$.message');return frozenClone({schemaVersion:v.schemaVersion,modeId:v.modeId,code,retryable,message:v.message,at});}
