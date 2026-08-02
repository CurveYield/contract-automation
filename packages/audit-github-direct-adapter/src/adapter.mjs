import { exactKeys,plainObject,validateCapabilityManifest,integer,fullName,commitSha,boundedString,denseArray,fail,frozenClone } from '../../audit-github-direct-protocol/src/index.mjs';
import { blobSha,validateLedgerMutation } from '../../audit-github-direct-ledger/src/index.mjs';
import { normalizeGitHubError,wrapTransportPromise } from './errors.mjs';
import { reconcilePublication,validatePublicationPlan } from './publications.mjs';
import { createArtifactMetadata,validateArtifactMetadata } from './artifacts.mjs';
import { validateRepositoryResponse,validateCommitResponse,validateBlobResponse,validateContentsResponse,validateLedgerMutationResponse,validatePublicationResponse } from './responses.mjs';
const methods=['getRepository','getCommit','getBlob','getContents','applyLedgerMutation','getPublication','publish','getArtifactMetadata'];
function validateTransport(value){const desc=plainObject(value,'$.transport'),keys=Object.keys(desc).sort();if(JSON.stringify(keys)!==JSON.stringify([...methods].sort())){const extra=keys.find((x)=>!methods.includes(x)),missing=methods.find((x)=>!keys.includes(x));fail(extra?'unknown_field':'missing_field',extra?`$.transport.${extra}`:`$.transport.${missing}`);}const result={};for(const name of methods){const fn=desc[name].value;if(typeof fn!=='function')fail('invalid_transport_method',`$.transport.${name}`);result[name]=fn.bind(value);}return result;}
function repoPath(value,path){const v=boundedString(value,path,512);if(v.startsWith('/')||v.includes('..')||v.includes('\\')||v.includes('//')||!/^[A-Za-z0-9_.@+\/-]+$/.test(v))fail('unsafe_path',path);return v;}
export function createInjectedGitHubAdapter(input){const v=exactKeys(input,['capabilityManifest','transport'],'$'),capability=validateCapabilityManifest(v.capabilityManifest),transport=validateTransport(v.transport),caps=new Set(capability.capabilities);
  function requireCap(name){if(!caps.has(name))fail('capability_denied','$.capabilityManifest.capabilities');}
  function identity(value,extra=[]){const x=exactKeys(value,['repositoryId','installationId','repositoryFullName','targetCommitSha',...extra],'$'),bound={repositoryId:integer(x.repositoryId,'$.repositoryId',1),installationId:integer(x.installationId,'$.installationId',1),repositoryFullName:fullName(x.repositoryFullName,'$.repositoryFullName'),targetCommitSha:commitSha(x.targetCommitSha,'$.targetCommitSha')};if(bound.repositoryId!==capability.repositoryId||bound.installationId!==capability.installationId||bound.repositoryFullName!==capability.repositoryFullName||bound.targetCommitSha!==capability.targetCommitSha)fail('identity_mismatch','$');return {x,bound};}
  const call=(name,args)=>{try{return wrapTransportPromise(transport[name](frozenClone(args)));}catch(error){return wrapTransportPromise(Promise.reject(error));}};
  const normalizeArtifact=(item)=>{try{return validateArtifactMetadata(item);}catch(error){if(error?.code!=='missing_field')throw error;return createArtifactMetadata(item);}};
  return Object.freeze({
    getRepository(value){requireCap('read-source');const {bound}=identity(value);return call('getRepository',bound).then((result)=>validateRepositoryResponse(result,bound));},
    getCommit(value){requireCap('read-source');const {bound}=identity(value);return call('getCommit',bound).then((result)=>validateCommitResponse(result,bound));},
    getBlob(value){requireCap('read-source');const {x,bound}=identity(value,['blobSha']),wanted=blobSha(x.blobSha,'$.blobSha');return call('getBlob',{...bound,blobSha:wanted}).then((result)=>validateBlobResponse(result,wanted));},
    getContents(value){requireCap('read-source');const {x,bound}=identity(value,['path']),path=repoPath(x.path,'$.path');return call('getContents',{...bound,path}).then((result)=>validateContentsResponse(result,path,bound));},
    applyLedgerMutation(value){requireCap('write-control-ledger');const {x,bound}=identity(value,['mutation']);const mutation=validateLedgerMutation(x.mutation);return call('applyLedgerMutation',{...bound,mutation}).then((result)=>validateLedgerMutationResponse(result,mutation));},
    publish(value){return (async()=>{const {x,bound}=identity(value,['plan']),plan=validatePublicationPlan(x.plan);const cap={check:'publish-check',comment:'publish-comment',status:'publish-status'}[plan.kind];requireCap(cap);const observed=await call('getPublication',{...bound,kind:plan.kind,idempotencyKey:plan.idempotencyKey});const decision=reconcilePublication({plan,observed});if(decision.action==='noop')return decision;const result=validatePublicationResponse(await call('publish',plan),plan);return frozenClone({action:'create',plan,result});})();},
    getArtifactMetadata(value){requireCap('read-artifact-metadata');const {bound}=identity(value);return call('getArtifactMetadata',bound).then((items)=>denseArray(items,'$.transportResult',100).map(normalizeArtifact));}
  });
}
export { normalizeGitHubError };
