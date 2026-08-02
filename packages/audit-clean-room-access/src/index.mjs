import {
  createCampaignAccessContext,
  validateCleanRoomPolicy,
  validateShareGrant,
  validateShareGrantRevocation
} from '../../audit-clean-room-protocol/src/index.mjs';

function hasScope(scopes, required) { return scopes.includes(required); }
function activeGrant(grant, revocations, at) {
  if (grant.expiresAt <= at) return false;
  return !revocations.some((revocation) => revocation.grantId === grant.grantId && revocation.grantDigest === grant.grantDigest && revocation.revokedAt <= at);
}
export function authorizeCampaignAccess(input) {
  const policy = validateCleanRoomPolicy(input.policy);
  const requester = input.requester;
  if (!requester || typeof requester !== 'object') throw new TypeError('requester is required');
  const requiredScope = input.requiredScope;
  if (!policy.allowedScopes.includes(requiredScope)) throw Object.assign(new Error('scope is not allowed by policy'), { code: 'policy_scope_denied' });
  if (!hasScope(requester.scopes ?? [], requiredScope)) throw Object.assign(new Error('requester lacks required scope'), { code: 'insufficient_scope' });
  if (requester.tenantId !== policy.tenantId || input.workspaceId !== policy.workspaceId) throw Object.assign(new Error('tenant or workspace mismatch'), { code: 'clean_room_identity_mismatch' });
  const grants = (input.grants ?? []).map(validateShareGrant);
  const revocations = (input.revocations ?? []).map(validateShareGrantRevocation);
  if (input.sourceCampaignId && input.sourceCampaignId !== input.campaignId) {
    const grant = grants.find((item) => item.sourceCampaignId === input.sourceCampaignId && item.targetCampaignId === input.campaignId && item.artifactId === input.artifactId && activeGrant(item, revocations, input.decisionAt));
    if (!grant) throw Object.assign(new Error('active share grant required'), { code: 'share_grant_required' });
  }
  return createCampaignAccessContext({
    tenantId: requester.tenantId,
    workspaceId: input.workspaceId,
    campaignId: input.campaignId,
    requesterId: requester.requesterId,
    scopes: requester.scopes,
    workspaceSourceDigest: input.workspaceSourceDigest,
    campaignRole: requester.campaignRole,
    campaignState: input.campaignState,
    policyId: policy.policyId,
    decisionAt: input.decisionAt
  });
}
