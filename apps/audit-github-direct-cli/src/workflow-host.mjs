import { createInjectedAuthorizationBroker } from '../../../packages/audit-github-direct-auth/src/index.mjs';
import { createDirectService } from '../../../packages/audit-github-direct-service/src/index.mjs';
import { createGitHubActionsTransport } from './github-actions-transport.mjs';

export function createWorkflowService({environment,fetchImpl}){
  const issueNumber=Number(environment.GITHUB_DIRECT_REPORT_ISSUE);
  const transport=createGitHubActionsTransport({tokenProvider:()=>environment.GITHUB_TOKEN,fetchImpl,issueNumber});
  const broker=createInjectedAuthorizationBroker({
    async issueTransport(request){
      const issuedAt=new Date().toISOString();
      const expiresAt=new Date(Date.now()+10*60*1000).toISOString();
      return {
        authorizationKind:'github-token',
        repositoryId:request.repositoryId,
        installationId:request.installationId,
        repositoryFullName:request.repositoryFullName,
        targetCommitSha:request.targetCommitSha,
        issuedAt,expiresAt,
        capabilities:request.capabilities,
        transport
      };
    }
  });
  async function read(adapter,request,path){
    return adapter.getContents({
      repositoryId:request.repositoryId,
      installationId:request.installationId,
      repositoryFullName:request.repositoryFullName,
      targetCommitSha:request.targetCommitSha,
      path
    });
  }
  const snapshotReader=async({kind,request,adapter})=>{
    const currentPath=`.audit-direct/v1/current/${request.jobId}.json`;
    const admissionPath=`.audit-direct/v1/manifests/${request.jobId}-admission.json`;
    const outcomePath=`.audit-direct/v1/manifests/${request.jobId}.json`;
    if(kind==='current'){
      const current=await read(adapter,request,currentPath);
      return {currentState:current?.content??null,currentBlobSha:current?.blobSha??null};
    }
    const [current,index,admission,outcome]=await Promise.all([
      read(adapter,request,currentPath),
      read(adapter,request,'.audit-direct/v1/indexes/jobs-v1.json'),
      read(adapter,request,admissionPath),
      read(adapter,request,outcomePath)
    ]);
    const snapshot={
      currentState:current?.content??null,
      currentBlobSha:current?.blobSha??null,
      currentIndex:index?.content??null,
      indexBlobSha:index?.blobSha??null,
      admission:admission?.content??null,
      outcome:outcome?.content??null
    };
    if(kind==='submit'||kind==='cancel'||kind==='report')return snapshot;
    return snapshot;
  };
  return createDirectService({authorizationBroker:broker,snapshotReader});
}
