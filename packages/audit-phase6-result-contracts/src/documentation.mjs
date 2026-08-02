import { PHASE6_PROFILE_RESULT_IDENTITIES, PHASE6_RESULT_CONTRACT_VERSION, PHASE6_RESULT_ENVELOPE_SCHEMA_VERSION } from './identities.mjs';
import { deepFreeze } from './primitives.mjs';
export const PHASE6_RESULT_DOCUMENTATION_VERSION = 'phase6-result-documentation-v1';
export const PHASE6_RESULT_DOCUMENTATION = deepFreeze({
  documentationVersion: PHASE6_RESULT_DOCUMENTATION_VERSION,
  runtimeAuthoritative: true,
  schemaVersion: PHASE6_RESULT_ENVELOPE_SCHEMA_VERSION,
  contractVersion: PHASE6_RESULT_CONTRACT_VERSION,
  exactFields: ['schemaVersion','profileId','parserId','parserPackage','parserPackageVersion','captureSchemaVersion','resultSchemaVersion','toolVersion','trustedProducer','outcome','result','summary'],
  profileIdentities: PHASE6_PROFILE_RESULT_IDENTITIES,
  summaryFields: ['obligations','assertions','models','traces','counterexamples','diagnostics','sourceReferences','parserWarnings','truncated'],
  outcomes: {
    proved: 'no error diagnostics or counterexamples',
    disproved: 'at least one referentially valid counterexample',
    unknown: 'no counterexample evidence',
    timeout: 'empty proof evidence',
    cancelled: 'empty proof evidence',
    resource_exhausted: 'empty proof evidence',
    parser_error: 'one bounded error diagnostic, at least one bounded warning, empty proof evidence'
  },
  forbiddenInference: ['digest','releaseIdentifier','artifact','executor','executionState']
});
export function serializePhase6ResultDocumentation() { return `${JSON.stringify(PHASE6_RESULT_DOCUMENTATION, null, 2)}\n`; }
