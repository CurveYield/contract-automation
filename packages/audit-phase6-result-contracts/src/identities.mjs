import { deepFreeze } from './primitives.mjs';
export const PHASE6_RESULT_ENVELOPE_SCHEMA_VERSION = 'phase6-tool-result-envelope-v1';
export const PHASE6_RESULT_CONTRACT_VERSION = 'phase6-result-contract-v1';
export const PHASE6_PROFILE_RESULT_IDENTITIES = deepFreeze({
  'formal-obligations-v1': { parserId: 'parseFormalObligationsBytes', parserPackage: '@curveyield/audit-phase6-parsers', parserPackageVersion: '0.2.0', captureSchemaVersion: 'formal-obligations-capture-v1', resultSchemaVersion: 'formal-result-v1', toolVersion: '1.0.0', trustedProducer: 'curveyield-formal-capture-producer-v1' },
  'halmos-v1': { parserId: 'parseHalmosBytes', parserPackage: '@curveyield/audit-phase6-parsers', parserPackageVersion: '0.2.0', captureSchemaVersion: 'halmos-capture-v1', resultSchemaVersion: 'formal-result-v1', toolVersion: '0.3.3', trustedProducer: 'curveyield-formal-capture-producer-v1' },
  'solidity-smt-v1': { parserId: 'parseSoliditySmtBytes', parserPackage: '@curveyield/audit-phase6-parsers', parserPackageVersion: '0.2.0', captureSchemaVersion: 'solidity-smt-capture-v1', resultSchemaVersion: 'formal-result-v1', toolVersion: '0.8.30', trustedProducer: 'curveyield-formal-capture-producer-v1' }
});
