import { exact, identifier, version, sortedUnique, pathValue, exportName, frozen, canonicalJson, fail } from './boundary.mjs';
import { PUBLIC_INTERFACE_LOCK_SCHEMA, SAFE_CAPABILITIES } from './constants.mjs';

function validateCapabilities(value,path){
  const safe=exact(value,Object.keys(SAFE_CAPABILITIES),path);
  for(const [key,expected] of Object.entries(SAFE_CAPABILITIES))if(safe[key]!==expected)fail('capability_broadening',`${path}.${key}`);
  return frozen(safe);
}

export function createPublicInterfaceLock(input){
  const safe=exact(input,['componentId','schemaVersion','entrypoints','exports','storagePrefixes','lifecycleOutcomes','capabilities']);
  const entrypoints=sortedUnique(safe.entrypoints,'$.entrypoints',128,pathValue);
  const exports=sortedUnique(safe.exports,'$.exports',512,exportName);
  if(entrypoints.length<1)fail('missing_interface_entrypoint','$.entrypoints');
  if(exports.length<1)fail('missing_interface_export','$.exports');
  return frozen({
    lockSchemaVersion:PUBLIC_INTERFACE_LOCK_SCHEMA,
    componentId:identifier(safe.componentId,'$.componentId'),
    schemaVersion:version(safe.schemaVersion,'$.schemaVersion'),
    entrypoints,exports,
    storagePrefixes:sortedUnique(safe.storagePrefixes,'$.storagePrefixes',128,pathValue),
    lifecycleOutcomes:sortedUnique(safe.lifecycleOutcomes,'$.lifecycleOutcomes',128,identifier),
    capabilities:validateCapabilities(safe.capabilities,'$.capabilities')
  });
}

export function validatePublicInterfaceLock(value){
  const safe=exact(value,['lockSchemaVersion','componentId','schemaVersion','entrypoints','exports','storagePrefixes','lifecycleOutcomes','capabilities']);
  if(safe.lockSchemaVersion!==PUBLIC_INTERFACE_LOCK_SCHEMA)fail('invalid_schema_version','$.lockSchemaVersion');
  return createPublicInterfaceLock({componentId:safe.componentId,schemaVersion:safe.schemaVersion,entrypoints:safe.entrypoints,exports:safe.exports,storagePrefixes:safe.storagePrefixes,lifecycleOutcomes:safe.lifecycleOutcomes,capabilities:safe.capabilities});
}

export function assertPublicInterfaceCompatibility(expected,actual){
  const left=validatePublicInterfaceLock(expected),right=validatePublicInterfaceLock(actual);
  for(const key of ['componentId','schemaVersion','entrypoints','exports','storagePrefixes','lifecycleOutcomes','capabilities']){
    if(canonicalJson(left[key])!==canonicalJson(right[key]))fail('public_interface_drift',`$.${key}`);
  }
  return frozen({compatible:true,componentId:left.componentId});
}

export function composeReleaseCapabilities(locks){
  const checked=locks.map(validatePublicInterfaceLock);
  const componentIds=checked.map(item=>item.componentId).sort();
  if(new Set(componentIds).size!==componentIds.length)fail('duplicate_component','$.locks');
  return frozen({...SAFE_CAPABILITIES,components:componentIds});
}
