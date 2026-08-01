import test from 'node:test';
import assert from 'node:assert/strict';

const packages=[
  '../packages/audit-github-direct-protocol/src/index.mjs',
  '../packages/audit-github-direct-ledger/src/index.mjs',
  '../packages/audit-github-direct-adapter/src/index.mjs',
  '../packages/audit-github-direct-runner/src/index.mjs'
];

for(const [index,path] of packages.entries()){
  test(`GitHub Direct core package ${index+1} exists and exposes a distinct mode`,async()=>{
    const mod=await import(path);
    assert.equal(mod.DIRECT_MODE_ID,'github-direct-audit-v1');
    assert.notEqual(mod.DIRECT_MODE_ID,'cloudflare-audit-v1');
  });
}

test('GitHub Direct mode never exposes automatic Cloudflare fallback',async()=>{
  const protocol=await import(packages[0]);
  assert.equal(protocol.DIRECT_MODE_ID,'github-direct-audit-v1');
  assert.equal(protocol.CONTROL_BRANCH,'audit-direct/control-v1');
  assert.equal(protocol.AUTOMATIC_FALLBACK,false);
});
