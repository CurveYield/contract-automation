const CONTROLLER_OWNER = 'CurveYield';
const CONTROLLER_NAME = 'audit-controller';
const CONTROLLER_REF = 'main';
const CONTROLLER_COMPATIBILITY_COMMIT = 'd4851886ece3e8793dcc2a99f97f6d34da10e1cd';
const CONTROLLER_INSTRUCTION_RELEASE = 'ai-auditor-deep-assurance-v6@16.13.0';
const REQUIRED_INTAKE_ISSUE = 64;
const MAX_POINTER_BYTES = 128 * 1024;
const MAX_COMMAND_BYTES = 64 * 1024;
const PROJECT_SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const FULL_SHA = /^[0-9a-f]{40}$/;
const BEGIN_MARKER = '<!-- CURVEYIELD_AUDIT_COMMAND_V1_BEGIN -->';
const END_MARKER = '<!-- CURVEYIELD_AUDIT_COMMAND_V1_END -->';
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const ALLOWED_COMMAND_TYPES = new Set([
  'campaign.create',
  'instruction_read_proof.record',
  'campaign.activate',
  'gate.define',
  'gate.record',
  'worker.register',
  'assignment.publish',
  'assignment.claim',
  'assignment.submit',
  'assignment.expire',
  'assignment.supersede',
  'assignment.controller_submit',
  'review.accept',
  'review.reject',
  'review.return_for_rework',
  'publication.record',
  'user_delivery.record',
  'campaign.evaluate',
  'campaign.revise_source',
]);

function json(value, env, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': env.CORS_ORIGIN || '*',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
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

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalize(value, path = '$') {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`non-finite number at ${path}`);
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map((entry, index) => canonicalize(entry, `${path}[${index}]`));
  if (!isPlainObject(value)) throw new TypeError(`non-plain object at ${path}`);
  const output = Object.create(null);
  for (const key of Object.keys(value).sort()) {
    if (FORBIDDEN_KEYS.has(key)) throw new TypeError(`forbidden key at ${path}.${key}`);
    const entry = value[key];
    if (entry === undefined || typeof entry === 'function' || typeof entry === 'symbol' || typeof entry === 'bigint') {
      throw new TypeError(`unsupported value at ${path}.${key}`);
    }
    output[key] = canonicalize(entry, `${path}.${key}`);
  }
  return output;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function requireString(value, field, maximum = 300) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    throw new TypeError(`${field} must be a bounded non-empty string`);
  }
  return value;
}

function validateCommand(command) {
  if (!isPlainObject(command)) throw new TypeError('command must be an object');
  if (command.schemaVersion !== 1) throw new TypeError('command schemaVersion must equal 1');
  requireString(command.commandId, 'commandId', 240);
  requireString(command.type, 'type', 120);
  if (!ALLOWED_COMMAND_TYPES.has(command.type)) {
    const unsupported = new TypeError('unsupported controller command');
    unsupported.code = 'unsupported_controller_command';
    throw unsupported;
  }
  if (!isPlainObject(command.actor)) throw new TypeError('command actor is required');
  requireString(command.actor.type, 'actor.type', 80);
  requireString(command.actor.id, 'actor.id', 200);
  if (!['controller', 'worker'].includes(command.actor.type)) throw new TypeError('actor.type must be controller or worker');
  if (command.type === 'campaign.create' && command.actor.type !== 'controller') {
    throw new TypeError('campaign.create requires controller actor');
  }
  if (!isPlainObject(command.payload)) throw new TypeError('command payload must be an object');
  const normalized = canonicalize(command);
  const serialized = JSON.stringify(normalized);
  if (new TextEncoder().encode(serialized).byteLength > MAX_COMMAND_BYTES) {
    throw new TypeError('controller command is too large');
  }
  return normalized;
}

export function renderControllerCommandEnvelopeV1(command) {
  const normalized = validateCommand(command);
  return `${BEGIN_MARKER}\n${JSON.stringify(normalized)}\n${END_MARKER}`;
}

