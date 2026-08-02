import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SAFE_CAPABILITIES,
  ROUND4_INTAKE_SLOTS,
  createPublicInterfaceLock,
  validatePublicInterfaceLock,
  createComponentManifest,
  createReleaseIntakePlan,
  validateSharedFileUnion,
  createReleaseIntegrationManifest,
  validateReleaseIntegrationManifest
} from '../packages/audit-release-integration/src/index.mjs';

const SHA=(c)=>c.repeat(40);
const baseLock=()=>createPublicInterfaceLock({componentId:'component-a',schemaVersion:'v1',entrypoints:['packages/a/src/index.mjs'],exports:['validate'],storagePrefixes:['a/'],lifecycleOutcomes:['completed'],capabilities:SAFE_CAPABILITIES});
const componentInput=()=>({componentId:'component-a',issueNumber:114,branch:'audit-round3/component-a-v1',finalSha:SHA('a'),status:'completed',recommendation:'ACCEPT',reportUrl:'issue:114#final',ownedPaths:['packages/a/src/index.mjs'],blobs:[{path:'packages/a/src/index.mjs',sourceBlobSha:SHA('b'),destinationBlobSha:SHA('b')}],publicInterface:baseLock(),adaptation:{kind:'exact',repairId:null}});
const manifest=()=>createComponentManifest(componentInput());
function expectCode(fn,codes){assert.throws(fn,(error)=>codes.includes(error.code),`expected ${codes.join('|')}`);}

test('release intake adversarial matrix rejects 24 invalid variants',()=>{
  let executed=0;
  const accessor={...componentInput()};
  Object.defineProperty(accessor,'status',{enumerable:true,get(){executed+=1;return 'completed';}});
  expectCode(()=>createComponentManifest(accessor),['accessor_field']);
  assert.equal(executed,0);
  const symbolic=componentInput(); symbolic[Symbol('hidden')]=true;
  expectCode(()=>createComponentManifest(symbolic),['symbol_field']);
  expectCode(()=>createComponentManifest(Object.assign(Object.create({hidden:true}),componentInput())),['invalid_object']);
  const cyclic=componentInput(); cyclic.loop=cyclic;
  expectCode(()=>createComponentManifest(cyclic),['cyclic_value']);
  const sparse=componentInput(); sparse.ownedPaths=new Array(2); sparse.ownedPaths[1]='packages/a/src/index.mjs';
  expectCode(()=>createComponentManifest(sparse),['sparse_array']);
  expectCode(()=>createComponentManifest({...componentInput(),status:'working'}),['candidate_incomplete']);
  expectCode(()=>createComponentManifest({...componentInput(),recommendation:'REJECT'}),['candidate_rejected']);
  expectCode(()=>createComponentManifest({...componentInput(),finalSha:'ABC'}),['invalid_sha']);
  expectCode(()=>createComponentManifest({...componentInput(),branch:'../unsafe'}),['unsafe_path']);
  expectCode(()=>createComponentManifest({...componentInput(),ownedPaths:['packages/a/src/index.mjs','packages/a/src/index.mjs']}),['duplicate_value']);
  expectCode(()=>createComponentManifest({...componentInput(),blobs:[...componentInput().blobs,...componentInput().blobs]}),['duplicate_path']);
  expectCode(()=>createComponentManifest({...componentInput(),blobs:[{path:'packages/a/src/other.mjs',sourceBlobSha:SHA('b'),destinationBlobSha:SHA('b')}]}),['unowned_blob']);
  expectCode(()=>createComponentManifest({...componentInput(),blobs:[{path:'packages/a/src/index.mjs',sourceBlobSha:SHA('b'),destinationBlobSha:SHA('c')}]}),['blob_mismatch']);
  expectCode(()=>createComponentManifest({...componentInput(),recommendation:'ACCEPT_WITH_REPAIR',adaptation:{kind:'repaired',repairId:null},blobs:[{path:'packages/a/src/index.mjs',sourceBlobSha:SHA('b'),destinationBlobSha:SHA('c')}]}),['invalid_identifier']);
  const a=manifest();
  expectCode(()=>createReleaseIntakePlan({baseSha:SHA('1'),candidates:[a,a],protectedPaths:[],sharedUnions:[]}),['duplicate_component']);
  expectCode(()=>createReleaseIntakePlan({baseSha:SHA('1'),candidates:[a],protectedPaths:['packages/a/src/index.mjs'],sharedUnions:[]}),['protected_path']);
  const nested=createComponentManifest({...componentInput(),componentId:'component-b',ownedPaths:['packages/a/src'],blobs:[{path:'packages/a/src',sourceBlobSha:SHA('d'),destinationBlobSha:SHA('d')}],publicInterface:createPublicInterfaceLock({componentId:'component-b',schemaVersion:'v1',entrypoints:['packages/b/index.mjs'],exports:['validate'],storagePrefixes:['b/'],lifecycleOutcomes:['completed'],capabilities:SAFE_CAPABILITIES})});
  expectCode(()=>createReleaseIntakePlan({baseSha:SHA('1'),candidates:[a,nested],protectedPaths:[],sharedUnions:[]}),['path_overlap']);
  expectCode(()=>validateSharedFileUnion({schemaVersion:'audit-shared-file-union-v1',path:'package.json',baseBlobSha:SHA('1'),inputs:[{componentId:'a',blobSha:SHA('2'),fields:['exports']},{componentId:'b',blobSha:SHA('3'),fields:['exports.audit']}],outputBlobSha:SHA('4'),strategy:'field-owned-v1'}),['union_field_overlap']);
  expectCode(()=>validateSharedFileUnion({schemaVersion:'audit-shared-file-union-v1',path:'package.json',baseBlobSha:SHA('1'),inputs:[{componentId:'a',blobSha:SHA('2'),fields:['exports.audit']}],outputBlobSha:SHA('4'),strategy:'field-owned-v1'}),['invalid_union_inputs']);
  expectCode(()=>validateSharedFileUnion({schemaVersion:'old',path:'package.json',baseBlobSha:SHA('1'),inputs:[{componentId:'a',blobSha:SHA('2'),fields:['a']},{componentId:'b',blobSha:SHA('3'),fields:['b']}],outputBlobSha:SHA('4'),strategy:'field-owned-v1'}),['invalid_schema_version']);
  expectCode(()=>createPublicInterfaceLock({componentId:'x',schemaVersion:'v1',entrypoints:['x/index.mjs'],exports:['validate'],storagePrefixes:['x/'],lifecycleOutcomes:['completed'],capabilities:{...SAFE_CAPABILITIES,executionEnabled:true}}),['capability_broadening']);
  expectCode(()=>validatePublicInterfaceLock({...baseLock(),lockSchemaVersion:'old'}),['invalid_schema_version']);
  const release=createReleaseIntegrationManifest({baseSha:SHA('1'),components:[a],protectedBlobs:[{path:'packages/runner/src/run-job.mjs',blobSha:SHA('2')}],staleInputs:['issue-97-phase7-8'],round4Slots:ROUND4_INTAKE_SLOTS});
  expectCode(()=>validateReleaseIntegrationManifest({...release,releaseDigest:'0'.repeat(64)}),['digest_mismatch']);
  expectCode(()=>validateReleaseIntegrationManifest({...release,capabilities:{...release.capabilities,networkEnabled:true}}),['capability_broadening','capability_drift']);
  expectCode(()=>createReleaseIntegrationManifest({baseSha:SHA('1'),components:[a],protectedBlobs:[],staleInputs:[],round4Slots:ROUND4_INTAKE_SLOTS.slice(0,4)}),['round4_slot_mismatch']);
});
