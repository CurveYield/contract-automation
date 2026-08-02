import {
  exactKeys, integer, fullName, commitSha, boundedString, frozenClone, sha256, fail
} from '../../../packages/audit-github-direct-protocol/src/index.mjs';

const API_BASE='https://api.github.com';
const CONTROL_BRANCH='audit-direct/control-v1';
const ABSENT_BLOB_SHA='0'.repeat(40);
const fingerprint=(content)=>sha256(content).slice(7,47);
function encodePath(path){return path.split('/').map(encodeURIComponent).join('/');}
function encodeContent(value){return Buffer.from(JSON.stringify(value),'utf8').toString('base64');}
function decodeResponseContent(value,path){const text=Buffer.from(value,'base64').toString('utf8');if(path.startsWith('.audit-direct/v1/'))return JSON.parse(text);return text;}
function createApi({tokenProvider,fetchImpl}){
  if(typeof tokenProvider!=='function')fail('invalid_token_provider','$.tokenProvider');
  if(typeof fetchImpl!=='function')fail('invalid_fetch','$.fetchImpl');
  async function request(method,path,body){const token=tokenProvider();if(typeof token!=='string'||token.length<1)fail('authorization_unavailable','$');const response=await fetchImpl(`${API_BASE}${path}`,{method,headers:{accept:'application/vnd.github+json',authorization:`Bearer ${token}`,'x-github-api-version':'2022-11-28','content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(response.status===404)return null;if(!response.ok){const error=new Error('GitHub operation failed');error.status=response.status;throw error;}return response.status===204?null:response.json();}
  function repoPath(args,suffix=''){fullName(args.repositoryFullName,'$.repositoryFullName');commitSha(args.targetCommitSha,'$.targetCommitSha');return `/repos/${args.repositoryFullName}${suffix}`;}
  async function readContents(args,path,ref){const result=await request('GET',`${repoPath(args)}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`);if(result===null)return null;const content=decodeResponseContent(result.content,path);return {path,nativeBlobSha:result.sha,blobSha:fingerprint(content),content,ref};}
  async function writeContents(args,path,branch,content,nativeSha){const body={message:`audit-direct: update ${path}`,content:encodeContent(content),branch};if(nativeSha)body.sha=nativeSha;const result=await request('PUT',`${repoPath(args)}/contents/${encodePath(path)}`,body);return {nativeBlobSha:result.content.sha,commitSha:result.commit.sha};}
  return {request,repoPath,readContents,writeContents};
}

export function createGitHubActionsLedgerSnapshotReader(input){
  const v=exactKeys(input,['tokenProvider','fetchImpl'],'$'),api=createApi(v);
  return async function readLedger(request,path){
    const safe=boundedString(path,'$.path',512);
    if(!safe.startsWith('.audit-direct/v1/')||safe.includes('..')||safe.includes('\\'))fail('unsafe_path','$.path');
    const found=await api.readContents(request,safe,CONTROL_BRANCH);
    return found===null?null:frozenClone({content:found.content,blobSha:found.blobSha});
  };
}

export function createGitHubActionsTransport(input){
  const v=exactKeys(input,['tokenProvider','fetchImpl','issueNumber'],'$'),issueNumber=integer(v.issueNumber,'$.issueNumber',1),api=createApi(v);
  const publicationPath=(plan)=>`.audit-direct/v1/publications/${plan.kind}/${plan.idempotencyKey}.json`;
  return Object.freeze({
    async getRepository(args){const data=await api.request('GET',api.repoPath(args));return {repositoryId:data.id,fullName:data.full_name};},
    async getCommit(args){const data=await api.request('GET',`${api.repoPath(args)}/commits/${args.targetCommitSha}`);return {sha:data.sha};},
    async getBlob(args){commitSha(args.blobSha,'$.blobSha');const data=await api.request('GET',`${api.repoPath(args)}/git/blobs/${args.blobSha}`);return {blobSha:data.sha,sizeBytes:data.size};},
    async getContents(args){const path=boundedString(args.path,'$.path',512);if(path.includes('..')||path.startsWith('/')||path.includes('\\'))fail('unsafe_path','$.path');const ref=path.startsWith('.audit-direct/v1/')?CONTROL_BRANCH:args.targetCommitSha,found=await api.readContents(args,path,ref);return found===null?null:{path,blobSha:found.blobSha};},
    async applyLedgerMutation(args){const mutation=args.mutation,existing=await api.readContents(args,mutation.path,mutation.branch);if(mutation.operation==='create-immutable'){if(existing!==null){if(sha256(existing.content)!==mutation.contentDigest){const error=new Error('immutable_conflict');error.code='immutable_conflict';error.status=409;throw error;}return frozenClone({applied:true,nextBlobSha:mutation.nextContentBlobSha});}await api.writeContents(args,mutation.path,mutation.branch,mutation.content,null);return frozenClone({applied:true,nextBlobSha:mutation.nextContentBlobSha});}if(existing===null){if(mutation.expectedBlobSha!==ABSENT_BLOB_SHA){const error=new Error('stale_blob_sha');error.code='stale_blob_sha';error.status=409;throw error;}await api.writeContents(args,mutation.path,mutation.branch,mutation.content,null);return frozenClone({applied:true,nextBlobSha:mutation.nextContentBlobSha});}if(existing.blobSha!==mutation.expectedBlobSha){const error=new Error('stale_blob_sha');error.code='stale_blob_sha';error.status=409;throw error;}await api.writeContents(args,mutation.path,mutation.branch,mutation.content,existing.nativeBlobSha);return frozenClone({applied:true,nextBlobSha:mutation.nextContentBlobSha});},
    async getPublication(args){const found=await api.readContents(args,publicationPath(args),CONTROL_BRANCH);return found?.content??null;},
    async publish(plan){const existing=await api.readContents(plan,publicationPath(plan),CONTROL_BRANCH);if(existing!==null){if(JSON.stringify(existing.content)!==JSON.stringify(plan)){const error=new Error('publication_conflict');error.code='publication_conflict';error.status=409;throw error;}return frozenClone({published:true,publicationId:plan.publicationId});}if(plan.kind==='check')await api.request('POST',`${api.repoPath(plan)}/check-runs`,{name:plan.name,head_sha:plan.targetCommitSha,status:'completed',conclusion:plan.conclusion,external_id:plan.idempotencyKey,output:{title:plan.name,summary:plan.summary}});else if(plan.kind==='status')await api.request('POST',`${api.repoPath(plan)}/statuses/${plan.targetCommitSha}`,{state:plan.state,description:plan.description,context:plan.context});else await api.request('POST',`${api.repoPath(plan)}/issues/${issueNumber}/comments`,{body:plan.body});await api.writeContents(plan,publicationPath(plan),CONTROL_BRANCH,plan,null);return frozenClone({published:true,publicationId:plan.publicationId});},
    async getArtifactMetadata(args){const data=await api.request('GET',`${api.repoPath(args)}/actions/artifacts?per_page=100`);return frozenClone((data?.artifacts??[]).slice(0,100).map(item=>({artifactId:`artifact-${item.id}`,name:String(item.name).slice(0,256),sizeBytes:item.size_in_bytes,digest:/^sha256:[0-9a-f]{64}$/.test(item.digest??'')?item.digest:sha256(`${item.id}:${item.size_in_bytes}:${item.created_at}`),expired:Boolean(item.expired),createdAt:new Date(item.created_at).toISOString(),expiresAt:new Date(item.expires_at).toISOString()})));}
  });
}
