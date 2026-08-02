import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SAFE_CAPABILITIES,
  ROUND4_INTAKE_SLOTS,
  createPublicInterfaceLock,
  createComponentManifest,
  createReleaseIntakePlan,
  createReleaseIntegrationManifest
} from '../packages/audit-release-integration/src/index.mjs';

const SHA=(c)=>c.repeat(40);
const REPORT=(issue=114,comment=5150000000)=>({
  issueNumber:issue,
  commentId:comment,
  url:`https://github.com/CurveYield/contract-automation/issues/${issue}#issuecomment-${comment}`
});
function publicLock(id='phase4'){
  return createPublicInterfaceLock({
    componentId:id,
    schemaVersion:'phase4-tool-result-v1',
    entrypoints:[`packages/${id}/src/index.mjs`],
    exports:['PHASE4_TOOL_RESULT_DOCUMENTATION','validatePhase4ToolResult'],
    storagePrefixes:[`${id}/`],
    lifecycleOutcomes:['success','resource_exhaustion'],
    capabilities:SAFE_CAPABILITIES
  });
}
function candidate(id,path,blob='b'){
  return createComponentManifest({
    componentId:id,
    issueNumber:114,
    branch:'audit-round3/phases1-8-release-integration-v1',
    finalSha:SHA('a'),
    status:'completed',
    recommendation:'ACCEPT WITH REPAIR',
    report:REPORT(),
    paths:[{
      path,
      sourceBlobSha:SHA(blob),
      destinationBlobSha:SHA(blob),
      adaptationKind:'exact',
      repairId:null
    }],
    publicInterface:publicLock(id)
  });
}

test('public interface locks accept real JavaScript export names and versioned schemas',()=>{
  const lock=publicLock();
  assert.deepEqual(lock.exports,['PHASE4_TOOL_RESULT_DOCUMENTATION','validatePhase4ToolResult']);
  assert.equal(lock.schemaVersion,'phase4-tool-result-v1');
});

test('component manifests bind exact report comments and per-path adaptations',()=>{
  const manifest=candidate('phase5','packages/audit-phase5-parsers/src/common.mjs');
  assert.equal(manifest.recommendation,'ACCEPT WITH REPAIR');
  assert.equal(manifest.report.commentId,5150000000);
  assert.deepEqual(manifest.ownedPaths,['packages/audit-phase5-parsers/src/common.mjs']);
  assert.equal(manifest.paths[0].adaptationKind,'exact');
});

test('nested protected ownership and protected shared unions are rejected',()=>{
  const ownsDirectory=candidate('runner-rewrite','packages/runner/src');
  assert.throws(()=>createReleaseIntakePlan({
    baseSha:SHA('1'),candidates:[ownsDirectory],
    protectedPaths:['packages/runner/src/run-job.mjs'],sharedUnions:[]
  }),error=>error.code==='protected_path');

  const a=candidate('a','package.json','2');
  const b=candidate('b','package.json','3');
  assert.throws(()=>createReleaseIntakePlan({
    baseSha:SHA('1'),candidates:[a,b],protectedPaths:['package.json'],
    sharedUnions:[{schemaVersion:'audit-shared-file-union-v1',path:'package.json',baseBlobSha:SHA('1'),inputs:[{componentId:'a',blobSha:SHA('2'),fields:['exports.a']},{componentId:'b',blobSha:SHA('3'),fields:['scripts.b']}],outputBlobSha:SHA('4'),strategy:'field-owned-v1'}]
  }),error=>error.code==='protected_path');
});

test('declared shared-file unions permit only exact registered overlap',()=>{
  const a=candidate('a','package.json','2');
  const b=candidate('b','package.json','3');
  const union={schemaVersion:'audit-shared-file-union-v1',path:'package.json',baseBlobSha:SHA('1'),inputs:[{componentId:'a',blobSha:SHA('2'),fields:['exports.a']},{componentId:'b',blobSha:SHA('3'),fields:['scripts.b']}],outputBlobSha:SHA('4'),strategy:'field-owned-v1'};
  const plan=createReleaseIntakePlan({baseSha:SHA('1'),candidates:[a,b],protectedPaths:[],sharedUnions:[union]});
  assert.equal(plan.sharedUnions.length,1);
  assert.throws(()=>createReleaseIntakePlan({baseSha:SHA('1'),candidates:[a,b],protectedPaths:[],sharedUnions:[{...union,inputs:[{componentId:'a',blobSha:SHA('9'),fields:['exports.a']},{componentId:'b',blobSha:SHA('3'),fields:['scripts.b']}]}]}),error=>error.code==='union_blob_mismatch');
});

test('release manifests reject duplicate components and component/protected overlap',()=>{
  const a=candidate('a','packages/a/src/index.mjs');
  assert.throws(()=>createReleaseIntegrationManifest({baseSha:SHA('1'),components:[a,a],protectedBlobs:[],sharedUnions:[],staleInputs:[],round4Slots:ROUND4_INTAKE_SLOTS}),error=>error.code==='duplicate_component');
  assert.throws(()=>createReleaseIntegrationManifest({baseSha:SHA('1'),components:[a],protectedBlobs:[{path:'packages/a',blobSha:SHA('2')}],sharedUnions:[],staleInputs:[],round4Slots:ROUND4_INTAKE_SLOTS}),error=>error.code==='protected_path');
});

test('Round 4 slots separate Stage A and Stage B activation',()=>{
  const worker2=ROUND4_INTAKE_SLOTS.find(slot=>slot.workerId==='worker-2');
  assert.deepEqual(worker2.stageAActivationIssues,[]);
  assert.deepEqual(worker2.stageBActivationIssues,[112,113,114,115,116,119,120,121,123,124]);
  const worker4=ROUND4_INTAKE_SLOTS.find(slot=>slot.workerId==='worker-4');
  assert.deepEqual(worker4.stageAActivationIssues,[112,113,115,116,119]);
  assert.deepEqual(worker4.stageBActivationIssues,[119,122]);
});
