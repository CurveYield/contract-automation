import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubActionsTransport } from '../apps/audit-github-direct-cli/src/github-actions-transport.mjs';
import { createDirectRequest } from '../packages/audit-github-direct-protocol/src/index.mjs';
import { planStatusPublication } from '../packages/audit-github-direct-adapter/src/index.mjs';

function response(status,body){return {status,ok:status>=200&&status<300,json:async()=>body};}
const identity={repositoryId:123,installationId:456,repositoryFullName:'curveyield/contract-automation',targetCommitSha:'a'.repeat(40)};

test('transport uses fixed api.github.com URLs and token only in request headers',async()=>{
  const calls=[];
  const fetchImpl=async(url,init)=>{calls.push({url,init});return response(200,{id:123,full_name:'curveyield/contract-automation',sha:identity.targetCommitSha,artifacts:[]})};
  const transport=createGitHubActionsTransport({tokenProvider:()=> 'ghs_secret',fetchImpl,issueNumber:104});
  await transport.getRepository(identity);
  await transport.getCommit(identity);
  assert.deepEqual(calls.slice(0,2).map(x=>x.url),[
    'https://api.github.com/repos/curveyield/contract-automation',
    `https://api.github.com/repos/curveyield/contract-automation/commits/${identity.targetCommitSha}`
  ]);
  assert.equal(calls[0].init.headers.authorization,'Bearer ghs_secret');
  assert.doesNotMatch(JSON.stringify(await transport.getArtifactMetadata({...identity})),/ghs_secret|bearer|authorization/i);
});

test('contents reads derive target/control refs and reject unsafe paths',async()=>{
  const calls=[];
  const encoded=Buffer.from(JSON.stringify({ok:true})).toString('base64');
  const fetchImpl=async(url,init)=>{calls.push(url);return response(200,{sha:'b'.repeat(40),content:encoded,artifacts:[]})};
  const transport=createGitHubActionsTransport({tokenProvider:()=> 'token',fetchImpl,issueNumber:104});
  const target=await transport.getContents({...identity,path:'contracts/A.sol'});
  const ledger=await transport.getContents({...identity,path:'.audit-direct/v1/current/job.json'});
  assert.equal(target.ref,identity.targetCommitSha);
  assert.equal(ledger.ref,'audit-direct/control-v1');
  assert.match(calls[0],new RegExp(`ref=${identity.targetCommitSha}`));
  assert.match(calls[1],/ref=audit-direct%2Fcontrol-v1/);
  assert.throws(()=>transport.getContents({...identity,path:'../../secret'}),{code:'unsafe_path'});
});

test('transport immutable create and CAS are idempotent/conflict-safe',async()=>{
  const encoded=Buffer.from(JSON.stringify({x:1})).toString('base64');
  let existing=null;
  const fetchImpl=async(url,init)=>{
    if(init.method==='GET')return existing===null?response(404,null):response(200,{sha:existing.sha,content:encoded});
    existing={sha:'c'.repeat(40)};return response(200,{content:{sha:existing.sha},commit:{sha:'d'.repeat(40)}});
  };
  const transport=createGitHubActionsTransport({tokenProvider:()=> 'token',fetchImpl,issueNumber:104});
  const create={schemaVersion:'github-direct-ledger-mutation-v1',modeId:'github-direct-audit-v1',branch:'audit-direct/control-v1',operation:'create-immutable',path:'.audit-direct/v1/requests/job.json',content:{x:1},contentDigest:(await import('../packages/audit-github-direct-protocol/src/index.mjs')).sha256({x:1}),expectedBlobSha:null,nextContentBlobSha:'f'.repeat(40),sideEffects:false,usesPrefixListing:false};
  assert.equal((await transport.applyLedgerMutation({...identity,mutation:create})).applied,true);
  assert.equal((await transport.applyLedgerMutation({...identity,mutation:create})).applied,false);
  const cas={...create,operation:'update-cas',expectedBlobSha:'0'.repeat(40),content:{x:2}};
  await assert.rejects(()=>transport.applyLedgerMutation({...identity,mutation:cas}),{code:'stale_blob_sha'});
});

test('publication records reconcile before GitHub side effects',async()=>{
  const calls=[];
  const request=createDirectRequest({repositoryId:123,installationId:456,repositoryFullName:'curveyield/contract-automation',requesterId:'user-1',policyVersion:'direct-policy-v1',profileId:'hardhat-test-v1',parserVersion:'hardhat-test-parser-v1',resultContractVersion:'phase5-tool-result-v1',reportContractVersion:'audit-report-v1',targetCommitSha:identity.targetCommitSha,requestedAt:'2026-08-01T23:40:00.000Z',idempotencyKey:'transport-publication'});
  const plan=planStatusPublication({request,state:'error',description:'Unavailable',context:'curveyield/direct',at:'2026-08-01T23:40:00.000Z'});
  const encoded=Buffer.from(JSON.stringify(plan)).toString('base64');
  const fetchImpl=async(url,init)=>{calls.push([init.method,url]);if(url.includes('/contents/'))return response(200,{sha:'b'.repeat(40),content:encoded});return response(500,{})};
  const transport=createGitHubActionsTransport({tokenProvider:()=> 'token',fetchImpl,issueNumber:104});
  assert.equal((await transport.publish(plan)).action,'noop');
  assert.equal(calls.length,1);
});

test('workflow host reads current, index, admission, and outcome through fixed derived paths',async()=>{
  const source=await (await import('node:fs/promises')).readFile(new URL('../apps/audit-github-direct-cli/src/workflow-host.mjs',import.meta.url),'utf8');
  assert.match(source,/manifests\/\$\{request\.jobId\}-admission\.json/);
  assert.match(source,/manifests\/\$\{request\.jobId\}\.json/);
  assert.match(source,/kind==='report'/);
  assert.doesNotMatch(source,/snapshotReader\([^)]*path|callerPath|inputPath/);
});
