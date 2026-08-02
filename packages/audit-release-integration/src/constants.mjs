import { deepFreeze } from './boundary.mjs';
export const COMPONENT_MANIFEST_SCHEMA='audit-release-component-manifest-v1';
export const PUBLIC_INTERFACE_LOCK_SCHEMA='audit-public-interface-lock-v1';
export const SHARED_FILE_UNION_SCHEMA='audit-shared-file-union-v1';
export const INTAKE_PLAN_SCHEMA='audit-release-intake-plan-v1';
export const RELEASE_MANIFEST_SCHEMA='audit-release-integration-manifest-v1';
export const SAFE_CAPABILITIES=Object.freeze({executionEnabled:false,executorState:'unavailable',networkEnabled:false,signingEnabled:false,transactionEnabled:false,deploymentEnabled:false});
export const ROUND4_MASTER_ISSUE=119;
export const ROUND4_INTAKE_SLOTS=deepFreeze([
  {workerId:'worker-0',issueNumber:120,branch:'audit-round4/review-integration-spine-v1',role:'review-phase1-6-spine',stageAActivationIssues:[114,119],stageBActivationIssues:[119,122]},
  {workerId:'worker-1',issueNumber:121,branch:'audit-round4/review-phase78-api-compat-v1',role:'review-phase78-api-compat',stageAActivationIssues:[112,113,119],stageBActivationIssues:[119,122]},
  {workerId:'worker-2',issueNumber:122,branch:'audit-round4/full-platform-integration-v1',role:'assemble-full-platform',stageAActivationIssues:[],stageBActivationIssues:[112,113,114,115,116,119,120,121,123,124]},
  {workerId:'worker-3',issueNumber:123,branch:'audit-round4/review-api-auth-security-v1',role:'security-review-stage-b',stageAActivationIssues:[113,115,119],stageBActivationIssues:[119,122]},
  {workerId:'worker-4',issueNumber:124,branch:'audit-round4/review-web-direct-e2e-v1',role:'ui-direct-review-stage-b',stageAActivationIssues:[112,113,115,116,119],stageBActivationIssues:[119,122]}
]);
export const ALLOWED_RECOMMENDATIONS=new Set(['ACCEPT','ACCEPT WITH REPAIR']);
export const ADAPTATION_KINDS=new Set(['exact','repaired','added','deleted']);
