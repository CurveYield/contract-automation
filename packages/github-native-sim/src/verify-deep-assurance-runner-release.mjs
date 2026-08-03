#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function plainObject(value, field) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
}

export async function verifyDeepAssuranceRunnerRelease({ repositoryRoot, manifestPath }) {
  const root = path.resolve(repositoryRoot);
  const absoluteManifest = path.resolve(root, manifestPath);
  if (!absoluteManifest.startsWith(`${root}${path.sep}`)) throw new TypeError('Runner release manifest is outside repository root');
  const manifestBytes = await fs.readFile(absoluteManifest);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  plainObject(manifest, '$');
  if (manifest.schemaVersion !== 'deep-assurance-runner-release-v1') throw new TypeError('Runner release manifest schemaVersion is invalid');
  if (manifest.releaseVersion !== 'deep-assurance-github-bridge-v1') throw new TypeError('Runner release version is invalid');
  if (manifest.baseContractAutomationCommit !== 'ad11d7d5a623c1411cbabb4bb0cd9acf7975bce8') throw new TypeError('Runner base release is invalid');
  plainObject(manifest.files, '$.files');
  if (Object.keys(manifest.files).length < 5) throw new TypeError('Runner release manifest is incomplete');
  for (const [file, expectedDigest] of Object.entries(manifest.files)) {
    if (path.isAbsolute(file) || file.includes('\\') || file.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
      throw new TypeError(`Runner release file path is unsafe: ${file}`);
    }
    if (!/^[0-9a-f]{64}$/.test(expectedDigest)) throw new TypeError(`Runner release digest is invalid: ${file}`);
    const absolute = path.resolve(root, ...file.split('/'));
    if (!absolute.startsWith(`${root}${path.sep}`)) throw new TypeError(`Runner release file is outside repository: ${file}`);
    const metadata = await fs.lstat(absolute);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new TypeError(`Runner release entry is not a regular file: ${file}`);
    const actualDigest = sha256(await fs.readFile(absolute));
    if (actualDigest !== expectedDigest) throw new TypeError(`Runner release digest mismatch: ${file}`);
  }
  return Object.freeze({ manifest, manifestSha256: sha256(manifestBytes) });
}

async function main() {
  const [repositoryRoot, manifestPath] = process.argv.slice(2);
  if (!repositoryRoot || !manifestPath) throw new TypeError('Usage: verify-deep-assurance-runner-release.mjs <repository-root> <manifest-path>');
  const verified = await verifyDeepAssuranceRunnerRelease({ repositoryRoot, manifestPath });
  process.stdout.write(`${JSON.stringify({ releaseVersion: verified.manifest.releaseVersion, manifestSha256: verified.manifestSha256 })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((cause) => { process.stderr.write(`${cause?.message ?? String(cause)}\n`); process.exitCode = 1; });
}
