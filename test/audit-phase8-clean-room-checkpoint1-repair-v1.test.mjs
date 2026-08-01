import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import {
  LIMITS, canonicalJson, sha256, createCampaignAccessContext, createShareGrant,
  createShareGrantRevocation
} from '../packages/audit-clean-room-protocol/src/index.mjs';
import {
  decideResourceVisibility, planConditionalIndexUpdate
} from '../packages/audit-clean-room-access/src/index.mjs';
import { planMergeStorageTransaction } from '../packages/audit-controlled-merge/src/index.mjs';

const ts='2026-08-01T16:00:00.000Z';
const later='2026-08-02T16:00:00.000Z';
const d=(c)=>`sha256:${c.repeat(64)}`;
const context=(overrides={})=>createCampaignAccessContext({tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',requesterId:'user-a',scopes:['campaign:read'],workspaceSourceDigest:d('a'),campaignRole:'owner',campaignState:'active',policyId:'policy-a',decisionAt:ts,...overrides});
const resource={kind:'report',tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',resourceId:'report-a',resourceDigest:d('b'),sourceDigest:d('a')};
const shared={kind:'base_artifact',tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-b',resourceId:'base-a',resourceDigest:d('b'),sourceDigest:d('a')};
const grant=()=>createShareGrant({tenantId:'tenant-a',workspaceId:'workspace-a',sourceCampaignId:'campaign-b',targetCampaignId:'campaign-a',artifactId:'base-a',artifactDigest:d('b'),sourceDigest:d('a'),issuedAt:ts,expiresAt:'2026-08-03T16:00:00.000Z'});

test('index key is server-derived from closed kind and scope',()=>{
  const etag=d('e');
  const plan=planConditionalIndexUpdate({tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',indexKind:'campaigns',currentEtag:etag,expectedEtag:etag,recordId:'campaign-a',recordDigest:d('c'),estimatedBytes:1024});
  assert.equal(plan.indexKey,'tenants/tenant-a/workspaces/workspace-a/indexes/campaigns-v1.json');
  assert.throws(()=>planConditionalIndexUpdate({indexKey:'attacker/path.json',tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',indexKind:'campaigns',currentEtag:etag,expectedEtag:etag,recordId:'campaign-a',recordDigest:d('c'),estimatedBytes:1024}),{code:'unknown_field'});
});

test('visibility requires campaign read scope and closed role-state matrix',()=>{
  const roles=['owner','reviewer','operator','reader'];
  const states=['active','terminal','archived'];
  const allowed=new Set(['owner:active','owner:terminal','owner:archived','reviewer:active','reviewer:terminal','reviewer:archived','operator:active','operator:terminal','reader:active','reader:terminal','reader:archived']);
  let cases=0;
  for(const role of roles)for(const state of states){
    const yes=decideResourceVisibility({context:context({campaignRole:role,campaignState:state}),resource,grants:[],revocations:[],at:ts});
    assert.equal(yes.visible,allowed.has(`${role}:${state}`),`${role}:${state}`);
    const no=decideResourceVisibility({context:context({campaignRole:role,campaignState:state,scopes:[]}),resource,grants:[],revocations:[],at:ts});
    assert.equal(no.visible,false,`${role}:${state}:no-scope`);
    cases+=2;
  }
  assert.equal(cases,24);
});

test('grant and revocation arrays are dense ordinary bounded and fully validated',()=>{
  const g=grant();
  const sparse=[g];sparse.length=2;
  assert.throws(()=>decideResourceVisibility({context:context(),resource:shared,grants:sparse,revocations:[],at:later}),{code:'sparse_array'});
  const malformed={...g,unexpected:true};
  assert.throws(()=>decideResourceVisibility({context:context(),resource:shared,grants:[g,malformed],revocations:[],at:later}),{code:'unknown_field'});
  const rev=createShareGrantRevocation({grantId:g.grantId,grantDigest:g.grantDigest,revokedAt:later,reasonCode:'owner-revoked'});
  assert.throws(()=>decideResourceVisibility({context:context(),resource:shared,grants:[g],revocations:[rev,{...rev,unexpected:true}],at:later}),{code:'unknown_field'});
  const custom=Object.setPrototypeOf([g],{polluted:true});
  assert.throws(()=>decideResourceVisibility({context:context(),resource:shared,grants:custom,revocations:[],at:later}),{code:'invalid_array'});
});

test('throwing and revoked reflection boundaries return hostile_reflection',()=>{
  const throwingObject=new Proxy({}, {ownKeys(){throw new Error('trap')}});
  assert.throws(()=>canonicalJson(throwingObject),{code:'hostile_reflection'});
  const {proxy:revokedObject,revoke:revokeObject}=Proxy.revocable({},{});revokeObject();
  assert.throws(()=>canonicalJson(revokedObject),{code:'hostile_reflection'});
  const {proxy:revokedArray,revoke:revokeArray}=Proxy.revocable([],{});revokeArray();
  assert.throws(()=>decideResourceVisibility({context:context(),resource:shared,grants:revokedArray,revocations:[],at:later}),{code:'hostile_reflection'});
  const throwingArray=new Proxy([], {ownKeys(){throw new Error('trap')}});
  assert.throws(()=>decideResourceVisibility({context:context(),resource:shared,grants:throwingArray,revocations:[],at:later}),{code:'hostile_reflection'});
});

test('canonical serialization enforces exact UTF-8 encoded byte limit',()=>{
  const exact='a'.repeat(LIMITS.bytes-2);
  assert.equal(new TextEncoder().encode(canonicalJson(exact)).byteLength,LIMITS.bytes);
  assert.throws(()=>canonicalJson(`${exact}a`),{code:'encoded_bytes_exceeded'});
  const multi='é'.repeat(Math.floor((LIMITS.bytes-2)/2));
  assert.equal(new TextEncoder().encode(canonicalJson(multi)).byteLength,LIMITS.bytes);
  assert.throws(()=>canonicalJson(`${multi}é`),{code:'encoded_bytes_exceeded'});
});

test('digest is runtime-neutral and matches SHA-256 known vectors',async()=>{
  assert.equal(sha256('abc'),'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const source=await readFile('packages/audit-clean-room-protocol/src/boundary.mjs','utf8');
  assert.doesNotMatch(source,/node:crypto|from\s+['"]node:/);
});

test('operation traces use canonical class-a and class-b vocabulary',()=>{
  const etag=d('e');
  const index=planConditionalIndexUpdate({tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',indexKind:'campaigns',currentEtag:etag,expectedEtag:etag,recordId:'campaign-a',recordDigest:d('c'),estimatedBytes:1024});
  assert.deepEqual(index.operations.map((op)=>op.class),['class-b','class-a']);
  const merge=planMergeStorageTransaction({tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:'merge-a',terminalManifestIds:['campaign-a','campaign-b'],currentEtag:etag,expectedEtag:etag,retainedBytes:2_000_000,retentionDays:90,existingImmutableDigests:[],quota:{maxInputs:8,maxBytes:4_000_000,maxRetentionDays:90}});
  assert.deepEqual(new Set(merge.operations.map((op)=>op.class)),new Set(['class-a','class-b']));
});

test('checkpoint-1 responsibilities are split into reviewable modules',async()=>{
  const paths=[
    'packages/audit-clean-room-protocol/src/digest.mjs',
    'packages/audit-clean-room-protocol/src/policy.mjs',
    'packages/audit-clean-room-protocol/src/access-context.mjs',
    'packages/audit-clean-room-protocol/src/grants.mjs',
    'packages/audit-clean-room-protocol/src/references.mjs',
    'packages/audit-clean-room-access/src/authorization.mjs',
    'packages/audit-clean-room-access/src/visibility.mjs',
    'packages/audit-clean-room-access/src/non-interference.mjs',
    'packages/audit-clean-room-access/src/storage-keys.mjs',
    'packages/audit-clean-room-access/src/index-planning.mjs'
  ];
  for(const path of paths) await access(path);
  const protocolFacade=await readFile('packages/audit-clean-room-protocol/src/index.mjs','utf8');
  const accessFacade=await readFile('packages/audit-clean-room-access/src/index.mjs','utf8');
  assert.ok(protocolFacade.split('\n').length<40);
  assert.ok(accessFacade.split('\n').length<40);
});
