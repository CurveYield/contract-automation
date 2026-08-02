import {
  exactKeys, validateDirectRequest, frozenClone, fail
} from '../../audit-github-direct-protocol/src/index.mjs';
import {
  planRequestPublication, transitionLedgerState, planImmutableCreate, createJobIndex
} from '../../audit-github-direct-ledger/src/index.mjs';
import {
  createInjectedGitHubAdapter, createPermissionManifest
} from '../../audit-github-direct-adapter/src/index.mjs';
import {
  admitDirectJob, orchestrateDirectJob, validateRunnerAdmission, validateRunnerOutcome
} from '../../audit-github-direct-runner/src/index.mjs';
import {
  createReportingBundle, createSubmissionReportingBundle, createTerminalReportingBundle,
  createCancellationReportingBundle, ingestArtifactMetadata
} from '../../audit-github-direct-reporting/src/index.mjs';
import { validateServiceCommand, createServiceResult, createServiceError } from './contracts.mjs';

const CAPS=Object.freeze({
  submit:['read-source','write-control-ledger','publish-check','publish-comment','publish-status','read-artifact-metadata'],
  status:['read-source'],
  cancel:['read-source','write-control-ledger','publish-comment','publish-status'],
  report:['read-source','write-control-ledger','publish-comment','publish-status','read-artifact-metadata'],
  capabilities:['read-source'],
  'verify-fixture':['read-source']
});

const identity=(request)=>({repositoryId:request.repositoryId,installationId:request.installationId,repositoryFullName:request.repositoryFullName,targetCommitSha:request.targetCommitSha});
const admissionPath=(request)=>`.audit-direct/v1/manifests/${request.jobId}-admission.json`;
const outcomePath=(request)=>`.audit-direct/v1/manifests/${request.jobId}.json`;

async function applyAll(adapter,request,operations){
  const results=[];
  for(const mutation of operations)results.push(await adapter.applyLedgerMutation({...identity(request),mutation}));
  return results;
}

async function publishAll(adapter,request,plans){
  const results=[];
  for(const plan of plans){
    const result=await adapter.publish({...identity(request),plan});
    results.push(frozenClone({...result,kind:plan.kind}));
  }
  return results;
}

async function applyTransition(adapter,request,snapshot,to,reasonCode,at){
  const transition=transitionLedgerState({
    request,
    currentState:snapshot.currentState,
    currentBlobSha:snapshot.currentBlobSha,
    indexBlobSha:snapshot.indexBlobSha,
    to,
    reasonCode,
    at,
    currentIndex:snapshot.currentIndex
  });
  const results=await applyAll(adapter,request,transition.operations);
  return {
    currentState:transition.nextState,
    currentBlobSha:results[1].nextBlobSha,
    currentIndex:transition.operations[2].content,
    indexBlobSha:results[2].nextBlobSha,
    transition
  };
}

async function advanceAlong(adapter,request,snapshot,states,at){
  const start=states.indexOf(snapshot.currentState.state);
  if(start<0)fail('invalid_transition','$.currentState.state');
  const transitions=[];
  let current=snapshot;
  for(let index=start+1;index<states.length;index++){
    current=await applyTransition(adapter,request,current,states[index],`service-${states[index]}`,at);
    transitions.push(current.transition);
  }
  return {...current,transitions};
}

async function initializeLedger(adapter,request,snapshot,at){
  let currentIndex=snapshot.currentIndex;
  let indexBlobSha=snapshot.indexBlobSha;
  const bootstrapOperations=[];
  if(indexBlobSha===null){
    if(snapshot.currentState!==null)fail('stale_blob_sha','$.indexBlobSha');
    currentIndex=createJobIndex({entries:[],updatedAt:at});
    const bootstrap=planImmutableCreate({path:'.audit-direct/v1/indexes/jobs-v1.json',content:currentIndex});
    const applied=await adapter.applyLedgerMutation({...identity(request),mutation:bootstrap});
    indexBlobSha=applied.nextBlobSha;
    bootstrapOperations.push(bootstrap);
  }
  if(snapshot.currentState!==null){
    return {
      currentIndex,indexBlobSha,
      currentState:snapshot.currentState,currentBlobSha:snapshot.currentBlobSha,
      requestPlan:null,bootstrapOperations
    };
  }
  const requestPlan=planRequestPublication({request,currentIndex,indexBlobSha,at});
  const results=await applyAll(adapter,request,requestPlan.operations);
  return {
    currentState:requestPlan.operations[1].content,
    currentBlobSha:results[1].nextBlobSha,
    currentIndex:requestPlan.operations[2].content,
    indexBlobSha:results[2].nextBlobSha,
    requestPlan,bootstrapOperations
  };
}

