import { ValidationError } from '../../audit-protocol/src/index.mjs';
import {
  PHASE4_PROFILE_IDS,
  getProfileTemplate
} from '../../audit-tool-profile-contracts/src/index.mjs';
import { PARSER_VERSIONS } from '../../audit-tool-parsers/src/index.mjs';

const DETECTORS = Object.freeze([
  'arbitrary-send-eth',
  'controlled-delegatecall',
  'incorrect-equality',
  'naming-convention',
  'reentrancy-eth',
  'reentrancy-no-eth',
  'shadowing-state',
  'suicidal',
  'unchecked-transfer',
  'uninitialized-state'
]);

const CONFIGURATION_SCHEMAS = Object.freeze({
  'solidity-compile-v1': {
    fields: [
      { name: 'compilerVersion', type: 'string', required: true, allowedValues: ['0.8.30'] },
      { name: 'optimizerEnabled', type: 'boolean', required: true },
      { name: 'optimizerRuns', type: 'integer', required: true, minimum: 0, maximum: 1_000_000 },
      { name: 'evmVersion', type: 'string', required: true, allowedValues: ['paris', 'shanghai', 'cancun'] },
      { name: 'viaIR', type: 'boolean', required: true }
    ]
  },
  'foundry-test-v1': {
    fields: [
      { name: 'matchPath', type: 'relative-pattern', required: true, maximumLength: 160 },
      { name: 'verbosity', type: 'integer', required: true, minimum: 0, maximum: 4 },
      { name: 'failFast', type: 'boolean', required: true }
    ]
  },
  'foundry-fuzz-v1': {
    fields: [
      { name: 'runs', type: 'integer', required: true, minimum: 1, maximum: 100_000 },
      { name: 'seed', type: 'integer', required: true, minimum: 0, maximum: 4_294_967_295 },
      { name: 'dictionaryWeight', type: 'integer', required: true, minimum: 0, maximum: 100 },
      { name: 'includeStorage', type: 'boolean', required: true }
    ]
  },
  'foundry-invariant-v1': {
    fields: [
      { name: 'runs', type: 'integer', required: true, minimum: 1, maximum: 10_000 },
      { name: 'depth', type: 'integer', required: true, minimum: 1, maximum: 1_024 },
      { name: 'seed', type: 'integer', required: true, minimum: 0, maximum: 4_294_967_295 },
      { name: 'failOnRevert', type: 'boolean', required: true },
      { name: 'callOverride', type: 'boolean', required: true }
    ]
  },
  'slither-v1': {
    fields: [
      { name: 'detectors', type: 'string-array', required: true, minimumItems: 1, maximumItems: 32, allowedValues: DETECTORS },
      { name: 'excludeDependencies', type: 'boolean', required: true },
      { name: 'filterPaths', type: 'relative-pattern-array', required: true, maximumItems: 32, maximumLength: 160 }
    ]
  },
  'coverage-forge-v1': {
    fields: [
      { name: 'reportFormats', type: 'string-array', required: true, minimumItems: 1, maximumItems: 3, allowedValues: ['summary', 'lcov', 'json'] },
      { name: 'matchPath', type: 'relative-pattern', required: true, maximumLength: 160 },
      { name: 'includeLibraries', type: 'boolean', required: true }
    ]
  }
});

function clone(value) {
  return structuredClone(value);
}

function entry(profileId) {
  const template = getProfileTemplate(profileId);
  const parserVersion = PARSER_VERSIONS[profileId];
  if (!parserVersion) throw new ValidationError('unknown_parser', `No parser registered for ${profileId}`, '$.profileId');
  return {
    schemaVersion: 'tool-profile-catalog-entry-v1',
    profileId: template.profileId,
    publicationState: template.publicationState,
    executionEnabled: false,
    executorState: 'unavailable',
    digestRequired: true,
    registryRepository: template.registryRepository,
    tool: clone(template.tool),
    programId: template.programId,
    adapterVersion: template.adapterVersion,
    parserVersion,
    resourcePolicyId: template.resourcePolicyId,
    networkPolicyId: template.networkPolicyId,
    evidenceSchemaVersion: template.evidenceSchemaVersion,
    artifactManifestVersion: template.artifactManifestVersion,
    seedPolicy: template.seedPolicy,
    cancellationPolicyId: template.cancellationPolicyId,
    resultSchemaVersion: 'tool-result-v1',
    configurationSchema: {
      schemaVersion: 'profile-configuration-schema-v1',
      fields: clone(CONFIGURATION_SCHEMAS[profileId].fields)
    }
  };
}

const CATALOG = Object.freeze(PHASE4_PROFILE_IDS.map((profileId) => Object.freeze(entry(profileId))));
const CATALOG_BY_ID = new Map(CATALOG.map((item) => [item.profileId, item]));

export function listToolProfileCatalog() {
  return clone(CATALOG);
}

export function getToolProfileCatalogEntry(profileId) {
  const item = CATALOG_BY_ID.get(profileId);
  if (!item) throw new ValidationError('unknown_profile_id', `Unsupported Phase 4 profileId: ${profileId}`, '$.profileId');
  return clone(item);
}
