import {
  exactKeys, identifier, digest, timestamp, integer, boolean, enumValue,
  stringArray, nullable, frozenClone, sha256, fail, boundedString, denseArray
} from './boundary.mjs';
export * from './boundary.mjs';

export const POLICY_SCHEMA = 'phase8-clean-room-policy-v1';
export const ACCESS_CONTEXT_SCHEMA = 'phase8-campaign-access-context-v1';
export const SHARE_GRANT_SCHEMA = 'phase8-share-grant-v1';
export const SHARE_REVOCATION_SCHEMA = 'phase8-share-revocation-v1';

const SCOPES = ['campaign:read', 'campaign:merge', 'campaign:share-base', 'campaign:write'];
const ROLES = ['owner', 'reviewer', 'operator', 'reader'];
const STATES = ['active', 'terminal', 'archived'];

export function createCleanRoomPolicy(input) {
  const v = exactKeys(input, ['tenantId','workspaceId','allowedScopes','maxCampaigns','maxMergeInputs','maxFindings','maxEvidence','maxRelations','maxBytes','retentionDays','issuedAt'], '$');
  const body = {
    schemaVersion: POLICY_SCHEMA,
    tenantId: identifier(v.tenantId, '$.tenantId'),
    workspaceId: identifier(v.workspaceId, '$.workspaceId'),
    allowedScopes: stringArray(v.allowedScopes, '$.allowedScopes', { item: (x,p) => enumValue(x, SCOPES, p), maximum: SCOPES.length }),
    maxCampaigns: integer(v.maxCampaigns, '$.maxCampaigns', 1, 1000),
    maxMergeInputs: integer(v.maxMergeInputs, '$.maxMergeInputs', 2, 64),
    maxFindings: integer(v.maxFindings, '$.maxFindings', 1, 100_000),
    maxEvidence: integer(v.maxEvidence, '$.maxEvidence', 1, 200_000),
    maxRelations: integer(v.maxRelations, '$.maxRelations', 1, 100_000),
    maxBytes: integer(v.maxBytes, '$.maxBytes', 1, 20_000_000),
    retentionDays: integer(v.retentionDays, '$.retentionDays', 1, 90),
    issuedAt: timestamp(v.issuedAt, '$.issuedAt')
  };
  const policyDigest = sha256(body);
  return frozenClone({ ...body, policyId: `policy-${policyDigest.slice(7,31)}`, policyDigest });
}

export function validateCleanRoomPolicy(input) {
  const v = exactKeys(input, ['schemaVersion','policyId','policyDigest','tenantId','workspaceId','allowedScopes','maxCampaigns','maxMergeInputs','maxFindings','maxEvidence','maxRelations','maxBytes','retentionDays','issuedAt'], '$');
  if (v.schemaVersion !== POLICY_SCHEMA) fail('invalid_schema', '$.schemaVersion');
  const rebuilt = createCleanRoomPolicy({
    tenantId:v.tenantId, workspaceId:v.workspaceId, allowedScopes:v.allowedScopes,
    maxCampaigns:v.maxCampaigns, maxMergeInputs:v.maxMergeInputs, maxFindings:v.maxFindings,
    maxEvidence:v.maxEvidence, maxRelations:v.maxRelations, maxBytes:v.maxBytes,
    retentionDays:v.retentionDays, issuedAt:v.issuedAt
  });
  if (v.policyId !== rebuilt.policyId) fail('identity_mismatch', '$.policyId');
  if (v.policyDigest !== rebuilt.policyDigest) fail('digest_mismatch', '$.policyDigest');
  return rebuilt;
}

export function createCampaignAccessContext(input) {
  const v = exactKeys(input, ['tenantId','workspaceId','campaignId','requesterId','scopes','workspaceSourceDigest','campaignRole','campaignState','policyId','decisionAt'], '$');
  return frozenClone({
    schemaVersion: ACCESS_CONTEXT_SCHEMA,
    tenantId: identifier(v.tenantId, '$.tenantId'), workspaceId: identifier(v.workspaceId, '$.workspaceId'),
    campaignId: identifier(v.campaignId, '$.campaignId'), requesterId: identifier(v.requesterId, '$.requesterId'),
    scopes: stringArray(v.scopes, '$.scopes', { item:(x,p)=>enumValue(x,SCOPES,p), maximum:SCOPES.length }),
    workspaceSourceDigest: digest(v.workspaceSourceDigest, '$.workspaceSourceDigest'),
    campaignRole: enumValue(v.campaignRole, ROLES, '$.campaignRole'),
    campaignState: enumValue(v.campaignState, STATES, '$.campaignState'),
    policyId: identifier(v.policyId, '$.policyId'), decisionAt: timestamp(v.decisionAt, '$.decisionAt')
  });
}

