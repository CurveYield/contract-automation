import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDirectRequest,createCapabilityManifest
} from '../packages/audit-github-direct-protocol/src/index.mjs';
import {
  createPermissionManifest,normalizeGitHubError,createInjectedGitHubAdapter,
  planCheckPublication,planCommentPublication,planStatusPublication,
  reconcilePublication,createArtifactMetadata,validateArtifactMetadata
} from '../packages/audit-github-direct-adapter/src/index.mjs';
import { planImmutableCreate } from '../packages/audit-github-direct-ledger/src/index.mjs';

const ts='2026-08-01T18:00:00.000Z',later='2026-08-01T18:05:00.000Z';
const sha='a'.repeat(40),blob='b'.repeat(40),d=(c)=>`sha256:${c.repeat(64)}`;
const request=createDirectRequest({repositoryId:123,installationId:456,repositoryFullName:'curveyield/contract-automation',requesterId:'user-1',policyVersion:'direct-policy-v1',profileId:'hardhat-test-v1',parserVersion:'hardhat-test-parser-v1',resultContractVersion:'phase5-tool-result-v1',reportContractVersion:'audit-report-v1',targetCommitSha:sha,requestedAt:ts,idempotencyKey:'request-1'});
const capability=createCapabilityManifest({request,authorizationKind:'github-token',capabilities:['read-source','write-control-ledger','publish-check','publish-comment','publish-status','read-artifact-metadata'],issuedAt:ts,expiresAt:later});
const identity={repositoryId:123,installationId:456,repositoryFullName:'curveyield/contract-automation',targetCommitSha:sha};

function fakeTransport(){
  const calls=[],publications=new Map();
  return {
    calls,publications,
    transport:{
      async getRepository(input){calls.push(['getRepository',input]);return {repositoryId:123,fullName:'curveyield/contract-automation'};},
      async getCommit(input){calls.push(['getCommit',input]);return {sha:input.targetCommitSha};},
      async getBlob(input){calls.push(['getBlob',input]);return {blobSha:input.blobSha,sizeBytes:3};},
      async getContents(input){calls.push(['getContents',input]);return {path:input.path,blobSha:blob};},
      async applyLedgerMutation(input){calls.push(['applyLedgerMutation',input]);return {applied:true,nextBlobSha:input.mutation.nextContentBlobSha};},
      async getPublication(input){calls.push(['getPublication',input]);return publications.get(`${input.kind}:${input.idempotencyKey}`)??null;},
      async publish(input){calls.push(['publish',input]);publications.set(`${input.kind}:${input.idempotencyKey}`,input);return {published:true,publicationId:input.publicationId};},
      async getArtifactMetadata(input){calls.push(['getArtifactMetadata',input]);return [{artifactId:'artifact-1',name:'results-json',sizeBytes:1024,digest:d('c'),expired:false,createdAt:ts,expiresAt:later}];}
    }
  };
}

test('permission manifest is least privilege and operation-specific',()=>{
  const manifest=createPermissionManifest({capabilityManifest:capability});
  assert.deepEqual(manifest.permissions,[
    {resource:'actions-artifact-metadata',access:'read'},
    {resource:'checks',access:'write'},
    {resource:'contents',access:'read'},
    {resource:'contents',access:'write'},
    {resource:'issues-comments',access:'write'},
    {resource:'statuses',access:'write'}
  ]);
  assert.doesNotMatch(JSON.stringify(manifest),/admin|secret|workflow|deployment|token/i);
});

test('permission manifest rejects expired capabilities and unsupported broad fields',()=>{
  assert.throws(()=>createPermissionManifest({capabilityManifest:capability,permissions:['admin']}),{code:'unknown_field'});
  assert.throws(()=>createPermissionManifest({capabilityManifest:{...capability,expiresAt:ts}}),(error)=>typeof error.code==='string');
});

