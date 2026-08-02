import { createInjectedAuthorizationBroker } from '../../../packages/audit-github-direct-auth/src/index.mjs';
import { createDirectService } from '../../../packages/audit-github-direct-service/src/index.mjs';
import { createGitHubActionsTransport,createGitHubActionsLedgerSnapshotReader } from './github-actions-transport.mjs';

export function createWorkflowService({environment,fetchImpl}){
  const tokenProvider=()=>environment.GITHUB_TOKEN;
  const transport=createGitHubActionsTransport({tokenProvider,fetchImpl,issueNumber:Number(environment.GITHUB_DIRECT_REPORT_ISSUE)});
  const readLedger=createGitHubActionsLedgerSnapshotReader({tokenProvider,fetchImpl});
  const broker=createInjectedAuthorizationBroker({async issueTransport(request){const issuedAt=new Date().toISOString(),expiresAt=new Date(Date.now()+10*60*1000).toISOString();return {authorizationKind:'github-token',repositoryId:request.repositoryId,installationId:request.installationId,repositoryFullName:request.repositoryFullName,targetCommitSha:request.targetCommitSha,issuedAt,expiresAt,capabilities:request.capabilities,transport};}});
  const snapshotReader=async({kind,request})=>{
    const currentPath=`.audit-direct/v1/current/${request.jobId}.json`,admissionPath=`.audit-direct/v1/manifests/${request.jobId}-admission.json`,outcomePath=`.audit-direct/v1/manifests/${request.jobId}.json`;
    if(kind==='current'){const current=await readLedger(request,currentPath);return {currentState:current?.content??null,currentBlobSha:current?.blobSha??null};}
    const [current,index,admission,outcome]=await Promise.all([readLedger(request,currentPath),readLedger(request,'.audit-direct/v1/indexes/jobs-v1.json'),readLedger(request,admissionPath),readLedger(request,outcomePath)]);
    return {currentState:current?.content??null,currentBlobSha:current?.blobSha??null,currentIndex:index?.content??null,indexBlobSha:index?.blobSha??null,admission:admission?.content??null,outcome:outcome?.content??null};
  };
  return createDirectService({authorizationBroker:broker,snapshotReader});
}
