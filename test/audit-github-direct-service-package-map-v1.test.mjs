import test from 'node:test';
import assert from 'node:assert/strict';

const modules=[
  '../packages/audit-github-direct-auth/src/index.mjs',
  '../packages/audit-github-direct-service/src/index.mjs',
  '../packages/audit-github-direct-reporting/src/index.mjs',
  '../apps/audit-github-direct-cli/src/index.mjs'
];

for(const path of modules)test(`Phase 9 service package exists: ${path}`,async()=>{
  const mod=await import(path);
  assert.ok(Object.keys(mod).length>0);
});

test('service packages remain GitHub Direct only',async()=>{
  const service=await import(modules[1]);
  assert.deepEqual(service.SERVICE_COMMANDS,['submit','status','cancel','report','capabilities','verify-fixture']);
});
