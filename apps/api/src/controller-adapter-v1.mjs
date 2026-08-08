import { TIER3_CONTROLLER_ADAPTER_VERSION_V1 } from '../../../packages/protocol/src/tier3-controller-v1.mjs';

const CONTROLLER_REPOSITORY = 'CurveYield/audit-controller';
const CONTROLLER_OWNER = 'CurveYield';
const CONTROLLER_NAME = 'audit-controller';
const CONTROLLER_REF = 'main';
const CONTROLLER_COMPATIBILITY_COMMIT = 'd4851886ece3e8793dcc2a99f97f6d34da10e1cd';
const CONTROLLER_RELEASE = 'audit-controller@hosted-tier3-v1';
const CONTROLLER_PROCESS_ID = 'deep-assurance-v6';
const CONTROLLER_INSTRUCTION_RELEASE = 'ai-auditor-deep-assurance-v6@16.13.0';
const AUTOMATION_REPOSITORY = 'CurveYield/contract-automation';
const AUTOMATION_RELEASE = 'contract-automation@round5-tier3-v1';
const MAX_GITHUB_ENVELOPE_BYTES = 512 * 1024;
const PROJECT_SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const FULL_SHA = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const CAMPAIGN_STATUSES = new Set(['DRAFT', 'ACTIVE', 'COMPLETE']);
const GATE_STATUSES = new Set([
  'PENDING',
  'PASS',
  'INFORMATIONAL_ISSUE_FOUND',
  'LOW_ISSUE_FOUND',
  'MEDIUM_ISSUE_FOUND',
  'HIGH_ISSUE_FOUND',
  'CRITICAL_ISSUE_FOUND',
  'FAIL',
]);
const ASSIGNMENT_STATUSES = new Set(['READY', 'LEASED', 'SUBMITTED', 'ACCEPTED', 'REJECTED']);

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
      releaseIdentity: CONTROLLER_RELEASE,
      processId: CONTROLLER_PROCESS_ID,
      instructionReleaseIdentity: CONTROLLER_INSTRUCTION_RELEASE,
    },
    automation: {
      repository: AUTOMATION_REPOSITORY,
      releaseIdentity: AUTOMATION_RELEASE,
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

function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function requireString(value, field, maximum = 512) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    throw new TypeError(`${field} must be a bounded non-empty string`);
  }
  return value;
}

function nullableString(value, field, maximum = 512) {
  if (value === null) return null;
  return requireString(value, field, maximum);
}

function requireSha(value, field) {
  if (typeof value !== 'string' || !FULL_SHA.test(value)) throw new TypeError(`${field} must be a full lowercase git SHA`);
  return value;
}

function nullableSha(value, field) {
  if (value === null) return null;
  return requireSha(value, field);
}

function requireSha256(value, field) {
  if (typeof value !== 'string' || !SHA256.test(value)) throw new TypeError(`${field} must be a lowercase SHA-256 digest`);
  return value;
}

function requirePositiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${field} must be a positive safe integer`);
  return value;
}

function nonNegativeInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${field} must be a non-negative safe integer`);
  return value;
}

function nullableInteger(value, field) {
  if (value === null) return null;
  if (!Number.isSafeInteger(value)) throw new TypeError(`${field} must be an integer or null`);
  return value;
}

function bool(value, field) {
  if (typeof value !== 'boolean') throw new TypeError(`${field} must be boolean`);
  return value;
}

function stringArray(value, field, maximum = 100) {
  if (!Array.isArray(value) || value.length > maximum) throw new TypeError(`${field} must be a bounded array`);
  return value.map((entry, index) => requireString(entry, `${field}[${index}]`, 240));
}

function recordBooleanMap(value, field, maximum = 100) {
  object(value, field);
  const entries = Object.entries(value);
  if (entries.length > maximum) throw new TypeError(`${field} contains too many entries`);
  return Object.fromEntries(entries.map(([key, entry]) => {
    requireString(key, `${field}.key`, 160);
    return [key, bool(entry, `${field}.${key}`)];
  }));
}

