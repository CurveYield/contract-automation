export const AUDIT_COMMAND_BEGIN_MARKER_V1 = '<!-- CURVEYIELD_AUDIT_COMMAND_V1_BEGIN -->';
export const AUDIT_COMMAND_END_MARKER_V1 = '<!-- CURVEYIELD_AUDIT_COMMAND_V1_END -->';

const ACTIVE_POINTER_SCHEMA_V2 = 'deep-assurance-active-pointer-v2';
const TOMBSTONE_SCHEMA_V1 = 'deep-assurance-active-pointer-tombstone-v1';
const HOSTED_STATE_SCHEMA_V1 = 'hosted-operator-state-v1';
const PROJECT_SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SHA40 = /^[0-9a-f]{40}$/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_GITHUB_CONTENT_BYTES = 950 * 1024;
const MAX_COMMAND_BYTES = 256 * 1024;

export class AuditControllerAdapterError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.name = 'AuditControllerAdapterError';
    this.code = code;
    this.status = status;
  }
}

function assertString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AuditControllerAdapterError('invalid_controller_contract', `${name} must be a non-empty string`, 500);
  }
  return value;
}

function safeProjectSlug(projectSlug) {
  if (typeof projectSlug !== 'string' || !PROJECT_SLUG.test(projectSlug)) {
    throw new AuditControllerAdapterError('invalid_project_slug', 'Audit project slug is invalid', 400);
  }
  return projectSlug;
}

function safeRelativePath(value, name, { directory = false } = {}) {
  assertString(value, name);
  if (value.startsWith('/') || value.includes('\\') || value.includes('..') || value.includes('//')) {
    throw new AuditControllerAdapterError('invalid_controller_path', `${name} is an unsafe controller path`, 409);
  }
  if (directory && !value.endsWith('/')) {
    throw new AuditControllerAdapterError('invalid_controller_path', `${name} must be a directory path`, 409);
  }
  return value;
}

function encodeRepositoryPath(path) {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

function githubHeaders(token, contentType = false) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    ...(contentType ? { 'content-type': 'application/json' } : {}),
    'user-agent': 'CurveYield-Preflight-Tier3-v1',
    'x-github-api-version': '2026-03-10',
  };
}

function upstreamError(status) {
  if (status === 403) return new AuditControllerAdapterError('github_forbidden', 'Audit controller GitHub request failed', 502);
  if (status === 404) return new AuditControllerAdapterError('github_not_found', 'Audit controller resource was not found', 404);
  if (status === 409) return new AuditControllerAdapterError('github_conflict', 'Audit controller GitHub request conflicted with current state', 409);
  if (status === 429) return new AuditControllerAdapterError('github_rate_limited', 'Audit controller GitHub request is rate limited', 503);
  return new AuditControllerAdapterError('github_request_failed', 'Audit controller GitHub request failed', status >= 500 ? 502 : 500);
}

async function responseJson(response) {
  try {
    return await response.json();
  } catch {
    throw new AuditControllerAdapterError('github_invalid_response', 'Audit controller GitHub response was invalid', 502);
  }
}

