// Tier 3 Controller Adapter v6 — campaign-fresh reads + session-bound mailbox command publication
import {
  controllerCompatibilityResponseV5,
  controllerProjectionResponseV5
} from './tier3-controller-adapter-v5.mjs';
import { renderHostedControllerCommandV1 } from '../../../packages/protocol/src/tier3-controller-command-v1.mjs';

const CONTROLLER_REPOSITORY = 'CurveYield/audit-controller';
const FULL_SHA = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;
const AUTHORIZATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const EXACT_REQUEST_KEYS = new Set(['authorizationId', 'capabilityToken', 'command']);
const EXACT_AUTHORIZATION_KEYS = new Set([
  'schemaVersion', 'authorizationId', 'campaignId', 'actor', 'sessionId', 'roleId', 'phaseId',
  'mailboxIssueNumber', 'allowedCommandTypes', 'controllerProtocolSha', 'instructionProofKey',
  'tokenSha256', 'issuedAt', 'expiresAt'
]);

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}
function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}
function text(value, name, maximum = 4096) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) throw new TypeError(`${name} must be a non-empty string`);
  return value;
}
function exactKeys(value, expected, name) {
  for (const key of Object.keys(value)) if (!expected.has(key)) throw new TypeError(`${name} contains unknown field ${key}`);
  for (const key of expected) if (!Object.hasOwn(value, key)) throw new TypeError(`${name} is missing field ${key}`);
}
function configuration(env) {
  const readToken = typeof env.AUDIT_CONTROLLER_GITHUB_TOKEN === 'string' ? env.AUDIT_CONTROLLER_GITHUB_TOKEN : '';
  const writeToken = typeof env.AUDIT_CONTROLLER_GITHUB_COMMAND_TOKEN === 'string' ? env.AUDIT_CONTROLLER_GITHUB_COMMAND_TOKEN : '';
  const protocolSha = typeof env.AUDIT_CONTROLLER_PROTOCOL_SHA === 'string' ? env.AUDIT_CONTROLLER_PROTOCOL_SHA : '';
  const stateRef = typeof env.AUDIT_CONTROLLER_STATE_REF === 'string' && env.AUDIT_CONTROLLER_STATE_REF.length > 0 ? env.AUDIT_CONTROLLER_STATE_REF : 'main';
  const automationRelease = typeof env.AUTOMATION_RELEASE_SHA === 'string' ? env.AUTOMATION_RELEASE_SHA : '';
  if (!readToken || !FULL_SHA.test(protocolSha) || !FULL_SHA.test(automationRelease) || !SAFE_REF.test(stateRef) || stateRef.includes('..')) return null;
  return { readToken, writeToken, protocolSha, stateRef, automationRelease };
}
function githubHeaders(token, userAgent) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'content-type': 'application/json; charset=utf-8',
    'user-agent': userAgent,
    'x-github-api-version': '2026-03-10'
  };
}
function decodeBase64Utf8(value) {
  const binary = atob(value.replaceAll('\n', ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}
async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function constantTimeHexEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}
function validateAuthorization(value, config) {
  object(value, 'authorization');
  exactKeys(value, EXACT_AUTHORIZATION_KEYS, 'authorization');
  if (value.schemaVersion !== 'hosted-controller-session-authorization-v1') throw new TypeError('authorization schemaVersion is unsupported');
  if (!AUTHORIZATION_ID.test(String(value.authorizationId ?? ''))) throw new TypeError('authorizationId is invalid');
  text(value.campaignId, 'authorization.campaignId', 200);
  const actor = object(value.actor, 'authorization.actor');
  if (JSON.stringify(Object.keys(actor).sort()) !== JSON.stringify(['id', 'type'])) throw new TypeError('authorization.actor must contain exactly id and type');
  if (!['controller', 'worker'].includes(actor.type)) throw new TypeError('authorization.actor.type is invalid');
  for (const field of ['id']) text(actor[field], `authorization.actor.${field}`, 200);
  for (const field of ['sessionId', 'roleId', 'phaseId']) text(value[field], `authorization.${field}`, 200);
  if (!Number.isSafeInteger(value.mailboxIssueNumber) || value.mailboxIssueNumber < 1) throw new TypeError('authorization.mailboxIssueNumber is invalid');
  if (!Array.isArray(value.allowedCommandTypes) || value.allowedCommandTypes.length === 0 || value.allowedCommandTypes.some((entry) => typeof entry !== 'string' || entry.length === 0)) throw new TypeError('authorization.allowedCommandTypes is invalid');
  if (new Set(value.allowedCommandTypes).size !== value.allowedCommandTypes.length) throw new TypeError('authorization.allowedCommandTypes contains duplicates');
  if (value.controllerProtocolSha !== config.protocolSha) throw new TypeError('authorization.controllerProtocolSha does not match hosted protocol');
  const expectedProofKey = `${actor.id}|${value.sessionId}|${value.roleId}|${value.phaseId}`;
  if (value.instructionProofKey !== expectedProofKey) throw new TypeError('authorization.instructionProofKey is invalid');
  if (!SHA256.test(String(value.tokenSha256 ?? ''))) throw new TypeError('authorization.tokenSha256 is invalid');
  const issuedAt = Date.parse(value.issuedAt);
  const expiresAt = Date.parse(value.expiresAt);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt) throw new TypeError('authorization timestamps are invalid');
  return { ...value, actor: { ...actor }, allowedCommandTypes: [...value.allowedCommandTypes], issuedAtMs: issuedAt, expiresAtMs: expiresAt };
}
async function readAuthorization(authorizationId, config, fetcher) {
  const response = await fetcher(
    `https://api.github.com/repos/${CONTROLLER_REPOSITORY}/contents/hosted-authorizations/v1/${encodeURIComponent(authorizationId)}.json?ref=${encodeURIComponent(config.stateRef)}`,
    { method: 'GET', headers: githubHeaders(config.readToken, 'CurveYield-Tier3-Controller-Adapter-v6-read') }
  );
  if (response.status === 404) return { kind: 'not_found' };
  if (!response.ok) throw new Error('authorization read failed');
  const payload = await response.json();
  if (payload?.encoding !== 'base64' || typeof payload?.content !== 'string') throw new Error('authorization envelope invalid');
  const parsed = JSON.parse(decodeBase64Utf8(payload.content));
  return { kind: 'ok', authorization: validateAuthorization(parsed, config) };
}

