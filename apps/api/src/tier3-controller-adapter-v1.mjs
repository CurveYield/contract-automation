import {
  TIER3_ACTIVE_NETWORKS_V1,
  TIER3_CONTROLLER_ADAPTER_VERSION_V1,
  TIER3_CONTROLLER_RELEASE_V1,
  TIER3_DEFAULT_NETWORK_V1,
  normalizeControllerProjectionV1
} from '../../../packages/protocol/src/tier3-controller-v1.mjs';

const CONTROLLER_REPOSITORY = 'CurveYield/audit-controller';
const CAMPAIGN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/;
const FULL_SHA = /^[0-9a-f]{40}$/;

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function configuration(env) {
  const token = typeof env.AUDIT_CONTROLLER_GITHUB_TOKEN === 'string' ? env.AUDIT_CONTROLLER_GITHUB_TOKEN : '';
  const ref = typeof env.AUDIT_CONTROLLER_REF === 'string' ? env.AUDIT_CONTROLLER_REF : '';
  const automationRelease = typeof env.AUTOMATION_RELEASE_SHA === 'string' ? env.AUTOMATION_RELEASE_SHA : '';
  if (!token || !FULL_SHA.test(ref) || !FULL_SHA.test(automationRelease)) return null;
  return { token, ref, automationRelease };
}

function decodeBase64Utf8(value) {
  const binary = atob(value.replaceAll('\n', ''));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export async function controllerCompatibilityResponseV1(env) {
  const config = configuration(env);
  if (!config) {
    return json({ error: { code: 'controller_not_configured', message: 'Tier 3 controller adapter is not fully configured' } }, 503);
  }
  return json({
    adapterVersion: TIER3_CONTROLLER_ADAPTER_VERSION_V1,
    controllerRepository: CONTROLLER_REPOSITORY,
    controllerRef: config.ref,
    controllerRelease: TIER3_CONTROLLER_RELEASE_V1,
    automationRelease: config.automationRelease,
    networkScope: { active: [...TIER3_ACTIVE_NETWORKS_V1], default: TIER3_DEFAULT_NETWORK_V1 },
    authority: 'github-audit-controller',
    mutationMode: 'disabled-read-only-v1'
  });
}

export async function controllerProjectionResponseV1(campaignId, env, fetcher = fetch) {
  if (!CAMPAIGN_ID.test(String(campaignId ?? ''))) {
    return json({ error: { code: 'invalid_campaign_id', message: 'Campaign ID is invalid' } }, 400);
  }
  const config = configuration(env);
  if (!config) {
    return json({ error: { code: 'controller_not_configured', message: 'Tier 3 controller adapter is not fully configured' } }, 503);
  }
  const path = `hosted-projections/v1/${campaignId}.json`;
  const url = `https://api.github.com/repos/CurveYield/audit-controller/contents/${path}?ref=${config.ref}`;
  let response;
  try {
    response = await fetcher(url, {
      method: 'GET',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${config.token}`,
        'user-agent': 'CurveYield-Tier3-Controller-Adapter-v1',
        'x-github-api-version': '2026-03-10'
      }
    });
  } catch {
    return json({ error: { code: 'controller_upstream_failed', message: 'Controller state could not be read' } }, 502);
  }
  if (response.status === 404) {
    return json({ error: { code: 'controller_projection_not_found', message: 'Published controller projection was not found' } }, 404);
  }
  if (!response.ok) {
    return json({ error: { code: 'controller_upstream_failed', message: 'Controller state could not be read' } }, 502);
  }
  try {
    const payload = await response.json();
    if (payload?.encoding !== 'base64' || typeof payload?.content !== 'string') throw new Error('invalid content envelope');
    const projection = normalizeControllerProjectionV1(JSON.parse(decodeBase64Utf8(payload.content)));
    if (projection.campaign.id !== campaignId) throw new Error('campaign identity mismatch');
    if (projection.automationRelease !== config.automationRelease) throw new Error('automation release mismatch');
    return json(projection);
  } catch {
    return json({ error: { code: 'controller_projection_invalid', message: 'Published controller projection failed compatibility validation' } }, 409);
  }
}
