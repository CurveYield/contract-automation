import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (relative) => import(`${pathToFileURL(path.join(root, relative)).href}?v=${Date.now()}-${Math.random()}`);

const requiredStates = new Map([
  ['requested', 'Requested'],
  ['validating', 'Validating'],
  ['admitted', 'Admitted'],
  ['accepted', 'Accepted — awaiting executor'],
  ['awaiting_executor', 'Awaiting executor'],
  ['fixture_running', 'Trusted fixture running'],
  ['publishing', 'Publishing'],
  ['completed', 'Completed'],
  ['failed', 'Failed'],
  ['cancelled', 'Cancelled'],
  ['policy_rejected', 'Policy rejected'],
  ['execution_plane_unavailable', 'Execution plane unavailable'],
  ['provisioning', 'Provisioning'],
  ['running', 'In progress'],
  ['collecting_evidence', 'Collecting evidence'],
  ['checkpointing', 'Checkpoint pending'],
  ['exporting', 'Export pending'],
  ['restoring', 'Restore pending'],
  ['deleting', 'Deletion pending'],
  ['tombstoned', 'Tombstoned'],
  ['timed_out', 'Timed out'],
  ['offline_stale', 'Offline — cached data'],
  ['unavailable', 'Unavailable'],
  ['not_found', 'Not found']
]);

test('every Round 4 external lifecycle state has an explicit truthful label', async () => {
  const { lifecycleState } = await load('packages/audit-report-view-model/src/lifecycle-v1.mjs');
  for (const [state, label] of requiredStates) assert.equal(lifecycleState(state).label, label, state);
});

test('identical report references deduplicate and conflicting duplicates fail closed', async () => {
  const { createReportViewModel } = await load('packages/audit-report-view-model/src/models-core-v1.mjs');
  const identical = createReportViewModel({
    id: 'report-1', title: 'Report', status: 'published',
    references: [
      { id: 'ref-1', label: 'Evidence', url: '/reports/ref-1' },
      { id: 'ref-1', label: 'Evidence', url: '/reports/ref-1' }
    ]
  });
  assert.equal(identical.references.length, 1);
  const conflicting = createReportViewModel({
    id: 'report-2', title: 'Report', status: 'published',
    references: [
      { id: 'ref-1', label: 'Evidence A', url: '/reports/a' },
      { id: 'ref-1', label: 'Evidence B', url: '/reports/b' }
    ]
  });
  assert.deepEqual(conflicting.references, []);
});

test('hidden report records are observationally identical to absent records', async () => {
  const { createReportListViewModel } = await load('packages/audit-report-view-model/src/models-core-v1.mjs');
  const absent = createReportListViewModel([{ id: 'visible', title: 'Visible', status: 'published' }]);
  const hidden = createReportListViewModel([
    { id: 'visible', title: 'Visible', status: 'published' },
    { id: 'hidden-secret', title: 'Hidden title', status: 'published', visible: false }
  ]);
  assert.equal(hidden.total, absent.total);
  assert.deepEqual(hidden.items, absent.items);
});

test('GitHub Direct v2 compatibility versions and adapters are explicit', () => {
  const source = fs.readFileSync(path.join(root, 'packages/audit-web-compat/src/index-v1.mjs'), 'utf8');
  assert.match(source, /githubDirectResult:\s*['"]github-direct-service-result-v2['"]/);
  assert.match(source, /githubDirectError:\s*['"]github-direct-service-error-v1['"]/);
  assert.match(source, /export function adaptGitHubDirectResultV2\b/);
  assert.match(source, /export function adaptGitHubDirectErrorV1\b/);
});

test('generic API fixture cannot bypass GitHub Direct schema validation', () => {
  const source = fs.readFileSync(path.join(root, 'packages/audit-web-compat/src/index-v1.mjs'), 'utf8');
  assert.doesNotMatch(source, /createGitHubDirectStatusViewModel\(githubDirectInput\)/);
  assert.match(source, /adaptGitHubDirectResultV2\(githubDirectInput\)/);
});

test('diagnostic redaction removes GitHub credential token formats and x-access-token values', async () => {
  const { redactDiagnosticText } = await load('packages/audit-report-view-model/src/safety-v1.mjs');
  const input = 'ghp_fixtureabcdefghijklmnopqrstuvwxyz123456 github_pat_fixture_abcdefghijklmnopqrstuvwxyz x-access-token:fixture-secret';
  const output = redactDiagnosticText(input);
  assert.doesNotMatch(output, /ghp_fixture|github_pat_fixture|fixture-secret/);
  assert.match(output, /\[redacted-secret\]/);
});
