import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SAFE_CAPABILITIES,
  SHARED_FILE_UNION_SCHEMA,
  createPublicInterfaceLock,
  validatePublicInterfaceLock,
  createComponentManifest,
  validateSharedFileUnion,
  createReleaseIntakePlan
} from '../packages/audit-release-integration/src/index.mjs';

const sha=(digit)=>digit.repeat(40);
const report={issueNumber:114,commentId:5156779012,url:'https://github.com/CurveYield/contract-automation/issues/114#issuecomment-5156779012'};
function lock(overrides={}){
  return {
    componentId:'component-a',schemaVersion:'component-a-v1',
    entrypoints:['packages/component-a/src/index.mjs'],exports:['createComponentA'],
    storagePrefixes:['components/component-a'],lifecycleOutcomes:['completed'],
    capabilities:SAFE_CAPABILITIES,...overrides
  };
}
function component(overrides={}){
  return {
    componentId:'component-a',issueNumber:114,branch:'audit-round4/component-a-v1',finalSha:sha('a'),
    status:'completed',recommendation:'ACCEPT',report,
    paths:[{path:'packages/component-a/src/index.mjs',sourceBlobSha:sha('b'),destinationBlobSha:sha('b'),adaptationKind:'exact',repairId:null}],
    publicInterface:createPublicInterfaceLock(lock()),...overrides
  };
}

test('created public interface locks round-trip through their validator',()=>{
  const created=createPublicInterfaceLock(lock());
  assert.deepEqual(validatePublicInterfaceLock(created),created);
});

test('a valid component manifest accepts a builder-produced interface lock',()=>{
  assert.equal(createComponentManifest(component()).componentId,'component-a');
});

test('public interface locks require at least one entrypoint',()=>{
  assert.throws(()=>createPublicInterfaceLock(lock({entrypoints:[]})),{code:'missing_interface_entrypoint'});
});

test('public interface locks require at least one export',()=>{
  assert.throws(()=>createPublicInterfaceLock(lock({exports:[]})),{code:'missing_interface_export'});
});

test('component manifests reject public entrypoints outside owned destination paths',()=>{
  const publicInterface=createPublicInterfaceLock(lock({entrypoints:['packages/unowned/src/index.mjs']}));
  assert.throws(()=>createComponentManifest(component({publicInterface})),{code:'interface_entrypoint_unowned'});
});

test('component manifests bind ACCEPT WITH REPAIR to repaired or deleted adaptations',()=>{
  const repaired={path:'packages/component-a/src/index.mjs',sourceBlobSha:sha('b'),destinationBlobSha:sha('c'),adaptationKind:'repaired',repairId:'repair-a'};
  assert.throws(()=>createComponentManifest(component({paths:[repaired],recommendation:'ACCEPT'})),{code:'recommendation_mismatch'});
});

test('shared-file unions reject inputs with no owned fields',()=>{
  assert.throws(()=>validateSharedFileUnion({schemaVersion:SHARED_FILE_UNION_SCHEMA,path:'packages/shared/src/index.mjs',baseBlobSha:sha('a'),inputs:[{componentId:'component-a',blobSha:sha('b'),fields:[]},{componentId:'component-b',blobSha:sha('c'),fields:['exports.b']}],outputBlobSha:sha('d'),strategy:'field-owned-v1'}),{code:'missing_union_field'});
});

test('shared-file unions reject ambiguous field paths',()=>{
  assert.throws(()=>validateSharedFileUnion({schemaVersion:SHARED_FILE_UNION_SCHEMA,path:'packages/shared/src/index.mjs',baseBlobSha:sha('a'),inputs:[{componentId:'component-a',blobSha:sha('b'),fields:['exports..a']},{componentId:'component-b',blobSha:sha('c'),fields:['exports.b']}],outputBlobSha:sha('d'),strategy:'field-owned-v1'}),{code:'invalid_union_field'});
});

test('repository paths reject dot-segment aliases and intake requires a candidate',()=>{
  assert.throws(()=>createPublicInterfaceLock(lock({entrypoints:['packages/component-a/./src/index.mjs']})),{code:'unsafe_path'});
  assert.throws(()=>createReleaseIntakePlan({baseSha:sha('a'),candidates:[],protectedPaths:[],sharedUnions:[]}),{code:'missing_candidate'});
});