export function validateCampaignAccessContext(input) {
  const v = exactKeys(input, ['schemaVersion','tenantId','workspaceId','campaignId','requesterId','scopes','workspaceSourceDigest','campaignRole','campaignState','policyId','decisionAt'], '$');
  if (v.schemaVersion !== ACCESS_CONTEXT_SCHEMA) fail('invalid_schema', '$.schemaVersion');
  return createCampaignAccessContext({tenantId:v.tenantId,workspaceId:v.workspaceId,campaignId:v.campaignId,requesterId:v.requesterId,scopes:v.scopes,workspaceSourceDigest:v.workspaceSourceDigest,campaignRole:v.campaignRole,campaignState:v.campaignState,policyId:v.policyId,decisionAt:v.decisionAt});
}

export function createShareGrant(input) {
  const v = exactKeys(input, ['tenantId','workspaceId','sourceCampaignId','targetCampaignId','artifactId','artifactDigest','sourceDigest','issuedAt','expiresAt'], '$');
  const body = {
    schemaVersion: SHARE_GRANT_SCHEMA,
    tenantId: identifier(v.tenantId,'$.tenantId'), workspaceId: identifier(v.workspaceId,'$.workspaceId'),
    sourceCampaignId: identifier(v.sourceCampaignId,'$.sourceCampaignId'), targetCampaignId: identifier(v.targetCampaignId,'$.targetCampaignId'),
    artifactId: identifier(v.artifactId,'$.artifactId'), artifactDigest: digest(v.artifactDigest,'$.artifactDigest'),
    sourceDigest: digest(v.sourceDigest,'$.sourceDigest'), issuedAt: timestamp(v.issuedAt,'$.issuedAt'), expiresAt: timestamp(v.expiresAt,'$.expiresAt')
  };
  if (body.sourceCampaignId === body.targetCampaignId) fail('invalid_grant', '$.targetCampaignId');
  if (body.expiresAt <= body.issuedAt) fail('invalid_expiry', '$.expiresAt');
  const grantDigest = sha256(body);
  return frozenClone({ ...body, grantId:`grant-${grantDigest.slice(7,31)}`, grantDigest });
}

export function validateShareGrant(input) {
  const v = exactKeys(input, ['schemaVersion','grantId','grantDigest','tenantId','workspaceId','sourceCampaignId','targetCampaignId','artifactId','artifactDigest','sourceDigest','issuedAt','expiresAt'], '$');
  if (v.schemaVersion !== SHARE_GRANT_SCHEMA) fail('invalid_schema', '$.schemaVersion');
  const rebuilt = createShareGrant({tenantId:v.tenantId,workspaceId:v.workspaceId,sourceCampaignId:v.sourceCampaignId,targetCampaignId:v.targetCampaignId,artifactId:v.artifactId,artifactDigest:v.artifactDigest,sourceDigest:v.sourceDigest,issuedAt:v.issuedAt,expiresAt:v.expiresAt});
  if (v.grantId !== rebuilt.grantId) fail('identity_mismatch','$.grantId');
  if (v.grantDigest !== rebuilt.grantDigest) fail('digest_mismatch','$.grantDigest');
  return rebuilt;
}

export function createShareGrantRevocation(input) {
  const v = exactKeys(input, ['grantId','grantDigest','revokedAt','reasonCode'], '$');
  const body = {
    schemaVersion: SHARE_REVOCATION_SCHEMA,
    grantId: identifier(v.grantId,'$.grantId'), grantDigest:digest(v.grantDigest,'$.grantDigest'),
    revokedAt:timestamp(v.revokedAt,'$.revokedAt'), reasonCode:boundedString(v.reasonCode,'$.reasonCode',64)
  };
  const revocationDigest=sha256(body);
  return frozenClone({ ...body, revocationId:`revoke-${revocationDigest.slice(7,31)}`, revocationDigest });
}

export function validateShareGrantRevocation(input) {
  const v=exactKeys(input,['schemaVersion','revocationId','revocationDigest','grantId','grantDigest','revokedAt','reasonCode'],'$');
  if(v.schemaVersion!==SHARE_REVOCATION_SCHEMA) fail('invalid_schema','$.schemaVersion');
  const rebuilt=createShareGrantRevocation({grantId:v.grantId,grantDigest:v.grantDigest,revokedAt:v.revokedAt,reasonCode:v.reasonCode});
  if(v.revocationId!==rebuilt.revocationId) fail('identity_mismatch','$.revocationId');
  if(v.revocationDigest!==rebuilt.revocationDigest) fail('digest_mismatch','$.revocationDigest');
  return rebuilt;
}

export function validateReferenceList(value, path, maximum=10_000) {
  return denseArray(value,path,maximum).map((item,index)=>{
    const v=exactKeys(item,['id','digest'],`${path}[${index}]`);
    return { id:identifier(v.id,`${path}[${index}].id`), digest:digest(v.digest,`${path}[${index}].digest`) };
  }).sort((a,b)=>a.id.localeCompare(b.id));
}
