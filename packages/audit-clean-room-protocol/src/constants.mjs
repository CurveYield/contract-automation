export const POLICY_SCHEMA='phase8-clean-room-policy-v1';
export const ACCESS_CONTEXT_SCHEMA='phase8-campaign-access-context-v1';
export const SHARE_GRANT_SCHEMA='phase8-share-grant-v1';
export const SHARE_REVOCATION_SCHEMA='phase8-share-revocation-v1';
export const SCOPES=Object.freeze(['campaign:read','campaign:merge','campaign:share-base','campaign:write']);
export const ROLES=Object.freeze(['owner','reviewer','operator','reader']);
export const STATES=Object.freeze(['active','terminal','archived']);
