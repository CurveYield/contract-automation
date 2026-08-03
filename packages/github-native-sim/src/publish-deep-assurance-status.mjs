#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUEST_ID_PATTERN = /^dar-[0-9a-f]{32}$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const RUN_ID_PATTERN = /^[1-9]\d*$/;
const STATES = new Set(['pending', 'success', 'failure']);
const PROFILE_LABELS = Object.freeze({
  'github-native-compile-v1': 'compile',
  'github-native-simulate-v1': 'simulation',
});

function nonEmptyString(value, field, maximum = 512) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value;
}

function validateIdentity({ repository, commitSha, runId, requestId, profileId, state }) {
  if (typeof repository !== 'string' || !REPOSITORY_PATTERN.test(repository)) {
    throw new TypeError('repository is invalid');
  }
  if (typeof commitSha !== 'string' || !COMMIT_PATTERN.test(commitSha)) {
    throw new TypeError('commitSha must be an exact lowercase 40-character commit');
  }
  if (typeof runId !== 'string' || !RUN_ID_PATTERN.test(runId)) {
    throw new TypeError('runId must be a positive integer string');
  }
  if (typeof requestId !== 'string' || !REQUEST_ID_PATTERN.test(requestId)) {
    throw new TypeError('requestId is invalid');
  }
  const profileLabel = PROFILE_LABELS[profileId];
  if (!profileLabel) throw new TypeError('profileId is unsupported');
  if (!STATES.has(state)) throw new TypeError('state is unsupported');
  return { repository, commitSha, runId, requestId, profileId, profileLabel, state };
}

export function buildDeepAssuranceCommitStatus(input) {
  const identity = validateIdentity(input);
  const description = identity.state === 'pending'
    ? `Deep Assurance ${identity.profileLabel} request accepted`
    : identity.state === 'success'
      ? `Deep Assurance ${identity.profileLabel} workflow completed`
      : `Deep Assurance ${identity.profileLabel} workflow failed`;
  return Object.freeze({
    state: identity.state,
    target_url: `https://github.com/${identity.repository}/actions/runs/${identity.runId}`,
    description,
    context: `deep-assurance/${identity.requestId}`,
  });
}

export async function publishDeepAssuranceCommitStatus({
  token,
  fetchImpl = globalThis.fetch,
  apiBaseUrl = 'https://api.github.com',
  ...identity
}) {
  nonEmptyString(token, 'token', 4096);
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  if (apiBaseUrl !== 'https://api.github.com') throw new TypeError('apiBaseUrl must be the GitHub API');
  const status = buildDeepAssuranceCommitStatus(identity);
  const response = await fetchImpl(
    `${apiBaseUrl}/repos/${identity.repository}/statuses/${identity.commitSha}`,
    {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'user-agent': 'curveyield-deep-assurance-status-v1',
        'x-github-api-version': '2022-11-28',
      },
      body: JSON.stringify(status),
    },
  );
  if (!response?.ok) {
    const body = typeof response?.text === 'function' ? await response.text() : '';
    const suffix = body ? `: ${body.slice(0, 500)}` : '';
    throw new Error(`GitHub status publication failed with ${response?.status ?? 'unknown'}${suffix}`);
  }
  return status;
}

function parseArgs(args) {
  const allowed = new Set(['--repository', '--commit', '--run-id', '--request-id', '--profile-id', '--state']);
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!allowed.has(key) || value === undefined || key in values) {
      throw new TypeError(`Invalid argument: ${key ?? '<missing>'}`);
    }
    values[key] = value;
  }
  for (const key of allowed) if (!(key in values)) throw new TypeError(`${key} is required`);
  return values;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await publishDeepAssuranceCommitStatus({
    token: process.env.GITHUB_TOKEN,
    repository: args['--repository'],
    commitSha: args['--commit'],
    runId: args['--run-id'],
    requestId: args['--request-id'],
    profileId: args['--profile-id'],
    state: args['--state'],
  });
  process.stdout.write(`${JSON.stringify({ requestId: args['--request-id'], state: args['--state'] })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((cause) => {
    process.stderr.write(`${cause?.message ?? String(cause)}\n`);
    process.exitCode = 1;
  });
}
