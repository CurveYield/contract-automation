export const MAX_PHASE5_INPUT_BYTES = 5_000_000;
export const MAX_PHASE5_RECORDS = 10_000;
export const MAX_PHASE5_STRING_LENGTH = 2_000;
export const PHASE5_PARSER_VERSIONS = Object.freeze({
  'hardhat-test-v1': 'hardhat-test-parser-v1',
  'echidna-v1': 'echidna-parser-v1',
  'mutation-v1': 'mutation-parser-v1',
  'dependency-scan-v1': 'dependency-scan-parser-v1'
});
const CONTRACTS = Object.freeze({
  'hardhat-test-v1': { recordKey: 'hardhatTests', evidenceType: 'hardhat-test-summary' },
  'echidna-v1': { recordKey: 'echidnaProperties', evidenceType: 'echidna-campaign-summary' },
  'mutation-v1': { recordKey: 'mutationResults', evidenceType: 'mutation-summary' },
  'dependency-scan-v1': { recordKey: 'dependencyFindings', evidenceType: 'dependency-scan-summary' }
});
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
function empty(profileId, parserVersion, classification, durationMs = 0, exitCode = null) {
  return {
    schemaVersion: 'phase5-tool-result-v1', profileId, parserVersion, classification, durationMs, exitCode,
    hardhatTests: [], echidnaProperties: [], mutationResults: [], dependencyFindings: [],
    evidence: [], artifacts: [], parserErrors: [], summary: {}
  };
}
function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }
function parserError(profileId, parserVersion, code, durationMs = 0) {
  const result = empty(profileId, parserVersion, code === 'malformed_output' ? 'malformed_output' : 'parser_error', durationMs, null);
  result.parserErrors = [{ code, message: `Phase 5 inert parsing failed with ${code}` }];
  return freeze(result);
}
function summaryFor(profileId, records, seed = 0) {
  if (profileId === 'hardhat-test-v1') return {
    passed: records.filter((item) => item.status === 'passed').length,
    failed: records.filter((item) => item.status === 'failed').length,
    skipped: records.filter((item) => item.status === 'skipped').length,
    total: records.length
  };
  if (profileId === 'echidna-v1') return {
    passed: records.filter((item) => item.status === 'passed').length,
    failed: records.filter((item) => item.status === 'failed').length,
    total: records.length, seed
  };
  if (profileId === 'mutation-v1') {
    const killed = records.filter((item) => item.status === 'killed').length;
    const survived = records.filter((item) => item.status === 'survived').length;
    const timedOut = records.filter((item) => item.status === 'timed_out').length;
    const invalid = records.filter((item) => item.status === 'invalid').length;
    const denominator = killed + survived;
    return { killed, survived, timedOut, invalid, total: records.length, mutationScore: denominator === 0 ? 0 : Math.round((killed / denominator) * 10000) / 100 };
  }
  return {
    critical: records.filter((item) => item.severity === 'critical').length,
    high: records.filter((item) => item.severity === 'high').length,
    moderate: records.filter((item) => item.severity === 'moderate').length,
    low: records.filter((item) => item.severity === 'low').length,
    unknown: records.filter((item) => !['critical','high','moderate','low'].includes(item.severity)).length,
    total: records.length
  };
}
export function parsePhase5ToolResult(profileId, input) {
  const recognized = Object.hasOwn(PHASE5_PARSER_VERSIONS, profileId);
  const resultProfileId = recognized ? profileId : 'invalid-profile-v1';
  const parserVersion = recognized ? PHASE5_PARSER_VERSIONS[profileId] : 'unknown-parser-v1';
  if (!recognized) return parserError(resultProfileId, parserVersion, 'unknown_profile_id');
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid_input');
    const durationMs = Number.isSafeInteger(input.durationMs) && input.durationMs >= 0 && input.durationMs <= 86_400_000 ? input.durationMs : 0;
    const termination = input.termination ?? input.terminationReason ?? 'completed';
    if (['timeout','cancelled','resource_exhaustion'].includes(termination)) return freeze(empty(profileId, parserVersion, termination, durationMs, null));
    const exitCode = Number.isSafeInteger(input.exitCode) && input.exitCode >= 0 && input.exitCode <= 255 ? input.exitCode : 0;
    let text;
    if (typeof input.resultJson === 'string') text = input.resultJson;
    else if (input.resultJson instanceof Uint8Array) text = decoder.decode(input.resultJson);
    else text = JSON.stringify(input.resultJson ?? {});
    if (encoder.encode(text).byteLength > MAX_PHASE5_INPUT_BYTES) return parserError(profileId, parserVersion, 'input_too_large', durationMs);
    let root;
    try { root = JSON.parse(text); } catch { return parserError(profileId, parserVersion, 'malformed_output', durationMs); }
    const contract = CONTRACTS[profileId];
    const records = Array.isArray(root.records) ? root.records : Array.isArray(root[contract.recordKey]) ? root[contract.recordKey] : [];
    if (records.length > MAX_PHASE5_RECORDS) return parserError(profileId, parserVersion, 'record_limit', durationMs);
    const normalized = records.map((item) => structuredClone(item)).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const result = empty(profileId, parserVersion, 'success', durationMs, exitCode);
    result[contract.recordKey] = normalized;
    result.summary = summaryFor(profileId, normalized, Number.isSafeInteger(root.seed) ? root.seed : 0);
    const findings = profileId === 'hardhat-test-v1' ? result.summary.failed > 0
      : profileId === 'echidna-v1' ? result.summary.failed > 0
        : profileId === 'mutation-v1' ? result.summary.survived + result.summary.timedOut + result.summary.invalid > 0
          : result.summary.total > 0;
    result.classification = exitCode !== 0 || findings ? 'findings' : 'success';
    result.evidence = [{ schemaVersion: 'phase5-parser-evidence-v1', type: contract.evidenceType, recordCount: normalized.length }];
    return freeze(result);
  } catch {
    return parserError(profileId, parserVersion, 'parser_error');
  }
}
