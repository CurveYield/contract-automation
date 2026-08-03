import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEEP_ASSURANCE_RUNNER_RELEASE_FILES = Object.freeze([
  '.github/workflows/deep-assurance-github-request-v1.yml',
  'packages/github-native-sim/src/deep-assurance-request.mjs',
  'packages/github-native-sim/src/inspect-deep-assurance-request.mjs',
  'packages/github-native-sim/src/prepare-deep-assurance-job.mjs',
  'packages/github-native-sim/src/finalize-deep-assurance-result.mjs',
  'packages/github-native-sim/src/publish-deep-assurance-status.mjs',
  'packages/github-native-sim/src/verify-deep-assurance-runner-release.mjs'
]);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function repositoryPath(value) {
  return value instanceof URL ? fileURLToPath(value) : value;
}

export async function buildDeepAssuranceRunnerManifest(repositoryRoot) {
  const root = path.resolve(repositoryPath(repositoryRoot));
  const files = {};
  for (const file of DEEP_ASSURANCE_RUNNER_RELEASE_FILES) {
    const absolute = path.resolve(root, ...file.split('/'));
    if (!absolute.startsWith(`${root}${path.sep}`)) throw new TypeError(`Runner release path escapes repository: ${file}`);
    const metadata = await fs.lstat(absolute);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new TypeError(`Runner release entry is not a regular file: ${file}`);
    files[file] = sha256(await fs.readFile(absolute));
  }
  return Object.freeze({
    schemaVersion: 'deep-assurance-runner-release-v1',
    releaseVersion: 'deep-assurance-github-bridge-v1',
    baseContractAutomationCommit: 'ad11d7d5a623c1411cbabb4bb0cd9acf7975bce8',
    files
  });
}
