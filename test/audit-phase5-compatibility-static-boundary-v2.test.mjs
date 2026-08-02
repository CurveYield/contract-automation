import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function filesUnder(relative){const root=path.join(ROOT,relative);const out=[];for(const entry of fs.readdirSync(root,{withFileTypes:true})){const p=path.join(root,entry.name);if(entry.isDirectory())out.push(...filesUnder(path.relative(ROOT,p)));else if(/\.(?:mjs|js)$/.test(entry.name))out.push(p);}return out;}

test('owned production packages contain no execution, filesystem, network, install, secret, transaction, or Lite capability',()=>{
 const files=[...filesUnder('packages/audit-phase5-result-contracts/src'),...filesUnder('packages/audit-phase5-tool-catalog/src')];
 const forbidden=[/node:(?:fs|child_process|worker_threads|http|https|net|dns|dgram|vm)/,/\b(?:readFile|readdir|writeFile|spawn|execFile|fork)\s*\(/,/\bfetch\s*\(/,/\b(?:WebSocket|XMLHttpRequest|eval|Function)\s*\(/,/\b(?:npm|pnpm|yarn|bun|docker|podman|containerd)\b/i,/\b(?:privateKey|mnemonic|wallet|signer|rawTransaction|calldata|broadcast|deploy)\b/i,/CurveYield[\s_-]*Lite|curveyield-lite/i,/executionEnabled\s*:\s*true/];
 for(const file of files){const source=fs.readFileSync(file,'utf8');for(const pattern of forbidden)assert.doesNotMatch(source,pattern,`${path.relative(ROOT,file)} ${pattern}`);}
});

test('focused tests reference only CurveYield-owned Phase 5 fixtures',()=>{
 const files=fs.readdirSync(path.join(ROOT,'test')).filter(n=>/^audit-phase5-(?:result|catalog|compatibility)-/.test(n));
 for(const name of files){
   const source=fs.readFileSync(path.join(ROOT,'test',name),'utf8');
   assert.doesNotMatch(source,/test\/fixtures\/(?!audit-phase5)/);
   for(const match of source.matchAll(/test\/fixtures\/([^'"`\s)]+)/g)){
     assert.match(match[1],/^audit-phase5(?:\/|$)/,`${name}: ${match[0]}`);
   }
 }
});
