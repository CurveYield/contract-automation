import test from 'node:test';
import assert from 'node:assert/strict';

import { DirectValidationError } from '../packages/audit-github-direct-protocol/src/index.mjs';
import { ledgerPath, buildLedgerPaths } from '../packages/audit-github-direct-ledger/src/paths.mjs';
import { planImmutableCreate, planCasUpdate } from '../packages/audit-github-direct-ledger/src/mutations.mjs';
import { planPartialWriteRecovery } from '../packages/audit-github-direct-ledger/src/recovery.mjs';

const blob = 'a'.repeat(40);
const otherBlob = 'b'.repeat(40);
const content = { schemaVersion: 'fixture-v1', value: 1 };
const paths = buildLedgerPaths({
  jobId: 'direct-job-1',
  eventId: 'event-1',
  resultId: 'result-1',
  reportId: 'report-1'
});

function expectBounded(fn, code) {
  assert.throws(fn, (error) => {
    assert.equal(typeof error.code, 'string');
    assert.equal(typeof error.path, 'string');
    if (code) assert.equal(error.code, code);
    return true;
  });
}

test('ledger path parser rejects arbitrary in-root namespaces and suffix aliases', () => {
  for (const path of [
    '.audit-direct/v1/custom/value.json',
    `${paths.request}/extra`,
    '.audit-direct/v1/indexes/other.json',
    '.audit-direct/v1/requests/direct-job-1',
    '.audit-direct/v1/events/direct-job-1.json'
  ]) {
    expectBounded(() => ledgerPath(path), 'ledger_path_violation');
  }
});

test('ledger path parser rejects control characters, overlong paths, and invalid identities', () => {
  expectBounded(() => ledgerPath('.audit-direct/v1/requests/job\nname.json'), 'ledger_path_violation');
  expectBounded(() => ledgerPath(`.audit-direct/v1/requests/${'a'.repeat(600)}.json`), 'ledger_path_violation');
  expectBounded(() => ledgerPath('.audit-direct/v1/requests/latest.json'), 'invalid_identifier');
});

test('ledger path parser accepts every server-owned path family', () => {
  for (const path of Object.values(paths)) assert.equal(ledgerPath(path), path);
});

test('CAS updates are confined to current pointers and the jobs index', () => {
  for (const path of [paths.request, paths.event, paths.result, paths.report, paths.manifest]) {
    expectBounded(
      () => planCasUpdate({ path, content, currentBlobSha: blob, expectedBlobSha: blob }),
      'mutation_path_violation'
    );
  }
  assert.equal(planCasUpdate({ path: paths.current, content, currentBlobSha: blob, expectedBlobSha: blob }).operation, 'update-cas');
  assert.equal(planCasUpdate({ path: paths.jobIndex, content, currentBlobSha: blob, expectedBlobSha: blob }).operation, 'update-cas');
});

test('create-only plans cannot target the mutable jobs index', () => {
  expectBounded(() => planImmutableCreate({ path: paths.jobIndex, content }), 'mutation_path_violation');
  assert.equal(planImmutableCreate({ path: paths.current, content }).operation, 'create-immutable');
});

test('recovery rejects duplicate observations even when identical', () => {
  const plan = planImmutableCreate({ path: paths.request, content });
  const observed = { path: plan.path, contentDigest: plan.contentDigest, blobSha: blob };
  expectBounded(
    () => planPartialWriteRecovery({ plans: [plan], observed: [observed, { ...observed }], currentBlobShas: {} }),
    'duplicate_identity'
  );
});

test('recovery rejects conflicting duplicate observations', () => {
  const plan = planImmutableCreate({ path: paths.request, content });
  expectBounded(
    () => planPartialWriteRecovery({
      plans: [plan],
      observed: [
        { path: plan.path, contentDigest: plan.contentDigest, blobSha: blob },
        { path: plan.path, contentDigest: `sha256:${'f'.repeat(64)}`, blobSha: otherBlob }
      ],
      currentBlobShas: {}
    }),
    'duplicate_identity'
  );
});

test('recovery rejects observations unrelated to supplied plans', () => {
  const plan = planImmutableCreate({ path: paths.request, content });
  expectBounded(
    () => planPartialWriteRecovery({
      plans: [plan],
      observed: [{ path: paths.event, contentDigest: plan.contentDigest, blobSha: blob }],
      currentBlobShas: {}
    }),
    'unrelated_observation'
  );
});

test('recovery rejects unrelated current-blob entries', () => {
  const plan = planCasUpdate({ path: paths.current, content, currentBlobSha: blob, expectedBlobSha: blob });
  expectBounded(
    () => planPartialWriteRecovery({
      plans: [plan],
      observed: [],
      currentBlobShas: { [paths.current]: blob, [paths.jobIndex]: otherBlob }
    }),
    'unrelated_observation'
  );
});

test('valid partial recovery behavior remains deterministic', () => {
  const immutable = planImmutableCreate({ path: paths.request, content });
  const current = planCasUpdate({ path: paths.current, content, currentBlobSha: blob, expectedBlobSha: blob });
  const result = planPartialWriteRecovery({
    plans: [immutable, current],
    observed: [{ path: immutable.path, contentDigest: immutable.contentDigest, blobSha: otherBlob }],
    currentBlobShas: { [current.path]: current.expectedBlobSha }
  });
  assert.equal(result.converged, false);
  assert.deepEqual(result.remaining.map((entry) => entry.path), [current.path]);
});
