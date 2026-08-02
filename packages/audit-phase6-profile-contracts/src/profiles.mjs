import {
  PHASE6_BOUNDS,
  PROFILE_IDS,
  SMT_TARGETS,
  TRACE_EVENTS,
  Phase6ValidationError,
  assertAllowedKeys,
  assertBoolean,
  assertEnum,
  assertEnumArray,
  assertInteger,
  assertPlainObject,
  assertRequiredKeys,
  assertString,
  assertStringArray,
  clone,
  deepFreeze,
  scanPhase6ForbiddenFields
} from './base.mjs';

const commonPolicy = deepFreeze({
  executionEnabled: false,
  runnable: false,
  resourcePolicy: {
    id: 'formal-bounded-v1',
    cpuCoresMax: 2,
    memoryBytesMax: 2_147_483_648,
    outputBytesMax: PHASE6_BOUNDS.inputBytes,
    artifactBytesMax: 8_388_608,
    processCountMax: 1,
    wallClockSecondsMax: 900
  },
  networkPolicy: {
    id: 'network-none-v1',
    enabled: false,
    destinations: []
  },
  timeoutPolicy: {
    queryTimeoutRequired: true,
    hardJobTimeoutSeconds: 900,
    terminalOutcome: 'timeout',
    preserveBoundedEvidence: true
  },
  cancellationPolicy: {
    terminalOutcome: 'cancelled',
    preserveBoundedEvidence: true,
    executionSignal: 'future-executor-contract-only',
    parserMayOnlyConsumeSuppliedBytes: true
  },
  evidenceContract: {
    schemaVersion: 'formal-evidence-v1',
    required: ['profileId', 'outcome', 'obligations', 'diagnostics', 'parserWarnings'],
    digestAlgorithm: 'sha256',
    maxEvidenceBytes: 8_388_608
  },
  artifactContract: {
    schemaVersion: 'formal-artifact-manifest-v1',
    allowedKinds: ['normalized-result', 'bounded-model', 'bounded-trace', 'bounded-counterexample', 'parser-snapshot'],
    maxArtifacts: 32,
    maxArtifactBytes: 8_388_608
  },
  executor: {
    available: false,
    status: 'unavailable',
    contractVersion: null
  },
  publication: {
    status: 'unpublished',
    imageDigest: null,
    releaseIdentifier: null,
    requirements: [
      'real immutable sha256 GHCR digest',
      'accepted orchestrator integration',
      'execution feature remains disabled'
    ]
  }
});

function profileTemplate(profile) {
  return deepFreeze({ ...clone(commonPolicy), ...profile });
}

