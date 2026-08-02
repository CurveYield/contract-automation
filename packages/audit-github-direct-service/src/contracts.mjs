import {
  exactKeys, validateDirectRequest, validateDirectState, identifier, boundedString,
  timestamp, commitSha, enumValue, frozenClone, fail, plainObject, canonicalClone,
  booleanValue, denseArray, nullable, digest, canonicalJson
} from '../../audit-github-direct-protocol/src/index.mjs';
import {
  blobSha, validateRequestPublicationPlan, validateLedgerTransition
} from '../../audit-github-direct-ledger/src/index.mjs';
import {
  validatePermissionManifest, validatePublicationPlan
} from '../../audit-github-direct-adapter/src/index.mjs';
import {
  validateRunnerAdmission, validateRunnerOutcome
} from '../../audit-github-direct-runner/src/index.mjs';
import {
  validateReportingBundle, validateSubmissionReportingBundle,
  validateCancellationReportingBundle, validateArtifactMetadataIndex
} from '../../audit-github-direct-reporting/src/index.mjs';

export const SERVICE_COMMANDS=Object.freeze(['submit','status','cancel','report','capabilities','verify-fixture']);
const SERVICE_STATES=Object.freeze(['accepted','completed','cancelled','execution_plane_unavailable','failed']);
const ERROR_CODES=Object.freeze(['invalid_command','authorization_denied','transport_failure','stale_state','publication_conflict','execution_plane_unavailable','internal_error']);
const COMMON=['kind','request','at'];
const EXTRA=Object.freeze({submit:['resultId','reportId','commentBody'],status:[],cancel:['reasonCode'],report:['resultId','reportId','commentBody'],capabilities:[],'verify-fixture':['sourceCommitSha']});
const STATE_BY_COMMAND=Object.freeze({
  submit:new Set(['accepted','completed','execution_plane_unavailable']),
  status:new Set(['completed']),
  cancel:new Set(['cancelled']),
  report:new Set(['completed','cancelled','execution_plane_unavailable']),
  capabilities:new Set(['completed']),
  'verify-fixture':new Set(['completed','execution_plane_unavailable'])
});
const DATA_SHAPES=Object.freeze({
  submit:Object.freeze({
    accepted:[['requestPlan','admission','currentState','transitions','bundle','publications']],
    execution_plane_unavailable:[['requestPlan','admission','currentState','bundle','publications']],
    completed:[['requestPlan','admission','outcome','currentState','bundle','publications','artifacts']]
  }),
  status:Object.freeze({completed:[['ok'],['currentState','currentBlobSha']]}),
  cancel:Object.freeze({cancelled:[['currentState','bundle','publications'],['transition','currentState','bundle','publications']]}),
  report:Object.freeze({
    cancelled:[['currentState','bundle','publications']],
    execution_plane_unavailable:[['currentState','outcome','bundle','publications','artifacts']],
    completed:[['currentState','outcome','bundle','publications','artifacts']]
  }),
  capabilities:Object.freeze({completed:[['schemaVersion','modeId','capabilityId','repositoryId','installationId','repositoryFullName','targetCommitSha','permissions','permissionId','permissionDigest']]}),
  'verify-fixture':Object.freeze({completed:[['sourceCommitSha','fixtureId','modeledResultDigest','executionPerformed']],execution_plane_unavailable:[['sourceCommitSha','fixtureId','modeledResultDigest','executionPerformed']]})
});
const CREDENTIAL_KEY=/(?:token|secret|authorization|credential|password|mnemonic|private.?key)/i;

