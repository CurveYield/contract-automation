import { CONTROL_BRANCH, exactKeys, identifier, frozenClone, fail } from '../../audit-github-direct-protocol/src/index.mjs';

export const LEDGER_ROOT = '.audit-direct/v1';
const MAX_LEDGER_PATH_LENGTH = 512;

function invalidPath(path = '$.path') {
  fail('ledger_path_violation', path, 'Ledger path is outside the server-owned namespace');
}

function validateRawPath(value, path) {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > MAX_LEDGER_PATH_LENGTH ||
    /[\u0000-\u001f\u007f\\]/.test(value) ||
    value.includes('//') ||
    value.includes('..')
  ) {
    invalidPath(path);
  }
  return value;
}

function oneIdentity(value, path, prefix, kind) {
  const match = value.match(new RegExp(`^${prefix}/([^/]+)\\.json$`));
  if (!match) return null;
  const identity = identifier(match[1], `${path}.identity`);
  const canonical = `${prefix}/${identity}.json`;
  if (value !== canonical) invalidPath(path);
  return { path: canonical, kind, jobId: identity };
}

function twoIdentities(value, path, prefix, kind, childName) {
  const match = value.match(new RegExp(`^${prefix}/([^/]+)/([^/]+)\\.json$`));
  if (!match) return null;
  const jobId = identifier(match[1], `${path}.jobId`);
  const childId = identifier(match[2], `${path}.${childName}`);
  const canonical = `${prefix}/${jobId}/${childId}.json`;
  if (value !== canonical) invalidPath(path);
  return { path: canonical, kind, jobId, [childName]: childId };
}

export function ledgerPathInfo(value, path = '$.path') {
  const raw = validateRawPath(value, path);
  if (raw === `${LEDGER_ROOT}/indexes/jobs-v1.json`) {
    return frozenClone({ path: raw, kind: 'job-index', jobId: null });
  }

  const candidates = [
    oneIdentity(raw, path, `${LEDGER_ROOT}/requests`, 'request'),
    oneIdentity(raw, path, `${LEDGER_ROOT}/current`, 'current'),
    oneIdentity(raw, path, `${LEDGER_ROOT}/manifests`, 'manifest'),
    twoIdentities(raw, path, `${LEDGER_ROOT}/events`, 'event', 'eventId'),
    twoIdentities(raw, path, `${LEDGER_ROOT}/results`, 'result', 'resultId'),
    twoIdentities(raw, path, `${LEDGER_ROOT}/reports`, 'report', 'reportId')
  ];
  const matched = candidates.find(Boolean);
  if (!matched) invalidPath(path);
  return frozenClone(matched);
}

export function ledgerPath(value, path = '$.path') {
  return ledgerPathInfo(value, path).path;
}

export function buildLedgerPaths(input) {
  const v = exactKeys(input, ['jobId','eventId','resultId','reportId'], '$');
  const jobId = identifier(v.jobId, '$.jobId');
  const eventId = identifier(v.eventId, '$.eventId');
  const resultId = identifier(v.resultId, '$.resultId');
  const reportId = identifier(v.reportId, '$.reportId');
  return frozenClone({
    request: `${LEDGER_ROOT}/requests/${jobId}.json`,
    current: `${LEDGER_ROOT}/current/${jobId}.json`,
    event: `${LEDGER_ROOT}/events/${jobId}/${eventId}.json`,
    result: `${LEDGER_ROOT}/results/${jobId}/${resultId}.json`,
    report: `${LEDGER_ROOT}/reports/${jobId}/${reportId}.json`,
    manifest: `${LEDGER_ROOT}/manifests/${jobId}.json`,
    jobIndex: `${LEDGER_ROOT}/indexes/jobs-v1.json`
  });
}

export { CONTROL_BRANCH };
