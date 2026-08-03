import { authorizeCampaignAccess } from '../../audit-clean-room-access/src/index.mjs';
import { canonicalJson, frozenClone, sha256, validateCleanRoomPolicy } from '../../audit-clean-room-protocol/src/index.mjs';

export const CONTROLLED_MERGE_SCHEMA_VERSION = 'phase8-controlled-merge-v1';
function error(code, message = code) { return Object.assign(new Error(message), { code }); }

export function createControlledMerge(input) {
  const policy = validateCleanRoomPolicy(input.policy);
  if (!Array.isArray(input.campaigns) || input.campaigns.length < 2 || input.campaigns.length > policy.maxMergeInputs) throw error('invalid_merge_inputs');
  const campaigns = [...input.campaigns].map((item) => structuredClone(item)).sort((a,b)=>a.campaignId.localeCompare(b.campaignId));
  const sourceDigests = new Set(campaigns.map((item)=>item.workspaceSourceDigest));
  if (sourceDigests.size !== 1) throw error('source_digest_mismatch');
  if (campaigns.some((item)=>item.tenantId!==policy.tenantId||item.workspaceId!==policy.workspaceId)) throw error('clean_room_identity_mismatch');
  for (const campaign of campaigns) {
    authorizeCampaignAccess({ ...input.accessByCampaign[campaign.campaignId], campaignId: campaign.campaignId, workspaceId: campaign.workspaceId, workspaceSourceDigest: campaign.workspaceSourceDigest, campaignState: campaign.state, requiredScope: 'campaign:merge' });
  }
  const artifacts = new Map();
  for (const inputArtifacts of Object.values(input.artifactsByCampaign ?? {})) {
    for (const artifact of inputArtifacts) {
      const previous = artifacts.get(artifact.artifactId);
      if (previous && previous.artifactDigest !== artifact.artifactDigest) throw error('merge_identity_conflict');
      artifacts.set(artifact.artifactId, structuredClone(artifact));
    }
  }
  if (artifacts.size > policy.maxEvidence + policy.maxFindings) throw error('merge_limit_exceeded');
  const body = {
    schemaVersion: CONTROLLED_MERGE_SCHEMA_VERSION,
    mergeId: input.mergeId,
    tenantId: policy.tenantId,
    workspaceId: policy.workspaceId,
    workspaceSourceDigest: campaigns[0].workspaceSourceDigest,
    policyId: policy.policyId,
    sourceCampaignIds: campaigns.map((item)=>item.campaignId),
    artifacts: [...artifacts.values()].sort((a,b)=>a.artifactId.localeCompare(b.artifactId)),
    createdAt: input.createdAt,
    executionEnabled: false
  };
  body.mergeDigest = sha256(body);
  return frozenClone(body);
}

export function validateControlledMerge(value) {
  if (!value || value.schemaVersion !== CONTROLLED_MERGE_SCHEMA_VERSION || value.executionEnabled !== false) throw error('invalid_merge');
  const digest = value.mergeDigest;
  const body = structuredClone(value); delete body.mergeDigest;
  if (digest !== sha256(body)) throw error('merge_digest_mismatch');
  if (canonicalJson(value.artifacts) !== canonicalJson([...value.artifacts].sort((a,b)=>a.artifactId.localeCompare(b.artifactId)))) throw error('noncanonical_merge');
  return frozenClone(value);
}

export class ControlledMergeService {
  constructor(store) { if (!store || typeof store.put !== 'function' || typeof store.get !== 'function') throw new TypeError('ControlledMergeService requires an Audit store'); this.store=store; }
  key(mergeId){ return `clean-room/merges/${mergeId}-v1.json`; }
  async publish(input){ const merge=createControlledMerge(input); await this.store.put(this.key(merge.mergeId),canonicalJson(merge),{onlyIf:{etagDoesNotMatch:'*'}}); return merge; }
  async read(mergeId){ const record=await this.store.get(this.key(mergeId)); if(!record)throw error('merge_not_found'); return validateControlledMerge(JSON.parse(typeof record.value==='string'?record.value:new TextDecoder().decode(record.value))); }
}