export const PHASE6_PROFILE_TEMPLATES = deepFreeze({
  'solidity-smt-v1': profileTemplate({
    profileId: 'solidity-smt-v1',
    contractVersion: 1,
    purpose: 'Solidity SMTChecker result contract and bounded capture parser',
    versions: {
      tool: {
        name: 'Solidity SMTChecker',
        version: '0.8.30',
        releaseIdentifier: 'v0.8.30',
        officialSource: 'https://github.com/ethereum/solidity/releases/tag/v0.8.30',
        retrievalDate: '2026-08-01'
      },
      compiler: {
        name: 'solc',
        version: '0.8.30',
        releaseIdentifier: 'v0.8.30',
        officialSource: 'https://github.com/ethereum/solidity/releases/tag/v0.8.30',
        retrievalDate: '2026-08-01'
      },
      solver: {
        name: 'z3-solver',
        version: '4.12.6.0',
        releaseIdentifier: 'z3-4.12.6',
        officialSource: 'https://github.com/Z3Prover/z3/releases/tag/z3-4.12.6',
        retrievalDate: '2026-08-01'
      }
    },
    compatibility: {
      decision: 'candidate',
      relationship: 'Solidity documents Z3 >=4.8.16 with solc >=0.8.14; solc 0.8.30 satisfies that lower bound. Z3 4.12.6.0 is selected to align with Halmos 0.3.3.',
      verifiedByExecution: false
    },
    determinism: {
      seedBehavior: 'not_applicable',
      ordering: 'canonical',
      queryLimitBehavior: 'explicit timeout required'
    }
  }),
  'halmos-v1': profileTemplate({
    profileId: 'halmos-v1',
    contractVersion: 1,
    purpose: 'Halmos symbolic result contract and bounded capture parser',
    versions: {
      tool: {
        name: 'halmos',
        version: '0.3.3',
        releaseIdentifier: 'v0.3.3',
        officialSource: 'https://github.com/a16z/halmos/tree/v0.3.3',
        retrievalDate: '2026-08-01'
      },
      compiler: {
        name: 'solc',
        version: '0.8.30',
        releaseIdentifier: 'v0.8.30',
        officialSource: 'https://github.com/ethereum/solidity/releases/tag/v0.8.30',
        retrievalDate: '2026-08-01'
      },
      solver: {
        name: 'z3-solver',
        version: '4.12.6.0',
        releaseIdentifier: 'z3-4.12.6',
        officialSource: 'https://github.com/a16z/halmos/blob/v0.3.3/pyproject.toml',
        retrievalDate: '2026-08-01'
      }
    },
    compatibility: {
      decision: 'candidate',
      relationship: 'Halmos v0.3.3 declares Python >=3.11 and pins z3-solver==4.12.6.0. Its Solidity/Foundry frontend is official, but the exact solc 0.8.30 composition remains execution-unverified.',
      verifiedByExecution: false
    },
    determinism: {
      seedBehavior: 'not_applicable',
      ordering: 'canonical model and trace ordering',
      pathBoundsRequired: true
    }
  }),
  'formal-obligations-v1': profileTemplate({
    profileId: 'formal-obligations-v1',
    contractVersion: 1,
    purpose: 'CurveYield normalized proof-obligation interchange contract',
    versions: {
      tool: {
        name: 'curveyield-formal-obligations',
        version: '1.0.0',
        releaseIdentifier: 'formal-obligations-v1',
        officialSource: 'https://github.com/CurveYield/contract-automation/issues/48',
        retrievalDate: '2026-08-01'
      },
      compiler: { applicable: false, name: null, version: null, releaseIdentifier: null, officialSource: null, retrievalDate: '2026-08-01' },
      solver: { applicable: false, name: null, version: null, releaseIdentifier: null, officialSource: null, retrievalDate: '2026-08-01' }
    },
    compatibility: {
      decision: 'internal-schema-only',
      relationship: 'No compiler or solver is used by this normalization-only profile.',
      verifiedByExecution: false
    },
    determinism: {
      seedBehavior: 'not_applicable',
      ordering: 'canonical identifier ordering',
      deduplication: 'identifier and content stable'
    }
  })
});

function validateSmtConfiguration(value) {
  const required = new Set(['engine', 'solver', 'targets', 'timeoutMs', 'showProvedSafe', 'showUnproved', 'showUnsupported']);
  assertAllowedKeys(value, required, '$');
  assertRequiredKeys(value, required, '$');
  assertEnum(value.engine, ['all', 'bmc', 'chc'], '$.engine');
  assertEnum(value.solver, ['z3'], '$.solver');
  const targets = assertEnumArray(value.targets, SMT_TARGETS, '$.targets', SMT_TARGETS.length);
  if (targets.length === 0) throw new Phase6ValidationError('invalid_collection', '$.targets must not be empty', '$.targets');
  assertInteger(value.timeoutMs, '$.timeoutMs', 1, 120_000);
  assertBoolean(value.showProvedSafe, '$.showProvedSafe');
  assertBoolean(value.showUnproved, '$.showUnproved');
  assertBoolean(value.showUnsupported, '$.showUnsupported');
  return clone(value);
}

