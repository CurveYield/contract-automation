#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateDeepAssuranceRequest } from './deep-assurance-request.mjs';

function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function json(value) { return `${JSON.stringify(value, null, 2)}\n`; }

async function walkRegularFiles(root, current = root, files = []) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    if (relative === 'deep-assurance-result-v1.json' || relative === 'deep-assurance-artifact-manifest-v1.json') continue;
    const metadata = await fs.lstat(absolute);
    if (metadata.isSymbolicLink()) throw new TypeError(`Output contains a forbidden symlink: ${relative}`);
    if (metadata.isDirectory()) await walkRegularFiles(root, absolute, files);
    else if (metadata.isFile()) files.push({ absolute, relative, size: metadata.size });
    else throw new TypeError(`Output contains an unsupported file type: ${relative}`);
  }
  return files;
}

function artifactRef({ repository, runId, artifactName, file }) {
  return `github-actions://${repository}/runs/${runId}/artifacts/${artifactName}/${file}`;
}

export async function finalizeDeepAssuranceOutput({ request, expectedRunnerManifestSha256, outputRoot, repository, runId, artifactName, nodeVersion }) {
  const validated = validateDeepAssuranceRequest(request, { expectedRunnerManifestSha256 });
  if (!/^[1-9]\d*$/.test(String(runId))) throw new TypeError('runId must be a positive integer string');
  if (typeof repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new TypeError('repository is invalid');
  if (typeof artifactName !== 'string' || !/^[A-Za-z0-9._-]{1,200}$/.test(artifactName)) throw new TypeError('artifactName is invalid');
  if (typeof nodeVersion !== 'string' || nodeVersion.length === 0) throw new TypeError('nodeVersion is required');
  const root = path.resolve(outputRoot);
  let runnerResult;
  try {
    runnerResult = JSON.parse(await fs.readFile(path.join(root, 'result.json'), 'utf8'));
  } catch (cause) {
    runnerResult = { jobId: validated.requestId, status: 'failed', error: { message: `runner result unavailable: ${cause?.message ?? String(cause)}` } };
    await fs.writeFile(path.join(root, 'result.json'), json(runnerResult));
  }
  if (runnerResult.jobId !== validated.requestId) throw new TypeError('Runner result jobId does not match the request');
  const expectedMode = validated.profileId === 'github-native-compile-v1' ? 'compile' : 'simulate';
  if (runnerResult.mode !== undefined && runnerResult.mode !== expectedMode) throw new TypeError('Runner result mode does not match the request');

  const files = await walkRegularFiles(root);
  const manifestFiles = [];
  for (const file of files) {
    const bytes = await fs.readFile(file.absolute);
    manifestFiles.push({ path: file.relative, size: bytes.length, sha256: sha256(bytes) });
  }
  const manifest = {
    schemaVersion: 'deep-assurance-artifact-manifest-v1',
    requestId: validated.requestId,
    requestDigest: validated.requestDigest,
    source: validated.source,
    files: manifestFiles
  };
  const manifestBytes = Buffer.from(json(manifest));
  const manifestFile = 'deep-assurance-artifact-manifest-v1.json';
  await fs.writeFile(path.join(root, manifestFile), manifestBytes);
  const manifestDigest = sha256(manifestBytes);
  const runnerResultFile = 'result.json';
  const runnerDigest = sha256(await fs.readFile(path.join(root, runnerResultFile)));
  const evidenceRefs = [
    {
      class: 'exact-source-execution-result',
      ref: artifactRef({ repository, runId: String(runId), artifactName, file: runnerResultFile }),
      sha256: runnerDigest,
      sourceCommit: validated.source.commit
    },
    {
      class: 'artifact-manifest',
      ref: artifactRef({ repository, runId: String(runId), artifactName, file: manifestFile }),
      sha256: manifestDigest,
      sourceCommit: validated.source.commit
    }
  ];
  for (const optional of ['compiler-output.json', 'compiler-diagnostics.json', 'report.html', 'source-manifest.json']) {
    const entry = manifestFiles.find((file) => file.path === optional);
    if (entry) evidenceRefs.push({
      class: optional.replace(/\.[^.]+$/, '').replaceAll('_', '-'),
      ref: artifactRef({ repository, runId: String(runId), artifactName, file: optional }),
      sha256: entry.sha256,
      sourceCommit: validated.source.commit
    });
  }
  const toolVersions = {
    node: nodeVersion,
    solc: runnerResult.compilerVersion ?? validated.configuration.compilerVersion
  };
  if (runnerResult.engine?.name) toolVersions.engine = `${runnerResult.engine.name}${runnerResult.engine.version ? `@${runnerResult.engine.version}` : ''}`;
  const normalized = {
    schemaVersion: 'deep-assurance-contract-automation-result-v1',
    requestId: validated.requestId,
    requestDigest: validated.requestDigest,
    source: validated.source,
    profileId: validated.profileId,
    status: runnerResult.status === 'completed' ? 'PASSED' : 'FAILED',
    artifactRefs: [{
      name: 'deep-assurance-artifact-manifest-v1',
      ref: artifactRef({ repository, runId: String(runId), artifactName, file: manifestFile }),
      sha256: manifestDigest
    }],
    evidenceRefs,
    toolVersions
  };
  await fs.writeFile(path.join(root, 'deep-assurance-result-v1.json'), json(normalized));
  return Object.freeze(normalized);
}

function parseArgs(args) {
  const allowed = new Set(['--request', '--output', '--repository', '--run-id', '--artifact-name', '--runner-manifest-sha256']);
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
  const normalized = await finalizeDeepAssuranceOutput({
    request,
    expectedRunnerManifestSha256: args['--runner-manifest-sha256'],
    outputRoot: args['--output'],
    repository: args['--repository'],
    runId: args['--run-id'],
    artifactName: args['--artifact-name'],
    nodeVersion: process.version.replace(/^v/, '')
  });
  process.stdout.write(`${JSON.stringify({ requestId: normalized.requestId, status: normalized.status })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((cause) => { process.stderr.write(`${cause?.message ?? String(cause)}\n`); process.exitCode = 1; });
}