function decodeBase64Utf8(value) {
  try {
    const binary = atob(value.replaceAll('\n', ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new TextDecoder().decode(bytes);
  } catch {
    throw new AuditControllerAdapterError('github_invalid_content', 'Audit controller GitHub content encoding was invalid', 502);
  }
}

function parseBoundedContent(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new AuditControllerAdapterError('github_invalid_content', 'Audit controller GitHub content response was invalid', 502);
  }
  if (payload.encoding !== 'base64' || typeof payload.content !== 'string') {
    throw new AuditControllerAdapterError('github_invalid_content', 'Audit controller GitHub content response was invalid', 502);
  }
  if (Number.isFinite(payload.size) && payload.size > MAX_GITHUB_CONTENT_BYTES) {
    throw new AuditControllerAdapterError('github_content_too_large', 'Audit controller GitHub content exceeded the hosted adapter limit', 502);
  }
  const text = decodeBase64Utf8(payload.content);
  if (new TextEncoder().encode(text).byteLength > MAX_GITHUB_CONTENT_BYTES) {
    throw new AuditControllerAdapterError('github_content_too_large', 'Audit controller GitHub content exceeded the hosted adapter limit', 502);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new AuditControllerAdapterError('github_invalid_json', 'Audit controller GitHub content was not valid JSON', 502);
  }
}

function sanitizeTombstone(pointer, projectSlug) {
  if (!pointer || typeof pointer !== 'object' || Array.isArray(pointer)
      || pointer.schemaVersion !== TOMBSTONE_SCHEMA_V1
      || pointer.status !== 'NO_ACTIVE_CAMPAIGN'
      || pointer.projectSlug !== projectSlug
      || pointer.launchAuthorized !== false) {
    throw new AuditControllerAdapterError('invalid_controller_pointer', 'Audit controller tombstone does not match the requested project', 409);
  }
  return {
    schemaVersion: TOMBSTONE_SCHEMA_V1,
    projectSlug,
    status: 'NO_ACTIVE_CAMPAIGN',
    reason: typeof pointer.reason === 'string' ? pointer.reason : 'NO_ACTIVE_CAMPAIGN',
    launchAuthorized: false,
    allPriorGenerationsAdmissible: pointer.allPriorGenerationsAdmissible === true,
    scrubCommit: typeof pointer.scrubCommit === 'string' ? pointer.scrubCommit : null,
  };
}

function validateActivePointer(pointer, projectSlug, expectedControllerCommit, expectedSkillReleaseIdentity) {
  if (!pointer || typeof pointer !== 'object' || Array.isArray(pointer)
      || pointer.schemaVersion !== ACTIVE_POINTER_SCHEMA_V2
      || pointer.status !== 'ACTIVE'
      || pointer.launchAuthorized !== true
      || pointer.projectSlug !== projectSlug) {
    throw new AuditControllerAdapterError('invalid_controller_pointer', 'Audit controller active pointer is invalid', 409);
  }
  for (const field of ['campaignId', 'campaignGenerationId', 'controllerBranch', 'workspacePath', 'projectionPath', 'controllerCommit', 'skillReleaseIdentity']) {
    assertString(pointer[field], `pointer.${field}`);
  }
  if (!pointer.controllerBranch.startsWith('campaign/') || pointer.controllerBranch.includes('..') || pointer.controllerBranch.includes('\\')) {
    throw new AuditControllerAdapterError('invalid_controller_branch', 'Audit controller branch is invalid', 409);
  }
  const workspacePath = safeRelativePath(pointer.workspacePath, 'pointer workspace path', { directory: true });
  if (!workspacePath.startsWith('campaigns/')) {
    throw new AuditControllerAdapterError('invalid_controller_path', 'Audit controller workspace path is invalid', 409);
  }
  const projectionPath = safeRelativePath(pointer.projectionPath, 'pointer projection path');
  if (!projectionPath.startsWith(workspacePath) || !projectionPath.endsWith('/HOSTED-OPERATOR-STATE-v1.json')) {
    throw new AuditControllerAdapterError('invalid_controller_path', 'Audit controller projection path is invalid', 409);
  }
  if (!Number.isSafeInteger(pointer.mailboxIssueNumber) || pointer.mailboxIssueNumber < 1) {
    throw new AuditControllerAdapterError('invalid_controller_mailbox', 'Audit controller mailbox issue is invalid', 409);
  }
  if (!SHA40.test(pointer.controllerCommit)) {
    throw new AuditControllerAdapterError('invalid_controller_release', 'Audit controller commit is invalid', 409);
  }
  if (expectedControllerCommit && pointer.controllerCommit !== expectedControllerCommit) {
    throw new AuditControllerAdapterError('controller_release_mismatch', 'Audit controller commit does not match the hosted adapter release', 409);
  }
  if (expectedSkillReleaseIdentity && pointer.skillReleaseIdentity !== expectedSkillReleaseIdentity) {
    throw new AuditControllerAdapterError('skill_release_mismatch', 'Audit controller skill release does not match the hosted adapter release', 409);
  }
  return {
    schemaVersion: ACTIVE_POINTER_SCHEMA_V2,
    projectSlug,
    status: 'ACTIVE',
    launchAuthorized: true,
    campaignId: pointer.campaignId,
    campaignGenerationId: pointer.campaignGenerationId,
    controllerBranch: pointer.controllerBranch,
    workspacePath,
    mailboxIssueNumber: pointer.mailboxIssueNumber,
    projectionPath,
    controllerCommit: pointer.controllerCommit,
    skillReleaseIdentity: pointer.skillReleaseIdentity,
  };
}

function validateProjection(projection, pointer, { expectedControllerCommit, expectedSkillReleaseIdentity, automationRelease }) {
  if (!projection || typeof projection !== 'object' || Array.isArray(projection) || projection.schemaVersion !== HOSTED_STATE_SCHEMA_V1) {
    throw new AuditControllerAdapterError('invalid_controller_projection', 'Audit controller hosted projection is invalid', 409);
  }
  const compatibility = projection.compatibility;
  const campaign = projection.campaign;
  if (!compatibility || typeof compatibility !== 'object' || !campaign || typeof campaign !== 'object') {
    throw new AuditControllerAdapterError('invalid_controller_projection', 'Audit controller hosted projection is incomplete', 409);
  }
  if (campaign.campaignId !== pointer.campaignId) {
    throw new AuditControllerAdapterError('controller_campaign_mismatch', 'Audit controller projection campaign does not match the active pointer', 409);
  }
  if (compatibility.controllerCommit !== pointer.controllerCommit || (expectedControllerCommit && compatibility.controllerCommit !== expectedControllerCommit)) {
    throw new AuditControllerAdapterError('controller_release_mismatch', 'Audit controller projection controller commit does not match the active pointer', 409);
  }
  if (compatibility.skillReleaseIdentity !== pointer.skillReleaseIdentity || (expectedSkillReleaseIdentity && compatibility.skillReleaseIdentity !== expectedSkillReleaseIdentity)) {
    throw new AuditControllerAdapterError('skill_release_mismatch', 'Audit controller projection skill release does not match the active pointer', 409);
  }
  if (automationRelease && compatibility.automationRelease !== automationRelease) {
    throw new AuditControllerAdapterError('automation_release_mismatch', 'Audit controller projection automation release does not match the hosted adapter release', 409);
  }
  return projection;
}

function normalize(value, path = '$') {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    if (typeof value === 'string' && (value.includes(AUDIT_COMMAND_BEGIN_MARKER_V1) || value.includes(AUDIT_COMMAND_END_MARKER_V1))) {
      throw new AuditControllerAdapterError('invalid_command_marker', `Audit command contains a reserved marker at ${path}`, 400);
    }
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new AuditControllerAdapterError('invalid_command', `Audit command contains a non-finite number at ${path}`, 400);
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map((entry, index) => normalize(entry, `${path}[${index}]`));
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new AuditControllerAdapterError('invalid_command', `Audit command requires plain JSON objects at ${path}`, 400);
  }
  const result = Object.create(null);
  for (const key of Object.keys(value).sort()) {
    if (FORBIDDEN_KEYS.has(key)) throw new AuditControllerAdapterError('invalid_command', `Audit command contains forbidden key ${key} at ${path}`, 400);
    const entry = value[key];
    if (entry === undefined || typeof entry === 'function' || typeof entry === 'symbol' || typeof entry === 'bigint') {
      throw new AuditControllerAdapterError('invalid_command', `Audit command contains an unsupported value at ${path}.${key}`, 400);
    }
    result[key] = normalize(entry, `${path}.${key}`);
  }
  return result;
}

