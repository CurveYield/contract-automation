import { authorizeCampaignAccess } from '../../audit-clean-room-access/src/index.mjs';
import { canonicalJson, frozenClone, sha256, validateCleanRoomPolicy } from '../../audit-clean-room-protocol/src/index.mjs';

export const CLEAN_ROOM_CAMPAIGN_SCHEMA_VERSION = 'phase8-clean-room-campaign-v1';
export const CLEAN_ROOM_ARTIFACT_SCHEMA_VERSION = 'phase8-clean-room-artifact-v1';

function error(code, message = code) { return Object.assign(new Error(message), { code }); }
function campaignKey(campaignId) { return `clean-room/campaigns/${campaignId}/campaign-v1.json`; }
function artifactKey(campaignId, artifactId) { return `clean-room/campaigns/${campaignId}/artifacts/${artifactId}-v1.json`; }
function indexKey(campaignId) { return `clean-room/campaigns/${campaignId}/artifact-index-v1.json`; }
function parse(record) { return record ? JSON.parse(typeof record.value === 'string' ? record.value : new TextDecoder().decode(record.value)) : null; }
function condition(record) { return record ? { onlyIf: { etagMatches: record.etag } } : { onlyIf: { etagDoesNotMatch: '*' } }; }

export function createBlindedCampaign(input) {
  const policy = validateCleanRoomPolicy(input.policy);
  const record = {
    schemaVersion: CLEAN_ROOM_CAMPAIGN_SCHEMA_VERSION,
    campaignId: input.campaignId,
    tenantId: policy.tenantId,
    workspaceId: policy.workspaceId,
    workspaceSourceDigest: input.workspaceSourceDigest,
    ownerId: input.ownerId,
    state: 'active',
    createdAt: input.createdAt,
    executionEnabled: false,
    artifactCount: 0
  };
  record.campaignDigest = sha256(record);
  return frozenClone(record);
}

export function createBlindedArtifact(input) {
  const body = {
    schemaVersion: CLEAN_ROOM_ARTIFACT_SCHEMA_VERSION,
    campaignId: input.campaignId,
    artifactId: input.artifactId,
    artifactType: input.artifactType,
    sourceDigest: input.sourceDigest,
    contentDigest: input.contentDigest,
    references: [...(input.references ?? [])].sort(),
    createdAt: input.createdAt,
    blinded: true,
    executionEnabled: false
  };
  body.artifactDigest = sha256(body);
  return frozenClone(body);
}

export class CleanRoomCampaignService {
  constructor(store) {
    if (!store || typeof store.get !== 'function' || typeof store.put !== 'function') throw new TypeError('CleanRoomCampaignService requires an Audit store');
    this.store = store;
  }

  async create(input) {
    const campaign = createBlindedCampaign(input);
    await this.store.put(campaignKey(campaign.campaignId), canonicalJson(campaign), { onlyIf: { etagDoesNotMatch: '*' } });
    await this.store.put(indexKey(campaign.campaignId), canonicalJson({ schemaVersion: 'phase8-clean-room-artifact-index-v1', campaignId: campaign.campaignId, entries: [] }), { onlyIf: { etagDoesNotMatch: '*' } });
    return campaign;
  }

  async read(campaignId, accessInput) {
    const record = await this.store.get(campaignKey(campaignId));
    if (!record) throw error('campaign_not_found');
    const campaign = parse(record);
    authorizeCampaignAccess({ ...accessInput, campaignId, workspaceId: campaign.workspaceId, workspaceSourceDigest: campaign.workspaceSourceDigest, campaignState: campaign.state });
    return frozenClone(campaign);
  }

  async publishArtifact(input) {
    const campaignRecord = await this.store.get(campaignKey(input.campaignId));
    if (!campaignRecord) throw error('campaign_not_found');
    const campaign = parse(campaignRecord);
    authorizeCampaignAccess({ ...input.access, campaignId: input.campaignId, workspaceId: campaign.workspaceId, workspaceSourceDigest: campaign.workspaceSourceDigest, campaignState: campaign.state, requiredScope: 'campaign:write' });
    if (campaign.state !== 'active') throw error('campaign_not_active');
    const artifact = createBlindedArtifact(input);
    const idxRecord = await this.store.get(indexKey(input.campaignId));
    const index = parse(idxRecord) ?? { schemaVersion: 'phase8-clean-room-artifact-index-v1', campaignId: input.campaignId, entries: [] };
    if (index.entries.some((entry) => entry.artifactId === artifact.artifactId && entry.artifactDigest !== artifact.artifactDigest)) throw error('artifact_conflict');
    if (!index.entries.some((entry) => entry.artifactId === artifact.artifactId)) index.entries.push({ artifactId: artifact.artifactId, artifactDigest: artifact.artifactDigest, artifactType: artifact.artifactType, createdAt: artifact.createdAt });
    index.entries.sort((a,b)=>a.artifactId.localeCompare(b.artifactId));
    await this.store.put(artifactKey(input.campaignId, artifact.artifactId), canonicalJson(artifact), { onlyIf: { etagDoesNotMatch: '*' } });
    await this.store.put(indexKey(input.campaignId), canonicalJson(index), condition(idxRecord));
    campaign.artifactCount = index.entries.length;
    await this.store.put(campaignKey(input.campaignId), canonicalJson(campaign), { onlyIf: { etagMatches: campaignRecord.etag } });
    return artifact;
  }

  async listArtifacts(campaignId, accessInput) {
    await this.read(campaignId, { ...accessInput, requiredScope: 'campaign:read' });
    const record = await this.store.get(indexKey(campaignId));
    return frozenClone(parse(record) ?? { schemaVersion: 'phase8-clean-room-artifact-index-v1', campaignId, entries: [] });
  }
}

export const BlindCampaignService = CleanRoomCampaignService;
export * from './terminal-manifest.mjs';
