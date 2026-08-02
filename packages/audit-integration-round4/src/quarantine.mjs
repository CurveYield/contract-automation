import {
  ROUND4_PRELIMINARY_OWNERSHIP,
  validatePathOwnershipRegistry
} from './index.mjs';

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
function overlap(left, right) {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}
function readDataObject(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    const error = new Error(`${path} must be an object`);
    error.code = 'invalid_object';
    error.path = path;
    throw error;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    const error = new Error(`${path} must be an ordinary object`);
    error.code = 'invalid_object';
    error.path = path;
    throw error;
  }
  const output = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === 'symbol') {
      const error = new Error(`${path} contains a symbol field`);
      error.code = 'symbol_field';
      error.path = path;
      throw error;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) {
      const error = new Error(`${path}.${key} must be an enumerable data property`);
      error.code = 'accessor_field';
      error.path = `${path}.${key}`;
      throw error;
    }
    output[key] = descriptor.value;
  }
  return output;
}
function validateQuarantinedPaths(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    const error = new Error('$.quarantinedPaths must be an ordinary array');
    error.code = 'invalid_array';
    error.path = '$.quarantinedPaths';
    throw error;
  }
  const paths = value.map((entry, index) => {
    if (typeof entry !== 'string' || entry.length < 1 || entry.startsWith('/') || entry.includes('//') || entry.split('/').includes('..')) {
      const error = new Error(`$.quarantinedPaths[${index}] is invalid`);
      error.code = 'unsafe_path';
      error.path = `$.quarantinedPaths[${index}]`;
      throw error;
    }
    return entry.replaceAll('\\', '/');
  });
  if (new Set(paths).size !== paths.length) {
    const error = new Error('$.quarantinedPaths contains duplicates');
    error.code = 'duplicate_value';
    error.path = '$.quarantinedPaths';
    throw error;
  }
  return paths.sort();
}

export const ROUND4_EXTERNAL_QUARANTINE = deepFreeze({
  schemaVersion: 'round4-external-workstream-quarantine-v1',
  pullRequestNumber: 126,
  title: 'Upgrade simulations to configurable live-fork multi-RPC routing',
  state: 'active-draft',
  baseSha: '3f68cc1b12cc7f9a84e4cb04b768c049138814c6',
  headSha: 'bc3b94c5a48192f5c1cc6e167794a5460ac661ec',
  changedFileCount: 20,
  paths: [
    '.github/workflows/export-v27-hardhat-harness.yml',
    '.github/workflows/live-fork-upgrade-ci.yml',
    'docs/superpowers/plans/2026-08-02-live-fork-multi-rpc-routing.md',
    'docs/superpowers/specs/2026-08-02-live-fork-multi-rpc-routing-design.md',
    'packages/github-native-sim/src/run-job-file.mjs',
    'packages/github-native-sim/src/schema.mjs',
    'packages/github-native-sim/test/run-job-file.test.mjs',
    'packages/protocol/src/index.mjs',
    'packages/protocol/src/simulation-config.mjs',
    'packages/runner/src/archive-rpc-pool.mjs',
    'packages/runner/src/fork-engine.mjs',
    'packages/runner/src/live-fork-proxy.mjs',
    'packages/runner/src/live-fork-runtime.mjs',
    'packages/runner/src/live-fork-time.mjs',
    'packages/runner/src/run-job.mjs',
    'packages/runner/test/archive-rpc-pool.test.mjs',
    'packages/runner/test/live-fork-config.test.mjs',
    'packages/runner/test/live-fork-proxy.test.mjs',
    'packages/runner/test/live-fork-runtime-actions.test.mjs',
    'packages/runner/test/run-job-live-fork.test.mjs'
  ].sort(),
  releaseConditions: [
    'James declares PR 126 complete',
    'the exact final PR head is independently reviewed',
    'an explicit integration authorization replaces the quarantine event',
    'all affected protected baselines and intake manifests are regenerated'
  ]
});

export const ROUND4_STAGE0_OWNERSHIP = deepFreeze({
  ...ROUND4_PRELIMINARY_OWNERSHIP,
  quarantinedPaths: ROUND4_EXTERNAL_QUARANTINE.paths
});

export function validateStage0PathOwnershipRegistry(input) {
  const source = readDataObject(input, '$');
  const expected = ['schemaVersion', 'domains', 'protectedPaths', 'sharedFiles', 'quarantinedPaths'];
  const actual = Object.keys(source).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
    const error = new Error('$ has an invalid field set');
    error.code = 'invalid_field_set';
    error.path = '$';
    throw error;
  }

  const base = validatePathOwnershipRegistry({
    schemaVersion: source.schemaVersion,
    domains: source.domains,
    protectedPaths: source.protectedPaths,
    sharedFiles: source.sharedFiles
  });
  const quarantinedPaths = validateQuarantinedPaths(source.quarantinedPaths);
  if (JSON.stringify(quarantinedPaths) !== JSON.stringify(ROUND4_EXTERNAL_QUARANTINE.paths)) {
    const error = new Error('$.quarantinedPaths does not match the active PR 126 quarantine');
    error.code = 'quarantine_mismatch';
    error.path = '$.quarantinedPaths';
    throw error;
  }

  for (const domain of base.domains) {
    for (const claim of [...domain.ownedPrefixes, ...domain.ownedFiles]) {
      if (quarantinedPaths.some((path) => overlap(path, claim))) {
        const error = new Error(`${claim} is quarantined by PR 126`);
        error.code = 'quarantined_path';
        error.path = '$.domains';
        throw error;
      }
    }
  }

  return deepFreeze({ ...base, quarantinedPaths });
}
