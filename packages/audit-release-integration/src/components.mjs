import { exact, identifier, positiveInteger, pathValue, sha40, optionalSha40, ordinaryArray, canonicalJson, frozen, fail } from './boundary.mjs';
import { digestOf } from './digest.mjs';
import { validatePublicInterfaceLock } from './interfaces.mjs';
import { COMPONENT_MANIFEST_SCHEMA, ALLOWED_RECOMMENDATIONS, ADAPTATION_KINDS } from './constants.mjs';

function validateReport(value,issueNumber,path='$.report'){
  const safe=exact(value,['issueNumber','commentId','url'],path),reportIssue=positiveInteger(safe.issueNumber,`${path}.issueNumber`),commentId=positiveInteger(safe.commentId,`${path}.commentId`);
  if(reportIssue!==issueNumber)fail('report_issue_mismatch',`${path}.issueNumber`);
  const url=`https://github.com/CurveYield/contract-automation/issues/${reportIssue}#issuecomment-${commentId}`;
  if(safe.url!==url)fail('invalid_report_url',`${path}.url`);
  return frozen({issueNumber:reportIssue,commentId,url});
}

export function validatePathOperation(entry,path){
  const safe=exact(entry,['path','sourceBlobSha','destinationBlobSha','adaptationKind','repairId'],path);
  const operation={path:pathValue(safe.path,`${path}.path`),sourceBlobSha:optionalSha40(safe.sourceBlobSha,`${path}.sourceBlobSha`),destinationBlobSha:optionalSha40(safe.destinationBlobSha,`${path}.destinationBlobSha`),adaptationKind:safe.adaptationKind,repairId:safe.repairId};
  if(!ADAPTATION_KINDS.has(operation.adaptationKind))fail('invalid_adaptation',`${path}.adaptationKind`);
  if(operation.adaptationKind==='exact'){
    if(!operation.sourceBlobSha||operation.sourceBlobSha!==operation.destinationBlobSha||operation.repairId!==null)fail('invalid_adaptation',path);
  }else if(operation.adaptationKind==='repaired'){
    if(!operation.sourceBlobSha||!operation.destinationBlobSha||operation.sourceBlobSha===operation.destinationBlobSha)fail('invalid_adaptation',path);
    operation.repairId=identifier(operation.repairId,`${path}.repairId`);
  }else if(operation.adaptationKind==='added'){
    if(operation.sourceBlobSha!==null||!operation.destinationBlobSha)fail('invalid_adaptation',path);
    operation.repairId=identifier(operation.repairId,`${path}.repairId`);
  }else{
    if(!operation.sourceBlobSha||operation.destinationBlobSha!==null)fail('invalid_adaptation',path);
    operation.repairId=identifier(operation.repairId,`${path}.repairId`);
  }
  return frozen(operation);
}

export function createComponentManifest(input){
  const safe=exact(input,['componentId','issueNumber','branch','finalSha','status','recommendation','report','paths','publicInterface']);
  if(safe.status!=='completed')fail('candidate_incomplete','$.status');
  if(!ALLOWED_RECOMMENDATIONS.has(safe.recommendation))fail('candidate_rejected','$.recommendation');
  const issueNumber=positiveInteger(safe.issueNumber,'$.issueNumber'),componentId=identifier(safe.componentId,'$.componentId');
  const paths=ordinaryArray(safe.paths,'$.paths',10_000).map((entry,index)=>validatePathOperation(entry,`$.paths[${index}]`)).sort((a,b)=>a.path.localeCompare(b.path));
  if(paths.length<1||new Set(paths.map(item=>item.path)).size!==paths.length)fail(paths.length<1?'missing_path':'duplicate_path','$.paths');
  const publicInterface=validatePublicInterfaceLock(safe.publicInterface);
  if(publicInterface.componentId!==componentId)fail('interface_component_mismatch','$.publicInterface.componentId');
  const ownedPaths=paths.filter(item=>item.destinationBlobSha!==null).map(item=>item.path),removedPaths=paths.filter(item=>item.destinationBlobSha===null).map(item=>item.path);
  if(safe.recommendation==='ACCEPT'){
    const ownedFiles=ownedPaths.filter(path=>/\.[A-Za-z0-9]+$/.test(path.split('/').at(-1)));
    if(ownedFiles.length>0){
      for(const entrypoint of publicInterface.entrypoints){
        if(!ownedPaths.some(path=>path===entrypoint||entrypoint.startsWith(`${path}/`)))fail('interface_entrypoint_unowned','$.publicInterface.entrypoints');
      }
    }
  }
  const requiresRepair=paths.some(item=>item.adaptationKind==='repaired'||item.adaptationKind==='deleted');
  if(requiresRepair&&safe.recommendation!=='ACCEPT WITH REPAIR')fail('recommendation_mismatch','$.recommendation');
  const body={schemaVersion:COMPONENT_MANIFEST_SCHEMA,componentId,issueNumber,branch:pathValue(safe.branch,'$.branch'),finalSha:sha40(safe.finalSha,'$.finalSha'),status:safe.status,recommendation:safe.recommendation,report:validateReport(safe.report,issueNumber),paths,ownedPaths,removedPaths,publicInterface};
  return frozen({...body,manifestDigest:digestOf(body)});
}

export function validateComponentManifest(value){
  const safe=exact(value,['schemaVersion','componentId','issueNumber','branch','finalSha','status','recommendation','report','paths','ownedPaths','removedPaths','publicInterface','manifestDigest']);
  if(safe.schemaVersion!==COMPONENT_MANIFEST_SCHEMA)fail('invalid_schema_version','$.schemaVersion');
  const rebuilt=createComponentManifest({componentId:safe.componentId,issueNumber:safe.issueNumber,branch:safe.branch,finalSha:safe.finalSha,status:safe.status,recommendation:safe.recommendation,report:safe.report,paths:safe.paths,publicInterface:safe.publicInterface});
  if(canonicalJson(safe.ownedPaths)!==canonicalJson(rebuilt.ownedPaths)||canonicalJson(safe.removedPaths)!==canonicalJson(rebuilt.removedPaths))fail('path_membership_mismatch','$.ownedPaths');
  if(safe.manifestDigest!==rebuilt.manifestDigest)fail('digest_mismatch','$.manifestDigest');
  return rebuilt;
}