export async function controllerCompatibilityResponseV6(env) {
  const baseResponse = await controllerCompatibilityResponseV5(env);
  if (!baseResponse.ok) return baseResponse;
  const base = await baseResponse.json();
  const config = configuration(env);
  return json({
    ...base,
    adapterImplementation: 'tier3-controller-adapter-v6',
    mutationMode: config?.writeToken ? 'session-capability-mailbox-v1' : 'disabled-command-credential-missing',
    commandAuthorization: 'controller-issued-session-capability-v1'
  });
}

export const controllerProjectionResponseV6 = controllerProjectionResponseV5;

export async function controllerCommandResponseV6(campaignId, requestBody, env, fetcher = fetch, now = new Date().toISOString()) {
  const config = configuration(env);
  if (!config || !config.writeToken) {
    return json({ error: { code: 'controller_command_not_configured', message: 'Tier 3 controller command publication is not configured' } }, 503);
  }
  try {
    object(requestBody, 'request');
    exactKeys(requestBody, EXACT_REQUEST_KEYS, 'request');
  } catch {
    return json({ error: { code: 'invalid_controller_command_request', message: 'Controller command request is invalid' } }, 400);
  }
  const authorizationId = String(requestBody.authorizationId ?? '');
  const capabilityToken = String(requestBody.capabilityToken ?? '');
  if (!AUTHORIZATION_ID.test(authorizationId) || capabilityToken.length < 1 || capabilityToken.length > 4096) {
    return json({ error: { code: 'invalid_controller_command_request', message: 'Controller command request is invalid' } }, 400);
  }

  let authorizationResult;
  try { authorizationResult = await readAuthorization(authorizationId, config, fetcher); }
  catch { return json({ error: { code: 'controller_authorization_read_failed', message: 'Controller authorization could not be read' } }, 502); }
  if (authorizationResult.kind === 'not_found') return json({ error: { code: 'controller_authorization_not_found', message: 'Controller authorization was not found' } }, 404);
  const authorization = authorizationResult.authorization;
  if (authorization.authorizationId !== authorizationId) return json({ error: { code: 'controller_authorization_invalid', message: 'Controller authorization failed validation' } }, 409);
  if (authorization.campaignId !== campaignId) return json({ error: { code: 'controller_authorization_campaign_mismatch', message: 'Controller authorization does not match the campaign' } }, 403);

  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) return json({ error: { code: 'invalid_controller_command_request', message: 'Controller command request is invalid' } }, 400);
  if (nowMs < authorization.issuedAtMs) return json({ error: { code: 'controller_authorization_not_active', message: 'Controller authorization is not active yet' } }, 403);
  if (nowMs >= authorization.expiresAtMs) return json({ error: { code: 'controller_authorization_expired', message: 'Controller authorization has expired' } }, 403);
  let suppliedHash;
  try { suppliedHash = await sha256Hex(capabilityToken); }
  catch { return json({ error: { code: 'controller_capability_invalid', message: 'Controller capability token is invalid' } }, 403); }
  if (!constantTimeHexEqual(suppliedHash, authorization.tokenSha256)) {
    return json({ error: { code: 'controller_capability_invalid', message: 'Controller capability token is invalid' } }, 403);
  }

  let rendered;
  try { rendered = renderHostedControllerCommandV1(requestBody.command, authorization); }
  catch { return json({ error: { code: 'controller_command_invalid', message: 'Controller command failed hosted validation' } }, 400); }

  let response;
  try {
    response = await fetcher(
      `https://api.github.com/repos/${CONTROLLER_REPOSITORY}/issues/${authorization.mailboxIssueNumber}/comments`,
      {
        method: 'POST',
        headers: githubHeaders(config.writeToken, 'CurveYield-Tier3-Controller-Adapter-v6-write'),
        body: JSON.stringify({ body: rendered })
      }
    );
  } catch {
    return json({ error: { code: 'controller_command_publish_failed', message: 'Controller command could not be submitted' } }, 502);
  }
  if (!response.ok) return json({ error: { code: 'controller_command_publish_failed', message: 'Controller command could not be submitted' } }, 502);
  let payload;
  try { payload = await response.json(); }
  catch { return json({ error: { code: 'controller_command_publish_failed', message: 'Controller command could not be submitted' } }, 502); }
  if (!Number.isSafeInteger(payload?.id) || payload.id < 1) return json({ error: { code: 'controller_command_publish_failed', message: 'Controller command could not be submitted' } }, 502);
  return json({
    status: 'SUBMITTED_TO_CONTROLLER_MAILBOX',
    authorizationId,
    commandId: requestBody.command.commandId,
    githubCommentId: payload.id
  }, 202);
}
