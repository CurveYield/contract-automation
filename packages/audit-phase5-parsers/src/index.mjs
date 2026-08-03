import {
  PROFILE_IDS,
  INVALID_PROFILE_ID,
  PHASE5_PARSER_VERSIONS,
  prepare,
  terminationResult,
  parseJson,
  parserFailure,
  fault
} from './lifecycle-boundary.mjs';
import {
  parseHardhat,
  parseEchidna,
  parseMutation,
  parseDependency
} from './profiles.mjs';
export {
  MAX_PHASE5_INPUT_BYTES,
  MAX_PHASE5_RECORDS,
  MAX_PHASE5_STRING_LENGTH,
  PHASE5_PARSER_VERSIONS
} from './common.mjs';

export function parsePhase5ToolResult(profileId, input) {
  const recognizedProfile = typeof profileId === 'string' && profileId.length <= 80 && PROFILE_IDS.has(profileId);
  const resultProfileId = recognizedProfile ? profileId : INVALID_PROFILE_ID;
  let parserVersion = recognizedProfile ? PHASE5_PARSER_VERSIONS[profileId] : 'unknown-parser-v1';
  let prepared;
  try {
    prepared = prepare(profileId, input);
    parserVersion = PHASE5_PARSER_VERSIONS[profileId];
    if (prepared.termination !== 'completed') return terminationResult(profileId, parserVersion, prepared);
    let root;
    try { root = parseJson(prepared.resultText); }
    catch (error) { return parserFailure(profileId, parserVersion, prepared, 'malformed_output', error); }
    switch (profileId) {
      case 'hardhat-test-v1': return parseHardhat(profileId, parserVersion, prepared, root);
      case 'echidna-v1': return parseEchidna(profileId, parserVersion, prepared, root);
      case 'mutation-v1': return parseMutation(profileId, parserVersion, prepared, root);
      case 'dependency-scan-v1': return parseDependency(profileId, parserVersion, prepared, root);
      default: throw fault('unknown_profile_id', 'Unsupported Phase 5 profileId');
    }
  } catch (error) {
    return parserFailure(resultProfileId, parserVersion, input, 'parser_error', error);
  }
}
