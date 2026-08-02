import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir,readFile } from 'node:fs/promises';
import { join } from 'node:path';
const roots=['packages/audit-github-direct-protocol','packages/audit-github-direct-ledger','packages/audit-github-direct-adapter','packages/audit-github-direct-runner'];
async function files(root){const out=[];async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await walk(path);else if(path.endsWith('.mjs'))out.push(path);}}await walk(root);return out;}

test('GitHub Direct core has no Cloudflare, R2, API, Lite, or fallback imports',async()=>{
  const paths=(await Promise.all(roots.map(files))).flat();
  for(const path of paths){const source=await readFile(path,'utf8');assert.doesNotMatch(source,/apps\/audit-api|audit-r2-store|infra\/audit-cloudflare|cloudflare-audit-v1|CurveYield\s+Lite/,path);}
});

test('GitHub Direct core has no process, filesystem, network client, execution, wallet, workflow, or deployment capability',async()=>{
  const paths=(await Promise.all(roots.map(files))).flat();
  const forbidden=[/from\s+['"](?:node:)?(?:fs|child_process|worker_threads|http|https|net|dns|tls)['"]/,/\b(?:spawn|exec|execFile|fork|eval|fetch)\s*\(/,/\bnew\s+(?:Function|WebSocket)\b/,/\b(?:wallet|signer|mnemonic|privateKey|calldata|broadcast|deploy|workflow_dispatch|pull_request_target)\b/i];
  for(const path of paths){const source=await readFile(path,'utf8');for(const pattern of forbidden)assert.doesNotMatch(source,pattern,path);}
});

test('Cloudflare and R2 credentials are not required by module import',async()=>{
  const names=['CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY'];
  const saved=Object.fromEntries(names.map((name)=>[name,process.env[name]]));
  for(const name of names)delete process.env[name];
  try{for(const root of roots)await import(`../${root}/src/index.mjs?credential-absence=${root}`);}finally{for(const [name,value] of Object.entries(saved))if(value!==undefined)process.env[name]=value;}
});
