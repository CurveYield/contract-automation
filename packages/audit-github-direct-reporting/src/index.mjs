import {
  exactKeys, validateDirectRequest, validateResultManifest, identifier, timestamp,
  denseArray, integer, boundedString, digest, booleanValue, frozenClone, fail,
  createResultManifest, createReportIndex
} from '../../audit-github-direct-protocol/src/index.mjs';
import {
  planCheckPublication, planCommentPublication, planStatusPublication,
  createArtifactMetadata, validateArtifactMetadata
} from '../../audit-github-direct-adapter/src/index.mjs';
import { planRunnerPublication } from '../../audit-github-direct-runner/src/index.mjs';
import { planImmutableCreate } from '../../audit-github-direct-ledger/src/index.mjs';

function terminalParts(input){
  const v=exactKeys(input,['request','outcome','resultId','reportId','commentBody','publishedAt'],'$');
  const request=validateDirectRequest(v.request);
  const resultId=identifier(v.resultId,'$.resultId');
  const reportId=identifier(v.reportId,'$.reportId');
  const commentBody=boundedString(v.commentBody,'$.commentBody',16_000);
  const publishedAt=timestamp(v.publishedAt,'$.publishedAt');
  const runnerPlan=planRunnerPublication({request,outcome:v.outcome,resultId,reportId,publishedAt});
  const unavailable=runnerPlan.resultManifest.executionState==='execution_plane_unavailable';
  const statusPlan=planStatusPublication({
    request,
    state:unavailable?'error':'success',
    description:unavailable?'Execution plane unavailable':'Modeled fixture result available',
    context:'curveyield/github-direct-audit',
    at:publishedAt
  });
  const commentPlan=planCommentPublication({request,body:commentBody,at:publishedAt});
  return {request,runnerPlan,publishedAt,unavailable,statusPlan,commentPlan};
}

export function createSubmissionReportingBundle(input){
  const v=exactKeys(input,['request','publishedAt'],'$');
  const request=validateDirectRequest(v.request);
  const publishedAt=timestamp(v.publishedAt,'$.publishedAt');
  const checkPlan=planCheckPublication({
    request,
    name:'CurveYield GitHub Direct Audit',
    summary:'Awaiting executor; submitted source was not executed.',
    conclusion:'neutral',
    at:publishedAt
  });
  return frozenClone({
    schemaVersion:'github-direct-submission-reporting-v1',
    modeId:'github-direct-audit-v1',
    jobId:request.jobId,
    targetCommitSha:request.targetCommitSha,
    publications:[checkPlan],
    publishedAt
  });
}

export function createTerminalReportingBundle(input){
  const {request,runnerPlan,publishedAt,statusPlan,commentPlan}=terminalParts(input);
  return frozenClone({
    schemaVersion:'github-direct-terminal-reporting-v1',
    modeId:'github-direct-audit-v1',
    jobId:request.jobId,
    targetCommitSha:request.targetCommitSha,
    resultManifest:runnerPlan.resultManifest,
    reportIndex:runnerPlan.reportIndex,
    ledgerPlans:runnerPlan.ledgerPlans,
    publications:[statusPlan,commentPlan],
    publishedAt
  });
}

export function createReportingBundle(input){
  const {request,runnerPlan,publishedAt,unavailable,statusPlan,commentPlan}=terminalParts(input);
  const checkPlan=planCheckPublication({
    request,
    name:'CurveYield GitHub Direct Audit',
    summary:unavailable?'Execution plane unavailable; submitted source was not executed':'Trusted inert fixture result published',
    conclusion:unavailable?'neutral':'success',
    at:publishedAt
  });
  return frozenClone({
    schemaVersion:'github-direct-reporting-bundle-v1',
    modeId:'github-direct-audit-v1',
    jobId:request.jobId,
    targetCommitSha:request.targetCommitSha,
    resultManifest:runnerPlan.resultManifest,
    reportIndex:runnerPlan.reportIndex,
    ledgerPlans:runnerPlan.ledgerPlans,
    publications:[checkPlan,statusPlan,commentPlan],
    publishedAt
  });
}

