import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROUND4_CANDIDATE_SLOTS,
  ROUND4_PRELIMINARY_OWNERSHIP,
  ROUND4_PROTECTED_BLOBS,
  ROUND4_INTAKE_WAVES,
  validateCompletedCandidateEvidence,
  validatePathOwnershipRegistry,
  validateRound4SharedUnion,
  validateIntakeWaveTemplate,
  validateRound5ProductionInput
} from '../packages/audit-integration-round4/src/index.mjs';

const SHA=(c)=>c.repeat(40);
const slot=()=>ROUND4_CANDIDATE_SLOTS[0];
const completedStatus=()=>({
  protocolVersion:1,
  workerId:'worker-0',
  state:'completed',
  lastConsumedSequence:6,
  activeSequence:null,
  activeMessageId:null,
  issueNumber:120,
  branch:'audit-round4/review-integration-spine-v1',
  startingSha:'5914b03382422ea714346625a601b5dbda3aa0cd',
  finalSha:SHA('a'),
  recommendation:'ACCEPT',
  reportReference:'https://github.com/CurveYield/contract-automation/issues/120#issuecomment-5150000120',
  blockers:[],
  updatedAt:'2026-08-02T10:00:00Z'
});
const evidence=()=>({
  status:completedStatus(),
  resolvedBranchHead:SHA('a'),
  report:{issueNumber:120,commentId:5150000120,url:'https://github.com/CurveYield/contract-automation/issues/120#issuecomment-5150000120',finalSha:SHA('a'),recommendation:'ACCEPT'},
  manifests:[
    {schemaVersion:'round4-stage-a-review-manifest-v1',path:'docs/audit/round4/worker0/review-manifest-v1.json',blobSha:SHA('b')},
    {schemaVersion:'audit-release-component-manifest-v1',path:'docs/audit/round4/worker0/component-manifest-v1.json',blobSha:SHA('c')},
    {schemaVersion:'audit-public-interface-lock-v1',path:'docs/audit/round4/worker0/public-interface-lock-v1.json',blobSha:SHA('d')}
  ]
});

test('candidate slots pin four unresolved Stage A reviews without fabricated heads',()=>{
  assert.deepEqual(ROUND4_CANDIDATE_SLOTS.map((item)=>item.issueNumber),[120,121,123,124]);
  assert.equal(ROUND4_CANDIDATE_SLOTS.every((item)=>item.resolvedFinalSha===null),true);
  assert.equal(Object.isFrozen(ROUND4_CANDIDATE_SLOTS),true);
});

test('completed candidate evidence binds status, branch head, report and manifests',()=>{
  const accepted=validateCompletedCandidateEvidence(slot(),evidence());
  assert.equal(accepted.finalSha,SHA('a'));
  assert.equal(accepted.report.commentId,5150000120);
  assert.equal(accepted.manifests.length,3);
});

test('stale, malformed, wrong-branch and wrong-report candidate evidence is rejected',()=>{
  assert.throws(()=>validateCompletedCandidateEvidence(slot(),{...evidence(),status:{...completedStatus(),state:'working',finalSha:null}}),error=>error.code==='candidate_incomplete');
  assert.throws(()=>validateCompletedCandidateEvidence(slot(),{...evidence(),resolvedBranchHead:SHA('e')}),error=>error.code==='branch_head_mismatch');
  assert.throws(()=>validateCompletedCandidateEvidence(slot(),{...evidence(),status:{...completedStatus(),branch:'audit-round4/wrong-v1'}}),error=>error.code==='candidate_slot_mismatch');
  assert.throws(()=>validateCompletedCandidateEvidence(slot(),{...evidence(),report:{...evidence().report,commentId:5150000999}}),error=>error.code==='report_reference_mismatch');
  assert.throws(()=>validateCompletedCandidateEvidence(slot(),{...evidence(),manifests:evidence().manifests.slice(0,2)}),error=>error.code==='missing_manifest_schema');
});

test('preliminary ownership covers all subsystem domains and protected paths',()=>{
  const registry=validatePathOwnershipRegistry(ROUND4_PRELIMINARY_OWNERSHIP);
  assert.deepEqual(registry.domains.map((item)=>item.domain),['api','github-direct','phase1-6-integration','phase7-8','web']);
  assert.equal(registry.protectedPaths.length,ROUND4_PROTECTED_BLOBS.length);
});

