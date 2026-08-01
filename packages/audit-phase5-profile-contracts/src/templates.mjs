export const MAX_UINT32 = 4_294_967_295;
const RETRIEVED_ON = '2026-08-01';
export const TEST_MODES = new Set(['property', 'assertion', 'foundry', 'overflow', 'optimization', 'exploration']);
export const MUTATION_OPERATORS = new Set([
  'binary-op-mutation',
  'unary-operator-mutation',
  'require-mutation',
  'assignment-mutation',
  'delete-expression-mutation',
  'if-cond-mutation',
  'swap-arguments-operator-mutation',
  'elim-delegate-mutation'
]);
export const SEVERITIES = new Set(['low', 'moderate', 'high', 'critical']);
export const LOCKFILE_NAMES = new Set([
  'package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml',
  'bun.lock', 'bun.lockb', 'Cargo.lock', 'go.sum', 'requirements.txt',
  'poetry.lock', 'Pipfile.lock', 'Gemfile.lock', 'composer.lock'
]);

export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function template({
  profileId,
  registryRepository,
  tool,
  adapterVersion,
  parserVersion,
  programId,
  resourcePolicy,
  seedPolicy,
  timeoutContract,
  evidenceContract,
  artifactContract,
  configurationFields,
  fixedRuntimeContract = {}
}) {
  return deepFreeze({
    schemaVersion: 'phase5-tool-profile-template-v1',
    profileId,
    publicationState: 'unpublished',
    executionEnabled: false,
    executorState: 'unavailable',
    registryRepository,
    digestRequired: true,
    tool,
    adapterVersion,
    parserVersion,
    programId,
    resourcePolicy,
    networkPolicy: {
      policyId: 'audit-network-deny-v1',
      mode: 'deny-all',
      allowedDestinations: []
    },
    seedPolicy,
    timeoutContract,
    cancellationContract: {
      policyId: 'cooperative-then-hard-stop-v1',
      requestedState: 'cancellation_requested',
      terminalState: 'cancelled',
      graceSeconds: 10,
      executionAvailable: false
    },
    evidenceContract,
    artifactContract,
    configurationFields,
    fixedRuntimeContract
  });
}

const tool = (name, version, releaseId, releaseCommit, officialSource) => ({
  name,
  version,
  releaseId,
  releaseCommit,
  officialSource,
  retrievedOn: RETRIEVED_ON
});

const resource = (policyId, cpuMillis, memoryBytes, outputBytes, processCount) => ({
  policyId,
  cpuMillis,
  memoryBytes,
  outputBytes,
  processCount
});

const timeout = (policyId, minimumSeconds, defaultSeconds, maximumSeconds) => ({
  policyId,
  minimumSeconds,
  defaultSeconds,
  maximumSeconds,
  terminalClassification: 'timeout'
});

const evidence = (schemaVersion, allowedTypes) => ({
  schemaVersion,
  allowedTypes,
  maximumEntries: 10_000,
  deterministicOrdering: true
});

const artifacts = (schemaVersion, allowedNames) => ({
  schemaVersion,
  allowedNames,
  maximumArtifacts: allowedNames.length,
  maximumArtifactBytes: 16_777_216,
  submittedPathsAllowed: false
});

export const PHASE5_PROFILE_IDS = Object.freeze([
  'hardhat-test-v1',
  'echidna-v1',
  'mutation-v1',
  'dependency-scan-v1'
]);

