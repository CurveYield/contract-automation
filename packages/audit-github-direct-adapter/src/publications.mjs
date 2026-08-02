import {
  DIRECT_MODE_ID,exactKeys,plainObject,validateDirectRequest,boundedString,enumValue,timestamp,sha256,
  frozenClone,canonicalJson,fail,integer,fullName,commitSha,identifier,digest
} from '../../audit-github-direct-protocol/src/index.mjs';
function base(requestInput,kind,at){const request=validateDirectRequest(requestInput);return {request,base:{schemaVersion:'github-direct-publication-plan-v1',modeId:request.modeId,kind,repositoryId:request.repositoryId,installationId:request.installationId,repositoryFullName:request.repositoryFullName,targetCommitSha:request.targetCommitSha,jobId:request.jobId,idempotencyKey:`${kind}-${request.jobId}`,at:timestamp(at,'$.at')}};}
function finish(body){const publicationDigest=sha256(body);return frozenClone({...body,publicationId:`direct-${body.kind}-${publicationDigest.slice(7,31)}`,publicationDigest});}
export function planCheckPublication(input){const v=exactKeys(input,['request','name','summary','conclusion','at'],'$'),{base:b}=base(v.request,'check',v.at);return finish({...b,name:boundedString(v.name,'$.name',100),summary:boundedString(v.summary,'$.summary',65_535,true),conclusion:enumValue(v.conclusion,['success','failure','neutral','cancelled','timed_out','action_required'],'$.conclusion')});}
export function planCommentPublication(input){const v=exactKeys(input,['request','body','at'],'$'),{base:b}=base(v.request,'comment',v.at);return finish({...b,body:boundedString(v.body,'$.body',65_535)});}
export function planStatusPublication(input){const v=exactKeys(input,['request','state','description','context','at'],'$'),{base:b}=base(v.request,'status',v.at);return finish({...b,state:enumValue(v.state,['error','failure','pending','success'],'$.state'),description:boundedString(v.description,'$.description',140),context:boundedString(v.context,'$.context',100)});}
export function validatePublicationPlan(input){
  const common=['schemaVersion','modeId','kind','repositoryId','installationId','repositoryFullName','targetCommitSha','jobId','idempotencyKey','at'];
  const desc=plainObject(input,'$');if(!desc.kind)fail('missing_field','$.kind');
  const kind=enumValue(desc.kind.value,['check','comment','status'],'$.kind');
  const extra=kind==='check'?['name','summary','conclusion']:kind==='comment'?['body']:['state','description','context'];
  const v=exactKeys(input,[...common,...extra,'publicationId','publicationDigest'],'$');
  if(v.schemaVersion!=='github-direct-publication-plan-v1')fail('invalid_schema','$.schemaVersion');
  if(v.modeId!==DIRECT_MODE_ID)fail('invalid_mode','$.modeId');
  integer(v.repositoryId,'$.repositoryId',1);integer(v.installationId,'$.installationId',1);fullName(v.repositoryFullName,'$.repositoryFullName');commitSha(v.targetCommitSha,'$.targetCommitSha');identifier(v.jobId,'$.jobId');
  const wanted=`${kind}-${v.jobId}`;if(v.idempotencyKey!==wanted)fail('idempotency_mismatch','$.idempotencyKey');timestamp(v.at,'$.at');
  if(kind==='check'){boundedString(v.name,'$.name',100);boundedString(v.summary,'$.summary',65_535,true);enumValue(v.conclusion,['success','failure','neutral','cancelled','timed_out','action_required'],'$.conclusion');}
  else if(kind==='comment')boundedString(v.body,'$.body',65_535);
  else{enumValue(v.state,['error','failure','pending','success'],'$.state');boundedString(v.description,'$.description',140);boundedString(v.context,'$.context',100);}
  digest(v.publicationDigest,'$.publicationDigest');
  const body=Object.fromEntries([...common,...extra].map((key)=>[key,v[key]]));
  const expected=sha256(body);if(v.publicationDigest!==expected)fail('digest_mismatch','$.publicationDigest');if(v.publicationId!==`direct-${kind}-${expected.slice(7,31)}`)fail('identity_mismatch','$.publicationId');return frozenClone(v);
}
export function reconcilePublication(input){const v=exactKeys(input,['plan','observed'],'$'),plan=validatePublicationPlan(v.plan);if(v.observed===null)return frozenClone({action:'create',plan});let observed;try{observed=validatePublicationPlan(v.observed);}catch{fail('publication_conflict','$.observed');}if(canonicalJson(observed)!==canonicalJson(plan))fail('publication_conflict','$.observed');return frozenClone({action:'noop',plan});}
