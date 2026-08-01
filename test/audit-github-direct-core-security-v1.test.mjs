import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir,readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  DIRECT_MODE_ID,AUTOMATIC_FALLBACK,createDirectRequest,createCapabilityManifest
} from '../packages/audit-github-direct-protocol/src/index.mjs';
import {
  createPermissionManifest,planCheckPublication,normalizeGitHubError
} from '../packages/audit-github-direct-adapter/src/index.mjs';
import {
  admitDirectJob,orchestrateDirectJob,planRunnerPublication
} from '../packages/audit-github-direct-runner/src/index.mjs';

const roots=['packages/audit-github-direct-protocol','packages/audit-github-direct-ledger','packages/audit-github-direct-adapter','packages/audit-github-direct-runner'];
async function files(root){const out=[];async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await walk(path);else if(path.endsWith('.mjs'))out.push(path);}}await walk(root);return out;}
const ts='2026-08-01T18:00:00.000Z',later='2026-08-01T18:05:00.000Z';
const requestInput={repositoryId:123,installationId:456,repositoryFullName:'curveyield/contract-automation',requesterId:'user-1',policyVersion:'direct-policy-v1',profileId:'hardhat-test-v1',parserVersion:'hardhat-test-parser-v1',resultContractVersion:'phase5-tool-result-v1',reportContractVersion:'audit-report-v1',targetCommitSha:'a'.repeat(40),requestedAt:ts,idempotencyKey:'request-security'};

test('all production imports are runtime-neutral relative GitHub Direct modules only',async()=>{
  const paths=(await Promise.all(roots.map(files))).flat().sort();
  assert.ok(paths.length>=25);
  for(const path of paths){
    const source=await readFile(path,'utf8');
    assert.doesNotMatch(source,/from\s+['"]node:/,path);
    for(const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)){
      assert.ok(match[1].startsWith('.'),`${path}: ${match[1]}`);
      assert.doesNotMatch(match[1],/cloudflare|r2|audit-api|audit-web|lite/i,path);
    }
  }
});

test('credential, command, URL, workflow, and execution fields cannot enter direct requests',()=>{
  for(const [key,value] of Object.entries({token:'ghs_secret',authorization:'Bearer secret',privateKey:'secret',command:'npm test',url:'https://example.test',workflow:'audit.yml',runner:'self-hosted',executionEnabled:true})){
    assert.throws(()=>createDirectRequest({...requestInput,[key]:value}),{code:'unknown_field'},key);
  }
});

test('capability, permission, publication, result, and report planning serialize no credentials',()=>{
  const request=createDirectRequest(requestInput);
  const capability=createCapabilityManifest({request,authorizationKind:'github-token',capabilities:['read-source','write-control-ledger','publish-check','publish-status'],issuedAt:ts,expiresAt:later});
  const permission=createPermissionManifest({capabilityManifest:capability});
  const admission=admitDirectJob({request,capabilityManifest:capability,sourceCommitSha:request.targetCommitSha,admittedAt:later});
  const outcome=orchestrateDirectJob({request,admission,producedAt:later});
  const publication=planRunnerPublication({request,outcome,resultId:'result-security',reportId:'report-security',publishedAt:later});
  const check=planCheckPublication({request,name:'CurveYield Direct Audit',summary:'Execution unavailable',conclusion:'neutral',at:later});
  const text=JSON.stringify({request,capability,permission,admission,outcome,publication,check});
  assert.doesNotMatch(text,/(?:gh[ps]_[A-Za-z0-9]+|bearer\s+|authorization\s*:|private[_-]?key|mnemonic|secret\s*[:=]|https?:\/\/)/i);
});

test('transport errors never reflect credential-bearing source objects',()=>{
  const source={status:403,message:'Bearer ghs_secret',request:{headers:{authorization:'Bearer ghs_secret'}},response:{body:'token=secret'},url:'https://api.github.com/private'};
  const normalized=normalizeGitHubError(source);
  assert.deepEqual(normalized,{schemaVersion:'github-direct-transport-error-v1',code:'permission_denied',status:403,retryable:false,message:'GitHub operation failed'});
  assert.doesNotMatch(JSON.stringify(normalized),/ghs_|bearer|authorization|secret|https?:/i);
});

test('representative outputs are recursively frozen, replay-stable, and never auto-fallback',()=>{
  const request=createDirectRequest(requestInput);
  const capability=createCapabilityManifest({request,authorizationKind:'github-token',capabilities:['read-source','write-control-ledger','publish-check','publish-status'],issuedAt:ts,expiresAt:later});
  const admission=admitDirectJob({request,capabilityManifest:capability,sourceCommitSha:request.targetCommitSha,admittedAt:later});
  const first=orchestrateDirectJob({request,admission,producedAt:later});
  const replay=orchestrateDirectJob({request,admission,producedAt:later});
  assert.deepEqual(replay,first);
  assert.equal(Object.isFrozen(first),true);
  assert.equal(Object.isFrozen(first.resultManifest),true);
  assert.equal(DIRECT_MODE_ID,'github-direct-audit-v1');
  assert.equal(AUTOMATIC_FALLBACK,false);
});
