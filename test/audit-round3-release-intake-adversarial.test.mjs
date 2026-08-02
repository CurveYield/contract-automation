import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SAFE_CAPABILITIES,
  ROUND4_INTAKE_SLOTS,
  createPublicInterfaceLock,
  validatePublicInterfaceLock,
  createComponentManifest,
  validateComponentManifest,
  createReleaseIntakePlan,
  validateSharedFileUnion,
  createReleaseIntegrationManifest,
  validateReleaseIntegrationManifest
} from '../packages/audit-release-integration/src/index.mjs';

const SHA=(c)=>c.repeat(40);
const report=()=>({issueNumber:114,commentId:5150000000,url:'https://github.com/CurveYield/contract-automation/issues/114#issuecomment-5150000000'});
const baseLock=(id='component-a')=>createPublicInterfaceLock({componentId:id,schemaVersion:'component-public-v1',entrypoints:['packages/a/src/index.mjs'],exports:['VALIDATION_SCHEMA','validateComponent'],storagePrefixes:['a/'],lifecycleOutcomes:['completed'],capabilities:SAFE_CAPABILITIES});
const exactPath=(path='packages/a/src/index.mjs')=>({path,sourceBlobSha:SHA('b'),destinationBlobSha:SHA('b'),adaptationKind:'exact',repairId:null});
const componentInput=()=>({componentId:'component-a',issueNumber:114,branch:'audit-round3/component-a-v1',finalSha:SHA('a'),status:'completed',recommendation:'ACCEPT',report:report(),paths:[exactPath()],publicInterface:baseLock()});
const manifest=()=>createComponentManifest(componentInput());
function expectCode(fn,codes){assert.throws(fn,(error)=>codes.includes(error.code),`expected ${codes.join('|')}`);}

