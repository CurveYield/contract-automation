import {
  exactKeys, integer, fullName, commitSha, boundedString, frozenClone, sha256, fail
} from '../../../packages/audit-github-direct-protocol/src/index.mjs';

const API_BASE='https://api.github.com';
const CONTROL_BRANCH='audit-direct/control-v1';
const ABSENT_BLOB_SHA='0'.repeat(40);

function encodePath(path){return path.split('/').map(encodeURIComponent).join('/');}
function encodeContent(value){return Buffer.from(JSON.stringify(value),'utf8').toString('base64');}
function decodeContent(value){return JSON.parse(Buffer.from(value,'base64').toString('utf8'));}

export function createGitHubActionsTransport(input){
  const v=exactKeys(input,['tokenProvider','fetchImpl','issueNumber'],'$');
  if(typeof v.tokenProvider!=='function')fail('invalid_token_provider','$.tokenProvider');
  if(typeof v.fetchImpl!=='function')fail('invalid_fetch','$.fetchImpl');
  const issueNumber=integer(v.issueNumber,'$.issueNumber',1);
  async function request(method,path,body){
    const token=v.tokenProvider();
    if(typeof token!=='string'||token.length<1)fail('authorization_unavailable','$');
    const response=await v.fetchImpl(`${API_BASE}${path}`,{
      method,
      headers:{accept:'application/vnd.github+json',authorization:`Bearer ${token}`,'x-github-api-version':'2022-11-28','content-type':'application/json'},
      body:body===undefined?undefined:JSON.stringify(body)
    });
    if(response.status===404)return null;
    if(!response.ok){const error=new Error('GitHub operation failed');error.status=response.status;throw error;}
    return response.status===204?null:response.json();
  }
  function repoPath(args,suffix=''){
    fullName(args.repositoryFullName,'$.repositoryFullName');commitSha(args.targetCommitSha,'$.targetCommitSha');
    return `/repos/${args.repositoryFullName}${suffix}`;
  }
  async function readContents(args,path,ref){
    const result=await request('GET',`${repoPath(args)}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`);
    if(result===null)return null;
    return frozenClone({path,blobSha:result.sha,content:decodeContent(result.content),ref});
  }
  async function writeContents(args,path,branch,content,sha){
    const body={message:`audit-direct: update ${path}`,content:encodeContent(content),branch};
    if(sha!==null&&sha!==undefined)body.sha=sha;
    const result=await request('PUT',`${repoPath(args)}/contents/${encodePath(path)}`,body);
    return frozenClone({applied:true,nextBlobSha:result.content.sha,commitSha:result.commit.sha});
  }
  const publicationPath=(plan)=>`.audit-direct/v1/publications/${plan.kind}/${plan.idempotencyKey}.json`;
  return Object.freeze({
    async getRepository(args){const data=await request('GET',repoPath(args));return {repositoryId:data.id,fullName:data.full_name};},
    async getCommit(args){const data=await request('GET',`${repoPath(args)}/commits/${args.targetCommitSha}`);return {sha:data.sha};},
    async getBlob(args){commitSha(args.blobSha,'$.blobSha');const data=await request('GET',`${repoPath(args)}/git/blobs/${args.blobSha}`);return {blobSha:data.sha,sizeBytes:data.size};},
    getContents(args){
      const path=boundedString(args.path,'$.path',512);
      if(path.includes('..')||path.startsWith('/')||path.includes('\\'))fail('unsafe_path','$.path');
      const ref=path.startsWith('.audit-direct/v1/')?CONTROL_BRANCH:args.targetCommitSha;
      return readContents(args,path,ref);
    },
    async applyLedgerMutation(args){
      const mutation=args.mutation;
      const existing=await readContents(args,mutation.path,mutation.branch);
      if(mutation.operation==='create-immutable'){
        if(existing!==null){
          if(sha256(existing.content)!==mutation.contentDigest){const error=new Error('immutable_conflict');error.code='immutable_conflict';error.status=409;throw error;}
          return frozenClone({applied:false,nextBlobSha:existing.blobSha,commitSha:null});
        }
        return writeContents(args,mutation.path,mutation.branch,mutation.content,null);
      }
      if(existing===null){
        if(mutation.expectedBlobSha!==ABSENT_BLOB_SHA){const error=new Error('stale_blob_sha');error.code='stale_blob_sha';error.status=409;throw error;}
        return writeContents(args,mutation.path,mutation.branch,mutation.content,null);
      }
      if(existing.blobSha!==mutation.expectedBlobSha){const error=new Error('stale_blob_sha');error.code='stale_blob_sha';error.status=409;throw error;}
      return writeContents(args,mutation.path,mutation.branch,mutation.content,mutation.expectedBlobSha);
    },
    async getPublication(args){
      const found=await readContents(args,publicationPath(args),CONTROL_BRANCH);
      return found?.content??null;
    },
    async publish(plan){
      const existing=await readContents(plan,publicationPath(plan),CONTROL_BRANCH);
      if(existing!==null){
        if(JSON.stringify(existing.content)!==JSON.stringify(plan)){const error=new Error('publication_conflict');error.code='publication_conflict';error.status=409;throw error;}
        return frozenClone({action:'noop',publicationId:plan.publicationId});
      }
      let published;
      if(plan.kind==='check')published=await request('POST',`${repoPath(plan)}/check-runs`,{name:plan.name,head_sha:plan.targetCommitSha,status:'completed',conclusion:plan.conclusion,external_id:plan.idempotencyKey,output:{title:plan.name,summary:plan.summary}});
      else if(plan.kind==='status')published=await request('POST',`${repoPath(plan)}/statuses/${plan.targetCommitSha}`,{state:plan.state,description:plan.description,context:plan.context});
      else published=await request('POST',`${repoPath(plan)}/issues/${issueNumber}/comments`,{body:plan.body});
      await writeContents(plan,publicationPath(plan),CONTROL_BRANCH,plan,null);
      return frozenClone({published:true,publicationId:plan.publicationId});
    },
    async getArtifactMetadata(args){
      const data=await request('GET',`${repoPath(args)}/actions/artifacts?per_page=100`);
      return frozenClone((data?.artifacts??[]).slice(0,100).map((item)=>({
        artifactId:`artifact-${item.id}`,
        name:String(item.name).slice(0,256),
        sizeBytes:item.size_in_bytes,
        digest:/^sha256:[0-9a-f]{64}$/.test(item.digest??'')?item.digest:sha256(`${item.id}:${item.size_in_bytes}:${item.created_at}`),
        expired:Boolean(item.expired),
        createdAt:new Date(item.created_at).toISOString(),
        expiresAt:new Date(item.expires_at).toISOString()
      })));
    }
  });
}
