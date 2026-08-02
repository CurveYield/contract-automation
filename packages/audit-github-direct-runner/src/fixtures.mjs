import {
  exactKeys,denseArray,identifier,integer,fullName,commitSha,versionSlug,digest,timestamp,
  sha256,frozenClone,fail,validateDirectRequest
} from '../../audit-github-direct-protocol/src/index.mjs';

const fixtureEntry=(value,path)=>{
  const v=exactKeys(value,['fixtureId','repositoryId','installationId','repositoryFullName','targetCommitSha','policyVersion','profileId','parserVersion','resultContractVersion','modeledResultDigest','summary'],path);
  const summaryRaw=exactKeys(v.summary,['findingCount','evidenceCount','artifactCount','truncated'],`${path}.summary`);
  const summary={
    findingCount:integer(summaryRaw.findingCount,`${path}.summary.findingCount`,0,1_000_000),
    evidenceCount:integer(summaryRaw.evidenceCount,`${path}.summary.evidenceCount`,0,1_000_000),
    artifactCount:integer(summaryRaw.artifactCount,`${path}.summary.artifactCount`,0,100_000),
    truncated:summaryRaw.truncated===false?false:(()=>{fail('invalid_boolean',`${path}.summary.truncated`)})()
  };
  return {
    fixtureId:identifier(v.fixtureId,`${path}.fixtureId`),
    repositoryId:integer(v.repositoryId,`${path}.repositoryId`,1),
    installationId:integer(v.installationId,`${path}.installationId`,1),
    repositoryFullName:fullName(v.repositoryFullName,`${path}.repositoryFullName`),
    targetCommitSha:commitSha(v.targetCommitSha,`${path}.targetCommitSha`),
    policyVersion:versionSlug(v.policyVersion,`${path}.policyVersion`),
    profileId:versionSlug(v.profileId,`${path}.profileId`),
    parserVersion:versionSlug(v.parserVersion,`${path}.parserVersion`),
    resultContractVersion:versionSlug(v.resultContractVersion,`${path}.resultContractVersion`),
    modeledResultDigest:digest(v.modeledResultDigest,`${path}.modeledResultDigest`),
    summary
  };
};

function buildAllowlist(entries,publishedAt){
  const normalized=denseArray(entries,'$.entries',64).map((entry,index)=>fixtureEntry(entry,`$.entries[${index}]`)).sort((a,b)=>a.fixtureId.localeCompare(b.fixtureId));
  if(new Set(normalized.map((entry)=>entry.fixtureId)).size!==normalized.length)fail('duplicate_identity','$.entries');
  const body={schemaVersion:'github-direct-fixture-allowlist-v1',entries:normalized,publishedAt:timestamp(publishedAt,'$.publishedAt'),serverOwned:true};
  const allowlistDigest=sha256(body);
  return frozenClone({...body,allowlistId:`direct-fixtures-${allowlistDigest.slice(7,31)}`,allowlistDigest});
}

export const DIRECT_FIXTURE_ALLOWLIST=buildAllowlist([{
  fixtureId:'fixture-hardhat-empty-v1',
  repositoryId:123,
  installationId:456,
  repositoryFullName:'curveyield/contract-automation',
  targetCommitSha:'f'.repeat(40),
  policyVersion:'direct-policy-v1',
  profileId:'hardhat-test-v1',
  parserVersion:'hardhat-test-parser-v1',
  resultContractVersion:'phase5-tool-result-v1',
  modeledResultDigest:`sha256:${'9'.repeat(64)}`,
  summary:{findingCount:0,evidenceCount:1,artifactCount:0,truncated:false}
}],'2026-08-01T00:00:00.000Z');

export function validateFixtureAllowlist(input){
  const v=exactKeys(input,['schemaVersion','entries','publishedAt','serverOwned','allowlistId','allowlistDigest'],'$');
  if(v.schemaVersion!=='github-direct-fixture-allowlist-v1')fail('invalid_schema','$.schemaVersion');
  if(v.serverOwned!==true)fail('server_owned_allowlist_required','$.serverOwned');
  digest(v.allowlistDigest,'$.allowlistDigest');
  const rebuilt=buildAllowlist(v.entries,v.publishedAt);
  if(v.allowlistDigest!==rebuilt.allowlistDigest)fail('digest_mismatch','$.allowlistDigest');
  if(v.allowlistId!==rebuilt.allowlistId)fail('identity_mismatch','$.allowlistId');
  return rebuilt;
}

export function matchRepositoryFixture(requestInput){
  const request=validateDirectRequest(requestInput);
  return DIRECT_FIXTURE_ALLOWLIST.entries.find((entry)=>
    entry.repositoryId===request.repositoryId&&
    entry.installationId===request.installationId&&
    entry.repositoryFullName===request.repositoryFullName&&
    entry.targetCommitSha===request.targetCommitSha&&
    entry.policyVersion===request.policyVersion&&
    entry.profileId===request.profileId&&
    entry.parserVersion===request.parserVersion&&
    entry.resultContractVersion===request.resultContractVersion
  )??null;
}
