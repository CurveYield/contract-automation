import {validateServiceRequest} from './contracts.mjs';
import {TERMINAL_STATES} from './constants.mjs';
import {exactKeys,canonicalClone,digest,integer,identifier,digestArray,sha256,frozenClone,fail} from './boundary.mjs';

const CORE_TRACE_SOURCE='worker0-round3-core-trace-v1';
const PLANS=Object.freeze({
 'fork.checkpoint':Object.freeze({
  lifecycle:['ready','checkpointing','ready'],
  failureBoundaries:['enter-transient','checkpoint-object','checkpoint-manifest','checkpoint-index','return-ready'],
  operationSummary:{classA:9,classB:10,free:0,variant:'checkpoint',measurementSource:CORE_TRACE_SOURCE},
  versionDelta:2
 }),
 'fork.export':Object.freeze({
  lifecycle:['ready','exporting','ready'],
  failureBoundaries:['enter-transient','export-manifest','export-index','return-ready'],
  operationSummary:{classA:8,classB:12,free:0,variant:'export',measurementSource:CORE_TRACE_SOURCE},
  versionDelta:2
 }),
 'fork.restore':Object.freeze({
  lifecycle:['ready','restoring','ready'],
  failureBoundaries:['enter-transient','restore-manifest','return-ready'],
  operationSummary:{classA:7,classB:11,free:0,variant:'restore',measurementSource:CORE_TRACE_SOURCE},
  versionDelta:2
 }),
 'fork.delete':Object.freeze({
  lifecycle:['ready-or-transient','deleting','deleted'],
  failureBoundaries:['enter-deleting','delete-stored-records','tombstone','deleted-cas'],
  operationSummary:{classA:7,classB:9,free:0,freeMaximum:16,variant:'delete-bounded',measurementSource:CORE_TRACE_SOURCE},
  versionDelta:2
 }),
 'fork.create':Object.freeze({
  lifecycle:['none','requested','ready-or-awaiting-executor'],
  failureBoundaries:['request','requested-state','admission-transition','tenant-index'],
  operationSummary:{classA:6,classB:4,free:0,variant:'create',measurementSource:'service-contract-v2'},
  versionDelta:2
 }),
 'fork.action':Object.freeze({
  lifecycle:['ready','ready'],
  failureBoundaries:['current-read','immutable-result'],
  operationSummary:{classA:1,classB:1,free:0,variant:'inert-action-result',measurementSource:'service-contract-v2'},
  versionDelta:0
 })
});
const READ_SUMMARY=Object.freeze({classA:0,classB:1,free:0,variant:'scoped-read',measurementSource:'service-contract-v2'});
const DEFAULT_WRITE_SUMMARY=Object.freeze({classA:3,classB:2,free:0,variant:'immutable-and-pointer',measurementSource:'service-contract-v2'});

function readOnly(operation){return operation.endsWith('.read')||operation==='provenance.read';}
function expectedStart(definition,current){
 const first=definition?.lifecycle?.[0];
 if(!first||first==='none'||first==='ready-or-transient')return;
 if(!current||current.state!==first)fail('invalid_lifecycle_state','$.current.state');
}
function operationSteps(definition,operation){
 if(readOnly(operation))return [{kind:'scoped-read',class:'class-b',target:'visible-resource'}];
 if(!definition)return [
  {kind:'read',class:'class-b',target:'current'},
  {kind:'immutable-write',class:'class-a',target:'request-event'},
  {kind:'immutable-write',class:'class-a',target:'result-record'},
  {kind:'cas-write',class:'class-a',target:'current-pointer'}
 ];
 return definition.failureBoundaries.map((target,index)=>({
  kind:index===0?'lifecycle-cas':target.includes('index')||target.includes('cas')||target.includes('ready')?'cas-write':
    target.includes('delete')?'delete':target.includes('object')||target.includes('manifest')||target.includes('tombstone')?'immutable-write':'boundary',
  class:index===0||target.includes('index')||target.includes('cas')||target.includes('ready')||target.includes('object')||target.includes('manifest')||target.includes('tombstone')?'class-a':'free',
  target
 }));
}

