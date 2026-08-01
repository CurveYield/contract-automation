import {
  exactKeys, identifier, digest, timestamp, enumValue, boolean, integer,
  stringArray, validateReferenceList, frozenClone, sha256, fail, denseArray
} from '../../audit-clean-room-protocol/src/index.mjs';

export const TERMINAL_MANIFEST_SCHEMA='phase8-terminal-campaign-manifest-v1';
const TERMINAL_STATES=['completed','failed','cancelled','policy_rejected'];
const COMPLETION_KINDS=['success','findings','failed','cancelled','partial','truncated','policy_rejected'];
const FINDING_STATUSES=['open','accepted','resolved','suppressed'];
const SEVERITIES=['critical','high','moderate','low','unknown'];

function finding(value,path){
  const v=exactKeys(value,['findingId','identityKey','severity','status','remediation','location','materialDigest','evidenceRefs'],path);
  return {
    findingId:identifier(v.findingId,`${path}.findingId`),identityKey:identifier(v.identityKey,`${path}.identityKey`),
    severity:enumValue(v.severity,SEVERITIES,`${path}.severity`),status:enumValue(v.status,FINDING_STATUSES,`${path}.status`),
    remediation:identifier(v.remediation,`${path}.remediation`),location:identifier(v.location,`${path}.location`),
    materialDigest:digest(v.materialDigest,`${path}.materialDigest`),
    evidenceRefs:validateReferenceList(v.evidenceRefs,`${path}.evidenceRefs`,256)
  };
}

function findings(value,path){
  const result=denseArray(value,path,100_000).map((entry,index)=>finding(entry,`${path}[${index}]`));
  result.sort((a,b)=>a.findingId.localeCompare(b.findingId));
  if(new Set(result.map((item)=>item.findingId)).size!==result.length) fail('duplicate_identity',path);
  return result;
}

function deriveSummary(items,evidenceRefs){
  const severity={critical:0,high:0,moderate:0,low:0,unknown:0};
  for(const item of items) severity[item.severity]+=1;
  return {findingCount:items.length,evidenceCount:evidenceRefs.length,severity};
}

function expectedCompletion(state,kind,partial,truncated){
  if(state==='failed'&&kind!=='failed') return false;
  if(state==='cancelled'&&kind!=='cancelled') return false;
  if(state==='policy_rejected'&&kind!=='policy_rejected') return false;
  if(state==='completed'&&!['success','findings','partial','truncated'].includes(kind)) return false;
  if(kind==='partial'&&!partial) return false;
  if(kind==='truncated'&&!truncated) return false;
  if(kind==='success'&&(partial||truncated)) return false;
  return true;
}

export function createTerminalCampaignManifest(input){
  const v=exactKeys(input,['tenantId','workspaceId','campaignId','workspaceSourceDigest','baseArtifactDigest','terminalState','completionKind','partialEvidence','truncated','policyId','profileVersions','layerRefs','jobRefs','attemptRefs','evidenceRefs','reportRefs','findings','completedAt'], '$');
  const evidenceRefs=validateReferenceList(v.evidenceRefs,'$.evidenceRefs',200_000);
  const findingItems=findings(v.findings,'$.findings');
  const body={
    schemaVersion:TERMINAL_MANIFEST_SCHEMA,
    tenantId:identifier(v.tenantId,'$.tenantId'),workspaceId:identifier(v.workspaceId,'$.workspaceId'),campaignId:identifier(v.campaignId,'$.campaignId'),
    workspaceSourceDigest:digest(v.workspaceSourceDigest,'$.workspaceSourceDigest'),baseArtifactDigest:digest(v.baseArtifactDigest,'$.baseArtifactDigest'),
    terminalState:enumValue(v.terminalState,TERMINAL_STATES,'$.terminalState'),completionKind:enumValue(v.completionKind,COMPLETION_KINDS,'$.completionKind'),
    partialEvidence:boolean(v.partialEvidence,'$.partialEvidence'),truncated:boolean(v.truncated,'$.truncated'),policyId:identifier(v.policyId,'$.policyId'),
    profileVersions:stringArray(v.profileVersions,'$.profileVersions',{maximum:64,item:identifier}),
    layerRefs:validateReferenceList(v.layerRefs,'$.layerRefs'),jobRefs:validateReferenceList(v.jobRefs,'$.jobRefs'),attemptRefs:validateReferenceList(v.attemptRefs,'$.attemptRefs'),
    evidenceRefs,reportRefs:validateReferenceList(v.reportRefs,'$.reportRefs'),findings:findingItems,completedAt:timestamp(v.completedAt,'$.completedAt')
  };
  if(!expectedCompletion(body.terminalState,body.completionKind,body.partialEvidence,body.truncated)) fail('terminal_contradiction','$.completionKind');
  const inventorySummary=deriveSummary(findingItems,evidenceRefs);
  const mergeEligible=body.terminalState==='completed';
  const canonical={...body,inventorySummary,mergeEligible};
  const manifestDigest=sha256(canonical);
  return frozenClone({...canonical,manifestId:`terminal-${manifestDigest.slice(7,31)}`,manifestDigest});
}

export function validateTerminalCampaignManifest(input){
  const v=exactKeys(input,['schemaVersion','manifestId','manifestDigest','tenantId','workspaceId','campaignId','workspaceSourceDigest','baseArtifactDigest','terminalState','completionKind','partialEvidence','truncated','policyId','profileVersions','layerRefs','jobRefs','attemptRefs','evidenceRefs','reportRefs','findings','completedAt','inventorySummary','mergeEligible'],'$');
  if(v.schemaVersion!==TERMINAL_MANIFEST_SCHEMA) fail('invalid_schema','$.schemaVersion');
  const rebuilt=createTerminalCampaignManifest({tenantId:v.tenantId,workspaceId:v.workspaceId,campaignId:v.campaignId,workspaceSourceDigest:v.workspaceSourceDigest,baseArtifactDigest:v.baseArtifactDigest,terminalState:v.terminalState,completionKind:v.completionKind,partialEvidence:v.partialEvidence,truncated:v.truncated,policyId:v.policyId,profileVersions:v.profileVersions,layerRefs:v.layerRefs,jobRefs:v.jobRefs,attemptRefs:v.attemptRefs,evidenceRefs:v.evidenceRefs,reportRefs:v.reportRefs,findings:v.findings,completedAt:v.completedAt});
  if(v.manifestId!==rebuilt.manifestId) fail('identity_mismatch','$.manifestId');
  if(v.manifestDigest!==rebuilt.manifestDigest) fail('digest_mismatch','$.manifestDigest');
  if(JSON.stringify(v.inventorySummary)!==JSON.stringify(rebuilt.inventorySummary)) fail('inventory_mismatch','$.inventorySummary');
  if(v.mergeEligible!==rebuilt.mergeEligible) fail('eligibility_mismatch','$.mergeEligible');
  return rebuilt;
}

export function terminalEligibility(input){
  const manifest=validateTerminalCampaignManifest(input);
  return frozenClone({schemaVersion:'phase8-terminal-eligibility-v1',campaignId:manifest.campaignId,eligible:manifest.mergeEligible,reason:manifest.mergeEligible?'eligible':'terminal_state_ineligible',manifestId:manifest.manifestId});
}
