import {
  exactKeys, validateDirectRequest, validateDirectState, identifier, boundedString,
  timestamp, commitSha, enumValue, frozenClone, fail, plainObject
} from '../../audit-github-direct-protocol/src/index.mjs';

export const SERVICE_COMMANDS=Object.freeze(['submit','status','cancel','report','capabilities','verify-fixture']);

const COMMON=['kind','request','at'];
const EXTRA=Object.freeze({
  submit:['resultId','reportId','commentBody'],
  status:[],
  cancel:['reasonCode'],
  report:['resultId','reportId','commentBody'],
  capabilities:[],
  'verify-fixture':['sourceCommitSha']
});

export function createServiceCommand(input){
  const descriptors=plainObject(input,'$');
  if(!descriptors.kind)fail('missing_field','$.kind');
  const kind=enumValue(descriptors.kind.value,SERVICE_COMMANDS,'$.kind');
  const v=exactKeys(input,[...COMMON,...EXTRA[kind]],'$');
  const request=validateDirectRequest(v.request);
  const at=timestamp(v.at,'$.at');
  const command={schemaVersion:'github-direct-service-command-v1',modeId:'github-direct-audit-v1',kind,request,at};
  if(kind==='submit'||kind==='report'){
    command.resultId=identifier(v.resultId,'$.resultId');
    command.reportId=identifier(v.reportId,'$.reportId');
    command.commentBody=boundedString(v.commentBody,'$.commentBody',16_000);
  }else if(kind==='cancel')command.reasonCode=identifier(v.reasonCode,'$.reasonCode');
  else if(kind==='verify-fixture')command.sourceCommitSha=commitSha(v.sourceCommitSha,'$.sourceCommitSha');
  return frozenClone(command);
}

export function validateServiceCommand(value){
  const descriptors=plainObject(value,'$');
  if(!descriptors.kind)fail('missing_field','$.kind');
  const kind=enumValue(descriptors.kind.value,SERVICE_COMMANDS,'$.kind');
  const v=exactKeys(value,['schemaVersion','modeId',...COMMON,...EXTRA[kind]],'$');
  if(v.schemaVersion!=='github-direct-service-command-v1')fail('invalid_schema','$.schemaVersion');
  if(v.modeId!=='github-direct-audit-v1')fail('invalid_mode','$.modeId');
  return createServiceCommand(Object.fromEntries([...COMMON,...EXTRA[kind]].map(key=>[key,v[key]])));
}

export function createServiceResult(input){
  const v=exactKeys(input,['command','state','data','completedAt'],'$');
  const command=validateServiceCommand(v.command);
  const state=enumValue(v.state,['accepted','completed','cancelled','execution_plane_unavailable','failed'],'$.state');
  const completedAt=timestamp(v.completedAt,'$.completedAt');
  return frozenClone({
    schemaVersion:'github-direct-service-result-v1',modeId:'github-direct-audit-v1',
    commandKind:command.kind,jobId:command.request.jobId,targetCommitSha:command.request.targetCommitSha,
    state,data:v.data,completedAt,cloudflareFallback:false
  });
}

export function createServiceError(input){
  const v=exactKeys(input,['code','retryable','at'],'$');
  const code=enumValue(v.code,['invalid_command','authorization_denied','transport_failure','stale_state','publication_conflict','execution_plane_unavailable','internal_error'],'$.code');
  if(typeof v.retryable!=='boolean')fail('invalid_boolean','$.retryable');
  const at=timestamp(v.at,'$.at');
  return frozenClone({schemaVersion:'github-direct-service-error-v1',modeId:'github-direct-audit-v1',code,retryable:v.retryable,message:'GitHub Direct service operation failed',at});
}