test('GitHub errors normalize to bounded stable redacted forms',()=>{
  const raw={status:403,message:'Bearer ghs_secret failed at https://api.github.com/repos/private C:\\Users\\alice',response:{body:'token=secret'},request:{headers:{authorization:'Bearer ghs_secret'}}};
  const normalized=normalizeGitHubError(raw);
  assert.deepEqual(normalized,{schemaVersion:'github-direct-transport-error-v1',code:'permission_denied',status:403,retryable:false,message:'GitHub operation failed'});
  assert.doesNotMatch(JSON.stringify(normalized),/ghs_|https?:|Users|authorization|secret/i);
  const hostile=new Proxy({}, {ownKeys(){throw new Error('trap')},get(){throw new Error('trap')}});
  assert.deepEqual(normalizeGitHubError(hostile),{schemaVersion:'github-direct-transport-error-v1',code:'transport_error',status:null,retryable:false,message:'GitHub operation failed'});
});

test('injected adapter binds repository/install/target SHA for reads',async()=>{
  const fake=fakeTransport(),adapter=createInjectedGitHubAdapter({capabilityManifest:capability,transport:fake.transport});
  await adapter.getRepository(identity);
  await adapter.getCommit(identity);
  await adapter.getBlob({...identity,blobSha:blob});
  await adapter.getContents({...identity,path:'contracts/A.sol'});
  assert.deepEqual(fake.calls.map((x)=>x[0]),['getRepository','getCommit','getBlob','getContents']);
  assert.throws(()=>adapter.getCommit({...identity,targetCommitSha:'c'.repeat(40)}),{code:'identity_mismatch'});
  assert.throws(()=>adapter.getContents({...identity,repositoryId:999,path:'contracts/A.sol'}),{code:'identity_mismatch'});
});

test('injected adapter validates transport shape without invoking getters',()=>{
  const transport={...fakeTransport().transport};Object.defineProperty(transport,'publish',{get(){throw new Error('must-not-run')},enumerable:true});
  assert.throws(()=>createInjectedGitHubAdapter({capabilityManifest:capability,transport}),{code:'accessor_field'});
  const {proxy,revoke}=Proxy.revocable(fakeTransport().transport,{});revoke();
  assert.throws(()=>createInjectedGitHubAdapter({capabilityManifest:capability,transport:proxy}),{code:'hostile_reflection'});
});

test('ledger mutation dispatch requires capability and exact identity',async()=>{
  const fake=fakeTransport(),adapter=createInjectedGitHubAdapter({capabilityManifest:capability,transport:fake.transport});
  const mutation=planImmutableCreate({path:`.audit-direct/v1/requests/${request.jobId}.json`,content:request});
  const result=await adapter.applyLedgerMutation({...identity,mutation});
  assert.equal(result.applied,true);
  assert.equal(fake.calls[0][0],'applyLedgerMutation');
  assert.throws(()=>adapter.applyLedgerMutation({...identity,installationId:999,mutation}),{code:'identity_mismatch'});
});

