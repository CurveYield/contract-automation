import test from 'node:test';
import assert from 'node:assert/strict';
import { AuditR2Store, ConditionalWriteError } from '../packages/audit-r2-store/src/index.mjs';
import { assertJobTransition } from '../packages/audit-campaign-protocol/src/index.mjs';
import { ForkService } from '../packages/audit-forks/src/index.mjs';
import { createCleanRoomPolicy } from '../packages/audit-clean-room-protocol/src/index.mjs';
import { createControlledMerge, validateControlledMerge } from '../packages/audit-controlled-merge/src/index.mjs';

class MemoryBackend {
  constructor() { this.values = new Map(); this.revision = 0; }
  async head(key) { const item=this.values.get(key); return item ? { etag:item.etag,size:item.bytes.byteLength,uploaded:item.uploaded,customMetadata:{} } : null; }
  async get(key) { const item=this.values.get(key); return item ? { value:new Uint8Array(item.bytes),etag:item.etag,size:item.bytes.byteLength,uploaded:item.uploaded,customMetadata:{} } : null; }
  async put(key,value) { const bytes=typeof value==='string'?new TextEncoder().encode(value):value instanceof Uint8Array?new Uint8Array(value):new Uint8Array(value); const item={bytes,etag:`etag-${++this.revision}`,uploaded:'2026-08-01T16:00:00.000Z'}; this.values.set(key,item); return {etag:item.etag,size:bytes.byteLength,uploaded:item.uploaded,customMetadata:{}}; }
  async delete(key) { this.values.delete(key); }
}
const sourceDigest = `sha256:${'a'.repeat(64)}`;

test('conditional Audit store rejects stale and duplicate create writes', async () => {
  const store = new AuditR2Store(new MemoryBackend());
  const first = await store.put('objects/a', 'one', { onlyIf: { etagDoesNotMatch: '*' } });
  await assert.rejects(() => store.put('objects/a', 'two', { onlyIf: { etagDoesNotMatch: '*' } }), (error) => error instanceof ConditionalWriteError);
  await assert.rejects(() => store.put('objects/a', 'two', { onlyIf: { etagMatches: 'stale' } }), (error) => error instanceof ConditionalWriteError);
  const second = await store.put('objects/a', 'two', { onlyIf: { etagMatches: first.etag } });
  assert.notEqual(second.etag, first.etag);
});

test('job provisioning remains blocked without explicit trusted-fixture authorization', () => {
  assert.throws(() => assertJobTransition('awaiting_executor', 'provisioning'), (error) => error.code === 'trusted_fixture_required');
  assert.equal(assertJobTransition('awaiting_executor', 'provisioning', { trustedFixture: true }), true);
});

test('Phase 7 mock fork create is deterministic and remains non-executing', async () => {
  const store = new AuditR2Store(new MemoryBackend());
  const service = new ForkService(store);
  const input = {
    schemaVersion:'fork-request-v1',tenantId:'ten_11111111111111111111111111111111',workspaceId:'ws_22222222222222222222222222222222',campaignId:'cmp_33333333333333333333333333333333',forkId:'fork_44444444444444444444444444444444',attemptId:'att_55555555555555555555555555555555',profileId:'free-development-v1',policyVersion:'fork-policy-v1',requesterId:'worker-2',scopes:['audit:submit'],chainId:1,blockNumber:19000000,adapterKind:'mock',executionGate:'trusted_mock',createdAt:'2026-08-01T16:00:00.000Z',idempotencyKey:'round2-e2e'
  };
  const first = await service.createFork(input);
  const second = await service.createFork(input);
  assert.equal(first.state, 'ready');
  assert.equal(second.requestDigest, first.requestDigest);
  assert.equal(service.capability().executionEnabled, false);
  assert.equal(service.capability().realCreateState, 'awaiting_executor');
});

test('Phase 8 controlled merge preserves one source digest and disabled execution', () => {
  const policy = createCleanRoomPolicy({tenantId:'tenant-1',workspaceId:'workspace-1',allowedScopes:['campaign:merge','campaign:read','campaign:share-base','campaign:write'],maxCampaigns:10,maxMergeInputs:8,maxFindings:100,maxEvidence:100,maxRelations:100,maxBytes:1000000,retentionDays:30,issuedAt:'2026-08-01T16:00:00.000Z'});
  const campaigns = [
    {campaignId:'campaign-a',tenantId:policy.tenantId,workspaceId:policy.workspaceId,workspaceSourceDigest:sourceDigest,state:'active'},
    {campaignId:'campaign-b',tenantId:policy.tenantId,workspaceId:policy.workspaceId,workspaceSourceDigest:sourceDigest,state:'active'}
  ];
  const access = (campaignId) => ({ policy, requester:{tenantId:policy.tenantId,requesterId:'worker-2',scopes:['campaign:merge'],campaignRole:'owner'}, grants:[],revocations:[],decisionAt:'2026-08-01T16:01:00.000Z',campaignId });
  const merge = createControlledMerge({policy,campaigns,accessByCampaign:{'campaign-a':access('campaign-a'),'campaign-b':access('campaign-b')},artifactsByCampaign:{'campaign-a':[{artifactId:'artifact-a',artifactDigest:`sha256:${'b'.repeat(64)}`}],'campaign-b':[{artifactId:'artifact-b',artifactDigest:`sha256:${'c'.repeat(64)}`}]},mergeId:'merge-1',createdAt:'2026-08-01T16:02:00.000Z'});
  assert.equal(merge.executionEnabled, false);
  assert.equal(merge.workspaceSourceDigest, sourceDigest);
  assert.equal(validateControlledMerge(merge).artifacts.length, 2);
});
