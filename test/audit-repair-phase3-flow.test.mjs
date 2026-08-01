import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryAuditStore } from '../packages/audit-r2-store/src/index.mjs';
import { workspaceSourceManifestKey } from '../packages/audit-workspace-protocol/src/index.mjs';
import { profileIndexKey } from '../packages/audit-profile-registry/src/index.mjs';
import {
  campaignJobIndexKey,
  workspaceCampaignIndexKey
} from '../packages/audit-campaign-protocol/src/index.mjs';
import { CampaignService } from '../packages/audit-campaigns/src/index.mjs';

const workspaceId = `ws_${'1'.repeat(32)}`;
const campaignId = `cmp_${'2'.repeat(32)}`;
const jobId = `ajob_${'3'.repeat(32)}`;
const profileId = 'slither-solidity-v1';

const creation = {
  schemaVersion: 'campaign-creation-v1',
  campaignId,
  workspaceId,
  name: 'BoostHub connected-stack audit',
  createdAt: '2026-08-01T06:30:00.000Z',
  retentionPolicy: 'free-development'
};

const request = {
  schemaVersion: 'audit-job-request-v1',
  jobId,
  campaignId,
  workspaceId,
  profileId,
  tool: 'slither',
  configuration: { detectors: ['reentrancy-eth'] },
  resourceClass: 'standard-test',
  timeoutSeconds: 1800,
  expectedEvidence: ['findings.json'],
  idempotencyKey: 'boosthub-slither-first-job',
  submittedAt: '2026-08-01T06:31:00.000Z'
};

function parse(record) {
  return JSON.parse(typeof record.value === 'string' ? record.value : new TextDecoder().decode(record.value));
}

test('first campaign and first job initialize deterministic indexes from an otherwise empty control store', async () => {
  const store = new InMemoryAuditStore();
  await store.put(workspaceSourceManifestKey(workspaceId), JSON.stringify({
    schemaVersion: 'workspace-manifest-v1',
    workspaceId,
    tenantId: `ten_${'4'.repeat(32)}`,
    sourceKind: 'upload'
  }));
  await store.put(profileIndexKey(), JSON.stringify({
    schemaVersion: 'profile-index-v1',
    profiles: [profileId],
    records: { [profileId]: { revoked: false } }
  }));

  const service = new CampaignService(store, {
    now: () => new Date('2026-08-01T06:31:00.000Z')
  });

  const campaign = await service.createCampaign({ creation });
  assert.equal(campaign.current.state, 'active');
  assert.deepEqual(parse(await store.get(workspaceCampaignIndexKey(workspaceId))).campaigns, [campaignId]);

  const job = await service.submitJob({ request });
  assert.equal(job.status.state, 'awaiting_executor');
  assert.equal(job.status.executionEnabled, false);
  assert.equal(job.error.code, 'execution_plane_unavailable');
  assert.deepEqual(parse(await store.get(campaignJobIndexKey(campaignId))).jobs, [jobId]);
});