function canonicalJson(value) {
  return JSON.stringify(normalize(value));
}

function validateCommand(command) {
  if (!command || typeof command !== 'object' || Array.isArray(command)) {
    throw new AuditControllerAdapterError('invalid_command', 'Audit command must be an object', 400);
  }
  if (command.schemaVersion !== 1) throw new AuditControllerAdapterError('invalid_command', 'Audit command requires schemaVersion 1', 400);
  for (const field of ['commandId', 'type']) {
    if (typeof command[field] !== 'string' || command[field].length === 0) throw new AuditControllerAdapterError('invalid_command', `Audit command ${field} is required`, 400);
  }
  if (!command.actor || typeof command.actor !== 'object' || Array.isArray(command.actor)) {
    throw new AuditControllerAdapterError('invalid_command', 'Audit command actor is required', 400);
  }
  for (const field of ['type', 'id']) {
    if (typeof command.actor[field] !== 'string' || command.actor[field].length === 0) throw new AuditControllerAdapterError('invalid_command', `Audit command actor.${field} is required`, 400);
  }
  if (!command.payload || typeof command.payload !== 'object' || Array.isArray(command.payload)) {
    throw new AuditControllerAdapterError('invalid_command', 'Audit command payload must be an object', 400);
  }
  return canonicalJson(command);
}

function renderEnvelope(command) {
  const body = validateCommand(command);
  const envelope = `${AUDIT_COMMAND_BEGIN_MARKER_V1}\n${body}\n${AUDIT_COMMAND_END_MARKER_V1}`;
  if (new TextEncoder().encode(envelope).byteLength > MAX_COMMAND_BYTES) {
    throw new AuditControllerAdapterError('command_too_large', 'Audit command exceeds the hosted adapter limit', 413);
  }
  return envelope;
}

function validateCampaignCreateCommand(command) {
  if (!command || command.type !== 'campaign.create') {
    throw new AuditControllerAdapterError('invalid_campaign_create', 'Hosted campaign intake accepts only campaign.create commands', 400);
  }
  if (!command.actor || command.actor.type !== 'controller') {
    throw new AuditControllerAdapterError('invalid_campaign_create_actor', 'Hosted campaign intake requires a controller actor', 400);
  }
  return renderEnvelope(command);
}

