#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildGitHubNativeJobFromDeepAssuranceRequest, validateDeepAssuranceRequest } from './deep-assurance-request.mjs';

const MAX_SOURCE_FILES = 5_000;
const MAX_SOURCE_FILE_BYTES = 2 * 1024 * 1024;
const MAX_SOURCE_BYTES = 100 * 1024 * 1024;

function json(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }

async function walkSolidity(root, current = root, files = []) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (entry.name === '.git') continue;
    const absolute = path.join(current, entry.name);
    const metadata = await fs.lstat(absolute);
    if (metadata.isSymbolicLink()) throw new TypeError(`Source tree contains a forbidden symlink: ${path.relative(root, absolute)}`);
    if (metadata.isDirectory()) {
      await walkSolidity(root, absolute, files);
      continue;
    }
    if (!metadata.isFile()) throw new TypeError(`Source tree contains an unsupported file type: ${path.relative(root, absolute)}`);
    if (!entry.name.endsWith('.sol')) continue;
    if (metadata.size > MAX_SOURCE_FILE_BYTES) throw new TypeError(`Solidity source is too large: ${path.relative(root, absolute)}`);
    files.push({ absolute, relative: path.relative(root, absolute).split(path.sep).join('/'), size: metadata.size });
    if (files.length > MAX_SOURCE_FILES) throw new TypeError(`Source tree exceeds ${MAX_SOURCE_FILES} Solidity files`);
  }
  return files;
}

function resolveProjectRoot(sourceCheckoutRoot, projectPath) {
  const sourceRoot = path.resolve(sourceCheckoutRoot);
  const projectRoot = projectPath === '.' ? sourceRoot : path.resolve(sourceRoot, ...projectPath.split('/'));
  if (projectRoot !== sourceRoot && !projectRoot.startsWith(`${sourceRoot}${path.sep}`)) {
    throw new TypeError('source.projectPath is outside the source checkout');
  }
  return projectRoot;
}

export async function prepareDeepAssuranceJob({ request, expectedRunnerManifestSha256, sourceCheckoutRoot, verifiedSourceCommit, outputRoot }) {
  const validated = validateDeepAssuranceRequest(request, { expectedRunnerManifestSha256 });
  if (verifiedSourceCommit !== validated.source.commit) throw new TypeError('Verified source commit does not match the request');
  const projectRoot = resolveProjectRoot(sourceCheckoutRoot, validated.source.projectPath);
  const projectMetadata = await fs.lstat(projectRoot);
  if (!projectMetadata.isDirectory() || projectMetadata.isSymbolicLink()) throw new TypeError('Requested source projectPath is not a regular directory');
  const sourceFiles = await walkSolidity(projectRoot);
  if (sourceFiles.length === 0) throw new TypeError('Requested source project contains no Solidity files');
  const totalBytes = sourceFiles.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_SOURCE_BYTES) throw new TypeError('Solidity source exceeds the total byte limit');

  const absoluteOutput = path.resolve(outputRoot);
  await fs.rm(absoluteOutput, { recursive: true, force: true });
  await fs.mkdir(path.join(absoluteOutput, 'project'), { recursive: true });
  const manifestFiles = [];
  for (const file of sourceFiles) {
    const bytes = await fs.readFile(file.absolute);
    const destination = path.join(absoluteOutput, 'project', ...file.relative.split('/'));
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, bytes, { flag: 'wx', mode: 0o600 });
    manifestFiles.push({ path: file.relative, size: bytes.length, sha256: sha256(bytes) });
  }

  const job = buildGitHubNativeJobFromDeepAssuranceRequest(validated);
  const sourceManifest = {
    schemaVersion: 'deep-assurance-source-manifest-v1',
    requestId: validated.requestId,
    requestDigest: validated.requestDigest,
    source: validated.source,
    fileCount: manifestFiles.length,
    totalBytes,
    files: manifestFiles
  };
  await fs.writeFile(path.join(absoluteOutput, 'job.json'), json(job), { flag: 'wx' });
  await fs.writeFile(path.join(absoluteOutput, 'request.json'), json(validated), { flag: 'wx' });
  await fs.writeFile(path.join(absoluteOutput, 'source-manifest.json'), json(sourceManifest), { flag: 'wx' });
  return { request: validated, job, sourceManifest, outputRoot: absoluteOutput };
}

function parseArgs(args) {
  const allowed = new Set(['--request', '--source', '--source-commit', '--output', '--runner-manifest-sha256']);
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!allowed.has(key) || value === undefined) throw new TypeError(`Invalid argument: ${key ?? '<missing>'}`);
    values[key] = value;
  }
  for (const key of allowed) if (!(key in values)) throw new TypeError(`${key} is required`);
  return values;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const request = JSON.parse(await fs.readFile(args['--request'], 'utf8'));
  const prepared = await prepareDeepAssuranceJob({
    request,
    expectedRunnerManifestSha256: args['--runner-manifest-sha256'],
    sourceCheckoutRoot: args['--source'],
    verifiedSourceCommit: args['--source-commit'],
    outputRoot: args['--output']
  });
  process.stdout.write(`${JSON.stringify({ requestId: prepared.request.requestId, jobPath: path.join(prepared.outputRoot, 'job.json') })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((cause) => { process.stderr.write(`${cause?.message ?? String(cause)}\n`); process.exitCode = 1; });
}
