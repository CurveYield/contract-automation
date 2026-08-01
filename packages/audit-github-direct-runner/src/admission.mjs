import {
  DIRECT_MODE_ID,exactKeys,validateDirectRequest,validateCapabilityManifest,commitSha,timestamp,
  nullable,identifier,digest,integer,booleanValue,enumValue,sha256,frozenClone,fail,fullName,versionSlug
} from '../../audit-github-direct-protocol/src/index.mjs';
import { matchRepositoryFixture } from './fixtures.mjs';

const REQUIRED_CAPABILITIES=['publish-check','publish-status','read-source','write-control-ledger'];
const SUMMARY_KEYS=['findingCount','evidenceCount','artifactCount','truncated'];
function validateSummary(value,path='$.summary'){
  const v=exactKeys(value,SUMMARY_KEYS,path);
  if(typeof v.truncated!=='boolean')fail('invalid_boolean',`${path}.truncated`);
  return {
    findingCount:integer(v.findingCount,`${path}.findingCount`,0,1_000_000),
    evidenceCount:integer(v.evidenceCount,`${path}.evidenceCount`,0,1_000_000),
    artifactCount:integer(v.artifactCount,`${path}.artifactCount`,0,100_000),
    truncated:v.truncated
  };
}
function capabilityMatches(capability,request){return capability.jobId===request.jobId&&capability.repositoryId===request.repositoryId&&capability.installationId===request.installationId&&capability.repositoryFullName===request.repositoryFullName&&capability.targetCommitSha===request.targetCommitSha;}
export function admitDirectJob(input){
  const v=exactKeys(input,['request','capabilityManifest','sourceCommitSha','admittedAt'],'$');
  const request=validateDirectRequest(v.request),capability=validateCapabilityManifest(v.capabilityManifest),sourceCommitSha=commitSha(v.sourceCommitSha,'$.sourceCommitSha'),admittedAt=timestamp(v.admittedAt,'$.admittedAt');
  if(sourceCommitSha!==request.targetCommitSha)fail('source_sha_mismatch','$.sourceCommitSha');
  if(!capabilityMatches(capability,request))fail('capability_request_mismatch','$.capabilityManifest');
  for(const required of REQUIRED_CAPABILITIES)if(!capability.capabilities.includes(required))fail('capability_missing','$.capabilityManifest.capabilities');
  const fixture=matchRepositoryFixture(request);
  const core={schemaVersion:'github-direct-runner-admission-v1',modeId:DIRECT_MODE_ID,jobId:request.jobId,repositoryId:request.repositoryId,installationId:request.installationId,repositoryFullName:request.repositoryFullName,targetCommitSha:request.targetCommitSha,sourceCommitSha,policyVersion:request.policyVersion,profileId:request.profileId,parserVersion:request.parserVersion,resultContractVersion:request.resultContractVersion,capabilityId:capability.capabilityId,fixtureId:fixture?.fixtureId??null,admissionState:fixture?'fixture_modeled':'awaiting_executor',reason:fixture?'fixture_allowlisted':'execution_plane_unavailable',executionEnabled:false,modeledResultDigest:fixture?.modeledResultDigest??null,summary:fixture?.summary??{findingCount:0,evidenceCount:0,artifactCount:0,truncated:false},admittedAt};
  const admissionDigest=sha256(core);
  return frozenClone({...core,admissionId:`direct-admission-${admissionDigest.slice(7,31)}`,admissionDigest});
}
export function validateRunnerAdmission(input){
  const keys=['schemaVersion','modeId','jobId','repositoryId','installationId','repositoryFullName','targetCommitSha','sourceCommitSha','policyVersion','profileId','parserVersion','resultContractVersion','capabilityId','fixtureId','admissionState','reason','executionEnabled','modeledResultDigest','summary','admittedAt','admissionId','admissionDigest'];
  const v=exactKeys(input,keys,'$');if(v.schemaVersion!=='github-direct-runner-admission-v1')fail('invalid_schema','$.schemaVersion');if(v.modeId!==DIRECT_MODE_ID)fail('invalid_mode','$.modeId');identifier(v.jobId,'$.jobId');integer(v.repositoryId,'$.repositoryId',1);integer(v.installationId,'$.installationId',1);fullName(v.repositoryFullName,'$.repositoryFullName');commitSha(v.targetCommitSha,'$.targetCommitSha');commitSha(v.sourceCommitSha,'$.sourceCommitSha');versionSlug(v.policyVersion,'$.policyVersion');versionSlug(v.profileId,'$.profileId');versionSlug(v.parserVersion,'$.parserVersion');versionSlug(v.resultContractVersion,'$.resultContractVersion');identifier(v.capabilityId,'$.capabilityId');nullable(v.fixtureId,identifier,'$.fixtureId');enumValue(v.admissionState,['fixture_modeled','awaiting_executor'],'$.admissionState');enumValue(v.reason,['fixture_allowlisted','execution_plane_unavailable'],'$.reason');if(booleanValue(v.executionEnabled,'$.executionEnabled')!==false)fail('execution_boundary_violation','$.executionEnabled');nullable(v.modeledResultDigest,digest,'$.modeledResultDigest');validateSummary(v.summary);timestamp(v.admittedAt,'$.admittedAt');digest(v.admissionDigest,'$.admissionDigest');
  if(v.sourceCommitSha!==v.targetCommitSha)fail('source_sha_mismatch','$.sourceCommitSha');
  if((v.fixtureId===null)!==(v.admissionState==='awaiting_executor'))fail('admission_contradiction','$.fixtureId');
  if((v.modeledResultDigest===null)!==(v.fixtureId===null))fail('admission_contradiction','$.modeledResultDigest');
  const core=Object.fromEntries(keys.slice(0,20).map((key)=>[key,v[key]]));const expected=sha256(core);if(v.admissionDigest!==expected)fail('digest_mismatch','$.admissionDigest');if(v.admissionId!==`direct-admission-${expected.slice(7,31)}`)fail('identity_mismatch','$.admissionId');return frozenClone(v);
}