export function planPhase78Operation({request:requestInput,authorization,current}){
 const request=validateServiceRequest(requestInput);
 if(!authorization?.allowed)fail('unauthorized','$');
 if(request.expectedVersion!==null){
  if(!current||current.version!==request.expectedVersion||current.etag!==request.expectedEtag)fail('stale_state','$.current');
 }
 if(current&&TERMINAL_STATES.includes(current.state)&&!readOnly(request.operation))fail('terminal_state','$.current.state');
 if(current&&request.forkId!==null){
  if(current.forkId!==undefined&&current.forkId!==request.forkId)fail('resource_identity_mismatch','$.current.forkId');
  if(current.tenantId!==undefined&&current.tenantId!==request.tenantId)fail('resource_identity_mismatch','$.current.tenantId');
  if(Object.hasOwn(request,'attemptId')&&request.attemptId!==null&&current.attemptId!==undefined&&current.attemptId!==request.attemptId)fail('resource_identity_mismatch','$.current.attemptId');
 }
 const definition=PLANS[request.operation]??null;
 expectedStart(definition,current);
 const external=request.operation==='fork.create'&&request.payload.adapterKind==='external';
 const resultStatus=external?'awaiting_executor':readOnly(request.operation)?'succeeded':'accepted';
 const versionDelta=readOnly(request.operation)?0:(definition?.versionDelta??1);
 const nextVersion=current?.version===undefined||current?.version===null?(readOnly(request.operation)?null:versionDelta):(current.version+versionDelta);
 const operationSummary=readOnly(request.operation)?READ_SUMMARY:(definition?.operationSummary??DEFAULT_WRITE_SUMMARY);
 const core={
  schemaVersion:'audit-phase9-orchestration-plan-v2',
  requestId:request.requestId,requestDigest:request.requestDigest,operation:request.operation,
  tenantId:request.tenantId,workspaceId:request.workspaceId,campaignId:request.campaignId,
  forkId:request.forkId,attemptId:Object.hasOwn(request,'attemptId')?request.attemptId:null,mergeId:request.mergeId,
  currentVersion:current?.version??null,nextVersion,resultStatus,executionEnabled:false,terminalProtection:true,
  idempotencyKey:request.idempotencyKey,
  lifecycle:definition?.lifecycle??[],
  failureBoundaries:definition?.failureBoundaries??[],
  steps:operationSteps(definition,request.operation),
  operationSummary,
  usesPrefixListing:false
 };
 return frozenClone({...core,planDigest:sha256(core)});
}

export function createRetryPlan(input){
 const v=exactKeys(input,['request','current','completedWrites','failedStep'],'$'),request=v.request;
 if(!request||typeof request!=='object')fail('invalid_request','$.request');
 let expected;
 try{expected=validateServiceRequest(request);}catch(error){if(error.code==='digest_mismatch')fail('request_digest_mismatch','$.request.requestDigest');throw error;}
 if(expected.requestDigest!==request.requestDigest)fail('request_digest_mismatch','$.request.requestDigest');
 const current=canonicalClone(v.current),completedWrites=digestArray(v.completedWrites,'$.completedWrites',64),failedStep=identifier(v.failedStep,'$.failedStep');
 if(expected.expectedVersion!==null&&(current.version!==expected.expectedVersion||current.etag!==expected.expectedEtag))fail('stale_state','$.current');
 if(Object.hasOwn(expected,'attemptId')&&expected.attemptId!==null&&current.attemptId!==undefined&&current.attemptId!==expected.attemptId)fail('resource_identity_mismatch','$.current.attemptId');
 const definition=PLANS[expected.operation]??null;
 if(definition&&!definition.failureBoundaries.includes(failedStep))fail('invalid_failure_boundary','$.failedStep');
 const core={
  schemaVersion:'audit-phase9-retry-plan-v2',requestId:expected.requestId,requestDigest:expected.requestDigest,
  tenantId:expected.tenantId,workspaceId:expected.workspaceId,campaignId:expected.campaignId,
  forkId:expected.forkId,attemptId:Object.hasOwn(expected,'attemptId')?expected.attemptId:null,mergeId:expected.mergeId,
  currentVersion:integer(current.version,'$.current.version',0),currentEtag:digest(current.etag,'$.current.etag'),
  currentState:identifier(current.state,'$.current.state'),completedWrites,failedStep,maxAttempts:4,retrySafe:true,
  retryOrder:['immutable-missing','index-cas','current-pointer-last'],executionEnabled:false
 };
 return frozenClone({...core,retryPlanId:`retry-${sha256(core).slice(7,31)}`,retryDigest:sha256(core)});
}
