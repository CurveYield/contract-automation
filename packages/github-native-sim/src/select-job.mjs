import path from 'node:path';
import { fileURLToPath } from 'node:url';

const JOB_PREFIX = 'github-native-sim/jobs';
const JOB_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const MANUAL_PATH_PATTERN = /^github-native-sim\/jobs\/([A-Za-z0-9][A-Za-z0-9._-]{0,79})\/job\.json$/;

function selectionFor(jobId) {
  const jobRoot = `${JOB_PREFIX}/${jobId}`;
  return {
    jobId,
    jobRoot,
    jobPath: `${jobRoot}/job.json`
  };
}

function normalizeChangedPath(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Changed paths must be non-empty strings');
  }
  if (value.includes('\\')) throw new Error(`Changed path uses unsupported separators: ${value}`);
  return value.replace(/^\.\//, '');
}

export function selectChangedJob({ changedPaths = [], manualJobPath } = {}) {
  if (manualJobPath !== undefined && manualJobPath !== '') {
    const normalized = normalizeChangedPath(manualJobPath);
    const match = normalized.match(MANUAL_PATH_PATTERN);
    if (!match) {
      throw new Error('manual job path must match github-native-sim/jobs/<job-id>/job.json');
    }
    return selectionFor(match[1]);
  }

  if (!Array.isArray(changedPaths) || changedPaths.length === 0) {
    throw new Error('No changed job paths were provided');
  }

  const normalizedPaths = changedPaths.map(normalizeChangedPath);
  const jobIds = new Set();
  for (const changedPath of normalizedPaths) {
    const match = changedPath.match(/^github-native-sim\/jobs\/([^/]+)\/(.+)$/);
    if (!match) throw new Error(`Changed path is outside github-native-sim/jobs/: ${changedPath}`);
    if (!JOB_ID_PATTERN.test(match[1])) throw new Error(`Invalid job directory name: ${match[1]}`);
    jobIds.add(match[1]);
  }

  if (jobIds.size !== 1) throw new Error('Changed paths must affect exactly one job directory');
  const [jobId] = jobIds;
  const selection = selectionFor(jobId);
  if (!normalizedPaths.includes(selection.jobPath)) {
    throw new Error(`Atomic job commits must include ${selection.jobPath}`);
  }
  return selection;
}

export function selectJobFromEnvironment(environment = process.env) {
  const changedPaths = String(environment.CHANGED_PATHS ?? '')
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  return selectChangedJob({
    changedPaths,
    manualJobPath: environment.MANUAL_JOB_PATH || undefined
  });
}

const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedFile === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(`${JSON.stringify(selectJobFromEnvironment())}\n`);
  } catch (cause) {
    process.stderr.write(`${cause?.message ?? String(cause)}\n`);
    process.exitCode = 1;
  }
}
