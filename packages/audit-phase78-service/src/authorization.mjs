import {validateServiceRequest} from './contracts.mjs';
import {OPERATION_SCOPE} from './constants.mjs';
import {frozenClone,plainObject,fail} from './boundary.mjs';

const READABLE={owner:['active','terminal','archived'],reviewer:['active','terminal','archived'],operator:['active','terminal'],reader:['active','terminal','archived']};

function descriptorValues(value,path){
 const desc=plainObject(value,path);
 return Object.fromEntries(Object.entries(desc).map(([key,item])=>[key,item.value]));
}
function decision(allowed,reason,request){
 return frozenClone({
  schemaVersion:'audit-phase9-authorization-decision-v2',allowed,reason,
  operation:request.operation,tenantId:request.tenantId,workspaceId:request.workspaceId,
  campaignId:request.campaignId,forkId:request.forkId,
  attemptId:Object.hasOwn(request,'attemptId')?request.attemptId:null,
  requesterId:request.requesterId
 });
}
function hidden(request){return decision(false,'resource_hidden',request);}

export function authorizePhase78Operation(requestInput,{forkState=null,accessContext=null,allowCreate=false}={}){
 const request=validateServiceRequest(requestInput),scope=OPERATION_SCOPE[request.operation];
 if(!scope)fail('unsupported_operation','$.operation');
 if(!request.scopes.includes(scope))return decision(false,'scope_missing',request);
 if(request.operation.startsWith('fork.')){
  if(request.operation==='fork.create'&&allowCreate&&forkState===null)return decision(true,'allowed',request);
  if(!forkState)return hidden(request);
  let state;
  try{state=descriptorValues(forkState,'$.forkState');}catch{return hidden(request);}
  if(state.tenantId!==request.tenantId||state.forkId!==request.forkId)return hidden(request);
  if(Object.hasOwn(request,'attemptId')&&request.attemptId!==null&&state.attemptId!==request.attemptId)return hidden(request);
  return decision(true,'allowed',request);
 }
 if(!accessContext)return hidden(request);
 let access;
 try{access=descriptorValues(accessContext,'$.accessContext');}catch{return hidden(request);}
 if(access.tenantId!==request.tenantId||access.workspaceId!==request.workspaceId)return hidden(request);
 if(request.campaignId!==null&&access.campaignId!==request.campaignId)return hidden(request);
 if(request.mergeId!==null&&access.mergeId!==undefined&&access.mergeId!==request.mergeId)return hidden(request);
 if(access.requesterId&&access.requesterId!==request.requesterId)return decision(false,'access_denied',request);
 if(!Array.isArray(access.scopes)||!access.scopes.includes(scope))return decision(false,'scope_missing',request);
 const read=request.operation.endsWith('.read')||request.operation==='provenance.read';
 if(read){
  if(!READABLE[access.campaignRole]?.includes(access.campaignState))return decision(false,'access_denied',request);
 }else if(access.campaignState!=='active'||!['owner','operator'].includes(access.campaignRole)){
  return decision(false,'access_denied',request);
 }
 return decision(true,'allowed',request);
}
