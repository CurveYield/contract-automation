import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  SAFE_CAPABILITIES,
  createPublicInterfaceLock,
  createComponentManifest
} from '../packages/audit-release-integration/src/index.mjs';

const SHA=(c)=>c.repeat(40);
function canonical(value){
  if(Array.isArray(value)) return value.map(canonical);
  if(value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}
test('component manifest digest matches independent Node SHA-256 over canonical JSON',()=>{
  const publicInterface=createPublicInterfaceLock({componentId:'digest-check',schemaVersion:'digest-check-v1',entrypoints:['packages/digest-check/src/index.mjs'],exports:['validateDigestCheck'],storagePrefixes:['digest-check/'],lifecycleOutcomes:['completed'],capabilities:SAFE_CAPABILITIES});
  const manifest=createComponentManifest({componentId:'digest-check',issueNumber:114,branch:'audit-round3/digest-check-v1',finalSha:SHA('a'),status:'completed',recommendation:'ACCEPT',report:{issueNumber:114,commentId:5150000000,url:'https://github.com/CurveYield/contract-automation/issues/114#issuecomment-5150000000'},paths:[{path:'packages/digest-check/src/index.mjs',sourceBlobSha:SHA('b'),destinationBlobSha:SHA('b'),adaptationKind:'exact',repairId:null}],publicInterface});
  const {manifestDigest,...body}=manifest;
  const expected=createHash('sha256').update(JSON.stringify(canonical(body))).digest('hex');
  assert.equal(manifestDigest,expected);
});