export const PHASE5_PROFILE_TEMPLATES = Object.freeze([
  template({
    profileId: 'hardhat-test-v1',
    registryRepository: 'ghcr.io/curveyield/audit-hardhat-test',
    tool: tool(
      'hardhat', '3.6.0', 'hardhat@3.6.0',
      'd6f606b4f3c47d6fa6de6cce83dd87b966bb425d',
      'https://github.com/NomicFoundation/hardhat/releases/tag/hardhat%403.6.0'
    ),
    adapterVersion: 'hardhat-test-adapter-v1',
    parserVersion: 'hardhat-test-parser-v1',
    programId: 'hardhat-test-json-v1',
    resourcePolicy: resource('audit-phase5-standard-2cpu-4g-v1', 3_600_000, 4_294_967_296, 16_777_216, 64),
    seedPolicy: { policyId: 'no-random-seed-v1', mode: 'none', deterministic: true },
    timeoutContract: timeout('hardhat-test-timeout-v1', 1, 600, 3_600),
    evidenceContract: evidence('phase5-hardhat-test-evidence-v1', ['test-case', 'failure-message', 'summary']),
    artifactContract: artifacts('phase5-hardhat-test-artifacts-v1', ['hardhat-test-result-v1.json', 'hardhat-test-stderr-v1.txt']),
    configurationFields: ['testFiles', 'grep', 'bail', 'parallel', 'concurrency'],
    fixedRuntimeContract: { compilationAllowed: false, submittedScriptsAllowed: false, packageInstallationAllowed: false }
  }),
  template({
    profileId: 'echidna-v1',
    registryRepository: 'ghcr.io/curveyield/audit-echidna',
    tool: tool(
      'echidna', '2.3.2', 'v2.3.2',
      '7cbb32f3ff558d8e0b6e249c199831915c971d76',
      'https://github.com/crytic/echidna/releases/tag/v2.3.2'
    ),
    adapterVersion: 'echidna-adapter-v1',
    parserVersion: 'echidna-parser-v1',
    programId: 'echidna-json-v1',
    resourcePolicy: resource('audit-phase5-intensive-4cpu-8g-v1', 14_400_000, 8_589_934_592, 33_554_432, 128),
    seedPolicy: { policyId: 'explicit-uint32-seed-v1', mode: 'required', minimum: 0, maximum: MAX_UINT32, deterministic: true },
    timeoutContract: timeout('echidna-timeout-v1', 1, 1_800, 7_200),
    evidenceContract: evidence('phase5-echidna-evidence-v1', ['property', 'counterexample', 'campaign-summary']),
    artifactContract: artifacts('phase5-echidna-artifacts-v1', ['echidna-result-v1.json', 'echidna-counterexamples-v1.json']),
    configurationFields: ['testMode', 'testLimit', 'sequenceLength', 'shrinkLimit', 'seed', 'workers'],
    fixedRuntimeContract: { outputFormat: 'json', corpusWritesAllowed: false, networkStateAllowed: false }
  }),
  template({
    profileId: 'mutation-v1',
    registryRepository: 'ghcr.io/curveyield/audit-gambit-mutation',
    tool: tool(
      'gambit', '1.0.6', 'v1.0.6',
      '072ff4c6d747397f859e0a15a20fe1ff05672332',
      'https://github.com/Certora/gambit/releases/tag/v1.0.6'
    ),
    adapterVersion: 'mutation-adapter-v1',
    parserVersion: 'mutation-parser-v1',
    programId: 'gambit-mutation-harness-v1',
    resourcePolicy: resource('audit-phase5-intensive-4cpu-8g-v1', 14_400_000, 8_589_934_592, 33_554_432, 128),
    seedPolicy: { policyId: 'explicit-uint32-seed-default-zero-v1', mode: 'required', minimum: 0, maximum: MAX_UINT32, default: 0, deterministic: true },
    timeoutContract: timeout('mutation-timeout-v1', 1, 1_800, 7_200),
    evidenceContract: evidence('phase5-mutation-evidence-v1', ['mutant', 'kill', 'survivor', 'mutation-summary']),
    artifactContract: artifacts('phase5-mutation-artifacts-v1', ['mutation-result-v1.json', 'mutation-manifest-v1.json']),
    configurationFields: ['sourceFiles', 'mutationOperators', 'maxMutants', 'seed', 'validateMutants'],
    fixedRuntimeContract: { testHarnessProfileId: 'hardhat-test-v1', randomSamplingAllowed: false, sourceMutationPersistenceAllowed: false }
  }),
  template({
    profileId: 'dependency-scan-v1',
    registryRepository: 'ghcr.io/curveyield/audit-osv-scanner',
    tool: tool(
      'osv-scanner', '2.3.8', 'v2.3.8',
      '408fcd6f8707999a29e7ba45e15809764cf24f67',
      'https://github.com/google/osv-scanner/releases/tag/v2.3.8'
    ),
    adapterVersion: 'dependency-scan-adapter-v1',
    parserVersion: 'dependency-scan-parser-v1',
    programId: 'osv-scanner-offline-json-v1',
    resourcePolicy: resource('audit-phase5-standard-2cpu-4g-v1', 3_600_000, 4_294_967_296, 33_554_432, 64),
    seedPolicy: { policyId: 'no-random-seed-v1', mode: 'none', deterministic: true },
    timeoutContract: timeout('dependency-scan-timeout-v1', 1, 300, 1_800),
    evidenceContract: evidence('phase5-dependency-scan-evidence-v1', ['package', 'vulnerability', 'scan-summary']),
    artifactContract: artifacts('phase5-dependency-scan-artifacts-v1', ['dependency-scan-result-v1.json', 'advisory-snapshot-manifest-v1.json']),
    configurationFields: ['lockfiles', 'includeDevDependencies', 'minimumSeverity', 'failOnFindings'],
    fixedRuntimeContract: { advisoryMode: 'offline-snapshot', packageInstallationAllowed: false, lockfileMutationAllowed: false }
  })
]);

export const TEMPLATE_BY_ID = new Map(PHASE5_PROFILE_TEMPLATES.map((item) => [item.profileId, item]));