export function createCancellationReportingBundle(input){
  const v=exactKeys(input,['request','stateVersion','publishedAt'],'$');
  const request=validateDirectRequest(v.request);
  const stateVersion=integer(v.stateVersion,'$.stateVersion',1,1_000_000);
  const publishedAt=timestamp(v.publishedAt,'$.publishedAt');
  const resultId=`cancel-result-v${stateVersion}`;
  const reportId=`cancel-report-v${stateVersion}`;
  const resultManifest=createResultManifest({
    request,
    outcome:'cancelled',
    executionState:'not_executed',
    resultDigest:null,
    summary:{findingCount:0,evidenceCount:0,artifactCount:0,truncated:false},
    producedAt:publishedAt
  });
  const reportIndex=createReportIndex({
    request,
    entries:[{reportId,reportDigest:resultManifest.manifestDigest,kind:'machine-json'}],
    publishedAt
  });
  const statusPlan=planStatusPublication({
    request,state:'error',description:'GitHub Direct audit cancelled',context:'curveyield/github-direct-audit',at:publishedAt
  });
  const commentPlan=planCommentPublication({request,body:'GitHub Direct audit cancelled before submitted-project execution.',at:publishedAt});
  return frozenClone({
    schemaVersion:'github-direct-cancellation-reporting-v1',
    modeId:'github-direct-audit-v1',
    jobId:request.jobId,
    targetCommitSha:request.targetCommitSha,
    resultManifest,
    reportIndex,
    ledgerPlans:[
      planImmutableCreate({path:`.audit-direct/v1/results/${request.jobId}/${resultId}.json`,content:resultManifest}),
      planImmutableCreate({path:`.audit-direct/v1/reports/${request.jobId}/${reportId}.json`,content:reportIndex})
    ],
    publications:[statusPlan,commentPlan],
    publishedAt
  });
}

export function ingestArtifactMetadata(input){
  const v=exactKeys(input,['request','items'],'$');
  const request=validateDirectRequest(v.request);
  const items=denseArray(v.items,'$.items',100).map((item,index)=>{
    try{return validateArtifactMetadata(item);}catch(error){
      if(error?.code!=='missing_field')throw error;
      const x=exactKeys(item,['artifactId','name','sizeBytes','digest','expired','createdAt','expiresAt'],`$.items[${index}]`);
      return createArtifactMetadata({
        artifactId:identifier(x.artifactId,`$.items[${index}].artifactId`),
        name:boundedString(x.name,`$.items[${index}].name`,256),
        sizeBytes:integer(x.sizeBytes,`$.items[${index}].sizeBytes`,0,2_000_000_000),
        digest:digest(x.digest,`$.items[${index}].digest`),
        expired:booleanValue(x.expired,`$.items[${index}].expired`),
        createdAt:timestamp(x.createdAt,`$.items[${index}].createdAt`),
        expiresAt:timestamp(x.expiresAt,`$.items[${index}].expiresAt`)
      });
    }
  });
  return frozenClone({
    schemaVersion:'github-direct-artifact-metadata-index-v1',
    jobId:request.jobId,
    targetCommitSha:request.targetCommitSha,
    items
  });
}

export function validateReportingBundle(value){
  const v=exactKeys(value,['schemaVersion','modeId','jobId','targetCommitSha','resultManifest','reportIndex','ledgerPlans','publications','publishedAt'],'$');
  if(!['github-direct-reporting-bundle-v1','github-direct-terminal-reporting-v1'].includes(v.schemaVersion))fail('invalid_schema','$.schemaVersion');
  if(v.modeId!=='github-direct-audit-v1')fail('invalid_mode','$.modeId');
  validateResultManifest(v.resultManifest);
  if(v.resultManifest.jobId!==v.jobId||v.resultManifest.targetCommitSha!==v.targetCommitSha)fail('reporting_identity_mismatch','$.resultManifest');
  if(!Array.isArray(v.ledgerPlans)||v.ledgerPlans.length!==2)fail('invalid_ledger_plans','$.ledgerPlans');
  const wanted=v.schemaVersion==='github-direct-reporting-bundle-v1'?3:2;
  if(!Array.isArray(v.publications)||v.publications.length!==wanted)fail('invalid_publications','$.publications');
  timestamp(v.publishedAt,'$.publishedAt');
  return frozenClone(v);
}

export function validateArtifactMetadataIndex(value){
  const v=exactKeys(value,['schemaVersion','jobId','targetCommitSha','items'],'$');
  if(v.schemaVersion!=='github-direct-artifact-metadata-index-v1')fail('invalid_schema','$.schemaVersion');
  const items=denseArray(v.items,'$.items',100).map(validateArtifactMetadata);
  return frozenClone({...v,items});
}