function rejectCredentialFields(value,path='$.data'){
  if(value===null||typeof value!=='object')return;
  if(Array.isArray(value)){value.forEach((item,index)=>rejectCredentialFields(item,`${path}[${index}]`));return;}
  for(const [key,item] of Object.entries(value)){
    if(CREDENTIAL_KEY.test(key))fail('credential_field',`${path}.${key}`);
    rejectCredentialFields(item,`${path}.${key}`);
  }
}
function sameIdentity(value,context,path){
  if(value.jobId!==context.jobId||value.targetCommitSha!==context.targetCommitSha){
    fail('service_identity_mismatch',path);
  }
  return value;
}
function exactShape(keys,variants){
  const actual=[...keys].sort();
  if(!variants.some((variant)=>JSON.stringify([...variant].sort())===JSON.stringify(actual))){
    fail('service_data_shape','$.data');
  }
}
function validateCurrentState(value,context,path='$.data.currentState'){
  const state=validateDirectState(value);
  sameIdentity(state,context,path);
  return state;
}
function validateRequestPlan(value,context){
  if(value===null)return null;
  const plan=validateRequestPublicationPlan(value);
  const request=plan.operations[0].content;
  sameIdentity(request,context,'$.data.requestPlan');
  return plan;
}
function validateTransitions(value,context){
  return denseArray(value,'$.data.transitions',16).map((entry,index)=>{
    const transition=validateLedgerTransition(entry);
    sameIdentity(transition.nextState,context,`$.data.transitions[${index}]`);
    return transition;
  });
}
function validatePublicationResults(value,context,bundle){
  const results=denseArray(value,'$.data.publications',3).map((entry,index)=>{
    const path=`$.data.publications[${index}]`;
    const descriptors=plainObject(entry,path);
    if(!descriptors.action)fail('missing_field',`${path}.action`);
    const action=enumValue(descriptors.action.value,['create','noop'],`${path}.action`);
    const keys=action==='create'?['action','plan','result','kind']:['action','plan','kind'];
    const v=exactKeys(entry,keys,path);
    const plan=validatePublicationPlan(v.plan);
    sameIdentity(plan,context,`${path}.plan`);
    const kind=enumValue(v.kind,['check','status','comment'],`${path}.kind`);
    if(kind!==plan.kind)fail('service_publication_mismatch',`${path}.kind`);
    if(action==='create'){
      const result=exactKeys(v.result,['published','publicationId'],`${path}.result`);
      if(result.published!==true||identifier(result.publicationId,`${path}.result.publicationId`)!==plan.publicationId){
        fail('service_publication_mismatch',`${path}.result`);
      }
      return frozenClone({action,plan,result:{published:true,publicationId:plan.publicationId},kind});
    }
    return frozenClone({action,plan,kind});
  });
  if(bundle){
    if(results.length!==bundle.publications.length)fail('service_publication_mismatch','$.data.publications');
    for(let index=0;index<results.length;index++){
      if(canonicalJson(results[index].plan)!==canonicalJson(bundle.publications[index])){
        fail('service_publication_mismatch',`$.data.publications[${index}].plan`);
      }
    }
  }
  return results;
}
function validateBundle(value,context,expected){
  let bundle;
  if(value?.schemaVersion==='github-direct-submission-reporting-v1')bundle=validateSubmissionReportingBundle(value);
  else if(value?.schemaVersion==='github-direct-cancellation-reporting-v1')bundle=validateCancellationReportingBundle(value);
  else bundle=validateReportingBundle(value);
  sameIdentity(bundle,context,'$.data.bundle');
  if(expected==='submission'&&bundle.schemaVersion!=='github-direct-submission-reporting-v1')fail('service_bundle_mismatch','$.data.bundle');
  if(expected==='cancellation'&&bundle.schemaVersion!=='github-direct-cancellation-reporting-v1')fail('service_bundle_mismatch','$.data.bundle');
  if(expected==='terminal'&&bundle.schemaVersion!=='github-direct-terminal-reporting-v1')fail('service_bundle_mismatch','$.data.bundle');
  if(expected==='fixture'&&bundle.schemaVersion!=='github-direct-reporting-bundle-v1')fail('service_bundle_mismatch','$.data.bundle');
  return bundle;
}
function assertCurrentState(state,expected,path='$.data.currentState.state'){
  if(state.state!==expected)fail('service_state_mismatch',path);
}
function validateResultData(context,state,value){
  const {kind}=context;
  if(!STATE_BY_COMMAND[kind].has(state))fail('service_state_mismatch','$.state');
  const data=canonicalClone(value);
  rejectCredentialFields(data);
  const descriptors=plainObject(data,'$.data');
  const keys=Object.keys(descriptors);
  exactShape(keys,DATA_SHAPES[kind][state]);

  if(kind==='status'){
    if(keys.length===1){booleanValue(data.ok,'$.data.ok');return frozenClone(data);}
    const bothNull=data.currentState===null&&data.currentBlobSha===null;
    const bothPresent=data.currentState!==null&&data.currentBlobSha!==null;
    if(!bothNull&&!bothPresent)fail('service_data_shape','$.data');
    if(bothPresent){validateCurrentState(data.currentState,context);blobSha(data.currentBlobSha,'$.data.currentBlobSha');}
    return frozenClone(data);
  }
  if(kind==='capabilities'){
    const manifest=validatePermissionManifest(data);
    if(manifest.targetCommitSha!==context.targetCommitSha)fail('service_identity_mismatch','$.data.targetCommitSha');
    if(context.request&&(
      manifest.repositoryId!==context.request.repositoryId||
      manifest.installationId!==context.request.installationId||
      manifest.repositoryFullName!==context.request.repositoryFullName
    ))fail('service_identity_mismatch','$.data');
    return manifest;
  }
  if(kind==='verify-fixture'){
    const sourceCommitSha=commitSha(data.sourceCommitSha,'$.data.sourceCommitSha');
    if(sourceCommitSha!==context.targetCommitSha)fail('service_identity_mismatch','$.data.sourceCommitSha');
    nullable(data.fixtureId,identifier,'$.data.fixtureId');
    nullable(data.modeledResultDigest,digest,'$.data.modeledResultDigest');
    if(data.executionPerformed!==false)fail('execution_boundary_violation','$.data.executionPerformed');
    if(state==='completed'&&(data.fixtureId===null||data.modeledResultDigest===null))fail('service_state_mismatch','$.data.fixtureId');
    if(state==='execution_plane_unavailable'&&(data.fixtureId!==null||data.modeledResultDigest!==null))fail('service_state_mismatch','$.data.fixtureId');
    return frozenClone(data);
  }

  const currentState=validateCurrentState(data.currentState,context);
  let bundle;
  if(kind==='submit'){
    validateRequestPlan(data.requestPlan,context);
    const admission=validateRunnerAdmission(data.admission);
    sameIdentity(admission,context,'$.data.admission');
    if(state==='accepted'){
      assertCurrentState(currentState,'awaiting_executor');
      validateTransitions(data.transitions,context);
      bundle=validateBundle(data.bundle,context,'submission');
    }else if(state==='execution_plane_unavailable'){
      assertCurrentState(currentState,'execution_plane_unavailable');
      bundle=validateBundle(data.bundle,context,'submission');
    }else{
      assertCurrentState(currentState,'completed');
      const outcome=validateRunnerOutcome(data.outcome);sameIdentity(outcome,context,'$.data.outcome');
      if(outcome.terminalState!=='completed')fail('service_state_mismatch','$.data.outcome.terminalState');
      bundle=validateBundle(data.bundle,context,'fixture');
      const artifacts=validateArtifactMetadataIndex(data.artifacts);sameIdentity(artifacts,context,'$.data.artifacts');
    }
  }else if(kind==='cancel'){
    assertCurrentState(currentState,'cancelled');
    if(Object.hasOwn(data,'transition')){
      const transition=validateLedgerTransition(data.transition);
      sameIdentity(transition.nextState,context,'$.data.transition');
      if(transition.nextState.state!=='cancelled')fail('service_state_mismatch','$.data.transition');
    }
    bundle=validateBundle(data.bundle,context,'cancellation');
  }else if(kind==='report'){
    if(state==='cancelled'){
      assertCurrentState(currentState,'cancelled');
      bundle=validateBundle(data.bundle,context,'cancellation');
    }else{
      assertCurrentState(currentState,state==='completed'?'completed':'execution_plane_unavailable');
      const outcome=validateRunnerOutcome(data.outcome);sameIdentity(outcome,context,'$.data.outcome');
      if((state==='completed')!==(outcome.terminalState==='completed'))fail('service_state_mismatch','$.data.outcome.terminalState');
      bundle=validateBundle(data.bundle,context,'terminal');
      const artifacts=validateArtifactMetadataIndex(data.artifacts);sameIdentity(artifacts,context,'$.data.artifacts');
    }
  }
  validatePublicationResults(data.publications,context,bundle);
  return frozenClone(data);
}

