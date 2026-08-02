import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir,readFile } from 'node:fs/promises';
import { join } from 'node:path';

const roots=[
  'packages/audit-github-direct-auth',
  'packages/audit-github-direct-service',
  'packages/audit-github-direct-reporting',
  'apps/audit-github-direct-cli'
];
async function files(root){const out=[];async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await walk(path);else if(path.endsWith('.mjs'))out.push(path);}}await walk(root);return out;}

test('new production modules import only accepted GitHub Direct packages and Node-free relative modules except the CLI entrypoint',async()=>{
  const paths=(await Promise.all(roots.map(files))).flat();
  for(const path of paths){
    const source=await readFile(path,'utf8');
    assert.doesNotMatch(source,/apps\/audit-api|audit-r2-store|infra\/audit-cloudflare|cloudflare-audit-v1|CurveYield\s+Lite/,path);
    for(const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g))assert.ok(match[1].startsWith('.'),`${path}: ${match[1]}`);
  }
});

test('no submitted execution, shell interpolation, dynamic code, process spawning, container, RPC, wallet, signing, transaction, broadcast, or deployment capability exists',async()=>{
  const paths=(await Promise.all(roots.map(files))).flat();
  const forbidden=[
    /from\s+['"](?:node:)?(?:child_process|worker_threads|vm|cluster|net|tls|dns)['"]/,
    /\b(?:spawn|exec|execFile|fork|eval)\s*\(/,
    /\bnew\s+Function\b/,
    /\b(?:docker|podman|containerd|hardhat\s+run|forge|anvil|ganache|rpcUrl|privateKey|mnemonic|wallet|signer|signTransaction|sendTransaction|broadcast|deployContract|workflow_dispatch\s*\()\b/i
  ];
  for(const path of paths){const source=await readFile(path,'utf8');for(const pattern of forbidden)assert.doesNotMatch(source,pattern,path);}
});

test('credential material is not persisted, logged, returned, or embedded in service/result/report contracts',async()=>{
  const paths=(await Promise.all(roots.map(files))).flat();
  for(const path of paths){
    const source=await readFile(path,'utf8');
    assert.doesNotMatch(source,/console\.(?:log|error|warn)\([^\n]*(?:token|authorization|secret)/i,path);
    assert.doesNotMatch(source,/JSON\.stringify\([^\n]*(?:process\.env|GITHUB_TOKEN)/i,path);
    assert.doesNotMatch(source,/writeFile[^\n]*(?:token|authorization|secret)/i,path);
  }
});

test('network creation is confined to the trusted CLI transport and API host is fixed',async()=>{
  const paths=(await Promise.all(roots.map(files))).flat();
  for(const path of paths){
    const source=await readFile(path,'utf8');
    if(path.endsWith('github-actions-transport.mjs')){
      assert.match(source,/const API_BASE='https:\/\/api\.github\.com'/);
      continue;
    }
    assert.doesNotMatch(source,/\bfetch\s*\(|https:\/\/api\.github\.com/,path);
  }
});

test('workflow host exposes token only through a closure and never stores it in an object field',async()=>{
  const source=await readFile('apps/audit-github-direct-cli/src/workflow-host.mjs','utf8');
  assert.match(source,/tokenProvider:\(\)=>environment\.GITHUB_TOKEN/);
  assert.doesNotMatch(source,/token\s*:\s*environment\.GITHUB_TOKEN|authorization\s*:\s*environment\.GITHUB_TOKEN/);
});
