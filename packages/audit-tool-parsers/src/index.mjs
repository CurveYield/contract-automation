export {
  MAX_FINDINGS,
  MAX_INPUT_BYTES,
  MAX_LINES,
  MAX_NESTING_DEPTH,
  MAX_NUMERIC_VALUE,
  MAX_SOURCE_REFERENCES,
  MAX_TEST_CASES,
  MAX_TRACE_ENTRIES,
  PARSER_LIMITS,
  PARSER_VERSIONS,
  TOOL_RESULT_SCHEMA_VERSION
} from './core.mjs';

import {
  baseResult,
  deepFreeze,
  knownProfile,
  parserErrorResult,
  prepareInput,
  warningCollector
} from './core.mjs';
import {
  parseCompiler,
  parseCoverage,
  parseFoundryTests,
  parseFuzz,
  parseInvariant,
  parseSlither
} from './profiles.mjs';

export function parseToolOutput(profileId, input) {
  const parserVersion = knownProfile(profileId);
  try {
    const prepared = prepareInput(input);
    if (prepared.terminationReason !== 'completed') {
      return deepFreeze(baseResult(profileId, parserVersion, {
        exitClassification: prepared.terminationReason,
        terminationReason: prepared.terminationReason,
        durationMs: prepared.durationMs,
        exitCode: prepared.exitCode,
        summary: { terminationReason: prepared.terminationReason }
      }));
    }

    const warnings = warningCollector();
    switch (profileId) {
      case 'solidity-compile-v1':
        return parseCompiler(profileId, parserVersion, prepared, warnings);
      case 'foundry-test-v1':
        return parseFoundryTests(profileId, parserVersion, prepared, warnings);
      case 'foundry-fuzz-v1':
        return parseFuzz(profileId, parserVersion, prepared, warnings);
      case 'foundry-invariant-v1':
        return parseInvariant(profileId, parserVersion, prepared, warnings);
      case 'slither-v1':
        return parseSlither(profileId, parserVersion, prepared, warnings);
      case 'coverage-forge-v1':
        return parseCoverage(profileId, parserVersion, prepared, warnings);
      default:
        throw new ValidationError('unknown_profile_id', `Unsupported Phase 4 profileId: ${profileId}`, '$.profileId');
    }
  } catch (error) {
    return parserErrorResult(profileId, parserVersion, input, error);
  }
}
