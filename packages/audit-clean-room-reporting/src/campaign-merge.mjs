import {validateTerminalCampaignManifest} from '../../audit-clean-room-campaigns/src/index.mjs';
import {validateMergeManifest} from '../../audit-controlled-merge/src/index.mjs';
import {timestamp,sha256,frozenClone} from '../../audit-phase78-service/src/index.mjs';

function finalize(kind,body){
 const core={schemaVersion:`audit-phase9-${kind}-report-v2`,...body};
 const reportDigest=sha256(core);
 return frozenClone({...core,reportId:`${kind}-report-${reportDigest.slice(7,31)}`,reportDigest});
}
export function createCampaignReportProjection({manifest,reportedAt}){
 const normalized=validateTerminalCampaignManifest(manifest);
 const complete=normalized.terminalState==='completed'&&!normalized.partialEvidence&&!normalized.truncated&&['success','findings'].includes(normalized.completionKind);
 return finalize('campaign',{
  manifestId:normalized.manifestId,manifestDigest:normalized.manifestDigest,
  tenantId:normalized.tenantId,workspaceId:normalized.workspaceId,campaignId:normalized.campaignId,
  terminalState:normalized.terminalState,completionKind:normalized.completionKind,
  partialEvidence:normalized.partialEvidence,truncated:normalized.truncated,
  mergeEligible:normalized.mergeEligible,complete,inventorySummary:normalized.inventorySummary,
  completedAt:normalized.completedAt,reportedAt:timestamp(reportedAt,'$.reportedAt')
 });
}
export function createMergeReportProjection({manifest,reportedAt}){
 const normalized=validateMergeManifest(manifest);
 return finalize('merge',{
  manifestId:normalized.manifestId,manifestDigest:normalized.manifestDigest,
  mergeId:normalized.mergeId,requestDigest:normalized.requestDigest,finalState:normalized.finalState,
  terminalManifestDigests:normalized.terminalManifestDigests,
  sourceCampaignCount:normalized.terminalManifestDigests.length,
  duplicateMapDigest:normalized.duplicateMapDigest,conflictMapDigest:normalized.conflictMapDigest,
  provenanceIndexDigest:normalized.provenanceIndexDigest,mergedReportRefs:normalized.mergedReportRefs,
  policyId:normalized.policyId,operationSummary:normalized.operationSummary,
  publishedAt:normalized.publishedAt,reportedAt:timestamp(reportedAt,'$.reportedAt')
 });
}