export function createServiceCommand(input){const descriptors=plainObject(input,'$');if(!descriptors.kind)fail('missing_field','$.kind');const kind=enumValue(descriptors.kind.value,SERVICE_COMMANDS,'$.kind'),v=exactKeys(input,[...COMMON,...EXTRA[kind]],'$'),request=validateDirectRequest(v.request),at=timestamp(v.at,'$.at'),command={schemaVersion:'github-direct-service-command-v1',modeId:'github-direct-audit-v1',kind,request,at};if(kind==='submit'||kind==='report'){command.resultId=identifier(v.resultId,'$.resultId');command.reportId=identifier(v.reportId,'$.reportId');command.commentBody=boundedString(v.commentBody,'$.commentBody',16_000);}else if(kind==='cancel')command.reasonCode=identifier(v.reasonCode,'$.reasonCode');else if(kind==='verify-fixture')command.sourceCommitSha=commitSha(v.sourceCommitSha,'$.sourceCommitSha');return frozenClone(command);}
export function validateServiceCommand(value){const descriptors=plainObject(value,'$');if(!descriptors.kind)fail('missing_field','$.kind');const kind=enumValue(descriptors.kind.value,SERVICE_COMMANDS,'$.kind'),v=exactKeys(value,['schemaVersion','modeId',...COMMON,...EXTRA[kind]],'$');if(v.schemaVersion!=='github-direct-service-command-v1')fail('invalid_schema','$.schemaVersion');if(v.modeId!=='github-direct-audit-v1')fail('invalid_mode','$.modeId');return createServiceCommand(Object.fromEntries([...COMMON,...EXTRA[kind]].map(key=>[key,v[key]])));}
export function createServiceResult(input){const v=exactKeys(input,['command','state','data','completedAt'],'$'),command=validateServiceCommand(v.command),state=enumValue(v.state,SERVICE_STATES,'$.state'),context={kind:command.kind,jobId:command.request.jobId,targetCommitSha:command.request.targetCommitSha,request:command.request},data=validateResultData(context,state,v.data),completedAt=timestamp(v.completedAt,'$.completedAt');return frozenClone({schemaVersion:'github-direct-service-result-v1',modeId:'github-direct-audit-v1',commandKind:command.kind,jobId:context.jobId,targetCommitSha:context.targetCommitSha,state,data,completedAt,cloudflareFallback:false});}
export function validateServiceResult(input){const v=exactKeys(input,['schemaVersion','modeId','commandKind','jobId','targetCommitSha','state','data','completedAt','cloudflareFallback'],'$');if(v.schemaVersion!=='github-direct-service-result-v1')fail('invalid_schema','$.schemaVersion');if(v.modeId!=='github-direct-audit-v1')fail('invalid_mode','$.modeId');const commandKind=enumValue(v.commandKind,SERVICE_COMMANDS,'$.commandKind'),state=enumValue(v.state,SERVICE_STATES,'$.state'),jobId=identifier(v.jobId,'$.jobId'),targetCommitSha=commitSha(v.targetCommitSha,'$.targetCommitSha'),data=validateResultData({kind:commandKind,jobId,targetCommitSha,request:null},state,v.data),completedAt=timestamp(v.completedAt,'$.completedAt');if(v.cloudflareFallback!==false)fail('fallback_boundary_violation','$.cloudflareFallback');return frozenClone({schemaVersion:v.schemaVersion,modeId:v.modeId,commandKind,jobId,targetCommitSha,state,data,completedAt,cloudflareFallback:false});}
export function createServiceError(input){const v=exactKeys(input,['code','retryable','at'],'$'),code=enumValue(v.code,ERROR_CODES,'$.code');if(typeof v.retryable!=='boolean')fail('invalid_boolean','$.retryable');const at=timestamp(v.at,'$.at');return frozenClone({schemaVersion:'github-direct-service-error-v1',modeId:'github-direct-audit-v1',code,retryable:v.retryable,message:'GitHub Direct service operation failed',at});}
export function validateServiceError(input){const v=exactKeys(input,['schemaVersion','modeId','code','retryable','message','at'],'$');if(v.schemaVersion!=='github-direct-service-error-v1')fail('invalid_schema','$.schemaVersion');if(v.modeId!=='github-direct-audit-v1')fail('invalid_mode','$.modeId');const code=enumValue(v.code,ERROR_CODES,'$.code'),retryable=booleanValue(v.retryable,'$.retryable'),at=timestamp(v.at,'$.at');if(v.message!=='GitHub Direct service operation failed')fail('service_error_message','$.message');return frozenClone({schemaVersion:v.schemaVersion,modeId:v.modeId,code,retryable,message:v.message,at});}
