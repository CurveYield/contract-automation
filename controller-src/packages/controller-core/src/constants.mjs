export const DEEP_ASSURANCE_PROCESS_ID = 'deep-assurance-v6';
export const DEEP_ASSURANCE_REQUIRED_CAPABILITIES = Object.freeze([
  'github-mailbox-v1',
  'browser-agent-review-v1',
  'github-native-compile-v1',
  'github-native-simulate-v1',
  'artifact-evidence-validation-v1',
  'exact-release-verification-v1',
]);

export const DEEP_ASSURANCE_RELEASE_AND_REPORT_GATE_ID = 'release-and-report-complete';
export const DEEP_ASSURANCE_REMEDIATION_REVIEW_GATE_ID = 'remediation-review-complete';

export const DEEP_ASSURANCE_GATE_CATALOG = Object.freeze([
  ['exact-scope-provenance-complete', 'scope-and-provenance'],
  ['risk-specification-complete', 'risk-specification'],
  ['architecture-threat-model-complete', 'architecture-threat-model'],
  ['manual-implementation-review-complete', 'manual-implementation-review'],
  ['economic-mathematical-review-complete', 'economic-mathematical-review'],
  ['exact-build-and-tests-complete', 'build-and-test'],
  ['fork-simulation-lifecycle-complete', 'fork-simulation-lifecycle'],
  ['findings-validation-complete', 'findings-validation'],
  [DEEP_ASSURANCE_REMEDIATION_REVIEW_GATE_ID, 'remediation-review'],
  [DEEP_ASSURANCE_RELEASE_AND_REPORT_GATE_ID, 'release-and-report'],
].map(([gateId, phaseId]) => Object.freeze({ gateId, phaseId })));

export const DEEP_ASSURANCE_LANE_CATALOG = Object.freeze([
  ['scope-specification-auditor', true, false],
  ['architecture-threat-auditor', true, false],
  ['manual-implementation-auditor', true, false],
  ['economic-accounting-auditor', true, false],
  ['build-simulation-evidence-auditor', false, false],
  ['adversarial-no-go-auditor', false, false],
  ['final-report-coordinator', false, true],
].map(([roleId, cleanRoom, controllerOwned]) => Object.freeze({ roleId, cleanRoom, controllerOwned })));

export const CampaignStatus = Object.freeze({
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  COMPLETE: 'COMPLETE',
});

export const SecurityVerdict = Object.freeze({
  PASS: 'PASS',
  NO_GO: 'NO_GO',
});

export const GateStatus = Object.freeze({
  PENDING: 'PENDING',
  PASS: 'PASS',
  INFORMATIONAL_ISSUE_FOUND: 'INFORMATIONAL_ISSUE_FOUND',
  LOW_ISSUE_FOUND: 'LOW_ISSUE_FOUND',
  MEDIUM_ISSUE_FOUND: 'MEDIUM_ISSUE_FOUND',
  HIGH_ISSUE_FOUND: 'HIGH_ISSUE_FOUND',
  CRITICAL_ISSUE_FOUND: 'CRITICAL_ISSUE_FOUND',
  FAIL: 'FAIL',
});

export const AssignmentStatus = Object.freeze({
  READY: 'READY',
  LEASED: 'LEASED',
  SUBMITTED: 'SUBMITTED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
});

export const TERMINAL_CAMPAIGN_STATUSES = new Set([CampaignStatus.COMPLETE]);
