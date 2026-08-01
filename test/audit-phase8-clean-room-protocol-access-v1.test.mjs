import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCleanRoomPolicy, validateCleanRoomPolicy, createCampaignAccessContext,
  validateCampaignAccessContext, createShareGrant, validateShareGrant,
  createShareGrantRevocation, canonicalJson, canonicalClone
} from '../packages/audit-clean-room-protocol/src/index.mjs';
import {
  authorizeCampaignAccess, decideResourceVisibility, createHiddenResourceEnvelope,
  enforceHiddenResourceNonInterference, planScopedStorageKeys, planConditionalIndexUpdate
} from '../packages/audit-clean-room-access/src/index.mjs';

const ts='2026-08-01T16:00:00.000Z';
const later='2026-08-02T16:00:00.000Z';
const muchLater='2026-08-03T16:00:00.000Z';
const d=(c)=>`sha256:${c.repeat(64)}`;
const policyInput={tenantId:'tenant-a',workspaceId:'workspace-a',allowedScopes:['campaign:read','campaign:merge','campaign:share-base','campaign:write'],maxCampaigns:100,maxMergeInputs:16,maxFindings:1000,maxEvidence:2000,maxRelations:1000,maxBytes:2_000_000,retentionDays:90,issuedAt:ts};
const contextInput={tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',requesterId:'user-a',scopes:['campaign:read','campaign:merge','campaign:share-base'],workspaceSourceDigest:d('a'),campaignRole:'owner',campaignState:'active',policyId:'policy-a',decisionAt:ts};
const resource=(kind='report',overrides={})=>({kind,tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',resourceId:`${kind}-a`,resourceDigest:d('b'),sourceDigest:d('a'),...overrides});

test('policy builder is deterministic, canonical, recursively frozen, and validates',()=>{
  const first=createCleanRoomPolicy(policyInput);
  const second=createCleanRoomPolicy({...policyInput,allowedScopes:[...policyInput.allowedScopes].reverse()});
  assert.deepEqual(second,first);
  assert.equal(Object.isFrozen(first),true);
  assert.equal(Object.isFrozen(first.allowedScopes),true);
  assert.deepEqual(validateCleanRoomPolicy(first),first);
});

test('policy one-field mutations fail with bounded code and path',()=>{
  const policy=createCleanRoomPolicy(policyInput);
  for(const key of Object.keys(policy)){
    const mutated=structuredClone(policy);
    if(key==='schemaVersion') mutated[key]='wrong-v1';
    else if(key.endsWith('Digest')) mutated[key]=d('f');
    else if(key==='policyId') mutated[key]='policy-wrong';
    else if(Array.isArray(mutated[key])) mutated[key]=[];
    else if(typeof mutated[key]==='number') mutated[key]=-0;
    else mutated[key]='wrong';
    assert.throws(()=>validateCleanRoomPolicy(mutated),(error)=>typeof error.code==='string'&&typeof error.path==='string');
  }
});

test('hostile object boundaries reject prototypes, accessors, symbols, sparse arrays, and cycles',()=>{
  assert.throws(()=>createCleanRoomPolicy(Object.assign(Object.create({x:1}),policyInput)),{code:'invalid_prototype'});
  const accessor={...policyInput};Object.defineProperty(accessor,'tenantId',{get(){throw new Error('must not run')},enumerable:true});
  assert.throws(()=>createCleanRoomPolicy(accessor),{code:'accessor_field'});
  const symbol={...policyInput};symbol[Symbol('x')]=1;assert.throws(()=>createCleanRoomPolicy(symbol),{code:'symbol_field'});
  const sparse=[...policyInput.allowedScopes];delete sparse[1];assert.throws(()=>createCleanRoomPolicy({...policyInput,allowedScopes:sparse}),{code:'sparse_array'});
  const cyclic={a:null};cyclic.a=cyclic;assert.throws(()=>canonicalClone(cyclic),{code:'cycle'});
});

test('access context is validated and defensively cloned',()=>{
  const context=createCampaignAccessContext(contextInput);
  assert.deepEqual(validateCampaignAccessContext(context),context);
  contextInput.scopes.push('campaign:write');
  assert.equal(context.scopes.includes('campaign:write'),false);
  contextInput.scopes.pop();
});

test('authorization truth table is default-deny and exact-scope bound',()=>{
  const context=createCampaignAccessContext(contextInput);
  const base={tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',requiredScopes:['campaign:read'],resourceKind:'report',at:ts};
  const cases=[
    [base,true,'allowed'],
    [{...base,tenantId:'tenant-b'},false,'tenant_mismatch'],
    [{...base,workspaceId:'workspace-b'},false,'workspace_mismatch'],
    [{...base,campaignId:'campaign-b'},false,'campaign_mismatch'],
    [{...base,requiredScopes:['campaign:write']},false,'scope_missing']
  ];
  for(const [input,allowed,reason] of cases){const result=authorizeCampaignAccess(context,input);assert.equal(result.allowed,allowed);assert.equal(result.reason,reason);assert.equal(Object.isFrozen(result),true);}
});

test('wildcard and caller-authored authorization fields are rejected',()=>{
  const context=createCampaignAccessContext(contextInput);
  assert.throws(()=>authorizeCampaignAccess(context,{tenantId:'*',workspaceId:'workspace-a',campaignId:'campaign-a',requiredScopes:['campaign:read'],resourceKind:'report',at:ts}),{code:'invalid_identifier'});
  assert.throws(()=>authorizeCampaignAccess(context,{tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',requiredScopes:['campaign:read'],resourceKind:'report',at:ts,allowed:true}),{code:'unknown_field'});
});

test('all campaign-owned resource classes are visible only to the owning campaign',()=>{
  const context=createCampaignAccessContext(contextInput);
  const kinds=['source_manifest','base_artifact','layer','job','attempt','log','artifact','evidence','report','fork_reference','notification','search_entry'];
  for(const kind of kinds){
    const own=decideResourceVisibility({context,resource:resource(kind),grants:[],revocations:[],at:ts});
    const hidden=decideResourceVisibility({context,resource:resource(kind,{campaignId:'campaign-b'}),grants:[],revocations:[],at:ts});
    assert.equal(own.visible,true,kind);assert.equal(hidden.visible,false,kind);
  }
});

test('explicit immutable base-artifact grant allows only exact artifact and source digest',()=>{
  const context=createCampaignAccessContext(contextInput);
  const grant=createShareGrant({tenantId:'tenant-a',workspaceId:'workspace-a',sourceCampaignId:'campaign-b',targetCampaignId:'campaign-a',artifactId:'base-a',artifactDigest:d('b'),sourceDigest:d('a'),issuedAt:ts,expiresAt:muchLater});
  assert.deepEqual(validateShareGrant(grant),grant);
  const shared=resource('base_artifact',{campaignId:'campaign-b',resourceId:'base-a'});
  assert.equal(decideResourceVisibility({context,resource:shared,grants:[grant],revocations:[],at:later}).visible,true);
  assert.equal(decideResourceVisibility({context,resource:{...shared,resourceDigest:d('c')},grants:[grant],revocations:[],at:later}).visible,false);
  assert.equal(decideResourceVisibility({context,resource:resource('evidence',{campaignId:'campaign-b',resourceId:'base-a'}),grants:[grant],revocations:[],at:later}).visible,false);
});

test('grant expiry and immutable revocation deny future reads without changing provenance',()=>{
  const context=createCampaignAccessContext(contextInput);
  const grant=createShareGrant({tenantId:'tenant-a',workspaceId:'workspace-a',sourceCampaignId:'campaign-b',targetCampaignId:'campaign-a',artifactId:'base-a',artifactDigest:d('b'),sourceDigest:d('a'),issuedAt:ts,expiresAt:muchLater});
  const revocation=createShareGrantRevocation({grantId:grant.grantId,grantDigest:grant.grantDigest,revokedAt:later,reasonCode:'owner-revoked'});
  const shared=resource('base_artifact',{campaignId:'campaign-b',resourceId:'base-a'});
  assert.equal(decideResourceVisibility({context,resource:shared,grants:[grant],revocations:[revocation],at:ts}).visible,true);
  assert.equal(decideResourceVisibility({context,resource:shared,grants:[grant],revocations:[revocation],at:later}).reason,'grant_revoked');
  assert.equal(grant.revokedAt,undefined);
});

test('hidden absent-versus-existing envelopes are byte-identical across all observable surfaces',()=>{
  const context=createCampaignAccessContext(contextInput);
  const hidden=decideResourceVisibility({context,resource:resource('report',{campaignId:'campaign-b'}),grants:[],revocations:[],at:ts});
  const absent=enforceHiddenResourceNonInterference(hidden);
  const existing=enforceHiddenResourceNonInterference(hidden);
  assert.equal(canonicalJson(absent),canonicalJson(existing));
  assert.deepEqual(absent,createHiddenResourceEnvelope());
  assert.deepEqual(Object.keys(absent).sort(),['cacheTag','code','facets','items','message','notifications','operationBudget','relationHints','schemaVersion','signedResource','status','timingClass','total'].sort());
});

test('scoped storage keys are deterministic and never request prefix listing',()=>{
  const first=planScopedStorageKeys({tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',mergeId:'merge-a'});
  const second=planScopedStorageKeys({tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',mergeId:'merge-a'});
  assert.deepEqual(first,second);assert.equal(first.usesPrefixListing,false);
  for(const key of Object.values(first.keys)) if(key!==null){assert.match(key,/tenant-a/);assert.doesNotMatch(key,/\.\./);}
});

test('server-owned index updates require exact CAS and expose billing trace',()=>{
  const etag=d('e');
  const plan=planConditionalIndexUpdate({indexKey:'tenants/tenant-a/workspaces/workspace-a/indexes/campaigns-v1.json',currentEtag:etag,expectedEtag:etag,recordId:'campaign-a',recordDigest:d('c'),estimatedBytes:1024});
  assert.deepEqual(plan.summary,{classA:1,classB:1,bytes:1024});assert.equal(plan.serverOwnedIndex,true);assert.equal(plan.usesPrefixListing,false);
  assert.throws(()=>planConditionalIndexUpdate({indexKey:'tenants/tenant-a/workspaces/workspace-a/indexes/campaigns-v1.json',currentEtag:etag,expectedEtag:d('f'),recordId:'campaign-a',recordDigest:d('c'),estimatedBytes:1024}),{code:'stale_write'});
});
