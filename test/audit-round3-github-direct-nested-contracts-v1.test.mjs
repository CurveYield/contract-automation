import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDirectRequest,
  createDirectState,
  createCapabilityManifest
} from '../packages/audit-github-direct-protocol/src/index.mjs';
import {
  createPermissionManifest,
  validatePermissionManifest,
  planCheckPublication
} from '../packages/audit-github-direct-adapter/src/index.mjs';
import {
  createJobIndex,
  planRequestPublication,
  validateRequestPublicationPlan
} from '../packages/audit-github-direct-ledger/src/index.mjs';
import {
  createSubmissionReportingBundle,
  validateSubmissionReportingBundle,
  createCancellationReportingBundle,
  validateCancellationReportingBundle
} from '../packages/audit-github-direct-reporting/src/index.mjs';
import {
  createServiceCommand,
  createServiceResult
} from '../packages/audit-github-direct-service/src/index.mjs';

const at='2026-08-02T02:34:00.000Z';
const later='2026-08-02T02:44:00.000Z';
function requestFor(character,key){
  return createDirectRequest({
    repositoryId:123,
    installationId:456,
    repositoryFullName:'curveyield/contract-automation',
    requesterId:'actor-123',
    policyVersion:'direct-policy-v1',
    profileId:'hardhat-test-v1',
    parserVersion:'hardhat-test-parser-v1',
    resultContractVersion:'phase5-tool-result-v1',
    reportContractVersion:'audit-report-v1',
    targetCommitSha:character.repeat(40),
    requestedAt:at,
    idempotencyKey:key
  });
}
const request=requestFor('a','nested-a');
const other=requestFor('b','nested-b');

test('permission manifests have a strict public validator',()=>{
  assert.equal(typeof validatePermissionManifest,'function');
  const capability=createCapabilityManifest({request,authorizationKind:'github-token',capabilities:['read-source'],issuedAt:at,expiresAt:later});
  const manifest=createPermissionManifest({capabilityManifest:capability});
  assert.deepEqual(validatePermissionManifest(manifest),manifest);
  assert.throws(()=>validatePermissionManifest({...manifest,repositoryId:999}));
});

test('service result rejects a self-valid current state for a different target',()=>{
  const command=createServiceCommand({kind:'status',request,at:later});
  const foreignState=createDirectState({request:other,state:'requested',version:0,updatedAt:later});
  assert.throws(
    ()=>createServiceResult({
      command,
      state:'completed',
      data:{currentState:foreignState,currentBlobSha:'c'.repeat(40)},
      completedAt:later
    }),
    (error)=>error?.code==='service_identity_mismatch'
  );
});

test('submission reporting validator binds the publication to the exact job and SHA',()=>{
  assert.equal(typeof validateSubmissionReportingBundle,'function');
  const bundle=createSubmissionReportingBundle({request,publishedAt:later});
  const foreign=planCheckPublication({request:other,name:'CurveYield GitHub Direct Audit',summary:'Awaiting executor; submitted source was not executed.',conclusion:'neutral',at:later});
  assert.throws(
    ()=>validateSubmissionReportingBundle({...bundle,publications:[foreign]}),
    (error)=>error?.code==='reporting_binding_mismatch'
  );
});

test('cancellation reporting validator binds result/report ledger order and contents',()=>{
  assert.equal(typeof validateCancellationReportingBundle,'function');
  const bundle=createCancellationReportingBundle({request,stateVersion:2,publishedAt:later});
  assert.throws(
    ()=>validateCancellationReportingBundle({...bundle,ledgerPlans:[bundle.ledgerPlans[1],bundle.ledgerPlans[0]]}),
    (error)=>error?.code==='reporting_binding_mismatch'
  );
});

test('request publication still validates after nested contract hardening',()=>{
  const index=createJobIndex({entries:[],updatedAt:at});
  const plan=planRequestPublication({request,currentIndex:index,indexBlobSha:'d'.repeat(40),at});
  assert.deepEqual(validateRequestPublicationPlan(plan),plan);
});