function decodeBase64Utf8(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_POINTER_BYTES * 2) {
    throw new TypeError('GitHub content field is invalid');
  }
  const binary = atob(value.replace(/\s+/g, ''));
  if (binary.length > MAX_POINTER_BYTES) throw new TypeError('GitHub pointer is too large');
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function fetcher(env) {
  const selected = typeof env.AUDIT_CONTROLLER_FETCH === 'function' ? env.AUDIT_CONTROLLER_FETCH : globalThis.fetch;
  if (typeof selected !== 'function') throw new TypeError('fetch is unavailable');
  return selected;
}

function githubHeaders(env, includeContentType = false) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${env.AUDIT_CONTROLLER_GITHUB_TOKEN}`,
    'x-github-api-version': '2022-11-28',
    'user-agent': 'CurveYield-Preflight-Tier3-Controller-Command-Adapter-v1',
    ...(includeContentType ? { 'content-type': 'application/json' } : {}),
  };
}

async function readPointer(projectSlug, env) {
  const url = `https://api.github.com/repos/${CONTROLLER_OWNER}/${CONTROLLER_NAME}/contents/.deep-assurance/active/${projectSlug}.json?ref=${CONTROLLER_REF}`;
  const response = await fetcher(env)(url, { method: 'GET', headers: githubHeaders(env) });
  if (response.status === 404) return { kind: 'not_found' };
  if (!response.ok) return { kind: 'upstream_error' };
  try {
    const envelope = await response.json();
    if (envelope?.encoding !== 'base64') throw new TypeError('unsupported content encoding');
    return { kind: 'ok', value: JSON.parse(decodeBase64Utf8(envelope.content)) };
  } catch {
    return { kind: 'invalid_content' };
  }
}

function normalizePointer(pointer, projectSlug) {
  if (!isPlainObject(pointer) || pointer.projectSlug !== projectSlug) throw new TypeError('pointer binding mismatch');
  if (pointer.schemaVersion === 'deep-assurance-active-pointer-tombstone-v1') {
    if (pointer.status !== 'NO_ACTIVE_CAMPAIGN'
        || pointer.launchAuthorized !== false
        || pointer.allPriorGenerationsAdmissible !== false) {
      throw new TypeError('invalid tombstone pointer');
    }
    return { status: 'NO_ACTIVE_CAMPAIGN' };
  }
  if (pointer.schemaVersion !== 'deep-assurance-active-pointer-v2'
      || pointer.status !== 'ACTIVE'
      || pointer.launchAuthorized !== true) {
    throw new TypeError('unsupported active pointer');
  }
  if (pointer.controllerCommit !== CONTROLLER_COMPATIBILITY_COMMIT
      || pointer.skillReleaseIdentity !== CONTROLLER_INSTRUCTION_RELEASE) {
    throw new TypeError('active pointer release mismatch');
  }
  if (typeof pointer.controllerCommit !== 'string' || !FULL_SHA.test(pointer.controllerCommit)) {
    throw new TypeError('invalid controller commit');
  }
  if (typeof pointer.controllerBranch !== 'string'
      || !pointer.controllerBranch.startsWith('campaign/')
      || pointer.controllerBranch.includes('..')
      || pointer.controllerBranch.includes('\\')) {
    throw new TypeError('invalid controller branch');
  }
  if (!Number.isSafeInteger(pointer.mailboxIssueNumber) || pointer.mailboxIssueNumber < 1) {
    throw new TypeError('invalid campaign mailbox issue');
  }
  return { status: 'ACTIVE', mailboxIssueNumber: pointer.mailboxIssueNumber };
}

async function postComment(issueNumber, envelope, env) {
  const url = `https://api.github.com/repos/${CONTROLLER_OWNER}/${CONTROLLER_NAME}/issues/${issueNumber}/comments`;
  const response = await fetcher(env)(url, {
    method: 'POST',
    headers: githubHeaders(env, true),
    body: JSON.stringify({ body: envelope }),
  });
  return response.ok;
}

