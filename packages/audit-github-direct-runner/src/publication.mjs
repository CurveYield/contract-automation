import {
  DIRECT_MODE_ID,exactKeys,validateDirectRequest,identifier,timestamp,createReportIndex,
  denseArray,sha256,frozenClone,fail,digest,validateResultManifest,validateReportIndex
} from '../../audit-github-direct-protocol/src/index.mjs';
import { buildLedgerPaths,planImmutableCreate,validateLedgerMutation } from '../../audit-github-direct-ledger/src/index.mjs';
import { planCheckPublication,planStatusPublication,validatePublicationPlan } from '../../audit-github-direct-adapter/src/index.mjs';
import { validateRunnerOutcome } from './orchestration.mjs';
export function planRunnerPublication(input){
  const v=exactKeys(input,['request','outcome','resultId','reportId','publishedAt'],'$'),request=validateDirectRequest(v.request),outcome=validateRunnerOutcome(v.outcome),resultId=identifier(v.resultId,'$.resultId'),reportId=identifier(v.reportId,'$.reportId'),publishedAt=timestamp(v.publishedAt,'$.publishedAt');
  if(outcome.jobId!==request.jobId||outcome.targetCommitSha!==request.targetCommitSha)fail('outcome_request_mismatch','$.outcome');
  const reportIndex=createReportIndex({request,entries:[{reportId,reportDigest:outcome.resultManifest.manifestDigest,kind:'machine-json'}],publishedAt});
  const paths=buildLedgerPaths({jobId:request.jobId,eventId:'publication',resultId,reportId});
  const ledgerPlans=[planImmutableCreate({path:paths.result,content:outcome.resultManifest}),planImmutableCreate({path:paths.report,content:reportIndex})];
  const fixture=outcome.fixtureId!==null;
  const adapterPlans=[
    planCheckPublication({request,name:'CurveYield Direct Audit',summary:fixture?'Modeled repository fixture result published':'Execution plane unavailable; no submitted project was executed',conclusion:fixture?'success':'neutral',at:publishedAt}),
    planStatusPublication({request,state:fixture?'success':'error',description:fixture?'Modeled fixture result available':'Execution plane unavailable',context:'curveyield/direct-audit',at:publishedAt})
  ];
  const core={schemaVersion:'github-direct-runner-publication-plan-v1',modeId:DIRECT_MODE_ID,jobId:request.jobId,targetCommitSha:request.targetCommitSha,outcomeId:outcome.outcomeId,resultManifest:outcome.resultManifest,reportIndex,ledgerPlans,adapterPlans,publishedAt};const publicationDigest=sha256(core);return frozenClone({...core,publicationId:`direct-runner-publication-${publicationDigest.slice(7,31)}`,publicationDigest});
}
export function validateRunnerPublicationPlan(input){
  const v=exactKeys(input,['schemaVersion','modeId','jobId','targetCommitSha','outcomeId','resultManifest','reportIndex','ledgerPlans','adapterPlans','publishedAt','publicationId','publicationDigest'],'$');if(v.schemaVersion!=='github-direct-runner-publication-plan-v1')fail('invalid_schema','$.schemaVersion');if(v.modeId!==DIRECT_MODE_ID)fail('invalid_mode','$.modeId');identifier(v.jobId,'$.jobId');if(typeof v.targetCommitSha!=='string'||!/^[0-9a-f]{40}$/.test(v.targetCommitSha))fail('invalid_commit_sha','$.targetCommitSha');identifier(v.outcomeId,'$.outcomeId');digest(v.publicationDigest,'$.publicationDigest');const resultManifest=validateResultManifest(v.resultManifest),reportIndex=validateReportIndex(v.reportIndex);if(resultManifest.jobId!==v.jobId||resultManifest.targetCommitSha!==v.targetCommitSha||reportIndex.jobId!==v.jobId||reportIndex.targetCommitSha!==v.targetCommitSha)fail('publication_identity_mismatch','$.resultManifest');const ledgerPlans=denseArray(v.ledgerPlans,'$.ledgerPlans',2).map((plan)=>validateLedgerMutation(plan));if(ledgerPlans.length!==2||ledgerPlans.some((plan)=>plan.operation!=='create-immutable'))fail('publication_shape','$.ledgerPlans');const adapterPlans=denseArray(v.adapterPlans,'$.adapterPlans',2).map((plan)=>validatePublicationPlan(plan));if(adapterPlans.length!==2||adapterPlans[0].kind!=='check'||adapterPlans[1].kind!=='status')fail('publication_shape','$.adapterPlans');timestamp(v.publishedAt,'$.publishedAt');const core={schemaVersion:v.schemaVersion,modeId:v.modeId,jobId:v.jobId,targetCommitSha:v.targetCommitSha,outcomeId:v.outcomeId,resultManifest,reportIndex,ledgerPlans,adapterPlans,publishedAt:v.publishedAt};const expected=sha256(core);if(v.publicationDigest!==expected)fail('digest_mismatch','$.publicationDigest');if(v.publicationId!==`direct-runner-publication-${expected.slice(7,31)}`)fail('identity_mismatch','$.publicationId');return frozenClone(v);
}
