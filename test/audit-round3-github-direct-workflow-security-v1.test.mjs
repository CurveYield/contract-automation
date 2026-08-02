import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../.github/workflows/audit-direct-v1.yml',import.meta.url),'utf8');
function inputsBlock(){return source.slice(source.indexOf('inputs:'),source.indexOf('permissions:'));}
function jobBlock(name,next){const start=source.indexOf(`  ${name}:`);const end=next?source.indexOf(`  ${next}:`,start+1):source.length;return source.slice(start,end);}

test('workflow syntax parses and exposes only operation and exact target SHA inputs',()=>{
  assert.deepEqual([...inputsBlock().matchAll(/^\s{6}([a-z_]+):$/gm)].map((match)=>match[1]),['operation','target_sha']);
});

test('trusted runner source is workflow SHA and target checkout remains inert data',()=>{
  assert.equal((source.match(/ref: \$\{\{ github\.workflow_sha \}\}/g)??[]).length,4);
  assert.equal((source.match(/path: trusted-runner/g)??[]).length,4);
  assert.equal((source.match(/path: target-source/g)??[]).length,4);
  assert.equal((source.match(/persist-credentials: false/g)??[]).length,8);
  assert.doesNotMatch(source,/node target-source|working-directory:\s*target-source|source target-source|bash target-source|sh target-source/);
});

test('server-owned variables define installation and report issue scope',()=>{
  assert.match(source,/vars\.GITHUB_DIRECT_INSTALLATION_ID/);
  assert.match(source,/vars\.GITHUB_DIRECT_REPORT_ISSUE/);
  assert.doesNotMatch(inputsBlock(),/installation_id|report_issue_number/);
  assert.doesNotMatch(source,/--installation-id "\$\{\{ inputs\./);
});

test('operation jobs use minimum permission subsets with no broad scopes',()=>{
  const readOnly=jobBlock('read-only','submit');
  const submit=jobBlock('submit','cancel');
  const cancel=jobBlock('cancel','report');
  const report=jobBlock('report');
  assert.match(readOnly,/permissions:\n\s+contents: read/);
  assert.doesNotMatch(readOnly,/checks: write|statuses: write|issues: write|actions: read/);
  assert.match(submit,/contents: write/);assert.match(submit,/checks: write/);assert.match(submit,/statuses: write/);assert.match(submit,/issues: write/);assert.match(submit,/actions: read/);
  assert.match(cancel,/contents: write/);assert.match(cancel,/statuses: write/);assert.match(cancel,/issues: write/);assert.doesNotMatch(cancel,/checks: write|actions: read/);
  assert.match(report,/contents: write/);assert.match(report,/statuses: write/);assert.match(report,/issues: write/);assert.match(report,/actions: read/);assert.doesNotMatch(report,/checks: write/);
  assert.doesNotMatch(source,/id-token:|workflows:|packages:|deployments:|administration:|security-events:/);
});

test('all operations for one repository and target serialize without cancellation',()=>{
  assert.match(source,/group: audit-direct-v1-\$\{\{ github\.repository_id \}\}-\$\{\{ inputs\.target_sha \}\}/);
  assert.doesNotMatch(source,/group:.*inputs\.operation/);
  assert.match(source,/cancel-in-progress: false/);
});

test('action versions and runner images are fixed by trusted source',()=>{
  const uses=[...source.matchAll(/^\s*uses:\s*([^\s]+)$/gm)].map((match)=>match[1]);
  assert.ok(uses.length>=8);
  for(const use of uses)assert.match(use,/^[^@]+@[0-9a-f]{40}$/);
  assert.equal((source.match(/runs-on: ubuntu-24\.04/g)??[]).length,4);
  assert.doesNotMatch(inputsBlock(),/runs_on|runner|image/);
});

test('target SHA and repository variables are validated before trusted CLI invocation',()=>{
  assert.match(source,/\^\[0-9a-f\]\{40\}\$/);
  assert.match(source,/GITHUB_DIRECT_INSTALLATION_ID.*\^\[1-9\]\[0-9\]\*\$/s);
  assert.match(source,/GITHUB_DIRECT_REPORT_ISSUE.*\^\[1-9\]\[0-9\]\*\$/s);
  assert.equal((source.match(/git -C target-source rev-parse HEAD/g)??[]).length,4);
  assert.equal((source.match(/node trusted-runner\/apps\/audit-github-direct-cli\/src\/main\.mjs/g)??[]).length,4);
});

test('workflow excludes untrusted triggers and submitted execution enablement',()=>{
  assert.match(source,/workflow_dispatch:/);
  assert.doesNotMatch(source,/pull_request_target|pull_request:|workflow_run:|repository_dispatch:/);
  assert.doesNotMatch(source,/npm |npx |pnpm |yarn |forge |hardhat |anvil |docker |podman |curl |wget /);
  assert.doesNotMatch(source,/cloudflare|R2_|submitted-execution|enable-execution/i);
});

test('bounded artifacts contain metadata only and retain for one day',()=>{
  assert.equal((source.match(/retention-days: 1/g)??[]).length,2);
  assert.equal((source.match(/sed -n '1,10000p'/g)??[]).length,2);
  assert.equal((source.match(/target-binding\.json/g)??[]).length>=4,true);
  assert.equal((source.match(/target-file-index\.txt/g)??[]).length>=4,true);
  assert.doesNotMatch(source,/upload-artifact[\s\S]*target-source\//);
});
