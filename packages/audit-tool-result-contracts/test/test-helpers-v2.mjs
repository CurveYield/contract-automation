export function compilerSuccess() {
  return {
    schemaVersion: 'tool-result-v1',
    profileId: 'solidity-compile-v1',
    parserVersion: 'solidity-compile-parser-v1',
    exitClassification: 'success',
    terminationReason: 'completed',
    durationMs: 30,
    exitCode: 0,
    truncated: false,
    diagnostics: [],
    tests: [],
    counterexamples: [],
    invariants: [],
    findings: [],
    coverage: null,
    parserWarnings: [],
    parserErrors: [],
    summary: { contracts: 2, errors: 0, warnings: 0, diagnostics: 0 }
  };
}
export function compilerFailure() {
  const value = compilerSuccess();
  value.exitClassification = 'tool_failure';
  value.exitCode = 1;
  value.diagnostics = [{
    severity: 'error', category: 'TypeError', component: 'general', message: 'Synthetic mismatch',
    formattedMessage: 'Synthetic mismatch', location: { path: 'contracts/A.sol', start: 1, end: 5 }
  }];
  value.summary = { contracts: 1, errors: 1, warnings: 0, diagnostics: 1 };
  return value;
}
export function foundryTestSuccess() {
  return {
    schemaVersion: 'tool-result-v1', profileId: 'foundry-test-v1', parserVersion: 'foundry-test-parser-v1',
    exitClassification: 'success', terminationReason: 'completed', durationMs: 10, exitCode: 0, truncated: false,
    diagnostics: [], tests: [{ suite: 'Suite', name: 'testA', status: 'passed', durationMs: 1, reason: null }],
    counterexamples: [], invariants: [], findings: [], coverage: null, parserWarnings: [], parserErrors: [],
    summary: { passed: 1, failed: 0, skipped: 0, total: 1 }
  };
}
export function fuzzFailure() {
  return {
    schemaVersion: 'tool-result-v1', profileId: 'foundry-fuzz-v1', parserVersion: 'foundry-fuzz-parser-v1',
    exitClassification: 'tool_failure', terminationReason: 'completed', durationMs: 20, exitCode: 1, truncated: false,
    diagnostics: [], tests: [{ test: 'testFuzzA', status: 'failed', runs: 10, seed: 7 }],
    counterexamples: [{ test: 'testFuzzA', seed: 7, value: { amount: '0', actor: '0x1' }, trace: [] }],
    invariants: [], findings: [], coverage: null, parserWarnings: [], parserErrors: [],
    summary: { passed: 0, failed: 1, total: 1 }
  };
}
export function invariantFailure() {
  return {
    schemaVersion: 'tool-result-v1', profileId: 'foundry-invariant-v1', parserVersion: 'foundry-invariant-parser-v1',
    exitClassification: 'tool_failure', terminationReason: 'completed', durationMs: 20, exitCode: 1, truncated: false,
    diagnostics: [], tests: [], counterexamples: [{ contract: 'Handler', invariant: 'invariantA', seed: 7, value: { x: 1 }, trace: [] }],
    invariants: [{ contract: 'Handler', name: 'invariantA', status: 'failed', runs: 10, depth: 5, seed: 7, counterexample: { x: 1 }, trace: [] }],
    findings: [], coverage: null, parserWarnings: [], parserErrors: [], summary: { passed: 0, failed: 1, total: 1 }
  };
}
export function slitherSuccess() {
  return {
    schemaVersion: 'tool-result-v1', profileId: 'slither-v1', parserVersion: 'slither-parser-v1',
    exitClassification: 'success', terminationReason: 'completed', durationMs: 10, exitCode: 0, truncated: false,
    diagnostics: [], tests: [], counterexamples: [], invariants: [], findings: [{
      detector: 'reentrancy-eth', impact: 'High', confidence: 'Medium', description: 'Synthetic',
      locations: [{ path: 'contracts/A.sol', lines: [1, 2] }]
    }], coverage: null, parserWarnings: [], parserErrors: [], summary: { findings: 1, high: 1 }
  };
}
export function coverageSuccess() {
  const metric = (covered, total) => ({ covered, total, percentage: total === 0 ? 100 : Math.round((covered / total) * 10000) / 100 });
  return {
    schemaVersion: 'tool-result-v1', profileId: 'coverage-forge-v1', parserVersion: 'coverage-forge-parser-v1',
    exitClassification: 'success', terminationReason: 'completed', durationMs: 10, exitCode: 0, truncated: false,
    diagnostics: [], tests: [], counterexamples: [], invariants: [], findings: [],
    coverage: { files: [{ path: 'contracts/A.sol', lines: metric(8, 10), functions: metric(3, 4), branches: metric(2, 4) }], totals: { lines: metric(8, 10), functions: metric(3, 4), branches: metric(2, 4) } },
    parserWarnings: [], parserErrors: [], summary: { files: 1 }
  };
}
export function timeoutResult() {
  return {
    schemaVersion: 'tool-result-v1', profileId: 'solidity-compile-v1', parserVersion: 'solidity-compile-parser-v1',
    exitClassification: 'timeout', terminationReason: 'timeout', durationMs: 86400000, exitCode: null, truncated: false,
    diagnostics: [], tests: [], counterexamples: [], invariants: [], findings: [], coverage: null,
    parserWarnings: [], parserErrors: [], summary: { terminationReason: 'timeout' }
  };
}
export function parserErrorResult() {
  return {
    schemaVersion: 'tool-result-v1', profileId: 'solidity-compile-v1', parserVersion: 'solidity-compile-parser-v1',
    exitClassification: 'parser_error', terminationReason: 'completed', durationMs: 5, exitCode: 1, truncated: false,
    diagnostics: [], tests: [], counterexamples: [], invariants: [], findings: [], coverage: null,
    parserWarnings: [], parserErrors: [{ code: 'invalid_json', message: 'Tool result JSON is malformed.', path: '$.resultJson' }], summary: {}
  };
}
export function cancelledResult() {
  const value = timeoutResult();
  value.profileId = 'foundry-test-v1'; value.parserVersion = 'foundry-test-parser-v1';
  value.exitClassification = 'cancelled'; value.terminationReason = 'cancelled'; value.durationMs = 15;
  value.summary = { terminationReason: 'cancelled' };
  return value;
}
export function resourceExhaustionResult() {
  const value = timeoutResult();
  value.profileId = 'slither-v1'; value.parserVersion = 'slither-parser-v1';
  value.exitClassification = 'resource_exhaustion'; value.terminationReason = 'resource_exhaustion';
  value.summary = { terminationReason: 'resource_exhaustion' };
  return value;
}
export const ALL_CANONICAL_RESULTS = Object.freeze([
  compilerSuccess(), compilerFailure(), foundryTestSuccess(), fuzzFailure(), invariantFailure(), slitherSuccess(), coverageSuccess(), timeoutResult(), cancelledResult(), resourceExhaustionResult(), parserErrorResult()
]);
export function canonicalPlan(profileId, parserVersion) {
  return {
    profileIdentity: { profileId, profileVersion: 1 },
    immutableDigestIdentity: { registryRepository: `ghcr.io/curveyield/${profileId}`, digest: `sha256:${'a'.repeat(64)}` },
    parserVersion,
    artifactContract: { schemaVersion: 'tool-artifacts-v1' },
    evidenceContract: { schemaVersion: 'tool-evidence-v1' },
    executionEnabled: false,
    executorState: 'unavailable'
  };
}
export function assertError(assert, fn, code, path) {
  assert.throws(fn, (error) => error?.code === code && (path === undefined || error?.path === path), `expected ${code} at ${path ?? '*'}`);
}
