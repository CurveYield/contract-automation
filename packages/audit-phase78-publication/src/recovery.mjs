import {validateServiceRequest,exactKeys,denseArray,digestArray,identifier,enumValue,digest,sha256,frozenClone,fail} from '../../audit-phase78-service/src/index.mjs';

export function planPublicationRecovery({request:requestInput,plannedDigests,completedDigests,failedStep}){
 const request=validateServiceRequest(requestInput),planned=digestArray(plannedDigests,'$.plannedDigests',128),
  completed=digestArray(completedDigests,'$.completedDigests',128),failed=identifier(failedStep,'$.failedStep');
 for(const item of completed)if(!planned.includes(item))fail('recovery_conflict','$.completedDigests');
 const remaining=planned.filter(item=>!completed.includes(item));
 const core={
  schemaVersion:request.schemaVersion==='audit-phase9-service-request-v2'?'audit-phase9-publication-recovery-v2':'audit-phase9-publication-recovery-v1',
  requestId:request.requestId,requestDigest:request.requestDigest,
  ...(request.schemaVersion==='audit-phase9-service-request-v2'?{
   tenantId:request.tenantId,workspaceId:request.workspaceId,campaignId:request.campaignId,
   forkId:request.forkId,attemptId:request.attemptId,mergeId:request.mergeId
  }:{}),
  plannedDigests:planned,completedDigests:completed,remainingDigests:remaining,failedStep:failed,
  retryPointerLast:true,retrySafe:true,maxAttempts:4
 };
 const recoveryDigest=sha256(core);
 return frozenClone({...core,recoveryId:`publication-recovery-${recoveryDigest.slice(7,31)}`,recoveryDigest});
}

export function planScopedPublicationRecovery({request:requestInput,plannedSteps,completedSteps,failedStep}){
 const request=validateServiceRequest(requestInput);
 if(request.schemaVersion!=='audit-phase9-service-request-v2')fail('scope_required','$.request');
 const normalize=(value,path)=>denseArray(value,path,128).map((entry,index)=>{
  const p=`${path}[${index}]`,v=exactKeys(entry,['stepId','kind','phase','digest'],p);
  return{stepId:identifier(v.stepId,`${p}.stepId`),kind:enumValue(v.kind,['immutable','index','pointer'],`${p}.kind`),
   phase:enumValue(v.phase,['immutable','index-cas','pointer-last'],`${p}.phase`),digest:digest(v.digest,`${p}.digest`)};
 });
 const planned=normalize(plannedSteps,'$.plannedSteps'),completed=normalize(completedSteps,'$.completedSteps');
 if(new Set(planned.map(x=>x.stepId)).size!==planned.length)fail('duplicate_identity','$.plannedSteps');
 const byId=new Map(planned.map(x=>[x.stepId,x]));
 for(const item of completed){
  const expected=byId.get(item.stepId);
  if(!expected||JSON.stringify(expected)!==JSON.stringify(item))fail('recovery_conflict','$.completedSteps');
 }
 const completedIds=new Set(completed.map(x=>x.stepId)),remaining=planned.filter(x=>!completedIds.has(x.stepId));
 const pointer=planned.find(x=>x.kind==='pointer');
 if(pointer&&completedIds.has(pointer.stepId)&&remaining.some(x=>x.kind!=='pointer'))fail('pointer_order_conflict','$.completedSteps');
 const core={
  schemaVersion:'audit-phase9-scoped-publication-recovery-v1',requestId:request.requestId,requestDigest:request.requestDigest,
  tenantId:request.tenantId,workspaceId:request.workspaceId,campaignId:request.campaignId,forkId:request.forkId,
  attemptId:request.attemptId,mergeId:request.mergeId,plannedSteps:planned,completedSteps:completed,remainingSteps:remaining,
  failedStep:identifier(failedStep,'$.failedStep'),retryOrder:['immutable','index-cas','pointer-last'],retrySafe:true,maxAttempts:4
 };
 const recoveryDigest=sha256(core);
 return frozenClone({...core,recoveryId:`scoped-publication-recovery-${recoveryDigest.slice(7,31)}`,recoveryDigest});
}
