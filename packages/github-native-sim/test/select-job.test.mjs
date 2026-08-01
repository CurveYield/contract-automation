import test from 'node:test';
import assert from 'node:assert/strict';

import { selectChangedJob } from '../src/select-job.mjs';

test('selects exactly one atomically committed job directory', () => {
  const selection = selectChangedJob({
    changedPaths: [
      'github-native-sim/jobs/smoke-1/job.json',
      'github-native-sim/jobs/smoke-1/project/Counter.sol'
    ]
  });
  assert.deepEqual(selection, {
    jobId: 'smoke-1',
    jobRoot: 'github-native-sim/jobs/smoke-1',
    jobPath: 'github-native-sim/jobs/smoke-1/job.json'
  });
});

test('rejects changes outside the selected job directory', () => {
  assert.throws(
    () => selectChangedJob({
      changedPaths: [
        'github-native-sim/jobs/smoke-1/job.json',
        'packages/runner/src/run-job.mjs'
      ]
    }),
    /outside github-native-sim\/jobs/
  );
});

test('rejects changes spanning multiple job directories', () => {
  assert.throws(
    () => selectChangedJob({
      changedPaths: [
        'github-native-sim/jobs/smoke-1/job.json',
        'github-native-sim/jobs/smoke-2/job.json'
      ]
    }),
    /exactly one job directory/
  );
});

test('requires job.json in an atomic push', () => {
  assert.throws(
    () => selectChangedJob({
      changedPaths: ['github-native-sim/jobs/smoke-1/project/Counter.sol']
    }),
    /must include .*job\.json/
  );
});

test('accepts a valid manual job path', () => {
  assert.deepEqual(
    selectChangedJob({ manualJobPath: 'github-native-sim/jobs/manual-1/job.json' }),
    {
      jobId: 'manual-1',
      jobRoot: 'github-native-sim/jobs/manual-1',
      jobPath: 'github-native-sim/jobs/manual-1/job.json'
    }
  );
});

test('validates the complete branch delta for a manual selection', () => {
  assert.deepEqual(
    selectChangedJob({
      manualJobPath: 'github-native-sim/jobs/manual-1/job.json',
      changedPaths: [
        'github-native-sim/jobs/manual-1/job.json',
        'github-native-sim/jobs/manual-1/project/Counter.sol'
      ]
    }),
    {
      jobId: 'manual-1',
      jobRoot: 'github-native-sim/jobs/manual-1',
      jobPath: 'github-native-sim/jobs/manual-1/job.json'
    }
  );
});

test('rejects an out-of-scope branch delta for a manual selection', () => {
  assert.throws(
    () => selectChangedJob({
      manualJobPath: 'github-native-sim/jobs/manual-1/job.json',
      changedPaths: [
        'github-native-sim/jobs/manual-1/job.json',
        '.github/workflows/github-native-simulate.yml'
      ]
    }),
    /outside github-native-sim\/jobs/
  );
});

test('rejects a manual path that disagrees with the branch delta', () => {
  assert.throws(
    () => selectChangedJob({
      manualJobPath: 'github-native-sim/jobs/manual-1/job.json',
      changedPaths: [
        'github-native-sim/jobs/other-1/job.json',
        'github-native-sim/jobs/other-1/project/Counter.sol'
      ]
    }),
    /does not match the changed job directory/
  );
});

test('rejects an unsafe manual job path', () => {
  assert.throws(
    () => selectChangedJob({ manualJobPath: '../job.json' }),
    /manual job path must match/
  );
});

test('rejects empty changed paths without a manual path', () => {
  assert.throws(
    () => selectChangedJob({ changedPaths: [] }),
    /No changed job paths were provided/
  );
});
