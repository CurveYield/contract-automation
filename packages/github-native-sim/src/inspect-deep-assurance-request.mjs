#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectDeepAssuranceRequestFromChangedPaths, validateDeepAssuranceRequest } from './deep-assurance-request.mjs';

function parseArgs(args) {
  const allowed = new Set(['--repository-root', '--runner-manifest-sha256']);
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

export async function inspectDeepAssuranceRequest({ repositoryRoot, changedPaths, expectedRunnerManifestSha256 }) {
  const selection = selectDeepAssuranceRequestFromChangedPaths(changedPaths);
  const root = path.resolve(repositoryRoot);
  const requestFile = path.resolve(root, ...selection.requestPath.split('/'));
  if (!requestFile.startsWith(`${root}${path.sep}`)) throw new TypeError('Request path is outside repository root');
  const raw = JSON.parse(await fs.readFile(requestFile, 'utf8'));
  const request = validateDeepAssuranceRequest(raw, { expectedRunnerManifestSha256 });
  if (request.requestId !== selection.requestId) throw new TypeError('Request directory does not match requestId');
  return Object.freeze({ ...selection, request });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const changedPaths = String(process.env.CHANGED_PATHS ?? '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  const inspected = await inspectDeepAssuranceRequest({ repositoryRoot: args['--repository-root'], changedPaths, expectedRunnerManifestSha256: args['--runner-manifest-sha256'] });
  process.stdout.write(`${JSON.stringify({ request_id: inspected.request.requestId, request_path: inspected.requestPath, request_root: inspected.requestRoot, profile_id: inspected.request.profileId, source_repository: inspected.request.source.repository, source_commit: inspected.request.source.commit, source_project_path: inspected.request.source.projectPath })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((cause) => { process.stderr.write(`${cause?.message ?? String(cause)}\n`); process.exitCode = 1; });
}