function validateRequestBody(value) {
  if (!isPlainObject(value)) throw new TypeError('request body must be an object');
  const keys = Object.keys(value).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['command', 'projectSlug'])) {
    throw new TypeError('request body must contain exactly projectSlug and command');
  }
  if (typeof value.projectSlug !== 'string' || !PROJECT_SLUG.test(value.projectSlug)) {
    throw new TypeError('projectSlug is invalid');
  }
  return { projectSlug: value.projectSlug, command: validateCommand(value.command) };
}

export async function handleControllerCommandRouteV1(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/v1/controller/commands') return null;
  if (request.method === 'OPTIONS') return json({ ok: true }, env);
  if (request.method !== 'POST') return error(env, 'method_not_allowed', 'Controller commands require POST', 405);

  if (!await browserAuthorized(request, env)) {
    return error(env, 'unauthorized', 'Valid browser client authentication is required', 401);
  }
  if (typeof env.AUDIT_CONTROLLER_GITHUB_TOKEN !== 'string' || env.AUDIT_CONTROLLER_GITHUB_TOKEN.length === 0) {
    return error(env, 'controller_configuration_required', 'The audit controller GitHub connection is not configured', 503);
  }
  if (String(env.AUDIT_CONTROLLER_INTAKE_ISSUE ?? '') !== String(REQUIRED_INTAKE_ISSUE)) {
    return error(env, 'controller_configuration_required', 'The audit controller intake mailbox is not configured', 503);
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_COMMAND_BYTES * 2) {
    return error(env, 'invalid_controller_command_request', 'The controller command request is too large', 413);
  }

  let parsed;
  try {
    parsed = validateRequestBody(await request.json());
  } catch (cause) {
    if (cause?.code === 'unsupported_controller_command') {
      return error(env, 'unsupported_controller_command', 'The controller command type is not supported by this hosted release', 400);
    }
    return error(env, 'invalid_controller_command_request', 'The controller command request is invalid', 400);
  }

  const pointerResult = await readPointer(parsed.projectSlug, env);
  if (pointerResult.kind === 'not_found') {
    return error(env, 'controller_project_not_found', 'No audit controller project pointer exists', 404);
  }
  if (pointerResult.kind !== 'ok') {
    return error(env, 'controller_upstream_unavailable', 'The audit controller could not be read safely', 502);
  }

  let pointer;
  try {
    pointer = normalizePointer(pointerResult.value, parsed.projectSlug);
  } catch {
    return error(env, 'controller_pointer_incompatible', 'The audit controller pointer is incompatible with this hosted release', 409);
  }

  let issueNumber;
  let target;
  if (parsed.command.type === 'campaign.create') {
    if (pointer.status !== 'NO_ACTIVE_CAMPAIGN') {
      return error(env, 'controller_campaign_already_active', 'A campaign is already active for this project', 409);
    }
    issueNumber = REQUIRED_INTAKE_ISSUE;
    target = 'controller-intake';
  } else {
    if (pointer.status !== 'ACTIVE') {
      return error(env, 'controller_no_active_campaign', 'No active campaign exists for this controller command', 409);
    }
    issueNumber = pointer.mailboxIssueNumber;
    target = 'campaign-mailbox';
  }

  let envelope;
  try {
    envelope = renderControllerCommandEnvelopeV1(parsed.command);
  } catch {
    return error(env, 'invalid_controller_command_request', 'The controller command request is invalid', 400);
  }

  if (!await postComment(issueNumber, envelope, env)) {
    return error(env, 'controller_command_queue_failed', 'The controller command could not be queued safely', 502);
  }

  return json({
    status: 'queued',
    commandId: parsed.command.commandId,
    commandType: parsed.command.type,
    target,
  }, env, 202);
}
