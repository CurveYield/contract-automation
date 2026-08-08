// Tier 3 Hosted Controller Command Contract v1
export const BEGIN_MARKER_V1 = '<!-- CURVEYIELD_AUDIT_COMMAND_V1_BEGIN -->';
export const END_MARKER_V1 = '<!-- CURVEYIELD_AUDIT_COMMAND_V1_END -->';

export const TIER3_CONTROLLER_COMMAND_TYPES_V1 = Object.freeze([
  'instruction_read_proof.record',
  'campaign.activate',
  'gate.define',
  'gate.record',
  'worker.register',
  'assignment.publish',
  'assignment.claim',
  'assignment.expire',
  'assignment.submit',
  'assignment.controller_submit',
  'review.accept',
  'review.reject',
  'review.return_for_rework',
  'assignment.supersede',
  'campaign.revise_source',
  'publication.record',
  'user_delivery.record',
  'campaign.evaluate'
]);

const COMMAND_TYPES = new Set(TIER3_CONTROLLER_COMMAND_TYPES_V1);
const TOP_LEVEL_KEYS = new Set(['schemaVersion', 'commandId', 'type', 'actor', 'payload']);
const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const SCOPE_EXEMPT = new Set(['instruction_read_proof.record', 'worker.register']);
const CONTROLLER_ONLY = new Set([
  'campaign.activate', 'gate.define', 'gate.record', 'assignment.publish', 'assignment.expire',
  'assignment.controller_submit', 'assignment.supersede', 'campaign.revise_source',
  'publication.record', 'user_delivery.record', 'campaign.evaluate'
]);
const WORKER_ID_COMMANDS = new Set(['assignment.claim', 'assignment.submit']);
const REVIEWER_ID_COMMANDS = new Set(['review.accept', 'review.reject', 'review.return_for_rework']);

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}
function text(value, name, maximum = 4096) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) throw new TypeError(`${name} must be a non-empty string`);
  return value;
}
function scanSafe(value, path = '$') {
  if (Array.isArray(value)) return value.forEach((entry, index) => scanSafe(entry, `${path}[${index}]`));
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_OBJECT_KEYS.has(key)) throw new TypeError(`forbidden object key ${key} at ${path}`);
    scanSafe(value[key], `${path}.${key}`);
  }
}
function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function exactActor(actual, expected) {
  object(actual, 'command.actor');
  object(expected, 'authorization.actor');
  if (actual.type !== expected.type || actual.id !== expected.id) throw new TypeError('command actor does not match hosted authorization actor');
}
function exactScope(scope, authorization) {
  object(scope, 'payload.instructionScope');
  if (
    scope.sessionId !== authorization.sessionId ||
    scope.roleId !== authorization.roleId ||
    scope.phaseId !== authorization.phaseId
  ) throw new TypeError('payload.instructionScope does not match hosted authorization session, role, and phase');
}
function validateAuthorization(value) {
  object(value, 'authorization');
  text(value.authorizationId, 'authorization.authorizationId', 200);
  text(value.campaignId, 'authorization.campaignId', 200);
  object(value.actor, 'authorization.actor');
  if (!['controller', 'worker'].includes(value.actor.type)) throw new TypeError('authorization.actor.type is invalid');
  text(value.actor.id, 'authorization.actor.id', 200);
  for (const field of ['sessionId', 'roleId', 'phaseId']) text(value[field], `authorization.${field}`, 200);
  if (!Number.isSafeInteger(value.mailboxIssueNumber) || value.mailboxIssueNumber < 1) throw new TypeError('authorization.mailboxIssueNumber is invalid');
  if (!Array.isArray(value.allowedCommandTypes) || value.allowedCommandTypes.some((entry) => typeof entry !== 'string')) throw new TypeError('authorization.allowedCommandTypes is invalid');
  return value;
}

export function validateHostedControllerCommandV1(command, authorizationInput) {
  const authorization = validateAuthorization(authorizationInput);
  object(command, 'command');
  scanSafe(command);
  for (const key of Object.keys(command)) if (!TOP_LEVEL_KEYS.has(key)) throw new TypeError(`unknown command field: ${key}`);
  for (const key of TOP_LEVEL_KEYS) if (!Object.hasOwn(command, key)) throw new TypeError(`missing command field: ${key}`);
  if (command.schemaVersion !== 1) throw new TypeError('command.schemaVersion must equal 1');
  text(command.commandId, 'command.commandId', 256);
  text(command.type, 'command.type', 128);
  if (!COMMAND_TYPES.has(command.type)) throw new TypeError(`unsupported command type: ${command.type}`);
  if (!authorization.allowedCommandTypes.includes(command.type)) throw new TypeError(`command type ${command.type} is not allowed by hosted authorization`);
  exactActor(command.actor, authorization.actor);
  object(command.payload, 'command.payload');

  if (CONTROLLER_ONLY.has(command.type) && command.actor.type !== 'controller') throw new TypeError(`${command.type} requires a controller actor`);
  if ((WORKER_ID_COMMANDS.has(command.type) || REVIEWER_ID_COMMANDS.has(command.type)) && command.actor.type !== 'worker') throw new TypeError(`${command.type} requires a worker actor`);

  if (!SCOPE_EXEMPT.has(command.type)) exactScope(command.payload.instructionScope, authorization);

  if (WORKER_ID_COMMANDS.has(command.type) && command.payload.workerId !== command.actor.id) {
    throw new TypeError(`${command.type} workerId must match command actor`);
  }
  if (REVIEWER_ID_COMMANDS.has(command.type) && command.payload.reviewerWorkerId !== command.actor.id) {
    throw new TypeError(`${command.type} reviewerWorkerId must match command actor`);
  }
  if (command.type === 'worker.register') {
    if (command.actor.type !== 'worker') throw new TypeError('worker.register requires a worker actor');
    if (command.payload.workerId !== command.actor.id) throw new TypeError('worker.register workerId must match command actor');
    if (command.payload.roleId !== authorization.roleId) throw new TypeError('worker.register roleId must match hosted authorization');
    if (authorization.phaseId !== 'phase-0') throw new TypeError('worker.register hosted authorization must be bound to phase-0');
    if (command.payload.sessionManifest?.sessionId !== authorization.sessionId) throw new TypeError('worker.register sessionManifest.sessionId must match hosted authorization');
    const proof = object(command.payload.instructionProof, 'worker.register instructionProof');
    if (
      proof.actorType !== command.actor.type || proof.actorId !== command.actor.id ||
      proof.sessionId !== authorization.sessionId || proof.roleId !== authorization.roleId || proof.phaseId !== 'phase-0'
    ) throw new TypeError('worker.register instruction proof does not match hosted authorization');
  }
  if (command.type === 'instruction_read_proof.record') {
    const proof = object(command.payload.proof, 'instruction_read_proof.record proof');
    if (
      proof.actorType !== command.actor.type || proof.actorId !== command.actor.id ||
      proof.sessionId !== authorization.sessionId || proof.roleId !== authorization.roleId || proof.phaseId !== authorization.phaseId
    ) throw new TypeError('instruction proof does not match hosted authorization');
  }

  return structuredClone(command);
}

export function renderHostedControllerCommandV1(command, authorization) {
  const validated = validateHostedControllerCommandV1(command, authorization);
  return `${BEGIN_MARKER_V1}\n${canonicalize(validated)}\n${END_MARKER_V1}`;
}