async function ensureAdmission(adapter,request,capabilityManifest,snapshot,at){
  if(snapshot.admission!==null){
    const admission=validateRunnerAdmission(snapshot.admission);
    if(admission.jobId!==request.jobId||admission.targetCommitSha!==request.targetCommitSha)fail('identity_mismatch','$.admission');
    return admission;
  }
  const admission=admitDirectJob({request,capabilityManifest,sourceCommitSha:request.targetCommitSha,admittedAt:at});
  await applyAll(adapter,request,[planImmutableCreate({path:admissionPath(request),content:admission})]);
  return admission;
}

async function ensureOutcome(adapter,request,admission,existing,at){
  if(existing!==null){
    const outcome=validateRunnerOutcome(existing);
    if(outcome.jobId!==request.jobId||outcome.targetCommitSha!==request.targetCommitSha)fail('identity_mismatch','$.outcome');
    return outcome;
  }
  const outcome=orchestrateDirectJob({request,admission,producedAt:at});
  await applyAll(adapter,request,[planImmutableCreate({path:outcomePath(request),content:outcome})]);
  return outcome;
}

function serviceFailure(error,at){
  const code=error?.code==='publication_conflict'?'publication_conflict':
    ['stale_blob_sha','transport_conflict','terminal_state','invalid_transition','immutable_conflict','identity_mismatch'].includes(error?.code)?'stale_state':'transport_failure';
  return createServiceError({code,retryable:code==='transport_failure',at});
}