function validateHalmosConfiguration(value) {
  const allowed = new Set(['solver', 'solverTimeoutMs', 'loopBound', 'maxPaths', 'traceEvents', 'functionSelectors', 'arrayLengths']);
  const required = new Set(['solver', 'solverTimeoutMs', 'loopBound', 'maxPaths', 'traceEvents']);
  assertAllowedKeys(value, allowed, '$');
  assertRequiredKeys(value, required, '$');
  assertEnum(value.solver, ['z3'], '$.solver');
  assertInteger(value.solverTimeoutMs, '$.solverTimeoutMs', 1, 120_000);
  assertInteger(value.loopBound, '$.loopBound', 1, 64);
  assertInteger(value.maxPaths, '$.maxPaths', 1, 100_000);
  assertEnumArray(value.traceEvents, TRACE_EVENTS, '$.traceEvents', TRACE_EVENTS.length);
  if ('functionSelectors' in value) assertStringArray(value.functionSelectors, '$.functionSelectors', 64, 160, true);
  if ('arrayLengths' in value) {
    assertPlainObject(value.arrayLengths, '$.arrayLengths');
    if (Object.keys(value.arrayLengths).length > 64) throw new Phase6ValidationError('invalid_collection', '$.arrayLengths has too many keys', '$.arrayLengths');
    for (const [name, lengths] of Object.entries(value.arrayLengths)) {
      assertString(name, `$.arrayLengths.${name}`, 160);
      if (!Array.isArray(lengths) || lengths.length < 1 || lengths.length > 16) {
        throw new Phase6ValidationError('invalid_collection', `$.arrayLengths.${name} must contain 1 to 16 lengths`, `$.arrayLengths.${name}`);
      }
      lengths.forEach((length, index) => assertInteger(length, `$.arrayLengths.${name}[${index}]`, 0, 4_096));
    }
  }
  return clone(value);
}

function validateObligationConfiguration(value) {
  const required = new Set(['normalizationMode', 'deduplicate', 'canonicalSort', 'maxObligations', 'maxAssertions']);
  assertAllowedKeys(value, required, '$');
  assertRequiredKeys(value, required, '$');
  assertEnum(value.normalizationMode, ['strict'], '$.normalizationMode');
  assertBoolean(value.deduplicate, '$.deduplicate');
  assertBoolean(value.canonicalSort, '$.canonicalSort');
  assertInteger(value.maxObligations, '$.maxObligations', 1, PHASE6_BOUNDS.obligations);
  assertInteger(value.maxAssertions, '$.maxAssertions', 1, PHASE6_BOUNDS.assertions);
  return clone(value);
}

export function validatePhase6ProfileConfiguration(profileId, value) {
  assertEnum(profileId, PROFILE_IDS, '$.profileId');
  assertPlainObject(value, '$');
  scanPhase6ForbiddenFields(value);
  if (profileId === 'solidity-smt-v1') return validateSmtConfiguration(value);
  if (profileId === 'halmos-v1') return validateHalmosConfiguration(value);
  return validateObligationConfiguration(value);
}

export function publishPhase6Profile(profileId, publication) {
  assertEnum(profileId, PROFILE_IDS, '$.profileId');
  assertPlainObject(publication, '$.publication');
  scanPhase6ForbiddenFields(publication, '$.publication');
  const allowed = new Set(['imageDigest', 'releaseIdentifier']);
  assertAllowedKeys(publication, allowed, '$.publication');
  if (typeof publication.imageDigest !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(publication.imageDigest)) {
    throw new Phase6ValidationError('invalid_image_digest', '$.publication.imageDigest must be a real lowercase sha256 digest', '$.publication.imageDigest');
  }
  assertRequiredKeys(publication, allowed, '$.publication');
  assertString(publication.releaseIdentifier, '$.publication.releaseIdentifier', 160);
  const template = clone(PHASE6_PROFILE_TEMPLATES[profileId]);
  const expectedReleaseIdentifier = template.versions.tool.releaseIdentifier;
  if (publication.releaseIdentifier !== expectedReleaseIdentifier) {
    throw new Phase6ValidationError(
      'invalid_release_identifier',
      '$.publication.releaseIdentifier must exactly match the immutable profile template',
      '$.publication.releaseIdentifier'
    );
  }
  template.publication = {
    ...template.publication,
    status: 'published',
    imageDigest: publication.imageDigest,
    releaseIdentifier: publication.releaseIdentifier
  };
  template.runnable = false;
  template.executionEnabled = false;
  template.executor = { available: false, status: 'unavailable', contractVersion: null };
  return deepFreeze(template);
}