function enumValue(value, allowed, field) {
  if (!allowed.has(value)) throw new TypeError(`${field} is unsupported`);
  return value;
}

function safeBranch(value) {
  requireString(value, 'controllerBranch', 200);
  if (!value.startsWith('campaign/') || value.includes('..') || value.includes('\\') || value.includes('//')) {
    throw new TypeError('controllerBranch must be a safe campaign/* branch');
  }
  return value;
}

function safeWorkspacePath(value) {
  requireString(value, 'workspacePath', 340);
  if (!value.startsWith('campaigns/') || !value.endsWith('/') || value.includes('..') || value.includes('\\') || value.includes('//')) {
    throw new TypeError('workspacePath must be a normalized campaigns/* directory');
  }
  return value;
}

function safeProjectionPath(value, workspacePath) {
  requireString(value, 'projectionPath', 380);
  if (value !== `${workspacePath}HOSTED-OPERATOR-STATE-v1.json`) {
    throw new TypeError('projectionPath must be the hosted operator state inside workspacePath');
  }
  return value;
}

function normalizePointer(pointer, expectedProjectSlug) {
  object(pointer, 'active pointer');
  if (pointer.projectSlug !== expectedProjectSlug) throw new TypeError('active pointer projectSlug mismatch');

  if (pointer.schemaVersion === 'deep-assurance-active-pointer-tombstone-v1') {
    if (pointer.status !== 'NO_ACTIVE_CAMPAIGN') throw new TypeError('tombstone status is invalid');
    if (pointer.launchAuthorized !== false || pointer.allPriorGenerationsAdmissible !== false) {
      throw new TypeError('tombstone authorization fields are invalid');
    }
    return {
      projectSlug: expectedProjectSlug,
      status: 'NO_ACTIVE_CAMPAIGN',
      reason: requireString(pointer.reason, 'reason', 160),
      launchAuthorized: false,
      allPriorGenerationsAdmissible: false,
      scrubCommit: requireSha(pointer.scrubCommit, 'scrubCommit'),
    };
  }

  if (pointer.schemaVersion !== 'deep-assurance-active-pointer-v2') {
    throw new TypeError('active pointer schema is unsupported');
  }
  if (pointer.status !== 'ACTIVE' || pointer.launchAuthorized !== true) {
    throw new TypeError('active pointer authorization state is invalid');
  }
  const controllerCommit = requireSha(pointer.controllerCommit, 'controllerCommit');
  if (controllerCommit !== CONTROLLER_COMPATIBILITY_COMMIT) {
    throw new TypeError('active pointer controller commit is incompatible');
  }
  if (pointer.skillReleaseIdentity !== CONTROLLER_INSTRUCTION_RELEASE) {
    throw new TypeError('active pointer skill release is incompatible');
  }
  const workspacePath = safeWorkspacePath(pointer.workspacePath);
  return {
    projectSlug: expectedProjectSlug,
    status: 'ACTIVE',
    launchAuthorized: true,
    campaignId: requireString(pointer.campaignId, 'campaignId', 200),
    campaignGenerationId: requireString(pointer.campaignGenerationId, 'campaignGenerationId', 200),
    controllerBranch: safeBranch(pointer.controllerBranch),
    workspacePath,
    mailboxIssueNumber: requirePositiveInteger(pointer.mailboxIssueNumber, 'mailboxIssueNumber'),
    projectionPath: safeProjectionPath(pointer.projectionPath, workspacePath),
    controllerCommit,
    skillReleaseIdentity: pointer.skillReleaseIdentity,
  };
}

