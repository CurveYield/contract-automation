import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const path='.github/workflows/audit-direct-v1.yml';
const source=await readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('workflow uses only trusted dispatch and never pull_request_target',()=>{
  assert.match(source,/workflow_dispatch:/);
  assert.doesNotMatch(source,/pull_request_target|pull_request:/);
});

test('trusted runner is checked out at immutable workflow SHA and target is data-only',()=>{
  assert.match(source,/ref: \$\{\{ github\.workflow_sha \}\}/);
  assert.match(source,/path: trusted-runner/);
  assert.match(source,/path: target-source/);
  assert.match(source,/persist-credentials: false/g);
  assert.match(source,/node trusted-runner\/apps\/audit-github-direct-cli\/src\/main\.mjs/);
  assert.doesNotMatch(source,/node target-source|working-directory:\s*target-source|source target-source|\.\/target-source/);
});

test('all actions are pinned by full commit SHA',()=>{
  const uses=[...source.matchAll(/^\s*uses:\s*([^\s]+)$/gm)].map(x=>x[1]);
  assert.ok(uses.length>=3);
  for(const use of uses)assert.match(use,/^[^@]+@[0-9a-f]{40}$/);
});

test('workflow permissions are minimal and exclude workflow, id-token, package, deployment, and admin scopes',()=>{
  const permissions=source.slice(source.indexOf('permissions:'),source.indexOf('concurrency:'));
  assert.match(permissions,/contents: write/);
  assert.match(permissions,/checks: write/);
  assert.match(permissions,/statuses: write/);
  assert.match(permissions,/issues: write/);
  assert.match(permissions,/actions: read/);
  assert.doesNotMatch(permissions,/workflows:|id-token:|packages:|deployments:|administration:|security-events:/);
});

test('workflow validates exact SHA, numeric IDs, operation allowlist, concurrency, timeout, and retention',()=>{
  assert.match(source,/\^\[0-9a-f\]\{40\}\$/);
  assert.match(source,/submit\|status\|cancel\|report\|capabilities\|verify-fixture/);
  assert.match(source,/cancel-in-progress: true/);
  assert.match(source,/timeout-minutes: 10/);
  assert.match(source,/retention-days: 1/);
});

test('credentials are exposed only to the trusted service step',()=>{
  const occurrences=[...source.matchAll(/GITHUB_TOKEN:/g)].length;
  assert.equal(occurrences,1);
  const trustedStep=source.slice(source.indexOf('- name: Run trusted GitHub Direct service'),source.indexOf('- name: Upload bounded machine result'));
  assert.match(trustedStep,/GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
  assert.doesNotMatch(source.slice(0,source.indexOf('- name: Run trusted GitHub Direct service')),/GITHUB_TOKEN:/);
});

test('workflow inputs cannot select commands, scripts, runners, images, URLs, paths, credentials, profiles, or policies',()=>{
  const inputs=source.slice(source.indexOf('inputs:'),source.indexOf('permissions:'));
  assert.deepEqual([...inputs.matchAll(/^\s{6}([a-z_]+):$/gm)].map(x=>x[1]),['operation','target_sha','installation_id','report_issue_number']);
  assert.match(source,/runs-on: ubuntu-24\.04/);
});

test('workflow runs only from the protected default branch',()=>{
  assert.match(source,/if: github\.ref == format\('refs\/heads\/\{0\}', github\.event\.repository\.default_branch\) && github\.ref_protected == true/);
});

test('workflow emits bounded exact-SHA and tree binding metadata',()=>{
  assert.match(source,/TREE_SHA=/);
  assert.match(source,/target-binding\.json/);
  assert.match(source,/"targetCommitSha"/);
  assert.match(source,/"targetTreeSha"/);
  assert.match(source,/sed -n '1,10000p'/);
  assert.doesNotMatch(source,/\| head -n 10000/);
});

test('workflow derives stable request identity from the exact target commit, not the run attempt',()=>{
  assert.match(source,/DIRECT_REQUESTED_AT/);
  assert.match(source,/workflow-\$\{REPOSITORY_ID\}-\$\{TARGET_SHA:0:12\}-\$\{REQUESTER_ID\}/);
  assert.doesNotMatch(source,/GITHUB_RUN_ID|GITHUB_RUN_ATTEMPT/);
  assert.doesNotMatch(source,/node -e/);
});
