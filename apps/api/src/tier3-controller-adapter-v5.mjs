import {
  TIER3_CONTROLLER_ADAPTER_VERSION_V4,
  normalizeControllerProjectionV4
} from '../../../packages/protocol/src/tier3-controller-v4-validator-v1.mjs';

const CONTROLLER_REPOSITORY = 'CurveYield/audit-controller';
const CONTROLLER_RELEASE = 'ai-auditor-deep-assurance-v6@16.13.0';
const CAMPAIGN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/;
const FULL_SHA = /^[0-9a-f]{40}$/;
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;
const ACTIVE_NETWORKS = Object.freeze(['ethereum', 'base']);

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function configuration(env) {
  const token = typeof env.AUDIT_CONTROLLER_GITHUB_TOKEN === 'string' ? env.AUDIT_CONTROLLER_GITHUB_TOKEN : '';
  const protocolSha = typeof env.AUDIT_CONTROLLER_PROTOCOL_SHA === 'string' ? env.AUDIT_CONTROLLER_PROTOCOL_SHA : '';
  const stateRef = typeof env.AUDIT_CONTROLLER_STATE_REF === 'string' && env.AUDIT_CONTROLLER_STATE_REF.length > 0
    ? env.AUDIT_CONTROLLER_STATE_REF
    : 'main';
  const automationRelease = typeof env.AUTOMATION_RELEASE_SHA === 'string' ? env.AUTOMATION_RELEASE_SHA : '';
  if (!token || !FULL_SHA.test(protocolSha) || !FULL_SHA.test(automationRelease) || !SAFE_REF.test(stateRef) || stateRef.includes('..')) return null;
  return { token, protocolSha, stateRef, automationRelease };
}

function headers(token) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'user-agent': 'CurveYield-Tier3-Controller-Adapter-v5',
    'x-github-api-version': '2026-03-10'
  };
}

function decodeBase64Utf8(value) {
  const binary = atob(value.replaceAll('\n', ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

async function latestCampaignCommit(config, campaignPath, fetcher) {
  const url = `https://api.github.com/repos/${CONTROLLER_REPOSITORY}/commits?sha=${encodeURIComponent(config.stateRef)}&path=${encodeURIComponent(campaignPath)}&per_page=1`;
  const response = await fetcher(url, { method: 'GET', headers: headers(config.token) });
  if (!response.ok) throw new Error('campaign freshness lookup failed');
  const payload = await response.json();
  const sha = Array.isArray(payload) ? payload[0]?.sha : null;
  if (!FULL_SHA.test(String(sha ?? ''))) throw new Error('campaign freshness lookup was empty or malformed');
  return sha;
}

export async function controllerCompatibilityResponseV5(env) {
  const config = configuration(env);
  if (!config) {
    return json({ error: { code: 'controller_not_configured', message: 'Tier 3 controller adapter v5 is not fully configured' } }, 503);
  }
  return json({
    adapterVersion: TIER3_CONTROLLER_ADAPTER_VERSION_V4,
    adapterImplementation: 'tier3-controller-adapter-v5',
    controllerRepository: CONTROLLER_REPOSITORY,
    controllerRelease: CONTROLLER_RELEASE,
    controllerProtocolSha: config.protocolSha,
    controllerStateRef: config.stateRef,
    automationRelease: config.automationRelease,
    networkScope: { active: [...ACTIVE_NETWORKS], default: 'base' },
    authority: 'github-audit-controller',
    freshnessMode: 'campaign-path-latest-commit-v1',
    mutationMode: 'disabled-until-session-bound-actor-auth-v5'
  });
}

export async function controllerProjectionResponseV5(campaignId, env, fetcher = fetch) {
  if (!CAMPAIGN_ID.test(String(campaignId ?? ''))) {
    return json({ error: { code: 'invalid_campaign_id', message: 'Campaign ID is invalid' } }, 400);
  }
  const config = configuration(env);
  if (!config) {
    return json({ error: { code: 'controller_not_configured', message: 'Tier 3 controller adapter v5 is not fully configured' } }, 503);
  }

  let response;
  try {
    response = await fetcher(
      `https://api.github.com/repos/${CONTROLLER_REPOSITORY}/contents/hosted-projections/v4/${campaignId}.json?ref=${encodeURIComponent(config.stateRef)}`,
      { method: 'GET', headers: headers(config.token) }
    );
  } catch {
    return json({ error: { code: 'controller_upstream_failed', message: 'Controller projection could not be read' } }, 502);
  }
  if (response.status === 404) {
    return json({ error: { code: 'controller_projection_not_found', message: 'Published controller projection was not found' } }, 404);
  }
  if (!response.ok) {
    return json({ error: { code: 'controller_upstream_failed', message: 'Controller projection could not be read' } }, 502);
  }

  let projection;
  try {
    const payload = await response.json();
    if (payload?.encoding !== 'base64' || typeof payload?.content !== 'string') throw new Error('invalid content envelope');
    projection = normalizeControllerProjectionV4(JSON.parse(decodeBase64Utf8(payload.content)));
    if (projection.campaign.id !== campaignId) throw new Error('campaign identity mismatch');
    if (projection.controllerProtocolSha !== config.protocolSha || projection.automationRelease !== config.automationRelease) {
      return json({ error: { code: 'controller_projection_incompatible', message: 'Controller projection release binding does not match the hosted application' } }, 409);
    }
  } catch {
    return json({ error: { code: 'controller_projection_invalid', message: 'Published controller projection failed validation' } }, 409);
  }

  let currentCampaignCommit;
  try {
    currentCampaignCommit = await latestCampaignCommit(config, projection.campaignSource.path, fetcher);
  } catch {
    return json({ error: { code: 'controller_upstream_failed', message: 'Controller campaign freshness could not be resolved' } }, 502);
  }
  if (currentCampaignCommit !== projection.campaignSource.commit) {
    return json({ error: { code: 'controller_projection_stale', message: 'Published controller projection is stale for the campaign' } }, 409);
  }

  return json({ controllerCampaignCommit: currentCampaignCommit, projection });
}
