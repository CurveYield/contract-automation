import {
  TIER3_ACTIVE_NETWORKS_V2,
  TIER3_CONTROLLER_ADAPTER_VERSION_V2,
  TIER3_CONTROLLER_RELEASE_V2,
  TIER3_DEFAULT_NETWORK_V2,
  normalizeControllerProjectionV2
} from '../../../packages/protocol/src/tier3-controller-v2.mjs';

const CONTROLLER_REPOSITORY = 'CurveYield/audit-controller';
const CAMPAIGN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/;
const FULL_SHA = /^[0-9a-f]{40}$/;
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;

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

function githubHeaders(token) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'user-agent': 'CurveYield-Tier3-Controller-Adapter-v2',
    'x-github-api-version': '2026-03-10'
  };
}

function decodeBase64Utf8(value) {
  const binary = atob(value.replaceAll('\n', ''));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function resolveStateCommit(config, fetcher) {
  const url = `https://api.github.com/repos/${CONTROLLER_REPOSITORY}/commits/${encodeURIComponent(config.stateRef)}`;
  const response = await fetcher(url, { method: 'GET', headers: githubHeaders(config.token) });
  if (!response.ok) throw new Error('state ref resolution failed');
  const payload = await response.json();
  if (!FULL_SHA.test(String(payload?.sha ?? ''))) throw new Error('state ref did not resolve to an exact commit');
  return payload.sha;
}

export async function controllerCompatibilityResponseV2(env) {
  const config = configuration(env);
  if (!config) {
    return json({ error: { code: 'controller_not_configured', message: 'Tier 3 controller adapter v2 is not fully configured' } }, 503);
  }
  return json({
    adapterVersion: TIER3_CONTROLLER_ADAPTER_VERSION_V2,
    controllerRepository: CONTROLLER_REPOSITORY,
    controllerRelease: TIER3_CONTROLLER_RELEASE_V2,
    controllerProtocolSha: config.protocolSha,
    controllerStateRef: config.stateRef,
    automationRelease: config.automationRelease,
    networkScope: { active: [...TIER3_ACTIVE_NETWORKS_V2], default: TIER3_DEFAULT_NETWORK_V2 },
    authority: 'github-audit-controller',
    mutationMode: 'disabled-read-only-v2'
  });
}

export async function controllerProjectionResponseV2(campaignId, env, fetcher = fetch) {
  if (!CAMPAIGN_ID.test(String(campaignId ?? ''))) {
    return json({ error: { code: 'invalid_campaign_id', message: 'Campaign ID is invalid' } }, 400);
  }
  const config = configuration(env);
  if (!config) {
    return json({ error: { code: 'controller_not_configured', message: 'Tier 3 controller adapter v2 is not fully configured' } }, 503);
  }

  let stateCommit;
  try {
    stateCommit = await resolveStateCommit(config, fetcher);
  } catch {
    return json({ error: { code: 'controller_upstream_failed', message: 'Controller state could not be resolved' } }, 502);
  }

  const path = `hosted-projections/v2/${campaignId}.json`;
  const url = `https://api.github.com/repos/${CONTROLLER_REPOSITORY}/contents/${path}?ref=${stateCommit}`;
  let response;
  try {
    response = await fetcher(url, { method: 'GET', headers: githubHeaders(config.token) });
  } catch {
    return json({ error: { code: 'controller_upstream_failed', message: 'Controller projection could not be read' } }, 502);
  }
  if (response.status === 404) {
    return json({ error: { code: 'controller_projection_not_found', message: 'Published controller projection was not found' } }, 404);
  }
  if (!response.ok) {
    return json({ error: { code: 'controller_upstream_failed', message: 'Controller projection could not be read' } }, 502);
  }

  try {
    const payload = await response.json();
    if (payload?.encoding !== 'base64' || typeof payload?.content !== 'string') throw new Error('invalid content envelope');
    const projection = normalizeControllerProjectionV2(JSON.parse(decodeBase64Utf8(payload.content)));
    if (projection.campaign.id !== campaignId) throw new Error('campaign identity mismatch');
    if (projection.controllerProtocolSha !== config.protocolSha || projection.automationRelease !== config.automationRelease) {
      return json({ error: { code: 'controller_projection_incompatible', message: 'Controller projection release binding does not match the hosted application' } }, 409);
    }
    return json({ controllerStateCommit: stateCommit, projection });
  } catch {
    return json({ error: { code: 'controller_projection_invalid', message: 'Published controller projection failed validation' } }, 409);
  }
}
