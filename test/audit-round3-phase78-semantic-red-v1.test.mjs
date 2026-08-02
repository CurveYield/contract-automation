import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256 } from '../packages/audit-clean-room-protocol/src/index.mjs';
import { validateMergeRequest } from '../packages/audit-controlled-merge/src/request-state.mjs';
import { validateMergeManifest } from '../packages/audit-controlled-merge/src/publication-storage.mjs';
import { validateDuplicateRelation, validateConflictRelation } from '../packages/audit-controlled-merge/src/relations.mjs';
import { createProvenanceIndex } from '../packages/audit-provenance/src/index.mjs';
const d=(c)=>`sha256:${c.repeat(64)}`;
const ts='2026-08-02T02:40:00.000Z';
function mergeRequest(refs){const body={schemaVersion:'phase8-merge-request-v1',tenantId:'tenant-a',workspaceId:'workspace-a',workspaceSourceDigest:d('a'),campaignManifestRefs:refs,policyId:'policy-a',requestedBy:'user-a',requestedAt:ts,idempotencyKey:'retry-a',expectedCurrentEtag:d('e')};const requestDigest=sha256(body);return {...body,mergeId:`merge-${requestDigest.slice(7,31)}`,requestDigest};}
function mergeManifest(overrides={}){const body={schemaVersion:'phase8-merge-manifest-v1',mergeId:'merge-a',requestDigest:d('a'),finalState:'completed',terminalManifestDigests:[d('1'),d('2')],duplicateMapDigest:d('3'),conflictMapDigest:d('4'),provenanceIndexDigest:d('5'),mergedReportRefs:[{referenceId:'reference-a',referenceDigest:d('6')}],policyId:'policy-a',operationSummary:{classA:4,classB:4,retainedBytes:2000000,retentionDays:90,variant:'typical'},publishedAt:ts,...overrides};const manifestDigest=sha256(body);return {...body,manifestId:`merge-manifest-${manifestDigest.slice(7,31)}`,manifestDigest};}

test('RED: merge request validator rejects fewer than two inputs',()=>{
  const request=mergeRequest([{campaignId:'campaign-a',manifestId:'manifest-a',manifestDigest:d('1')}]);
  assert.throws(()=>validateMergeRequest(request),{code:'insufficient_inputs'});
});

test('RED: merge request validator rejects duplicate campaign identities',()=>{
  const request=mergeRequest([
    {campaignId:'campaign-a',manifestId:'manifest-a',manifestDigest:d('1')},
    {campaignId:'campaign-a',manifestId:'manifest-b',manifestDigest:d('2')}
  ]);
  assert.throws(()=>validateMergeRequest(request),{code:'duplicate_identity'});
});

test('RED: merge manifest validator rejects malformed report references',()=>{
  const manifest=mergeManifest({mergedReportRefs:[{referenceId:'reference-a',referenceDigest:'not-a-digest'}]});
  assert.throws(()=>validateMergeManifest(manifest),{code:'invalid_digest'});
});

test('RED: merge manifest validator rejects invalid operation summaries',()=>{
  const manifest=mergeManifest({operationSummary:{classA:-1,classB:4,retainedBytes:2000000,retentionDays:90,variant:'typical'}});
  assert.throws(()=>validateMergeManifest(manifest),{code:'invalid_integer'});
});

test('RED: duplicate relation rejects duplicate members and material mismatch',()=>{
  const member={campaignId:'campaign-a',findingId:'finding-a',materialDigest:d('9'),evidenceRefs:[]};
  const core={schemaVersion:'phase8-duplicate-relation-v1',identityKey:'identity-a',material:{identityKey:'identity-a',severity:'high',status:'open',remediation:'upgrade',location:'contract-a',materialDigest:d('8')},members:[member,{...member}]};
  const relationDigest=sha256(core);const relation={...core,relationId:`duplicate-${relationDigest.slice(7,31)}`,relationDigest};
  assert.throws(()=>validateDuplicateRelation(relation),{code:'duplicate_identity'});
});

test('RED: conflict relation recomputes actual conflict fields and unique members',()=>{
  const value={campaignId:'campaign-a',findingId:'finding-a',severity:'high',status:'open',remediation:'upgrade',location:'contract-a',materialDigest:d('1'),evidenceRefs:[]};
  const core={schemaVersion:'phase8-conflict-relation-v1',identityKey:'identity-a',conflictFields:['status'],values:[value,{...value}]};
  const relationDigest=sha256(core);const relation={...core,relationId:`conflict-${relationDigest.slice(7,31)}`,relationDigest};
  assert.throws(()=>validateConflictRelation(relation),{code:'duplicate_identity'});
});

test('RED: provenance classification never invokes schemaVersion getter',()=>{
  let getterCalls=0;
  const hostile={nodeId:'node-a',type:'source',tenantId:'tenant-a',workspaceId:'workspace-a',campaignId:null,digest:d('a'),sourceRef:null};
  Object.defineProperty(hostile,'schemaVersion',{enumerable:true,get(){getterCalls++;return 'phase8-provenance-node-v1';}});
  assert.throws(()=>createProvenanceIndex({tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:'merge-a',nodes:[hostile],edges:[],createdAt:ts}),{code:'accessor_field'});
  assert.equal(getterCalls,0);
});

test('RED: revoked provenance node proxy maps to hostile_reflection',()=>{
  const {proxy,revoke}=Proxy.revocable({},{});revoke();
  assert.throws(()=>createProvenanceIndex({tenantId:'tenant-a',workspaceId:'workspace-a',mergeId:'merge-a',nodes:[proxy],edges:[],createdAt:ts}),{code:'hostile_reflection'});
});