test('ownership rejects duplicate paths, nested overlap and protected mutation',()=>{
  const source=structuredClone(ROUND4_PRELIMINARY_OWNERSHIP);
  source.domains[1].ownedPrefixes=[source.domains[0].ownedPrefixes[0]];
  assert.throws(()=>validatePathOwnershipRegistry(source),error=>error.code==='ownership_overlap');
  const nested=structuredClone(ROUND4_PRELIMINARY_OWNERSHIP);
  nested.domains[1].ownedPrefixes=['apps/audit-api/internal'];
  assert.throws(()=>validatePathOwnershipRegistry(nested),error=>error.code==='ownership_overlap');
  const protectedMutation=structuredClone(ROUND4_PRELIMINARY_OWNERSHIP);
  protectedMutation.domains[0].ownedFiles=[ROUND4_PROTECTED_BLOBS[0].path];
  assert.throws(()=>validatePathOwnershipRegistry(protectedMutation),error=>error.code==='protected_path');
});

test('shared-file union binds ordered owners, disjoint fields, output blob and rerun tests',()=>{
  const union=validateRound4SharedUnion({
    schemaVersion:'round4-shared-file-union-v1',
    path:'package.json',
    baseBlobSha:SHA('1'),
    inputs:[
      {candidateId:'api-auth-reviewed',blobSha:SHA('2'),fields:['exports.auditApi']},
      {candidateId:'web-direct-reviewed',blobSha:SHA('3'),fields:['scripts.test:web']}
    ],
    outputBlobSha:SHA('4'),
    requiredTests:['test/audit-round4-integration-api.test.mjs','test/audit-round4-integration-web.test.mjs']
  });
  assert.deepEqual(union.inputs.map((item)=>item.candidateId),['api-auth-reviewed','web-direct-reviewed']);
  assert.throws(()=>validateRound4SharedUnion({...union,inputs:[...union.inputs].reverse()}),error=>error.code==='noncanonical_union_order');
  assert.throws(()=>validateRound4SharedUnion({...union,inputs:[{candidateId:'api-auth-reviewed',blobSha:SHA('2'),fields:['exports']},{candidateId:'web-direct-reviewed',blobSha:SHA('3'),fields:['exports.auditApi']}]}),error=>error.code==='union_field_overlap');
});

test('intake waves are deterministic and cannot claim unresolved candidates',()=>{
  assert.deepEqual(ROUND4_INTAKE_WAVES.map((item)=>item.waveId),['phase1-8-core','api-auth','github-direct-web','protected-addon-final']);
  const wave=validateIntakeWaveTemplate(ROUND4_INTAKE_WAVES[0]);
  assert.equal(wave.state,'waiting-for-stage-a');
  assert.throws(()=>validateIntakeWaveTemplate({...wave,state:'ready'}),error=>error.code==='premature_wave_state');
});

test('Round 5 production input accepts names/caps only and rejects secret values or writable RPC',()=>{
  const value=validateRound5ProductionInput({
    schemaVersion:'round5-production-input-v1',
    secretNames:['CLOUDFLARE_API_TOKEN','PREFLIGHTSIM_CLIENT_API_KEY','RPC_ETHEREUM'],
    variableNames:['PREFLIGHTSIM_API_URL','PAGES_PROJECT_NAME'],
    cloudflare:{workerName:'curveyield-preflight-api',pagesProject:'curveyield-preflight',zones:['curveyield.online'],routes:['api.preflight.curveyield.online'],r2Bindings:[{binding:'AUDIT_R2',bucket:'curveyield-preflight'}],corsOrigins:['https://preflight.curveyield.online']},
    github:{repository:'CurveYield/contract-automation',environment:'production',workflowPath:'.github/workflows/audit-production-v1.yml'},
    rpcNetworks:[{name:'ethereum',secretName:'RPC_ETHEREUM',readOnly:true}],
    caps:{requestsPerMinute:30,dailyUsd:10,artifactBytes:10000000,retentionDays:7},
    rollback:{requiredChecks:['api-health','web-health','r2-read'],preservePreviousRelease:true},
    observability:{fields:['correlationId','route','status','durationMs'],redactions:['authorization','cookie','rpcUrl']}
  });
  assert.equal(value.rpcNetworks[0].readOnly,true);
  assert.throws(()=>validateRound5ProductionInput({...value,secretNames:['CLOUDFLARE_API_TOKEN=secret']}),error=>error.code==='invalid_secret_name');
  assert.throws(()=>validateRound5ProductionInput({...value,rpcNetworks:[{name:'ethereum',secretName:'RPC_ETHEREUM',readOnly:false}]}),error=>error.code==='writable_rpc_forbidden');
});