test('publication plans are deterministic, boundeK[™Ъ[™\ЬXЪYљXЙЛ

OOћВ€ЫЫњЭЪXЪП\[ђЪXЪФX›XШ][ЫЉЬ™\]Y\Э[YN‰РЭ\ќ™VZY[]Y]	ЛЭ[[X\ћN‰У›Иљ[™[™ЬЙЛЫЫЫ\Ъ[ЫЋ‰ЬЭXШЩ\ЬЙЛ]›]\џJNВ€ЫЫњЭЫЫ[Y[ќ\[ђЫЫ[Y[ќX›XШ][ЫЉЬ™\]Y\Э›ЩN‰Р]Y]ЫЫ\]YЪ]љ[™[™ЬЛ‰Л]›]\џJNВ€ЫЫњЭЭ]\П\[”Э]\ФX›XШ][ЫЉЬ™\]Y\ЭЭ]N‰ЬЭXШЩ\ЬЙЛ\ШЬљ\[ЫЋ‰Р]Y]ЫЫ\]IЛЫЫќ^‰ШЭ\ќ™^ZY[Ш]Y]	Л]›]\џJNВ€\ЬЩ\ќ›X]Ъ
ЪXЪЛњX›XШ][Ы’YЧ™\™XЭXЪXЪЛKКNШ\ЬЩ\ќ›X]Ъ
ЫЫ[Y[ќњX›XШ][Ы’YЧ™\™XЭXЫЫ[Y[ќKКNШ\ЬЩ\ќ›X]Ъ
Э]\ЛњX›XШ][Ы’YЧ™\™XЭ\Э]\ЛKКNВ€\ЬЩ\ќ™\]X[
ЪXЪЛќ\™Щ]ЫЫ[Z]ЪKЪJNШ\ЬЩ\ќ™\]X[
ЫЫ[Y[ќњ™\ЬЪ]ЬћRYLЊКNШ\ЬЩ\ќ™\]X[
Э]\Лљ[њЭ[][Ы’YMЉNВ€\ЬЩ\ќќ›ЭЬК

OOњ[ђЫЫ[Y[ќX›XШ][ЫЉЬ™\]Y\Э›ЩN‰Ю	Лњ™\X]
ЌWНLНЉK]›]\џJKШЫЩN‰Ъ[ќ[YЬЭљ[™ЙЯJNВ€\ЬЩ\ќќ›ЭЬК

OOњ[”Э]\ФX›XШ][ЫЉЬ™\]Y\ЭЭ]N‰ЬЭXШЩ\ЬЙЛ\ШЬљ\[ЫЋ‰ЫЪЙЛЫЫќ^‰ШЭ\ќ™^ZY[Ш]Y]	Л]›]\‹\›‰ЪО‹ЛЩ]љ[	ЯJKШЫЩN‰Э[љЫ›ЭЫ—ЩљY[	ЯJNВџJNВ‚ќ\Э
	Ь™\X]YY[ќXШ[X›XШ][Ы€™XЫЫЪ[\ИЪ[HЫЫ™›XЭ[™И™\^HZ[ЙЛ

OOћВ€ЫЫњЭ[Џ\[ђЪXЪФX›XШ][ЫЉЬ™\]Y\Э[YN‰РЭ\ќ™VZY[]Y]	ЛЭ[[X\ћN‰У›Иљ[™[™ЬЙЛЫЫЫ\Ъ[ЫЋ‰ЬЭXШЩ\ЬЙЛ]›]\џJNВ€\ЬЩ\ќ™Y\\]X[
™XЫЫЪ[TX›XШ][ЫЉЬ[‹ШњЩ\ќ™Y›ќ[JKШXЭ[ЫЋ‰ШЬ™X]IЛ[џJNВ€\ЬЩ\ќ™Y\\]X[
™XЫЫЪ[TX›XШ][ЫЉЬ[‹ШњЩ\ќ™Yњ[џJKШXЭ[ЫЋ‰Ы›ЫЬ	Л[џJNВ€\ЬЩ\ќќ›ЭЬК

OOњ™XЫЫЪ[TX›XШ][ЫЉЬ[‹ШњЩ\ќ™YћЛ‹‹њ[‹Э[[X\ћN‰ЩY™™\™[ќ	Я_JKШЫЩN‰ЬX›XШ][Ы—ШЫЫ™›XЭ	ЯJNВџJNВ‚ќ\Э
	ШY\\€X›XШ][Ы€Ш[XЩ\ИЬ™X]HЫЩH[€™XЫЫЪ[HЪ]Э]\XШ]IЛ\Ю[К
OOћВ€ЫЫњЭZЩOYZЩU[њЬЬќ

KY\\ЏXЬ™X]R[љ™XЭYЪ]XђY\\ЉШШ\Xљ[]SX[љY™\ЭШ\Xљ[]K[њЬЬќ™ZЩKќ[њЬЬќJNВ€ЫЫњЭ[Џ\[ђЪXЪФX›XШ][ЫЉЬ™\]Y\Э[YN‰РЭ\ќ™VZY[]Y]	ЛЭ[[X\ћN‰У›Иљ[™[™ЬЙЛЫЫЫ\Ъ[ЫЋ‰ЬЭXШЩ\ЬЙЛ]›]\џJNВ€ЫЫњЭљ\њЭX]ШZ]Y\\‹њX›\Ъ
Л‹‹љY[ќ]K[џJNВ€ЫЫњЭЩXЫЫ™X]ШZ]Y\\‹њX›\Ъ
Л‹‹љY[ќ]K[џJNВ€\ЬЩ\ќ™\]X[
љ\њЭXЭ[Ы‹	ШЬ™X]IКNШ\ЬЩ\ќ™\]X[
ЩXЫЫ™XЭ[Ы‹	Ы›ЫЬ	КNВ€\ЬЩ\ќ™Y\\]X[
ZЩKШ[Л›X\


OOћМJKЙЩЩ]X›XШ][Ы‰Л	ЬX›\Ъ	Л	ЩЩ]X›XШ][Ы‰ЧJNВџJNВ‚ќ\Э
	Ш\ќYXЭY]Y]H\И›Э[™Y[™ЫЫќZ[њИ›Ић]\ИЬ€T“ЙЛ\Ю[К
OOћВ€ЫЫњЭY]Y]OXЬ™X]P\ќYXЭY]Y]JШ\ќYXЭY‰Ш\ќYXЭLIЛ[YN‰Ь™\Э[ЛZњЫЫ‰ЛЪ^™Pћ]\ОЊLЌYЩ\Э™
	ШЙКK^\™Y™[ЩKЬ™X]Y]ќЛ^\™\Р]›]\џJNВ€\ЬЩ\ќ™Y\\]X[
[Y]P\ќYXЭY]Y]JY]Y]JKY]Y]JNВ€\ЬЩ\ќ™Щ\У›ЭX]Ъ
”УУ‹њЭљ[™ЪYћJY]Y]JKЪПОџЭЫ›ШY\ќYXЭћ]\ЯЫЫќ[ќ›ЩKЪJNВ€\ЬЩ\ќќ›ЭЬК

OOЬ™X]P\ќYXЭY]Y]JШ\ќYXЭY‰Ш\ќYXЭLIЛ[YN‰Ь™\Э[ЛZњЫЫ‰ЛЪ^™Pћ]\ОЊ—МММKYЩ\Э™
	ШЙКK^\™Y™[ЩKЬ™X]Y]ќЛ^\™\Р]›]\џJKШЫЩN‰Ъ[ќ[YЪ[ќYЩ\‰ЯJNВ€ЫЫњЭZЩOYZЩU[њЬЬќ

KY\\ЏXЬ™X]R[љ™XЭYЪ]XђY\\ЉШШ\Xљ[]SX[љY™\ЭШ\Xљ[]K[њЬЬќ™ZЩKќ[њЬЬќJNВ€ЫЫњЭ\ЭX]ШZ]Y\\‹™Щ]\ќYXЭY]Y]JY[ќ]JNВ€\ЬЩ\ќ™\]X[
\Э›[™ЭJNШ\ЬЩ\ќ™Y\\]X[
\ЭМKY]Y]JNВџJNВ‚ќ\Э
	ШШ\Xљ[]HЫZ\ЬЪ[ЫњИ[ћHY\\€Ь\][ЫњИ™Y›Ь™H[њЬЬќШ[ЙЛ\Ю[К
OOћВ€ЫЫњЭ™XYЫ›OXЬ™X]PШ\Xљ[]SX[љY™\Э
Ь™\]Y\Э]]Ьљ^][Ы’Ъ[™‰ЩЪ]X‹]ЪЩ[‰ЛШ\Xљ[]Y\О–ЙЬ™XY\ЫЭ\ЩIЧK\ЬЭYY]ќЛ^\™\Р]›]\џJNВ€ЫЫњЭZЩOYZЩU[њЬЬќ

KY\\ЏXЬ™X]R[љ™XЭYЪ]XђY\\ЉШШ\Xљ[]SX[љY™\Эњ™XYЫ›K[њЬЬќ™ZЩKќ[њЬЬќJNВ€ЫЫњЭ]]][ЫЏ\[’[[]]X›PЬ™X]JЬ]]Y]Y\™XЭЭЊKЬ™\]Y\ЭЛЙЬ™\]Y\Эљ›Ш’YKљњЫЫЫЫќ[ќњ™\]Y\ЭJNВ€\ЬЩ\ќќ›ЭЬК

OOY\\‹\SYЩ\“]]][ЫЉЛ‹‹љY[ќ]K]]][ЫџJKШЫЩN‰ШШ\Xљ[]WЩ[љYY	ЯJNВ€\ЬЩ\ќ™\]X[
ZЩKШ[Л›[™Э
NВџJNВ