export function createDirectService(input){
  const v=exactKeys(input,['authorizationBroker','snapshotReader'],'$');
  if(!v.authorizationBroker||typeof v.authorizationBroker.authorize!=='function')fail('invalid_authorization_broker','$.authorizationBroker');
  if(typeof v.snapshotReader!=='function')fail('invalid_snapshot_reader','$.snapshotReader');
  return Object.freeze({
    async execute(commandInput){
      let command;
      try{command=validateServiceCommand(commandInput);}catch{return createServiceError({code:'invalid_command',retryable:false,at:new Date(0).toISOString()});}
      const request=validateDirectRequest(command.request);
      let session;
      try{session=await v.authorizationBroker.authorize(request,CAPS[command.kind]);}
      catch{return createServiceError({code:'authorization_denied',retryable:false,at:command.at});}
      const adapter=createInjectedGitHubAdapter({capabilityManifest:session.capabilityManifest,transport:session.transport});
      try{
        if(command.kind==='capabilities')return createServiceResult({command,state:'completed',data:createPermissionManifest({capabilityManifest:session.capabilityManifest}),completedAt:command.at});
        if(command.kind==='status'){
          const snapshot=await v.snapshotReader({kind:'current',request,adapter});
          return createServiceResult({command,state:'completed',data:frozenClone(snapshot),completedAt:command.at});
        }
        if(command.kind==='verify-fixture'){
          const admission=admitDirectJob({request,capabilityManifest:session.capabilityManifest,sourceCommitSha:command.sourceCommitSha,admittedAt:command.at});
          const outcome=orchestrateDirectJob({request,admission,producedAt:command.at});
          return createServiceResult({command,state:outcome.terminalState==='completed'?'completed':'execution_plane_unavailable',data:{admission,outcome},completedAt:command.at});
        }
        if(command.kind==='cancel'){
          const snapshot=await v.snapshotReader({kind:'cancel',request,adapter});
          if(snapshot.currentState===null)fail('stale_blob_sha','$.currentState');
          if(snapshot.currentState.state==='cancelled'){
            if(snapshot.outcome===null)fail('stale_blob_sha','$.outcome');
            const bundle=snapshot.outcome;
            const publications=await publishAll(adapter,request,bundle.publications);
            return createServiceResult({command,state:'cancelled',data:{currentState:snapshot.currentState,bundle,publications},completedAt:command.at});
          }
          const bundle=snapshot.outcome===null
            ?createCancellationReportingBundle({request,stateVersion:snapshot.currentState.version+1,publishedAt:command.at})
            :snapshot.outcome.schemaVersion==='github-direct-cancellation-reporting-v1'
              ?snapshot.outcome
              :(()=>{fail('immutable_conflict','$.outcome')})();
          await applyAll(adapter,request,[planImmutableCreate({path:outcomePath(request),content:bundle}),...bundle.ledgerPlans]);
          const advanced=await applyTransition(adapter,request,snapshot,'cancelled',command.reasonCode,bundle.publishedAt);
          const publications=await publishAll(adapter,request,bundle.publications);
          return createServiceResult({command,state:'cancelled',data:{transition:advanced.transition,currentState:advanced.currentState,bundle,publications},completedAt:command.at});
        }
        if(command.kind==='report'){
          const snapshot=await v.snapshotReader({kind:'report',request,adapter});
          if(snapshot.currentState===null||snapshot.admission===null)fail('stale_blob_sha','$.currentState');
          if(snapshot.currentState.state==='cancelled'){
            if(snapshot.outcome===null||snapshot.outcome.schemaVersion!=='github-direct-cancellation-reporting-v1')fail('stale_blob_sha','$.outcome');
            const publications=await publishAll(adapter,request,snapshot.outcome.publications);
            return createServiceResult({command,state:'cancelled',data:{currentState:snapshot.currentState,bundle:snapshot.outcome,publications},completedAt:command.at});
          }
          if(!['awaiting_executor','execution_plane_unavailable','completed'].includes(snapshot.currentState.state))fail('invalid_transition','$.currentState.state');
          const admission=validateRunnerAdmission(snapshot.admission);
          const outcome=await ensureOutcome(adapter,request,admission,snapshot.outcome,command.at);
          const stableAt=outcome.producedAt;
          const bundle=createTerminalReportingBundle({request,outcome,resultId:command.resultId,reportId:command.reportId,commentBody:command.commentBody,publishedAt:stableAt});
          await applyAll(adapter,request,bundle.ledgerPlans);
          let current={currentState:snapshot.currentState,currentBlobSha:snapshot.currentBlobSha,currentIndex:snapshot.currentIndex,indexBlobSha:snapshot.indexBlobSha};
          if(current.currentState.state==='awaiting_executor')current=await applyTransition(adapter,request,current,'execution_plane_unavailable','execution-plane-unavailable',stableAt);
          else if(!['execution_plane_unavailable','completed'].includes(current.currentState.state))fail('invalid_transition','$.currentState.state');
          const publications=await publishAll(adapter,request,bundle.publications);
          const rawArtifacts=await adapter.getArtifactMetadata(identity(request));
          const artifacts=ingestArtifactMetadata({request,items:rawArtifacts});
          return createServiceResult({command,state:outcome.terminalState==='completed'?'completed':'execution_plane_unavailable',data:{currentState:current.currentState,outcome,bundle,publications,artifacts},completedAt:command.at});
        }

        const snapshot=await v.snapshotReader({kind:'submit',request,adapter});
        let ledger=await initializeLedger(adapter,request,snapshot,command.at);
        const admission=await ensureAdmission(adapter,request,session.capabilityManifest,snapshot,command.at);
        if(admission.fixtureId===null){
          if(['cancelled','failed','policy_rejected'].includes(ledger.currentState.state))fail('terminal_state','$.currentState.state');
          if(ledger.currentState.state==='execution_plane_unavailable'){
            const checkBundle=createSubmissionReportingBundle({request,publishedAt:admission.admittedAt});
            const publications=await publishAll(adapter,request,checkBundle.publications);
            return createServiceResult({command,state:'execution_plane_unavailable',data:{requestPlan:ledger.requestPlan,admission,currentState:ledger.currentState,bundle:checkBundle,publications},completedAt:command.at});
          }
          ledger=await advanceAlong(adapter,request,ledger,['requested','validating','admitted','awaiting_executor'],admission.admittedAt);
          const bundle=createSubmissionReportingBundle({request,publishedAt:admission.admittedAt});
          const publications=await publishAll(adapter,request,bundle.publications);
          return createServiceResult({command,state:'accepted',data:{requestPlan:ledger.requestPlan,admission,currentState:ledger.currentState,transitions:ledger.transitions,bundle,publications},completedAt:command.at});
        }

        if(!['publishing','completed'].includes(ledger.currentState.state)){
          ledger=await advanceAlong(adapter,request,ledger,['requested','validating','admitted','fixture_running'],admission.admittedAt);
        }
        const outcome=await ensureOutcome(adapter,request,admission,snapshot.outcome,admission.admittedAt);
        const bundle=createReportingBundle({request,outcome,resultId:command.resultId,reportId:command.reportId,commentBody:command.commentBody,publishedAt:outcome.producedAt});
        await applyAll(adapter,request,bundle.ledgerPlans);
        if(ledger.currentState.state==='fixture_running')ledger=await applyTransition(adapter,request,ledger,'publishing','service-publishing',outcome.producedAt);
        const publications=await publishAll(adapter,request,bundle.publications);
        if(ledger.currentState.state==='publishing')ledger=await applyTransition(adapter,request,ledger,'completed','service-completed',outcome.producedAt);
        const rawArtifacts=await adapter.getArtifactMetadata(identity(request));
        const artifacts=ingestArtifactMetadata({request,items:rawArtifacts});
        return createServiceResult({command,state:'completed',data:{requestPlan:ledger.requestPlan,admission,outcome,currentState:ledger.currentState,bundle,publications,artifacts},completedAt:command.at});
      }catch(error){
        return serviceFailure(error,command.at);
      }
    }
  });
}
