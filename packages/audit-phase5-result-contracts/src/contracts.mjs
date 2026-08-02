export const PHASE5_RESULT_SCHEMA_VERSION = 'phase5-tool-result-v1';
export const PHASE5_EVIDENCE_SCHEMA_VERSION = 'phase5-parser-evidence-v1';
export const INVALID_PROFILE_ID = 'invalid-profile-v1';
export const UNKNOWN_PARSER_VERSION = 'unknown-parser-v1';

export const PHASE5_RESULT_CONTRACTS = Object.freeze({
  'hardhat-test-v1': Object.freeze({ parserVersion: 'hardhat-test-parser-v1', recordKey: 'hardhatTests', evidenceType: 'hardhat-test-summary', summaryKeys: Object.freeze(['passed', 'failed', 'skipped', 'total']) }),
  'echidna-v1': Object.freeze({ parserVersion: 'echidna-parser-v1', recordKey: 'echidnaProperties', evidenceType: 'echidna-campaign-summary', summaryKeys: Object.freeze(['passed', 'failed', 'total', 'seed']) }),
  'mutation-v1': Object.freeze({ parserVersion: 'mutation-parser-v1', recordKey: 'mutationResults', evidenceType: 'mutation-summary', summaryKeys: Object.freeze(['killed', 'survived', 'timedOut', 'invalid', 'total', 'mutationScore']) }),
  'dependency-scan-v1': Object.freeze({ parserVersion: 'dependency-scan-parser-v1', recordKey: 'dependencyFindings', evidenceType: 'dependency-scan-summary', summaryKeys: Object.freeze(['critical', 'high', 'moderate', 'low', 'unknown', 'total']) })
});
export const PHASE5_RESULT_PROFILE_IDS = Object.freeze(Object.keys(PHASE5_RESULT_CONTRACTS));
export const PROFILE_RECORD_KEYS = Object.freeze(['hardhatTests', 'echidnaProperties', 'mutationResults', 'dependencyFindings']);
export const RESULT_TOP_LEVEL_KEYS = Object.freeze(['schemaVersion','profileId','parserVersion','classification','durationMs','exitCode',...PROFILE_RECORD_KEYS,'evidence','artifacts','parserErrors','summary']);
export const RESULT_CLASSIFICATIONS = Object.freeze(['success','findings','timeout','cancelled','resource_exhaustion','malformed_output','parser_error']);
export const TERMINAL_CLASSIFICATIONS = new Set(['timeout','cancelled','resource_exhaustion']);
export const FAILURE_CLASSIFICATIONS = new Set(['malformed_output','parser_error']);
export const MAX_RECORDS = 10_000;
export const MAX_STRING = 2_000;
export const MAX_DURATION_MS = 86_400_000;
