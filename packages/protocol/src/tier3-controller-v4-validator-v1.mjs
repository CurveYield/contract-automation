import { normalizeControllerProjectionV3 } from './tier3-controller-v3-validator-v2.mjs';

export const TIER3_CONTROLLER_ADAPTER_VERSION_V4 = 'tier3-controller-adapter-v4';
export const TIER3_HOSTED_PROJECTION_VERSION_V2 = 'hosted-tier3-projection-v2';

const FULL_SHA = /^[0-9a-f]{40}$/;
const CAMPAIGN_PATH = /^campaigns\/[A-Za-z0-9][A-Za-z0-9._() -]{0,239}$/;

function validateCampaignSource(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('campaignSource must be an object');
  if (typeof value.path !== 'string' || !CAMPAIGN_PATH.test(value.path) || value.path.includes('..') || value.path.startsWith('/')) {
    throw new TypeError('campaignSource.path must be one exact top-level campaigns/<name> directory without traversal');
  }
  if (!FULL_SHA.test(String(value.commit ?? ''))) throw new TypeError('campaignSource.commit must be an exact lowercase 40-character git SHA');
  return { path: value.path, commit: value.commit };
}

export function normalizeControllerProjectionV4(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('projection must be an object');
  if (value.projectionVersion !== TIER3_HOSTED_PROJECTION_VERSION_V2) throw new TypeError('projectionVersion is not supported');
  if (value.adapterVersion !== TIER3_CONTROLLER_ADAPTER_VERSION_V4) throw new TypeError('adapterVersion is not supported');
  const campaignSource = validateCampaignSource(value.campaignSource);
  const normalized = normalizeControllerProjectionV3({ ...value, adapterVersion: 'tier3-controller-adapter-v3' });
  return {
    ...normalized,
    projectionVersion: TIER3_HOSTED_PROJECTION_VERSION_V2,
    adapterVersion: TIER3_CONTROLLER_ADAPTER_VERSION_V4,
    campaignSource
  };
}
