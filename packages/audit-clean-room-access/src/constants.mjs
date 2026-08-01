export const ACCESS_DECISION_SCHEMA='phase8-access-decision-v1';
export const VISIBILITY_DECISION_SCHEMA='phase8-visibility-decision-v1';
export const HIDDEN_ENVELOPE_SCHEMA='phase8-hidden-resource-envelope-v1';
export const STORAGE_PLAN_SCHEMA='phase8-scoped-storage-plan-v1';
export const RESOURCE_KINDS=Object.freeze(['source_manifest','base_artifact','layer','job','attempt','log','artifact','evidence','report','fork_reference','notification','search_entry']);
export const REQUIRED_SCOPES=Object.freeze(['campaign:read','campaign:merge','campaign:share-base','campaign:write']);
export const REASONS=Object.freeze(['allowed','scope_missing','role_state_denied','tenant_mismatch','workspace_mismatch','campaign_mismatch','grant_missing','grant_expired','grant_revoked','resource_hidden']);
export const READABLE_STATES_BY_ROLE=Object.freeze({owner:Object.freeze(['active','terminal','archived']),reviewer:Object.freeze(['active','terminal','archived']),operator:Object.freeze(['active','terminal']),reader:Object.freeze(['active','terminal','archived'])});