export function createAuditControllerAdapterV1({
  fetcher = fetch,
  token,
  owner = 'CurveYield',
  repo = 'audit-controller',
  mainRef = 'main',
  expectedControllerCommit = null,
  expectedSkillReleaseIdentity = null,
  automationRelease = null,
  intakeIssueNumber = null,
} = {}) {
  assertString(token, 'GitHub token');
  assertString(owner, 'GitHub owner');
  assertString(repo, 'GitHub repository');
  assertString(mainRef, 'GitHub main ref');
  const configuredIntakeIssue = Number.isSafeInteger(intakeIssueNumber) && intakeIssueNumber > 0 ? intakeIssueNumber : null;
  const root = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  async function getContent(path, ref) {
    const url = `${root}/contents/${encodeRepositoryPath(path)}?ref=${encodeURIComponent(ref)}`;
    let response;
    try {
      response = await fetcher(url, { headers: githubHeaders(token) });
    } catch {
      throw new AuditControllerAdapterError('github_unavailable', 'Audit controller GitHub request failed', 502);
    }
    if (!response.ok) throw upstreamError(response.status);
    return parseBoundedContent(await responseJson(response));
  }

  async function getPointer(projectSlug) {
    const slug = safeProjectSlug(projectSlug);
    const rawPointer = await getContent(`.deep-assurance/active/${slug}.json`, mainRef);
    if (rawPointer?.status === 'NO_ACTIVE_CAMPAIGN') return sanitizeTombstone(rawPointer, slug);
    return validateActivePointer(rawPointer, slug, expectedControllerCommit, expectedSkillReleaseIdentity);
  }

  async function getProject(projectSlug) {
    const pointer = await getPointer(projectSlug);
    if (pointer.status === 'NO_ACTIVE_CAMPAIGN') {
      return { pointer, projection: null, status: 'NO_ACTIVE_CAMPAIGN' };
    }
    const projection = validateProjection(
      await getContent(pointer.projectionPath, pointer.controllerBranch),
      pointer,
      { expectedControllerCommit, expectedSkillReleaseIdentity, automationRelease },
    );
    return { pointer, projection, status: projection.campaign?.status ?? 'UNKNOWN' };
  }

  async function postEnvelope(issueNumber, envelope, commandId) {
    const url = `${root}/issues/${issueNumber}/comments`;
    let response;
    try {
      response = await fetcher(url, {
        method: 'POST',
        headers: githubHeaders(token, true),
        body: JSON.stringify({ body: envelope }),
      });
    } catch {
      throw new AuditControllerAdapterError('github_unavailable', 'Audit controller GitHub request failed', 502);
    }
    if (!response.ok) throw upstreamError(response.status);
    const payload = await responseJson(response);
    if (!Number.isSafeInteger(payload?.id) || payload.id < 1) {
      throw new AuditControllerAdapterError('github_invalid_response', 'Audit controller GitHub response was invalid', 502);
    }
    return { accepted: true, commentId: payload.id, commandId };
  }

  async function submitCommand({ projectSlug, command }) {
    const envelope = renderEnvelope(command);
    const project = await getProject(projectSlug);
    if (project.pointer.status !== 'ACTIVE' || project.pointer.launchAuthorized !== true) {
      throw new AuditControllerAdapterError('no_active_campaign', 'Audit project has no active campaign', 409);
    }
    return postEnvelope(project.pointer.mailboxIssueNumber, envelope, command.commandId);
  }

  async function submitCampaignCreate({ projectSlug, command }) {
    if (!configuredIntakeIssue) {
      throw new AuditControllerAdapterError('campaign_intake_unavailable', 'Hosted campaign intake is not configured', 503);
    }
    const envelope = validateCampaignCreateCommand(command);
    const pointer = await getPointer(projectSlug);
    if (pointer.status === 'ACTIVE') {
      throw new AuditControllerAdapterError('active_campaign_exists', 'Audit project already has an active campaign', 409);
    }
    return postEnvelope(configuredIntakeIssue, envelope, command.commandId);
  }

  return Object.freeze({
    getProject,
    submitCommand,
    submitCampaignCreate,
    getCompatibility() {
      return {
        schemaVersion: 'audit-controller-hosted-compatibility-v1',
        repository: `${owner}/${repo}`,
        mainRef,
        hostedStateSchemaVersion: HOSTED_STATE_SCHEMA_V1,
        activePointerSchemaVersion: ACTIVE_POINTER_SCHEMA_V2,
        controllerCommit: expectedControllerCommit,
        skillReleaseIdentity: expectedSkillReleaseIdentity,
        automationRelease,
        campaignCreateAvailable: configuredIntakeIssue !== null,
      };
    },
  });
}