test('release intake adversarial matrix rejects 32 invalid variants',()=>{
  let executed=0;
  const accessor={...componentInput()};
  Object.defineProperty(accessor,'status',{enumerable:true,get(){executed+=1;return 'completed';}});
  expectCode(()=>createComponentManifest(accessor),['accessor_field']);
  assert.equal(executed,0);
  const hidden={...componentInput()};Object.defineProperty(hidden,'hidden',{value:true,enumerable:false});
  expectCode(()=>createComponentManifest(hidden),['hidden_field']);
  const symbolic=componentInput();symbolic[Symbol('hidden')]=true;
  expectCode(()=>createComponentManifest(symbolic),['symbol_field']);
  expectCode(()=>createComponentManifest(Object.assign(Object.create({hidden:true}),componentInput())),['invalid_object']);
  const cyclic=componentInput();cyclic.loop=cyclic;
  expectCode(()=>createComponentManifest(cyclic),['cyclic_value']);
  const sparse=componentInput();sparse.paths=new Array(2);sparse.paths[1]=exactPath();
  expectCode(()=>createComponentManifest(sparse),['sparse_array']);
  expectCode(()=>createComponentManifest({...componentInput(),status:'working'}),['candidate_incomplete']);
  expectCode(()=>createComponentManifest({...componentInput(),recommendation:'REJECT'}),['candidate_rejected']);
  expectCode(()=>createComponentManifest({...componentInput(),recommendation:'ACCEPT_WITH_REPAIR'}),['candidate_rejected']);
  expectCode(()=>createComponentManifest({...componentInput(),finalSha:'ABC'}),['invalid_sha']);
  expectCode(()=>createComponentManifest({...componentInput(),branch:'../unsafe'}),['unsafe_path']);
  expectCode(()=>createComponentManifest({...componentInput(),report:{...report(),issueNumber:113}}),['report_issue_mismatch']);
  expectCode(()=>createComponentManifest({...componentInput(),report:{...report(),url:'https://example.com'}}),['invalid_report_url']);
  expectCode(()=>createComponentManifest({...componentInput(),paths:[exactPath(),exactPath()]}),['duplicate_path']);
  expectCode(()=>createComponentManifest({...componentInput(),paths:[]}),['missing_path']);
  expectCode(()=>createComponentManifest({...componentInput(),paths:[{...exactPath(),destinationBlobSha:SHA('c')}]}),['invalid_adaptation']);
  expectCode(()=>createComponentManifest({...componentInput(),paths:[{...exactPath(),adaptationKind:'repaired',repairId:null,destinationBlobSha:SHA('c')}]}),['invalid_type']);
  expectCode(()=>createComponentManifest({...componentInput(),paths:[{...exactPath(),adaptationKind:'added',repairId:'add-v1'}]}),['invalid_adaptation']);
  expectCode(()=>createComponentManifest({...componentInput(),paths:[{...exactPath(),adaptationKind:'deleted',repairId:'delete-v1'}]}),['invalid_adaptation']);
  expectCode(()=>createComponentManifest({...componentInput(),publicInterface:baseLock('other')}),['interface_component_mismatch']);
  const a=manifest();
  expectCode(()=>validateComponentManifest({...a,ownedPaths:[]}),['path_membership_mismatch']);
  expectCode(()=>validateComponentManifest({...a,manifestDigest:'0'.repeat(64)}),['digest_mismatch']);
  expectCode(()=>createReleaseIntakePlan({baseSha:SHA('1'),candidates:[a,a],protectedPaths:[],sharedUnions:[]}),['duplicate_component']);
  expectCode(()=>createReleaseIntakePlan({baseSha:SHA('1'),candidates:[a],protectedPaths:['packages/a'],sharedUnions:[]}),['protected_path']);
  const nested=createComponentManifest({...componentInput(),componentId:'component-b',paths:[exactPath('packages/a/src')],publicInterface:baseLock('component-b')});
  expectCode(()=>createReleaseIntakePlan({baseSha:SHA('1'),candidates:[a,nested],protectedPaths:[],sharedUnions:[]}),['path_overlap']);
  expectCode(()=>validateSharedFileUnion({schemaVersion:'audit-shared-file-union-v1',path:'package.json',baseBlobSha:SHA('1'),inputs:[{componentId:'a',blobSha:SHA('2'),fields:['exports']},{componentId:'b',blobSha:SHA('3'),fields:['exports.audit']}],outputBlobSha:SHA('4'),strategy:'field-owned-v1'}),['union_field_overlap']);
  expectCode(()=>validateSharedFileUnion({schemaVersion:'audit-shared-file-union-v1',path:'package.json',baseBlobSha:SHA('1'),inputs:[{componentId:'a',blobSha:SHA('2'),fields:['exports.audit']}],outputBlobSha:SHA('4'),strategy:'field-owned-v1'}),['invalid_union_inputs']);
  expectCode(()=>validateSharedFileUnion({schemaVersion:'old',path:'package.json',baseBlobSha:SHA('1'),inputs:[{componentId:'a',blobSha:SHA('2'),fields:['a']},{componentId:'b',blobSha:SHA('3'),fields:['b']}],outputBlobSha:SHA('4'),strategy:'field-owned-v1'}),['invalid_schema_version']);
  expectCode(()=>createPublicInterfaceLock({componentId:'x',schemaVersion:'x-v1',entrypoints:['x/index.mjs'],exports:['not-valid-name!'],storagePrefixes:['x/'],lifecycleOutcomes:['completed'],capabilities:SAFE_CAPABILITIES}),['invalid_export_name']);
  expectCode(()=>createPublicInterfaceLock({componentId:'x',schemaVersion:'x-v1',entrypoints:['x/index.mjs'],exports:['validateX'],storagePrefixes:['x/'],lifecycleOutcomes:['completed'],capabilities:{...SAFE_CAPABILITIES,executionEnabled:true}}),['capability_broadening']);
  expectCode(()=>validatePublicInterfaceLock({...baseLock(),lockSchemaVersion:'old'}),['invalid_schema_version']);
  const release=createReleaseIntegrationManifest({baseSha:SHA('1'),components:[a],protectedBlobs:[{path:'packages/runner/src/run-job.mjs',blobSha:SHA('2')}],sharedUnions:[],staleInputs:['issue-97-phase7-8'],round4Slots:ROUND4_INTAKE_SLOTS});
  expectCode(()=>validateReleaseIntegrationManifest({...release,releaseDigest:'0'.repeat(64)}),['digest_mismatch']);
  expectCode(()=>validateReleaseIntegrationManifest({...release,capabilities:{...release.capabilities,networkEnabled:true}}),['capability_broadening','capability_drift']);
  expectCode(()=>createReleaseIntegrationManifest({baseSha:SHA('1'),components:[a],protectedBlobs:[],sharedUnions:[],staleInputs:[],round4Slots:ROUND4_INTAKE_SLOTS.slice(0,4)}),['round4_slot_mismatch']);
});
