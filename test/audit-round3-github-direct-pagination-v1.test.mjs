import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubActionsTransport } from '../apps/audit-github-direct-cli/src/github-actions-transport.mjs';
import { createDirectRequest } from '../packages/audit-github-direct-protocol/src/index.mjs';
import { planCommentPublication } from '../packages/audit-github-direct-adapter/src/index.mjs';

const at='2026-08-02T03:34:00.000Z';
const request=createDirectRequest({
  repositoryId:123,
  installationId:456,
  repositoryFullName:'curveyield/contract-automation',
  requesterId:'actor-123',
  policyVersion:'direct-policy-v1',
  profileId:'hardhat-test-v1',
  parserVersion:'hardhat-test-parser-v1',
  resultContractVersion:'phase5-tool-result-v1',
  reportContractVersion:'audit-report-v1',
  targetCommitSha:'a'.repeat(40),
  requestedAt:at,
  idempotencyKey:'pagination-test'
});
const response=(status,body)=>({status,ok:status>=200&&status<300,json:async()=>body});

test('comment reconciliation searches bounded pages before creating a duplicate',async()=>{
  const plan=planCommentPublication({request,body:'existing comment',at});
  let posts=0;
  let journalWrites=0;
  const fetchImpl=async(url,init)=>{
    if(url.includes('/contents/')){
      if(init.method==='GET')return response(404,null);
      journalWrites++;
      return response(201,{content:{sha:'b'.repeat(40)},commit:{sha:'c'.repeat(40)}});
    }
    if(url.includes('/issues/115/comments')){
      const page=Number(new URL(url).searchParams.get('page')??'1');
      if(init.method==='GET'){
        if(page===1)return response(200,Array.from({length:100},(_,i)=>({id:i+1,body:`other-${i}`})));
        if(page===2)return response(200,[{id:101,body:`existing comment\n\n<!-- audit-direct:${plan.publicationId} -->`}]);
        return response(200,[]);
      }
      posts++;
      return response(201,{id:999});
    }
    return response(200,{});
  };
  const transport=createGitHubActionsTransport({tokenProvider:()=> 'token',fetchImpl,issueNumber:115});
  const result=await transport.publish(plan);
  assert.equal(result.published,true);
  assert.equal(posts,0);
  assert.equal(journalWrites,1);
});

test('artifact lookup sends exact target name to GitHub and filters the response again',async()=>{
  const wanted=`audit-direct-result-${request.repositoryId}-${request.targetCommitSha}`;
  let queriedName=null;
  const fetchImpl=async(url)=>{
    if(url.includes('/actions/artifacts'))queriedName=new URL(url).searchParams.get('name');
    return response(200,{artifacts:[
      {id:1,name:wanted,size_in_bytes:1,digest:`sha256:${'1'.repeat(64)}`,expired:false,created_at:at,expires_at:'2026-08-03T03:34:00.000Z'},
      {id:2,name:'unrelated',size_in_bytes:1,digest:`sha256:${'2'.repeat(64)}`,expired:false,created_at:at,expires_at:'2026-08-03T03:34:00.000Z'}
    ]});
  };
  const transport=createGitHubActionsTransport({tokenProvider:()=> 'token',fetchImpl,issueNumber:115});
  const items=await transport.getArtifactMetadata(request);
  assert.equal(queriedName,wanted);
  assert.deepEqual(items.map((item)=>item.name),[wanted]);
});
