import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCleanRoomPolicy, validateCleanRoomPolicy, createCampaignAccessContext,
  validateCampaignAccessContext, createShareGrant, validateShareGrant,
  createShareGrantRevocation, validateShareGrantRevocation, canonicalClone
} from '../packages/audit-clean-room-protocol/src/index.mjs';
import { authorizeCampaignAccess, validateAccessDecision, decideResourceVisibility, validateVisibilityDecision, planScopedStorageKeys } from '../packages/audit-clean-room-access/src/index.mjs';
import { createTerminalCampaignManifest, validateTerminalCampaignManifest } from '../packages/audit-clean-room-campaigns/src/index.mjs';
import {
  createMergeRequest, validateMergeRequest, createInitialMergeState, validateMergeState,
  transitionMergeState, validateMergeEvent, buildRelationMaps, validateDuplicateRelation,
  validateConflictRelation, createMergeManifest, validateMergeManifest
} from '../packages/audit-controlled-merge/src/index.mjs';
import {
  createProvenanceNode, validateProvenanceNode, createProvenanceEdge, validateProvenanceEdge,
  createProvenanceIndex, validateProvenanceIndex, createMergedReportReference,
  validateMergedReportReference
} from '../packages/audit-provenance/src/index.mjs';

const ts='2026-08-01T16:00:00.000Z';const d=(c)=>`sha256:${c.repeat(64)}`;const ref=(id,c)=>({id,digest:d(c)});
const policy=createCleanRoomPolicy({tenantId:'tenant-a',workspaceId:'workspace-a',allowedScopes:['campaign:read','campaign:merge','campaign:share-base','campaign:write'],maxCampaigns:100,maxMergeInputs:16,maxFindings:1000,maxEvidence:2000,maxRelations:1000,maxBytes:2_000_000,retentionDays:90,issuedAt:ts});
const context=createCampaignAccessContext({tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',requesterId:'user-a',scopes:['campaign:read','campaign:merge'],workspaceSourceDigest:d('a'),campaignRole:'owner',campaignState:'active',policyId:policy.policyId,decisionAt:ts});
const grant=createShareGrant({tenantId:'tenant-a',workspaceId:'workspace-a',sourceCampaignId:'campaign-b',targetCampaignId:'campaign-a',artifactId:'base-a',artifactDigest:d('b'),sourceDigest:d('a'),issuedAt:ts,expiresAt:'2026-08-03T16:00:00.000Z'});
const revocation=createShareGrantRevocation({grantId:grant.grantId,grantDigest:grant.grantDigest,revokedAt:'2026-08-02T16:00:00.000Z',reasonCode:'owner-revoked'});
const accessDecision=authorizeCampaignAccess(context,{tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',requiredScopes:['campaign:read'],resourceKind:'report',at:ts});
const visibility=decideResourceVisibility({context,resource:{kind:'report',tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',resourceId:'report-a',resourceDigest:d('d'),sourceDigest:d('a')},grants:[],revocations:[],at:ts});
const terminal=(id)=>createTerminalCampaignManifest({tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:id,workspaceSourceDigest:d('a'),baseArtifactDigest:d('b'),terminalState:'completed',completionKind:'findings',partialEvidence:false,truncated:false,policyId:policy.policyId,profileVersions:['profile-a-v1'],layerRefs:[ref(`layer-${id}`,'1')],jobRefs:[ref(`job-${id}`,'2')],attemptRefs:[ref(`attempt-${id}`,'3')],evidenceRefs:[ref(`evidence-${id}`,'4')],reportRefs:[ref(`report-${id}`,'5')],findings:[{findingId:`finding-${id}`,identityKey:'identity-a',severity:'high',status:'open',remediation:'upgrade',location:'contracts-a-sol-10',materialDigest:d('6'),evidenceRefs:[ref(`evidence-${id}`,'4')]}],completedAt:ts});
const ta=terminal('campaign-a'),tb=terminal('campaign-b');
const request=createMergeRequest({terminalManifests:[ta,tb],policyId:policy.policyId,requestedBy:'user-a',requestedAt:ts,idempotencyKey:'request-a',expectedCurrentEtag:d('e')});
const state=createInitialMergeState(request,ts);const event=transitionMergeState(state,{to:'validating',expectedEtag:state.etag,at:ts,reasonCode:'validate'}).event;
const maps=buildRelationMaps([{findingId:'finding-a',campaignId:'campaign-a',identityKey:'identity-a',severity:'high',status:'open',remediation:'upgrade',location:'contracts-a-sol-10',materialDigest:d('6'),evidenceRefs:[ref('evidence-a','4')]},{findingId:'finding-b',campaignId:'campaign-b',identityKey:'identity-a',severity:'high',status:'open',remediation:'upgrade',location:'contracts-a-sol-10',materialDigest:d('6'),evidenceRefs:[ref('evidence-b','4')]},{findingId:'finding-c',campaignId:'campaign-c',identityKey:'identity-a',severity:'critical',status:'accepted',remediation:'replace',location:'contracts-a-sol-10',materialDigest:d('9'),evidenceRefs:[ref('evidence-c','7')]}]);
const source=createProvenanceNode({nodeId:'source-a',type:'source',tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:null,digest:d('a'),sourceRef:null});
const campaign=createProvenanceNode({nodeId:'campaign-a',type:'campaign',tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',digest:ta.manifestDigest,sourceRef:'source-a'});
const edge=createProvenanceEdge({type:'derived_from',from:'campaign-a',to:'source-a'});
const provenance=createProvenanceIndex({tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:request.mergeId,nodes:[source,campaign],edges:[edge],createdAt:ts});
const report=createMergedReportReference({tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:request.mergeId,sourceCampaignId:'campaign-a',sourceState:'complete',reportId:'report-a',reportDigest:d('5'),evidenceRefs:[ref('evidence-a','4')],label:'Campaign A report',createdAt:ts});
const mergeManifest=createMergeManifest({mergeRequest:request,finalState:'completed',terminalManifestDigests:[ta.manifestDigest,tb.manifestDigest],duplicateMapDigest:maps.duplicateMapDigest,conflictMapDigest:maps.conflictMapDigest,provenanceIndexDigest:provenance.indexDigest,mergedReportRefs:[{referenceId:report.referenceId,referenceDigest:report.referenceDigest}],policyId:policy.policyId,operationSummary:{classA:4,classB:4,retainedBytes:2_000_000,retentionDays:90,variant:'typical-4a-4b-2mb-90d'},publishedAt:ts});

function invalidFor(value,key){if(Array.isArray(value))return null;if(value===null)return '*';if(typeof value==='boolean')return 'false';if(typeof value==='number')return -0;if(typeof value==='object')return {...value,unexpected:true};if(key==='schemaVersion')return 'wrong-v1';if(/Digest|etag$/.test(key))return 'sha256:bad';if(/At$/.test(key))return 'not-a-time';return '*';}
const contracts=[['policy',policy,validateCleanRoomPolicy],['context',context,validateCampaignAccessContext],['grant',grant,validateShareGrant],['revocation',revocation,validateShareGrantRevocation],['accessDecision',accessDecision,validateAccessDecision],['visibility',visibility,validateVisibilityDecision],['terminal',ta,validateTerminalCampaignManifest],['mergeRequest',request,validateMergeRequest],['mergeState',state,validateMergeState],['mergeEvent',event,validateMergeEvent],['duplicateRelation',maps.duplicateRelations[0],validateDuplicateRelation],['conflictRelation',maps.conflictRelations[0],validateConflictRelation],['provenanceNode',source,validateProvenanceNode],['provenanceEdge',edge,validateProvenanceEdge],['provenanceIndex',provenance,validateProvenanceIndex],['reportReference',report,validateMergedReportReference],['mergeManifest',mergeManifest,validateMergeManifest]];

test('one-field invalid mutations are rejected across public output contracts',()=>{
  let mutationCount=0;
  for(const [name,value,validate] of contracts){for(const key of Object.keys(value)){const mutated=structuredClone(value);mutated[key]=invalidFor(mutated[key],key);assert.throws(()=>validate(mutated),(error)=>typeof error?.code==='string'&&typeof error?.path==='string',`${name}.${key}`);mutationCount++;}}
  assert.ok(mutationCount>=170,`expected broad mutation corpus, got ${mutationCount}`);
});

test('hostile reflection corpus returns bounded errors without executing accessors',()=>{
  let getterCalls=0;const accessor={tenantId:'tenant-a'};Object.defineProperty(accessor,'workspaceId',{get(){getterCalls++;throw new Error('must not execute')},enumerable:true});
  assert.throws(()=>createCleanRoomPolicy(accessor),(error)=>error.code==='accessor_field');assert.equal(getterCalls,0);
  assert.throws(()=>createCleanRoomPolicy(Object.assign(Object.create({polluted:true}),{})),(error)=>error.code==='invalid_prototype');
  const symbol={};symbol[Symbol('hidden')]=1;assert.throws(()=>createCleanRoomPolicy(symbol),(error)=>['symbol_field','missing_field'].includes(error.code));
  const cycle={value:null};cycle.value=cycle;assert.throws(()=>canonicalClone(cycle),{code:'cycle'});
  const throwing=new Proxy({}, {ownKeys(){throw new Error('trap')}});assert.throws(()=>createCleanRoomPolicy(throwing),(error)=>error.code==='hostile_reflection');
  const {proxy,revoke}=Proxy.revocable({},{});revoke();assert.throws(()=>createCleanRoomPolicy(proxy),(error)=>typeof error?.code==='string');
});

test('numeric, string, path, collection, and cross-scope substitutions reject deterministically',()=>{
  for(const bad of [-0,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>createCleanRoomPolicy({tenantId:'tenant-a',workspaceId:'workspace-a',allowedScopes:['campaign:read'],maxCampaigns:bad,maxMergeInputs:2,maxFindings:1,maxEvidence:1,maxRelations:1,maxBytes:1,retentionDays:1,issuedAt:ts}), (error)=>typeof error.code==='string');
  assert.throws(()=>createCampaignAccessContext({tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:'campaign-a',requesterId:'user\u0000secret',scopes:['campaign:read'],workspaceSourceDigest:d('a'),campaignRole:'owner',campaignState:'active',policyId:'policy-a',decisionAt:ts}),(error)=>error.code==='control_character');
  assert.throws(()=>planScopedStorageKeys({tenantId:'tenant-a',workspaceId:'../workspace',campaignId:'campaign-a',mergeId:null}),{code:'invalid_identifier'});
  assert.throws(()=>createMergeRequest({terminalManifests:[ta,createTerminalCampaignManifest({...structuredClone(tb),tenantId:'tenant-b'})],policyId:policy.policyId,requestedBy:'user-a',requestedAt:ts,idempotencyKey:'request-b',expectedCurrentEtag:d('e')}),{code:'tenant_mismatch'});
});

test('all valid public outputs are recursively frozen defensive clones',()=>{
  for(const [,value] of contracts){assert.equal(Object.isFrozen(value),true);for(const child of Object.values(value))if(child&&typeof child==='object')assert.equal(Object.isFrozen(child),true);}
});
