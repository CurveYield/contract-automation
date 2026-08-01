import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { resolveJobProjectRoot } from '../src/project.mjs';

test('resolves a project below the job directory', () => {
  const jobFile = path.resolve('/tmp/github-native/jobs/example/job.json');
  assert.equal(
    resolveJobProjectRoot(jobFile, 'project'),
    path.resolve('/tmp/github-native/jobs/example/project')
  );
});

test('resolves a nested project below the job directory', () => {
  const jobFile = path.resolve('/tmp/github-native/jobs/example/job.json');
  assert.equal(
    resolveJobProjectRoot(jobFile, 'sources/contracts'),
    path.resolve('/tmp/github-native/jobs/example/sources/contracts')
  );
});

test('rejects escape from the job directory', () => {
  assert.throws(
    () => resolveJobProjectRoot('/tmp/github-native/jobs/example/job.json', '../project'),
    /inside the job directory/
  );
});

test('rejects an absolute project path', () => {
  assert.throws(
    () => resolveJobProjectRoot('/tmp/github-native/jobs/example/job.json', '/tmp/project'),
    /relative path/
  );
});

test('rejects empty and dot path segments', () => {
  assert.throws(
    () => resolveJobProjectRoot('/tmp/github-native/jobs/example/job.json', 'project//contracts'),
    /safe path segments/
  );
  assert.throws(
    () => resolveJobProjectRoot('/tmp/github-native/jobs/example/job.json', './project'),
    /safe path segments/
  );
});
