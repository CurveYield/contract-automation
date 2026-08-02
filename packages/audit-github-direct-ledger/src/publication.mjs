import { exactKeys,validateDirectRequest,validateDirectState,createDirectState,frozenClone,denseArray,fail,canonicalJson } from '../../audit-github-direct-protocol/src/index.mjs';
import { buildLedgerPaths,ledgerPathInfo } from './paths.mjs';
import { planImmutableCreate,validateLedgerMutation } from './mutations.mjs';
import { planJobIndexUpdate,validateJobIndex } from './index-state.mjs';
function mismatch(path){fail('publication_binding_mismatch',path,'Request publication operations do not describe one request');}
export function planRequestPublication(input){const v=exactKeys(input,['request','currentIndex','indexBlobSha','at'],'$'),request=validateDirectRequest(v.request),paths=buildLedgerPaths({jobId:request.jobId,eventId:'request-created',resultId:'placeholder-result',reportId:'placeholder-report'}),state=createDirectState({request,state:'requested',version:0,updatedAt:v.at}),requestPlan=planImmutableCreate({path:paths.request,content:request}),currentPlan=planImmutableCreate({path:paths.current,content:state}),indexPlan=planJobIndexUpdate({currentIndex:v.currentIndex,currentBlobSha:v.indexBlobSha,expectedBlobSha:v.indexBlobSha,entry:{jobId:request.jobId,targetCommitSha:request.targetCommitSha,state:'requested',currentPath:paths.current,currentBlobSha:currentPlan.nextContentBlobSha},updatedAt:v.at});return frozenClone({schemaVersion:'github-direct-request-publication-plan-v1',operations:[requestPlan,currentPlan,indexPlan]});}
export function validateRequestPublicationPlan(input){
  const v=exactKeys(input,['schemaVersion','operations'],'$');if(v.schemaVersion!=='github-direct-request-publication-plan-v1')fail('invalid_schema','$.schemaVersion');
  const operations=denseArray(v.operations,'$.operations',3).map((x)=>validateLedgerMutation(x));
  if(operations.length!==3||operations[0].operation!=='create-immutable'||operations[1].operation!=='create-immutable'||operations[2].operation!=='update-cas')mismatch('$.operations');
  const requestInfo=ledgerPathInfo(operations[0].path,'$.operations[0].path'),currentInfo=ledgerPathInfo(operations[1].path,'$.operations[1].path'),indexInfo=ledgerPathInfo(operations[2].path,'$.operations[2].path');
  if(requestInfo.kind!=='request'||currentInfo.kind!=='current'||indexInfo.kind!=='job-index')mismatch('$.operations');
  const request=validateDirectRequest(operations[0].content),state=validateDirectState(operations[1].content),index=validateJobIndex(operations[2].content);
  if(requestInfo.jobId!==request.jobId||currentInfo.jobId!==request.jobId)mismatch('$.operations');
  if(state.jobId!==request.jobId||state.repositoryId!==request.repositoryId||state.installationId!==request.installationId||state.repositoryFullName!==request.repositoryFullName||state.targetCommitSha!==request.targetCommitSha||state.state!=='requested'||state.version!==0)mismatch('$.operations[1].content');
  if(canonicalJson(operations[0].content)!==canonicalJson(request)||canonicalJson(operations[1].content)!==canonicalJson(state))mismatch('$.operations');
  const entry=index.entries.find((item)=>item.jobId===request.jobId);
  if(!entry||entry.targetCommitSha!==request.targetCommitSha||entry.state!=='requested'||entry.currentPath!==operations[1].path||entry.currentBlobSha!==operations[1].nextContentBlobSha||index.updatedAt!==state.updatedAt)mismatch('$.operations[2].content');
  return frozenClone({schemaVersion:v.schemaVersion,operations});
}
