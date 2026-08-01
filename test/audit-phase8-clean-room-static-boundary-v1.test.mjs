import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const roots=[
  'packages/audit-clean-room-protocol','packages/audit-clean-room-access','packages/audit-clean-room-campaigns','packages/audit-controlled-merge','packages/audit-provenance'
];
async function files(root){const out=[];async function walk(path){for(const entry of await readdir(path,{withFileTypes:true})){const full=join(path,entry.name);if(entry.isDirectory())await walk(full);else if(entry.name.endsWith('.mjs'))out.push(full);}}await walk(root);return out;}

test('Phase 8 production sources have no execution, filesystem, network, cloud, wallet, or deployment capability',async()=>{
  const paths=(await Promise.all(roots.map(files))).flat().sort();assert.equal(paths.length,9);
  const forbidden=[
    [/from\s+['"](?:node:)?(?:fs|fs\/promises|child_process|worker_threads|http|https|net|dns|tls|dgram)['"]/,'forbidden import'],
    [/\b(?:spawn|exec|execFile|fork|fetch|eval)\s*\(/,'forbidden execution/network call'],
    [/\bnew\s+(?:Function|WebSocket)\b/,'dynamic/network constructor'],
    [/\b(?:ListObjects|listObjects|readdir|readFile|writeFile|unlink|mkdir)\b/,'filesystem or listing capability'],
    [/\b(?:npm|pnpm|yarn|docker|podman|kubectl)\b/,'package/container capability'],
    [/\b(?:wallet|signer|mnemonic|privateKey|calldata|broadcastTransaction|deployContract)\b/,'wallet/deployment capability'],
    [/\b(?:Cloudflare|R2Bucket|aws-sdk|@aws-sdk)\b/,'direct cloud SDK coupling'],
    [/CurveYield\s+Lite|AUDIT_EXECUTION_ENABLED\s*=\s*true/,'Lite/execution enablement']
  ];
  let matches=0;
  for(const path of paths){const source=await readFile(path,'utf8');for(const [pattern,label] of forbidden){if(pattern.test(source)){matches++;assert.fail(`${label}: ${path}`);}}}
  assert.equal(matches,0);
});

test('Phase 8 production imports remain within owned packages plus node crypto',async()=>{
  const paths=(await Promise.all(roots.map(files))).flat();
  for(const path of paths){const source=await readFile(path,'utf8');for(const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)){const spec=match[1];assert.ok(spec==='node:crypto'||spec.startsWith('.')||spec.includes('audit-clean-room-')||spec.includes('audit-controlled-merge')||spec.includes('audit-provenance'),`${path}: ${spec}`);}}
});

test('Phase 8 fixtures contain no credential, authorization, signed URL, or host-path leakage',async()=>{
  const names=(await readdir('test/fixtures/audit-phase8')).sort();assert.equal(names.length,4);
  const forbidden=/(?:Authorization\s*:|Bearer\s+[A-Za-z0-9._-]+|PRIVATE[_ -]?KEY|MNEMONIC|API[_ -]?KEY|https?:\/\/|[A-Za-z]:\\(?:Users|home)|\/(?:home|mnt|Users)\/)/i;
  for(const name of names){const text=await readFile(join('test/fixtures/audit-phase8',name),'utf8');assert.doesNotMatch(text,forbidden,name);JSON.parse(text);}
});

test('Phase 8 production code contains no prefix listing or execution-enablement state',async()=>{
  const paths=(await Promise.all(roots.map(files))).flat();
  for(const path of paths){const source=await readFile(path,'utf8');assert.doesNotMatch(source,/usesPrefixListing\s*:\s*true|executionEnabled\s*:\s*true|runnable\s*:\s*true/,path);}
});
