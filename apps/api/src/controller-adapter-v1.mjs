import { TIER3_CONTROLLER_ADAPTER_VERSION_V1 } from '../../../packages/protocol/src/tier3-controller-v1.mjs';

const CONTROLLER_REPOSITORY = 'CurveYield/audit-controller';
const CONTROLLER_OWNER = 'CurveYield';
const CONTROLLER_NAME = 'audit-controller';
const CONTROLLER_REF = 'main';
const CONTROLLER_COMPATIBILITY_COMMIT = '853b77b92018f4e42068cef6def56f9902a02f27';
const CONTROLLER_PROCESS_ID = 'deep-assurance-v6';
const CONTROLLER_INSTRUCTION_RELEASE = 'ai-auditor-deep-assurance-v6@16.13.0';
const AUTOMATION_REPOSITORY = 'CurveYield/contract-automation';
const AUTOMATION_COMPATIBILITY_COMMIT = '0edb1751be297deaad610a6a73a5b3a4fcc84be5';
const MAX_GITHUB_ENVELOPE_BYTES = 256 * 1024;
const PROJECT_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const SAFE_BRANCH = /^[A-Za-z0-9._/-]{1,200}$/;
const SAFE_MANIFEST_PATH = /^\.deep-assurance\/manifests\/[A-Za-z0-9._/-]{1,300}$/;
const FULL_SHA = /^[0-9a-f]{40}$/;

function json(value, env, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': env.CORS_ORIGIN || '*',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'GET, OPTIONS',
    },
  });
}

function error(env, code, message, status) {
  return json({ error: { code, message } }, env, status);
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function secureEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || right.length === 0) return false;
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  let difference = a.byteLength ^ b.byteLength;
  const length = Math.max(a.byteLength, b.byteLength);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index % a.byteLength] ?? 0) ^ (b[index % b.byteLength] ?? 0);
  }
  return difference === 0;
}

function bearer(request) {
  const authorization = request.headers.get('authorization') ?? '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

async function browserAuthorized(request, env) {
  if (typeof env.CLIENT_API_KEY !== 'string' || env.CLIENT_API_KEY.length === 0) return false;
  return secureEqual(bearer(request), env.CLIENT_API_KEY);
}

function compatibility() {
  return {
    adapterVersion: TIER3_CONTROLLER_ADAPTER_VERSION_V1,
    controller: {
      repository: CONTROLLER_REPOSITORY,
      ref: CONTROLLER_REF,
      compatibilityCommit: CONTROLLER_COMPATIBILITY_COMMIT,
      processId: CONTROLLER_PROCESS_ID,
      instructionReleaseIdentity: CONTROLLER_INSTRUCTION_RELEASE,
    },
    automation: {
      repository: AUTOMATION_REPOSITORY,
      compatibilityCommit: AUTOMATION_COMPATIBILITY_COMMIT,
    },
    networkScope: {
      chains: ['ethereum', 'base'],
      defaultChain: 'base',
    },
  };
}

export function controllerSetupReadinessV1(env) {
  const features = {
    browserApiAuth: typeof env.CLIENT_API_KEY === 'string' && env.CLIENT_API_KEY.length > 0,
    auditControllerGithub: typeof env.AUDIT_CONTROLLER_GITHUB_TOKEN === 'string'
      && env.AUDIT_CONTROLLER_GITHUB_TOKEN.length > 0,
  };
  return {
    status: Object.values(features).every(Boolean) ? 'ready' : 'configuration_required',
    features,
    controller: compatibility().controller,
  };
}

function requireSha(value, field) {
  if (typeof value !== 'string' || !FULL_SHA.test(value)) throw new TypeError(`${field} must be a full lowercase git SHA`);
  return value;
}

function requireString(value, field, maximum = 300) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    throw new TypeError(`${field} must be a bounded non-empty string`);
  }
  return value;
}

function requirePositiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${field} must be a positive safe integer`);
  return value;
}

function safeBranch(value) {
  requireString(value, 'authoritativeControllerBranch', 200);
  if (!SAFE_BRANCH.test(value) || value.includes('..') || value.startsWith('/') || value.endsWith('/')) {
    throw new TypeError('authoritativeControllerBranch is unsafe');
  }
  return value;
}

function safeManifestPath(value) {
  requireString(value, 'immutableLaunchManifestPath', 320);
  if (!SAFE_MANIFEST_PATH.test(value) || value.includes('..') || value.includes('//')) {
    throw new TypeError('immutableLaunchManifestPath is unsafe');
  }
  return value;
}

function normalizePointer(pointer, expectedProjectSlug) {
  if (!pointer || typeof pointer !== 'object' || Array.isArray(pointer)) {
    throw new TypeError('active pointer must be an object');
  }
  if (pointer.projectSlug !== expectedProjectSlug) throw new TypeError('active pointer projectSlug mismatch');

  if (pointer.schemaVersion === 'deep-assurance-active-pointer-tombstone-v1') {
    if (pointer.status !== 'NO_ACTIVE_CAMPAIGN') throw new TypeError('tombstone status is invalid');
    if (pointer.launchAuthorized !== false || pointer.allPriorGenerationsAdmissible !== false) {
      throw new TypeError('tombstone authorization fields are invalid');
    }
    return {
      project: {
        projectSlug: expectedProjectSlug,
        status: 'NO_ACTIVE_CAMPAIGN',
        reason: requireString(pointer.reason, 'reason', 160),
        launchAuthorized: false,
        allPriorGenerationsAdmissible: false,
        scrubCommit: requireSha(pointer.scrubCommit, 'scrubCommit'),
      },
      campaign: null,
    };
  }

  if (pointer.schemaVersion === 'deep-assurance-active-pointer-v2') {
    if (pointer.authoritativeControllerRepository !== CONTROLLER_REPOSITORY) {
      throw new TypeError('active pointer controller repository mismatch');
    }
    const authoritativeControllerCommit = requireSha(
      pointer.authoritativeControllerCommit,
      'authoritativeControllerCommit',
    );
    const immutableLaunchManifestCommit = requireSha(
      pointer.immutableLaunchManifestCommit,
      'immutableLaunchManifestCommit',
    );
    if (authoritativeControllerCommit !== immutableLaunchManifestCommit) {
      throw new TypeError('active pointer manifest commit must equal authoritative controller commit');
    }
    if (!pointer.source || typeof pointer.source !== 'object' || Array.isArray(pointer.source)) {
      throw new TypeError('active pointer source is required');
    }
    return {
      project: {
        projectSlug: expectedProjectSlug,
        status: 'ACTIVE',
        activeCampaignId: requireString(pointer.activeCampaignId, 'activeCampaignId', 200),
        campaignIssueNumber: requirePositiveInteger(pointer.campaignIssueNumber, 'campaignIssueNumber'),
        authoritativeControllerBranch: safeBranch(pointer.authoritativeControllerBranch),
        authoritativeControllerCommit,
        immutableLaunchManifestPath: safeManifestPath(pointer.immutableLaunchManifestPath),
        immutableLaunchManifestCommit,
        source: {
          repository: requireString(pointer.source.repository, 'source.repository', 200),
          commit: requireSha(pointer.source.commit, 'source.commit'),
        },
      },
      campaign: null,
    };
  }

  throw new TypeError('active pointer schema is unsupported');
}

function decodeBase64Utf8(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_GITHUB_ENVELOPE_BYTES * 2) {
    throw new TypeError('GitHub content field is invalid');
  }
  const binary = atob(value.replace(/\s+/g, ''));
  if (binary.length > MAX_GITHUB_ENVELOPE_BYTES) throw new TypeError('GitHub content is too large');
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function readActivePointer(projectSlug, env) {
  const fetcher = typeof env.AUDIT_CONTROLLER_FETCH === 'function'
    ? env.AUDIT_CONTROLLER_FETCH
    : globalThis.fetch;
  if (typeof fetcher !== 'function') throw new TypeError('fetch is unavailable');

  const path = `.deep-assurance/active/${projectSlug}.json`;
  const url = `https://api.github.com/repos/${CONTROLLER_OWNER}/${CONTROLLER_NAME}/contents/${path}?ref=${CONTROLLER_REF}`;
  const response = await fetcher(url, {
    method: 'GET',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${env.AUDIT_CONTROLLER_GITHUB_TOKEN}`,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'CurveYield-Preflight-Tier3-Controller-Adapter-v1',
    },
  });

  if (response.status === 404) return { kind: 'not_found' };
  if (!response.ok) return { kind: 'upstream_error' };

  let envelope;
  try {
    envelope = await response.json();
  } catch {
    return { kind: 'upstream_error' };
  }
  try {
    if (envelope?.encoding !== 'base64') throw new TypeError('unsupported GitHub content encoding');
    const text = decodeBase64Utf8(envelope.content);
    return { kind: 'ok', value: JSON.parse(text) };
  } catch {
    return { kind: 'invalid_content' };
  }
}

function extractProjectSlug(pathname) {
  const prefix = '/api/v1/controller/projects/';
  if (!pathname.startsWith(prefix)) return null;
  const encoded = pathname.slice(prefix.length);
  if (!encoded || encoded.includes('/')) return '';
  try {
    return decodeURIComponent(encoded);
  } catch {
    return '';
  }
}

export async function handleControllerRouteV1(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/v1/controller/')) return null;

  if (request.method === 'OPTIONS') {
    return json({ ok: true }, env);
  }

  if (!await browserAuthorized(request, env)) {
    return error(env, 'unauthorized', 'Valid browser client authentication is required', 401);
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/controller/compatibility') {
    return json({
      status: controllerSetupReadinessV1(env).status,
      ...compatibility(),
    }, env);
  }

  if (request.method === 'GET') {
    const projectSlug = extractProjectSlug(url.pathname);
    if (projectSlug !== null) {
      if (!PROJECT_SLUG.test(projectSlug)) {
        return error(env, 'invalid_project_slug', 'The controller project slug is invalid', 400);
      }
      if (typeof env.AUDIT_CONTROLLER_GITHUB_TOKEN !== 'string' || env.AUDIT_CONTROLLER_GITHUB_TOKEN.length === 0) {
        return error(
          env,
          'controller_configuration_required',
          'The audit controller GitHub connection is not configured',
          503,
        );
      }

      const result = await readActivePointer(projectSlug, env);
      if (result.kind === 'not_found') {
        return error(env, 'controller_project_not_found', 'No audit controller project pointer exists', 404);
      }
      if (result.kind !== 'ok') {
        return error(
          env,
          'controller_upstream_unavailable',
          'The audit controller could not be read safely',
          502,
        );
      }
      try {
        return json({
          ...compatibility(),
          ...normalizePointer(result.value, projectSlug),
        }, env);
      } catch {
        return error(
          env,
          'controller_pointer_incompatible',
          'The audit controller pointer is incompatible with this browser release',
          409,
        );
      }
    }
  }

  return error(env, 'not_found', 'Controller route not found', 404);
}