function normalizeSession(value, field) {
  if (value === null) return null;
  object(value, field);
  return {
    productSurface: nullableString(value.productSurface, `${field}.productSurface`, 160),
    model: nullableString(value.model, `${field}.model`, 160),
    sessionId: nullableString(value.sessionId, `${field}.sessionId`, 200),
    priorMaterialVisibility: nullableString(value.priorMaterialVisibility, `${field}.priorMaterialVisibility`, 200),
    independenceClassification: nullableString(value.independenceClassification, `${field}.independenceClassification`, 200),
  };
}

function normalizeSubmission(value, field) {
  if (value === null) return null;
  object(value, field);
  return {
    workerId: nullableString(value.workerId, `${field}.workerId`, 200),
    controllerId: nullableString(value.controllerId, `${field}.controllerId`, 200),
    summary: nullableString(value.summary, `${field}.summary`, 2000),
    sourceRevision: nullableInteger(value.sourceRevision, `${field}.sourceRevision`),
    evidenceRefCount: nonNegativeInteger(value.evidenceRefCount, `${field}.evidenceRefCount`),
    submittedAt: nullableString(value.submittedAt, `${field}.submittedAt`, 80),
  };
}

function normalizeReview(value, field) {
  if (value === null) return null;
  object(value, field);
  return {
    reviewerWorkerId: nullableString(value.reviewerWorkerId, `${field}.reviewerWorkerId`, 200),
    decision: nullableString(value.decision, `${field}.decision`, 120),
    reason: nullableString(value.reason, `${field}.reason`, 2000),
    revision: nullableInteger(value.revision, `${field}.revision`),
    reviewedAt: nullableString(value.reviewedAt, `${field}.reviewedAt`, 80),
  };
}

function boundedArray(value, field, maximum, normalize) {
  if (!Array.isArray(value) || value.length > maximum) throw new TypeError(`${field} must be a bounded array`);
  return value.map((entry, index) => normalize(entry, `${field}[${index}]`));
}

