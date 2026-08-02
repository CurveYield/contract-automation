import {
  exactKeys, identifier, digest, timestamp, enumValue, denseArray,
  frozenClone, sha256, fail, boundedString
} from '../../audit-clean-room-protocol/src/index.mjs';
import { MERGED_REPORT_REFERENCE_SCHEMA, SOURCE_STATES } from './contracts.mjs';

function safeLabel(value,path){
  const text=boundedString(value,path,256);
  if(/<\/?(?:script|iframe|object)|(?:https?:\/\/)|authorization|bearer|private[_ -]?key|[A-Za-z]:\\|\/(?:home|mnt|Users)\//i.test(text))fail('unsafe_report_content',path);
  return text;
}
export function createMergedReportReference(input){
  const value=exactKeys(input,['tenantId','workspaceId','mergeId','sourceCampaignId','sourceState','reportId','reportDigest','evidenceRefs','label','createdAt'],'$');
  const evidenceRefs=denseArray(value.evidenceRefs,'$.evidenceRefs',100_000).map((entry,index)=>{
    const path=`$.evidenceRefs[${index}]`,record=exactKeys(entry,['id','digest'],path);
    return{id:identifier(record.id,`${path}.id`),digest:digest(record.digest,`${path}.digest`)};
  }).sort((a,b)=>a.id.localeCompare(b.id));
  if(new Set(evidenceRefs.map((item)=>item.id)).size!==evidenceRefs.length)fail('duplicate_identity','$.evidenceRefs');
  const body={schemaVersion:MERGED_REPORT_REFERENCE_SCHEMA,tenantId:identifier(value.tenantId,'$.tenantId'),workspaceId:identifier(value.workspaceId,'$.workspaceId'),mergeId:identifier(value.mergeId,'$.mergeId'),sourceCampaignId:identifier(value.sourceCampaignId,'$.sourceCampaignId'),sourceState:enumValue(value.sourceState,SOURCE_STATES,'$.sourceState'),reportId:identifier(value.reportId,'$.reportId'),reportDigest:digest(value.reportDigest,'$.reportDigest'),evidenceRefs,label:safeLabel(value.label,'$.label'),createdAt:timestamp(value.createdAt,'$.createdAt')};
  const referenceDigest=sha256(body);
  return frozenClone({...body,referenceId:`merged-report-${referenceDigest.slice(7,31)}`,referenceDigest});
}
export function validateMergedReportReference(input){
  const value=exactKeys(input,['schemaVersion','referenceId','referenceDigest','tenantId','workspaceId','mergeId','sourceCampaignId','sourceState','reportId','reportDigest','evidenceRefs','label','createdAt'],'$');
  if(value.schemaVersion!==MERGED_REPORT_REFERENCE_SCHEMA)fail('invalid_schema','$.schemaVersion');
  const rebuilt=createMergedReportReference({tenantId:value.tenantId,workspaceId:value.workspaceId,mergeId:value.mergeId,sourceCampaignId:value.sourceCampaignId,sourceState:value.sourceState,reportId:value.reportId,reportDigest:value.reportDigest,evidenceRefs:value.evidenceRefs,label:value.label,createdAt:value.createdAt});
  if(identifier(value.referenceId,'$.referenceId')!==rebuilt.referenceId)fail('identity_mismatch','$.referenceId');
  if(digest(value.referenceDigest,'$.referenceDigest')!==rebuilt.referenceDigest)fail('digest_mismatch','$.referenceDigest');
  return rebuilt;
}
