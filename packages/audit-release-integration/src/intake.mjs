import { exact, sortedUnique, pathValue, ordinaryArray, canonicalJson, sha40, identifier, frozen, fail } from './boundary.mjs';
import { digestOf } from './digest.mjs';
import { validateComponentManifest } from './components.mjs';
import { validateSharedFileUnion } from './unions.mjs';
import { composeReleaseCapabilities } from './interfaces.mjs';
import { INTAKE_PLAN_SCHEMA, RELEASE_MANIFEST_SCHEMA, ROUND4_INTAKE_SLOTS } from './constants.mjs';

function pathOverlap(left,right){return left===right||left.startsWith(`${right}/`)||right.startsWith(`${left}/`);}
function operationFor(candidate,path){return candidate.paths.find(operation=>operation.path===path&&operation.destinationBlobSha!==null);}

export function createReleaseIntakePlan(input){
  const safe=exact(input,['baseSha','candidates','protectedPaths','sharedUnions']);
  const protectedPaths=sortedUnique(safe.protectedPaths,'$.protectedPaths',10_000,pathValue);
  const candidates=ordinaryArray(safe.candidates,'$.candidates',128).map(validateComponentManifest).sort((a,b)=>a.componentId.localeCompare(b.componentId));
  if(candidates.length<1)fail('missing_candidate','$.candidates');
  if(new Set(candidates.map(item=>item.componentId)).size!==candidates.length)fail('duplicate_component','$.candidates');
  const sharedUnions=ordinaryArray(safe.sharedUnions,'$.sharedUnions',128).map(validateSharedFileUnion).sort((a,b)=>a.path.localeCompare(b.path));
  if(new Set(sharedUnions.map(item=>item.path)).size!==sharedUnions.length)fail('duplicate_union_path','$.sharedUnions');
  const unionByPath=new Map(sharedUnions.map(item=>[item.path,item])),ownership=[];
  for(const candidate of candidates)for(const operation of candidate.paths){
    if(protectedPaths.some(p=>pathOverlap(p,operation.path)))fail('protected_path','$.candidates');
    for(const conflict of ownership.filter(entry=>pathOverlap(entry.path,operation.path))){
      const exactShared=conflict.path===operation.path&&conflict.destinationBlobSha!==null&&operation.destinationBlobSha!==null&&unionByPath.has(operation.path);
      if(!exactShared)fail('path_overlap','$.candidates');
    }
    ownership.push({componentId:candidate.componentId,path:operation.path,sourceBlobSha:operation.sourceBlobSha,destinationBlobSha:operation.destinationBlobSha});
  }
  for(const union of sharedUnions){
    if(protectedPaths.some(p=>pathOverlap(p,union.path)))fail('protected_path','$.sharedUnions');
    const owners=ownership.filter(entry=>entry.path===union.path&&entry.destinationBlobSha!==null),expectedIds=owners.map(x=>x.componentId).sort(),inputIds=union.inputs.map(x=>x.componentId).sort();
    if(owners.length<2||canonicalJson(expectedIds)!==canonicalJson(inputIds))fail('union_ownership_mismatch','$.sharedUnions');
    for(const inputEntry of union.inputs){
      const candidate=candidates.find(item=>item.componentId===inputEntry.componentId),operation=candidate?operationFor(candidate,union.path):null;
      if(!operation)fail('union_ownership_mismatch','$.sharedUnions');
      if(operation.sourceBlobSha!==union.baseBlobSha)fail('union_base_mismatch','$.sharedUnions');
      if(operation.destinationBlobSha!==inputEntry.blobSha)fail('union_blob_mismatch','$.sharedUnions');
    }
  }
  return frozen({schemaVersion:INTAKE_PLAN_SCHEMA,baseSha:sha40(safe.baseSha,'$.baseSha'),candidates,protectedPaths,sharedUnions,capabilities:composeReleaseCapabilities(candidates.map(item=>item.publicInterface))});
}

function validateProtectedBlob(entry,path){const safe=exact(entry,['path','blobSha'],path);return{path:pathValue(safe.path,`${path}.path`),blobSha:sha40(safe.blobSha,`${path}.blobSha`)};}

export function createReleaseIntegrationManifest(input){
  const safe=exact(input,['baseSha','components','protectedBlobs','sharedUnions','staleInputs','round4Slots']);
  const protectedBlobs=ordinaryArray(safe.protectedBlobs,'$.protectedBlobs',10_000).map((entry,index)=>validateProtectedBlob(entry,`$.protectedBlobs[${index}]`)).sort((a,b)=>a.path.localeCompare(b.path));
  if(new Set(protectedBlobs.map(item=>item.path)).size!==protectedBlobs.length)fail('duplicate_protected_path','$.protectedBlobs');
  const plan=createReleaseIntakePlan({baseSha:safe.baseSha,candidates:safe.components,protectedPaths:protectedBlobs.map(item=>item.path),sharedUnions:safe.sharedUnions});
  const staleInputs=sortedUnique(safe.staleInputs,'$.staleInputs',128,identifier),round4Slots=ordinaryArray(safe.round4Slots,'$.round4Slots',16);
  if(canonicalJson(round4Slots)!==canonicalJson(ROUND4_INTAKE_SLOTS))fail('round4_slot_mismatch','$.round4Slots');
  const body={schemaVersion:RELEASE_MANIFEST_SCHEMA,baseSha:plan.baseSha,components:plan.candidates,protectedBlobs,sharedUnions:plan.sharedUnions,staleInputs,round4Slots:ROUND4_INTAKE_SLOTS,capabilities:plan.capabilities};
  return frozen({...body,releaseDigest:digestOf(body)});
}

export function validateReleaseIntegrationManifest(value){
  const safe=exact(value,['schemaVersion','baseSha','components','protectedBlobs','sharedUnions','staleInputs','round4Slots','capabilities','releaseDigest']);
  if(safe.schemaVersion!==RELEASE_MANIFEST_SCHEMA)fail('invalid_schema_version','$.schemaVersion');
  const rebuilt=createReleaseIntegrationManifest({baseSha:safe.baseSha,components:safe.components,protectedBlobs:safe.protectedBlobs,sharedUnions:safe.sharedUnions,staleInputs:safe.staleInputs,round4Slots:safe.round4Slots});
  if(canonicalJson(safe.capabilities)!==canonicalJson(rebuilt.capabilities))fail('capability_drift','$.capabilities');
  if(safe.releaseDigest!==rebuilt.releaseDigest)fail('digest_mismatch','$.releaseDigest');
  return rebuilt;
}
