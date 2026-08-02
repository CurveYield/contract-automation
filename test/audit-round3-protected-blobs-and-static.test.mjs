import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const protectedBlobs = Object.freeze({
  '.github/workflows/github-native-simulate.yml': 'c6312e071401acdd6554bacfe753f3791b6d1502',
  'packages/runner/src/rpc-method-policy.mjs': '59dfa72f41a697d533720a4d8f939a81aeba6736',
  'packages/runner/src/fork-rpc-guard.mjs': '73690f16b506baa50ca471ce5b5566ccb601e765',
  'packages/runner/src/run-job.mjs': 'e6489c756d43a2f294120ac3c84687030fb919db',
  'packages/github-native-sim/src/fork-rpc-proxy.mjs': '4d7e2bd1114f5a37914b26447c9c79a1e40a58e6',
  'packages/github-native-sim/src/run-job-file.mjs': '8c4c82d76e249b74efc630c8cbf0d7707d25b5f2'
});
const auditRoots = [
  'audit-protocol','audit-r2-store','audit-profile-registry','audit-workspace-protocol','audit-workspaces',
  'audit-campaign-protocol','audit-campaigns','audit-evidence','audit-tool-profile-contracts','audit-tool-parsers',
  'audit-executor-adapters','audit-tool-result-contracts','audit-phase5-profile-contracts','audit-phase5-parsers',
  'audit-phase5-result-contracts','audit-phase5-tool-catalog','audit-phase6-profile-contracts','audit-phase6-parsers',
  'audit-phase6-result-contracts','audit-phase6-tool-catalog','audit-fork-protocol','audit-fork-mock-adapter','audit-forks',
  'audit-clean-room-protocol','audit-clean-room-access','audit-clean-room-campaigns','audit-controlled-merge','audit-provenance',
  'audit-release-integration'
];
async function files(root) {
  const output=[];
  async function walk(path){for(const entry of await readdir(path,{withFileTypes:true})){const child=join(path,entry.name);if(entry.isDirectory())await walk(child);else if(entry.name.endsWith('.mjs'))output.push(child);}}
  await walk(root); return output;
}
function gitBlobSha(bytes){return createHash('sha1').update(`blob ${bytes.byteLength}\0`).update(bytes).digest('hex');}

test('all six protected current-main blobs remain byte-identical',async()=>{
  for(const [path,expected] of Object.entries(protectedBlobs)){
    const bytes=await readFile(new URL(`../${path}`,import.meta.url));
    assert.equal(gitBlobSha(bytes),expected,path);
  }
});

test('Audit production modules remain transport-free and execution-disabled',async()=>{
  const forbidden=[
    /from\s+['"]node:(?:child_process|fs|fs\/promises|http|https|net|tls|dgram|worker_threads|vm|cluster)['"]/,
    /require\s*\(\s*['"]node:(?:child_process|fs|http|https|net|tls|dgram|worker_threads|vm|cluster)['"]\s*\)/,
    /\bfetch\s*\(/,
    /\beval\s*\(/,
    /\bnew\s+Function\b/,
    /executionEnabled\s*:\s*true/,
    /executorState\s*:\s*['"]available['"]/,
    /networkEnabled\s*:\s*true/,
    /signingEnabled\s*:\s*true/,
    /transactionEnabled\s*:\s*true/,
    /deploymentEnabled\s*:\s*true/
  ];
  let checked=0;
  for(const root of auditRoots){
    const directory=fileURLToPath(new URL(`../packages/${root}/src/`,import.meta.url));
    let paths=[];
    try{paths=await files(directory);}catch(error){if(error.code==='ENOENT')continue;throw error;}
    for(const path of paths){
      const source=await readFile(path,'utf8');
      for(const pattern of forbidden)assert.doesNotMatch(source,pattern,`${relative(process.cwd(),path)}: ${pattern}`);
      checked+=1;
    }
  }
  assert.ok(checked>=50,`expected broad production scan, got ${checked}`);
});
