import { exact, ordinaryArray, identifier, sha40, sortedUnique, unionField, pathValue, frozen, fail } from './boundary.mjs';
import { SHARED_FILE_UNION_SCHEMA } from './constants.mjs';

function fieldOverlap(left,right){return left===right||left.startsWith(`${right}.`)||right.startsWith(`${left}.`)||left.startsWith(`${right}[`)||right.startsWith(`${left}[`);}

export function validateSharedFileUnion(input){
  const safe=exact(input,['schemaVersion','path','baseBlobSha','inputs','outputBlobSha','strategy']);
  if(safe.schemaVersion!==SHARED_FILE_UNION_SCHEMA)fail('invalid_schema_version','$.schemaVersion');
  if(safe.strategy!=='field-owned-v1')fail('invalid_union_strategy','$.strategy');
  const inputs=ordinaryArray(safe.inputs,'$.inputs',32).map((entry,index)=>{
    const item=exact(entry,['componentId','blobSha','fields'],`$.inputs[${index}]`);
    const fields=sortedUnique(item.fields,`$.inputs[${index}].fields`,256,unionField);
    if(fields.length<1)fail('missing_union_field',`$.inputs[${index}].fields`);
    return {componentId:identifier(item.componentId,`$.inputs[${index}].componentId`),blobSha:sha40(item.blobSha,`$.inputs[${index}].blobSha`),fields};
  }).sort((a,b)=>a.componentId.localeCompare(b.componentId));
  if(inputs.length<2||new Set(inputs.map(item=>item.componentId)).size!==inputs.length)fail('invalid_union_inputs','$.inputs');
  const owned=[];
  for(const item of inputs)for(const field of item.fields){if(owned.some(entry=>fieldOverlap(entry.field,field)))fail('union_field_overlap','$.inputs');owned.push({componentId:item.componentId,field});}
  return frozen({schemaVersion:SHARED_FILE_UNION_SCHEMA,path:pathValue(safe.path,'$.path'),baseBlobSha:sha40(safe.baseBlobSha,'$.baseBlobSha'),inputs,outputBlobSha:sha40(safe.outputBlobSha,'$.outputBlobSha'),strategy:safe.strategy});
}