function normalizeHostedProjectionV1(value, pointer) {
  object(value, 'hosted projection');
  if (value.schemaVersion !== 'hosted-operator-state-v1') throw new TypeError('hosted projection schema is unsupported');

  const projectedCompatibility = object(value.compatibility, 'compatibility');
  const controllerCommit = requireSha(projectedCompatibility.controllerCommit, 'compatibility.controllerCommit');
  if (controllerCommit !== CONTROLLER_COMPATIBILITY_COMMIT || controllerCommit !== pointer.controllerCommit) {
    throw new TypeError('hosted projection controller commit is incompatible');
  }
  if (projectedCompatibility.controllerRelease !== CONTROLLER_RELEASE) {
    throw new TypeError('hosted projection controller release is incompatible');
  }
  if (projectedCompatibility.skillReleaseIdentity !== CONTROLLER_INSTRUCTION_RELEASE
      || projectedCompatibility.skillReleaseIdentity !== pointer.skillReleaseIdentity) {
    throw new TypeError('hosted projection skill release is incompatible');
  }
  if (projectedCompatibility.automationRelease !== AUTOMATION_RELEASE) {
    throw new TypeError('hosted projection automation release is incompatible');
  }

  const campaign = object(value.campaign, 'campaign');
  if (campaign.campaignId !== pointer.campaignId) throw new TypeError('hosted projection campaign binding mismatch');
  if (campaign.processId !== CONTROLLER_PROCESS_ID) throw new TypeError('hosted projection process is incompatible');
  const status = enumValue(campaign.status, CAMPAIGN_STATUSES, 'campaign.status');
  const completionStatus = campaign.completionStatus === null
    ? null
    : enumValue(campaign.completionStatus, new Set(['COMPLETE']), 'campaign.completionStatus');
  const securityVerdict = campaign.securityVerdict === null
    ? null
    : enumValue(campaign.securityVerdict, new Set(['PASS', 'NO_GO']), 'campaign.securityVerdict');
  if (completionStatus === 'COMPLETE') {
    if (status !== 'COMPLETE' || securityVerdict === null) throw new TypeError('complete campaign must have PASS or NO_GO');
  } else if (securityVerdict !== null || status === 'COMPLETE') {
    throw new TypeError('incomplete campaign must not expose a final verdict');
  }
  const source = object(campaign.source, 'campaign.source');
  const preflight = object(campaign.preflight, 'campaign.preflight');
  const topology = object(value.topology, 'topology');

  const projection = {
    schemaVersion: 'hosted-operator-state-v1',
    controllerStateSchemaVersion: nullableInteger(value.controllerStateSchemaVersion, 'controllerStateSchemaVersion'),
    compatibility: {
      controllerCommit,
      controllerRelease: CONTROLLER_RELEASE,
      skillReleaseIdentity: CONTROLLER_INSTRUCTION_RELEASE,
      automationRelease: AUTOMATION_RELEASE,
    },
    campaign: {
      campaignId: pointer.campaignId,
      processId: CONTROLLER_PROCESS_ID,
      title: nullableString(campaign.title, 'campaign.title', 300),
      status,
      completionStatus,
      securityVerdict,
      terminalReason: nullableString(campaign.terminalReason, 'campaign.terminalReason', 1000),
      source: {
        repository: nullableString(source.repository, 'campaign.source.repository', 220),
        commit: nullableSha(source.commit, 'campaign.source.commit'),
        revision: nullableInteger(source.revision, 'campaign.source.revision'),
      },
      preflight: {
        status: nullableString(preflight.status, 'campaign.preflight.status', 120),
        capabilities: recordBooleanMap(preflight.capabilities, 'campaign.preflight.capabilities'),
      },
      instructionPolicyRequired: bool(campaign.instructionPolicyRequired, 'campaign.instructionPolicyRequired'),
      createdAt: nullableString(campaign.createdAt, 'campaign.createdAt', 80),
      updatedAt: nullableString(campaign.updatedAt, 'campaign.updatedAt', 80),
    },
    topology: {
      gateIds: stringArray(topology.gateIds, 'topology.gateIds', 50),
      laneRoleIds: stringArray(topology.laneRoleIds, 'topology.laneRoleIds', 50),
    },
    gates: boundedArray(value.gates, 'gates', 50, (gate, field) => {
      object(gate, field);
      return {
        gateId: nullableString(gate.gateId, `${field}.gateId`, 180),
        phaseId: nullableString(gate.phaseId, `${field}.phaseId`, 180),
        title: nullableString(gate.title, `${field}.title`, 300),
        mandatory: bool(gate.mandatory, `${field}.mandatory`),
        status: enumValue(gate.status, GATE_STATUSES, `${field}.status`),
        evidenceRefCount: nonNegativeInteger(gate.evidenceRefCount, `${field}.evidenceRefCount`),
        recordedAt: nullableString(gate.recordedAt, `${field}.recordedAt`, 80),
      };
    }),
    workers: boundedArray(value.workers, 'workers', 100, (worker, field) => {
      object(worker, field);
      return {
        workerId: nullableString(worker.workerId, `${field}.workerId`, 200),
        roleId: nullableString(worker.roleId, `${field}.roleId`, 180),
        capabilities: stringArray(worker.capabilities, `${field}.capabilities`, 100),
        session: normalizeSession(worker.session, `${field}.session`),
        registeredAt: nullableString(worker.registeredAt, `${field}.registeredAt`, 80),
      };
    }),
    assignments: boundedArray(value.assignments, 'assignments', 300, (assignment, field) => {
      object(assignment, field);
      return {
        assignmentId: nullableString(assignment.assignmentId, `${field}.assignmentId`, 200),
        roleId: nullableString(assignment.roleId, `${field}.roleId`, 180),
        title: nullableString(assignment.title, `${field}.title`, 300),
        mandatory: bool(assignment.mandatory, `${field}.mandatory`),
        status: enumValue(assignment.status, ASSIGNMENT_STATUSES, `${field}.status`),
        requiredCapabilities: stringArray(assignment.requiredCapabilities, `${field}.requiredCapabilities`, 100),
        requiredEvidenceClasses: stringArray(assignment.requiredEvidenceClasses, `${field}.requiredEvidenceClasses`, 100),
        promptVersion: nullableString(assignment.promptVersion, `${field}.promptVersion`, 160),
        cleanRoom: bool(assignment.cleanRoom, `${field}.cleanRoom`),
        controllerOwned: bool(assignment.controllerOwned, `${field}.controllerOwned`),
        instructionPhaseId: nullableString(assignment.instructionPhaseId, `${field}.instructionPhaseId`, 180),
        revision: nullableInteger(assignment.revision, `${field}.revision`),
        sourceRevision: nullableInteger(assignment.sourceRevision, `${field}.sourceRevision`),
        assignedWorkerId: nullableString(assignment.assignedWorkerId, `${field}.assignedWorkerId`, 200),
        leaseStartedAt: nullableString(assignment.leaseStartedAt, `${field}.leaseStartedAt`, 80),
        leaseExpiresAt: nullableString(assignment.leaseExpiresAt, `${field}.leaseExpiresAt`, 80),
        submission: normalizeSubmission(assignment.submission, `${field}.submission`),
        review: normalizeReview(assignment.review, `${field}.review`),
        reviewCount: nonNegativeInteger(assignment.reviewCount, `${field}.reviewCount`),
        invalidationCount: nonNegativeInteger(assignment.invalidationCount, `${field}.invalidationCount`),
        publishedAt: nullableString(assignment.publishedAt, `${field}.publishedAt`, 80),
      };
    }),
    instructionProofs: boundedArray(value.instructionProofs, 'instructionProofs', 500, (proof, field) => {
      object(proof, field);
      return {
        proofKey: requireString(proof.proofKey, `${field}.proofKey`, 800),
        skillReleaseIdentity: nullableString(proof.skillReleaseIdentity, `${field}.skillReleaseIdentity`, 200),
        actorType: nullableString(proof.actorType, `${field}.actorType`, 100),
        actorId: nullableString(proof.actorId, `${field}.actorId`, 200),
        sessionId: nullableString(proof.sessionId, `${field}.sessionId`, 200),
        roleId: nullableString(proof.roleId, `${field}.roleId`, 180),
        phaseId: nullableString(proof.phaseId, `${field}.phaseId`, 180),
        aggregateInstructionSetDigest: proof.aggregateInstructionSetDigest === null
          ? null
          : requireSha256(proof.aggregateInstructionSetDigest, `${field}.aggregateInstructionSetDigest`),
        acknowledgedAt: nullableString(proof.acknowledgedAt, `${field}.acknowledgedAt`, 80),
      };
    }),
    findings: boundedArray(value.findings, 'findings', 1000, (finding, field) => {
      object(finding, field);
      return {
        findingId: nullableString(finding.findingId, `${field}.findingId`, 200),
        title: nullableString(finding.title, `${field}.title`, 500),
        severity: nullableString(finding.severity, `${field}.severity`, 80),
        status: nullableString(finding.status, `${field}.status`, 120),
        phaseId: nullableString(finding.phaseId, `${field}.phaseId`, 180),
        assignmentId: nullableString(finding.assignmentId, `${field}.assignmentId`, 200),
        remediationStatus: nullableString(finding.remediationStatus, `${field}.remediationStatus`, 120),
      };
    }),
    remediation: value.remediation === null ? null : (() => {
      const remediation = object(value.remediation, 'remediation');
      return {
        status: nullableString(remediation.status, 'remediation.status', 120),
        unresolvedHighCriticalCount: nullableInteger(remediation.unresolvedHighCriticalCount, 'remediation.unresolvedHighCriticalCount'),
        reviewedAt: nullableString(remediation.reviewedAt, 'remediation.reviewedAt', 80),
      };
    })(),
    report: value.report === null ? null : (() => {
      const report = object(value.report, 'report');
      return {
        status: nullableString(report.status, 'report.status', 120),
        completionStatus: report.completionStatus === null ? null : enumValue(report.completionStatus, new Set(['COMPLETE']), 'report.completionStatus'),
        securityVerdict: report.securityVerdict === null ? null : enumValue(report.securityVerdict, new Set(['PASS', 'NO_GO']), 'report.securityVerdict'),
        findingCount: nullableInteger(report.findingCount, 'report.findingCount'),
        limitationCount: nullableInteger(report.limitationCount, 'report.limitationCount'),
        evidenceCount: nullableInteger(report.evidenceCount, 'report.evidenceCount'),
        exactReleaseCommit: nullableSha(report.exactReleaseCommit, 'report.exactReleaseCommit'),
      };
    })(),
    publication: {
      status: nullableString(object(value.publication, 'publication').status, 'publication.status', 120),
    },
    userDelivery: {
      status: nullableString(object(value.userDelivery, 'userDelivery').status, 'userDelivery.status', 120),
    },
    events: boundedArray(value.events, 'events', 5000, (event, field) => {
      object(event, field);
      const actor = event.actor === null ? null : object(event.actor, `${field}.actor`);
      return {
        sequence: nullableInteger(event.sequence, `${field}.sequence`),
        hash: event.hash === null ? null : requireSha256(event.hash, `${field}.hash`),
        previousHash: event.previousHash === null ? null : requireSha256(event.previousHash, `${field}.previousHash`),
        commandId: nullableString(event.commandId, `${field}.commandId`, 240),
        type: nullableString(event.type, `${field}.type`, 180),
        actor: actor === null ? null : {
          type: nullableString(actor.type, `${field}.actor.type`, 100),
          id: nullableString(actor.id, `${field}.actor.id`, 200),
        },
        timestamp: nullableString(event.timestamp, `${field}.timestamp`, 80),
      };
    }),
  };

  return Object.freeze(projection);
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

function encodeRepositoryPath(path) {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

async function readGithubJson(path, ref, env) {
  const fetcher = typeof env.AUDIT_CONTROLLER_FETCH === 'function'
    ? env.AUDIT_CONTROLLER_FETCH
    : globalThis.fetch;
  if (typeof fetcher !== 'function') throw new TypeError('fetch is unavailable');

  const url = `https://api.github.com/repos/${CONTROLLER_OWNER}/${CONTROLLER_NAME}/contents/${encodeRepositoryPath(path)}?ref=${encodeURIComponent(ref)}`;
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

      const pointerResult = await readGithubJson(`.deep-assurance/active/${projectSlug}.json`, CONTROLLER_REF, env);
      if (pointerResult.kind === 'not_found') {
        return error(env, 'controller_project_not_found', 'No audit controller project pointer exists', 404);
      }
      if (pointerResult.kind !== 'ok') {
        return error(
          env,
          'controller_upstream_unavailable',
          'The audit controller could not be read safely',
          502,
        );
      }

      try {
        const project = normalizePointer(pointerResult.value, projectSlug);
        if (project.status === 'NO_ACTIVE_CAMPAIGN') {
          return json({ ...compatibility(), project, campaign: null }, env);
        }

        const projectionResult = await readGithubJson(project.projectionPath, project.controllerBranch, env);
        if (projectionResult.kind !== 'ok') {
          return error(
            env,
            'controller_upstream_unavailable',
            'The audit controller could not be read safely',
            502,
          );
        }
        const campaign = normalizeHostedProjectionV1(projectionResult.value, project);
        return json({ ...compatibility(), project, campaign }, env);
      } catch {
        return error(
          env,
          'controller_pointer_incompatible',
          'The audit controller pointer or hosted projection is incompatible with this browser release',
          409,
        );
      }
    }
  }

  return error(env, 'not_found', 'Controller route not found', 404);
}
