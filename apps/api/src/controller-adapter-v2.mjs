import {
  TIER3_CONTROLLER_ADAPTER_VERSION_V2,
  TIER3_CONTROLLER_COMPATIBILITY_V2,
} from '../../../packages/protocol/src/tier3-controller-v3.mjs';

const CONTROLLER_OWNER = 'CurveYield';
const CONTROLLER_NAME = 'audit-controller';
const CONTROLLER_REF = 'main';
const MAX_GITHUB_BYTES = 512 * 1024;
const PROJECT_SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const FULL_SHA = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;

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
  return typeof env.CLIENT_API_KEY === 'string'
    && env.CLIENT_API_KEY.length > 0
    && secureEqual(bearer(request), env.CLIENT_API_KEY);
}

function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function string(value, field, maximum = 512) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    throw new TypeError(`${field} must be a bounded non-empty string`);
  }
  return value;
}

function optionalString(value, field, maximum = 512) {
  if (value === null || value === undefined) return null;
  return string(value, field, maximum);
}

function sha(value, field) {
  if (typeof value !== 'string' || !FULL_SHA.test(value)) throw new TypeError(`${field} must be a full git SHA`);
  return value;
}

function sha256(value, field) {
  if (typeof value !== 'string' || !SHA256.test(value)) throw new TypeError(`${field} must be a SHA-256 digest`);
  return value;
}

function bool(value, field) {
  if (typeof value !== 'boolean') throw new TypeError(`${field} must be boolean`);
  return value;
}

function integer(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${field} must be a non-negative integer`);
  return value;
}

function compatibility() {
  return {
    adapterVersion: TIER3_CONTROLLER_ADAPTER_VERSION_V2,
    controller: {
      ...TIER3_CONTROLLER_COMPATIBILITY_V2.controller,
      ref: CONTROLLER_REF,
    },
    automation: { ...TIER3_CONTROLLER_COMPATIBILITY_V2.automation },
    networkScope: {
      chains: [...TIER3_CONTROLLER_COMPATIBILITY_V2.networkScope.chains],
      defaultChain: TIER3_CONTROLLER_COMPATIBILITY_V2.networkScope.defaultChain,
    },
  };
}

export function controllerSetupReadinessV2(env) {
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

function decodeBase64Utf8(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_GITHUB_BYTES * 2) {
    throw new TypeError('GitHub content field is invalid');
  }
  const binary = atob(value.replace(/\s+/g, ''));
  if (binary.length > MAX_GITHUB_BYTES) throw new TypeError('GitHub content is too large');
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function encodePath(value) {
  return value.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

async function readGithubJson(path, env) {
  const fetcher = typeof env.AUDIT_CONTROLLER_FETCH === 'function' ? env.AUDIT_CONTROLLER_FETCH : globalThis.fetch;
  if (typeof fetcher !== 'function') throw new TypeError('fetch is unavailable');
  const url = `https://api.github.com/repos/${CONTROLLER_OWNER}/${CONTROLLER_NAME}/contents/${encodePath(path)}?ref=${CONTROLLER_REF}`;
  const response = await fetcher(url, {
    method: 'GET',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${env.AUDIT_CONTROLLER_GITHUB_TOKEN}`,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'CurveYield-Preflight-Tier3-Controller-Adapter-v2',
    },
  });
  if (response.status === 404) return { kind: 'not_found' };
  if (!response.ok) return { kind: 'upstream_error' };
  try {
    const envelope = await response.json();
    if (envelope?.encoding !== 'base64') throw new TypeError('unsupported encoding');
    return { kind: 'ok', value: JSON.parse(decodeBase64Utf8(envelope.content)) };
  } catch {
    return { kind: 'invalid_content' };
  }
}

function safeReceiptPath(value) {
  string(value, 'controllerCampaignCreateReceipt', 400);
  if (!value.startsWith('campaigns/')
      || !value.endsWith('/control/CONTROLLER_CAMPAIGN_CREATE_RECEIPT-v1.json')
      || value.includes('..')
      || value.includes('\\')
      || value.includes('//')) {
    throw new TypeError('controllerCampaignCreateReceipt is unsafe');
  }
  return value;
}

function workspaceFromReceipt(receiptPath) {
  return receiptPath.slice(0, -'control/CONTROLLER_CAMPAIGN_CREATE_RECEIPT-v1.json'.length);
}

function normalizeTombstone(pointer, projectSlug) {
  if (pointer.schemaVersion !== 'deep-assurance-active-pointer-tombstone-v1'
      || pointer.projectSlug !== projectSlug
      || pointer.status !== 'NO_ACTIVE_CAMPAIGN'
      || pointer.launchAuthorized !== false
      || pointer.allPriorGenerationsAdmissible !== false) {
    throw new TypeError('invalid no-active-campaign pointer');
  }
  return {
    projectSlug,
    status: 'NO_ACTIVE_CAMPAIGN',
    reason: string(pointer.reason, 'pointer.reason', 180),
    launchAuthorized: false,
    scrubCommit: sha(pointer.scrubCommit, 'pointer.scrubCommit'),
    commandRouting: { available: true, reason: 'CAMPAIGN_CREATE_ONLY' },
  };
}

function normalizeActivePointer(pointer, projectSlug) {
  if (pointer.schemaVersion !== 'deep-assurance-active-pointer-v2'
      || pointer.projectSlug !== projectSlug
      || pointer.status !== 'ACTIVE') {
    throw new TypeError('unsupported active pointer');
  }
  const campaignId = string(pointer.campaignId, 'pointer.campaignId', 220);
  const campaignGenerationId = string(pointer.campaignGenerationId, 'pointer.campaignGenerationId', 220);
  const phaseSequence = integer(pointer.phaseSequence, 'pointer.phaseSequence');
  const launchAuthorized = bool(pointer.launchAuthorized, 'pointer.launchAuthorized');
  const sourceRepository = string(pointer.sourceRepository, 'pointer.sourceRepository', 220);
  const sourceCommit = sha(pointer.sourceCommit, 'pointer.sourceCommit');
  const sourceArchiveSha256 = sha256(pointer.sourceArchiveSha256, 'pointer.sourceArchiveSha256');
  const receiptPath = safeReceiptPath(pointer.controllerCampaignCreateReceipt);
  const requiredSkillPackageVersion = string(pointer.requiredSkillPackageVersion, 'pointer.requiredSkillPackageVersion', 80);
  const requiredEmbeddedReleaseIdentity = string(pointer.requiredEmbeddedReleaseIdentity, 'pointer.requiredEmbeddedReleaseIdentity', 220);
  if (requiredSkillPackageVersion !== '16.14.0'
      || requiredEmbeddedReleaseIdentity !== TIER3_CONTROLLER_COMPATIBILITY_V2.controller.instructionReleaseIdentity) {
    throw new TypeError('active pointer skill release is incompatible');
  }
  return {
    projectSlug,
    status: 'ACTIVE',
    campaignId,
    campaignGenerationId,
    phaseSequence,
    launchAuthorized,
    sourceRepository,
    sourceCommit,
    sourceArchiveSha256,
    controllerCampaignCreateReceipt: receiptPath,
    workspacePath: workspaceFromReceipt(receiptPath),
    requiredSkillPackageVersion,
    skillReleaseIdentity: requiredEmbeddedReleaseIdentity,
  };
}

function normalizeReceipt(value, pointer) {
  object(value, 'campaign create receipt');
  if (value.schemaVersion !== 'controller-campaign-create-receipt-v1'
      || value.campaignId !== pointer.campaignId
      || value.campaignGenerationId !== pointer.campaignGenerationId) {
    throw new TypeError('campaign create receipt binding mismatch');
  }
  const controllerCommit = sha(value.controllerCommit, 'receipt.controllerCommit');
  if (controllerCommit !== TIER3_CONTROLLER_COMPATIBILITY_V2.controller.compatibilityCommit) {
    throw new TypeError('controller release mismatch');
  }
  const preflight = object(value.preflight, 'receipt.preflight');
  if (preflight.status !== 'READY') throw new TypeError('controller preflight is not READY');
  const capabilities = object(preflight.capabilities, 'receipt.preflight.capabilities');
  for (const required of [
    'github-mailbox-v1',
    'browser-agent-review-v1',
    'github-native-compile-v1',
    'github-native-simulate-v1',
    'artifact-evidence-validation-v1',
    'exact-release-verification-v1',
  ]) {
    if (capabilities[required] !== true) throw new TypeError(`required capability ${required} is not READY`);
  }
  const source = object(value.source, 'receipt.source');
  if (source.repository !== pointer.sourceRepository || source.commit !== pointer.sourceCommit) {
    throw new TypeError('campaign create receipt source mismatch');
  }
  if (sha256(value.sourceArchiveSha256, 'receipt.sourceArchiveSha256') !== pointer.sourceArchiveSha256) {
    throw new TypeError('campaign archive digest mismatch');
  }
  if (value.stateStatus !== 'ACTIVE') throw new TypeError('campaign receipt state is not ACTIVE');
  return {
    controllerCommit,
    reducerSchemaVersion: integer(value.reducerSchemaVersion, 'receipt.reducerSchemaVersion'),
    preflight: {
      status: 'READY',
      capabilities: Object.fromEntries(Object.entries(capabilities)
        .filter(([key, ready]) => typeof key === 'string' && typeof ready === 'boolean')
        .sort(([left], [right]) => left.localeCompare(right))),
    },
    instructionProof: {
      proofKey: string(value.instructionProofKey, 'receipt.instructionProofKey', 800),
      skillReleaseIdentity: pointer.skillReleaseIdentity,
      actorType: 'controller',
      actorId: 'phase-0-orchestrator',
      sessionId: null,
      roleId: 'orchestrator',
      phaseId: 'phase-0',
      aggregateInstructionSetDigest: sha256(value.instructionProofAggregateDigest, 'receipt.instructionProofAggregateDigest'),
      acknowledgedAt: optionalString(value.createdAt, 'receipt.createdAt', 80),
    },
    createEvent: {
      sequence: null,
      hash: sha256(value.campaignCreatedEventHash, 'receipt.campaignCreatedEventHash'),
      previousHash: null,
      commandId: string(value.campaignCreateCommandId, 'receipt.campaignCreateCommandId', 240),
      type: 'campaign.created',
      actor: { type: 'controller', id: 'phase-0-orchestrator' },
      timestamp: optionalString(value.createdAt, 'receipt.createdAt', 80),
    },
    activateEvent: {
      sequence: null,
      hash: sha256(value.campaignActivatedEventHash, 'receipt.campaignActivatedEventHash'),
      previousHash: sha256(value.campaignCreatedEventHash, 'receipt.campaignCreatedEventHash'),
      commandId: string(value.campaignActivateCommandId, 'receipt.campaignActivateCommandId', 240),
      type: 'campaign.activated',
      actor: { type: 'controller', id: 'phase-0-orchestrator' },
      timestamp: optionalString(value.activatedAt, 'receipt.activatedAt', 80),
    },
    createdAt: optionalString(value.createdAt, 'receipt.createdAt', 80),
    activatedAt: optionalString(value.activatedAt, 'receipt.activatedAt', 80),
  };
}

function normalizeTopology(value, pointer, receipt) {
  object(value, 'controller topology');
  if (value.schemaVersion !== 'deep-assurance-controller-topology-v1'
      || value.campaignId !== pointer.campaignId
      || value.campaignGenerationId !== pointer.campaignGenerationId
      || value.controllerRepository !== TIER3_CONTROLLER_COMPATIBILITY_V2.controller.repository
      || value.controllerCommit !== receipt.controllerCommit
      || value.campaignCreateReceipt !== pointer.controllerCampaignCreateReceipt) {
    throw new TypeError('controller topology binding mismatch');
  }
  if (value.requiredGateCount !== 10 || value.requiredLaneCount !== 7) {
    throw new TypeError('controller topology count mismatch');
  }
  if (!Array.isArray(value.gates) || value.gates.length !== 10 || !Array.isArray(value.lanes) || value.lanes.length !== 7) {
    throw new TypeError('controller topology arrays are incomplete');
  }
  const gates = value.gates.map((gate, index) => {
    object(gate, `topology.gates[${index}]`);
    const gateId = string(gate.gateId, `topology.gates[${index}].gateId`, 180);
    const phaseId = string(gate.phaseId, `topology.gates[${index}].phaseId`, 180);
    return { gateId, phaseId, title: phaseId, mandatory: true, status: 'PENDING', evidenceRefCount: 0, recordedAt: null };
  });
  const lanes = value.lanes.map((lane, index) => {
    object(lane, `topology.lanes[${index}]`);
    return {
      roleId: string(lane.roleId, `topology.lanes[${index}].roleId`, 180),
      cleanRoom: bool(lane.cleanRoom, `topology.lanes[${index}].cleanRoom`),
      controllerOwned: bool(lane.controllerOwned, `topology.lanes[${index}].controllerOwned`),
    };
  });
  return {
    gates,
    lanes,
    assignmentClaimsAuthorized: bool(value.assignmentClaimsAuthorized, 'topology.assignmentClaimsAuthorized'),
    substantiveWorkAuthorized: bool(value.substantiveWorkAuthorized, 'topology.substantiveWorkAuthorized'),
  };
}

function normalizeAssignments(value, pointer, topology) {
  object(value, 'assignment plan');
  if (value.schemaVersion !== 'deep-assurance-assignment-plan-v1'
      || value.campaignId !== pointer.campaignId
      || value.campaignGenerationId !== pointer.campaignGenerationId) {
    throw new TypeError('assignment plan binding mismatch');
  }
  const status = string(value.status, 'assignmentPlan.status', 120);
  const claimAuthorized = bool(value.claimAuthorized, 'assignmentPlan.claimAuthorized');
  const sourceAccessAuthorized = bool(value.sourceAccessAuthorized, 'assignmentPlan.sourceAccessAuthorized');
  if (!Array.isArray(value.assignments) || value.assignments.length !== 7) throw new TypeError('assignment plan must contain seven assignments');
  const roleSet = new Set(topology.lanes.map((lane) => lane.roleId));
  const assignments = value.assignments.map((assignment, index) => {
    object(assignment, `assignments[${index}]`);
    const roleId = string(assignment.roleId, `assignments[${index}].roleId`, 180);
    if (!roleSet.has(roleId)) throw new TypeError('assignment role is outside controller topology');
    return {
      assignmentId: string(assignment.assignmentId, `assignments[${index}].assignmentId`, 220),
      roleId,
      title: roleId,
      mandatory: true,
      status,
      requiredCapabilities: [],
      requiredEvidenceClasses: [],
      promptVersion: null,
      cleanRoom: bool(assignment.cleanRoom, `assignments[${index}].cleanRoom`),
      controllerOwned: bool(assignment.controllerOwned, `assignments[${index}].controllerOwned`),
      instructionPhaseId: string(assignment.initialPhaseId, `assignments[${index}].initialPhaseId`, 180),
      revision: null,
      sourceRevision: 0,
      assignedWorkerId: null,
      leaseStartedAt: null,
      leaseExpiresAt: null,
      submission: null,
      review: null,
      reviewCount: 0,
      invalidationCount: 0,
      publishedAt: null,
    };
  });
  return { status, claimAuthorized, sourceAccessAuthorized, assignments };
}

function normalizeFailover(value, pointer) {
  object(value, 'failover state');
  if (value.schemaVersion !== 'orchestrator-failover-state-v1'
      || value.campaignId !== pointer.campaignId
      || value.campaignGenerationId !== pointer.campaignGenerationId) {
    throw new TypeError('failover state binding mismatch');
  }
  return {
    status: string(value.status, 'failover.status', 120),
    primaryTaskEnabled: bool(value.primaryTaskEnabled, 'failover.primaryTaskEnabled'),
  };
}

function normalizeLease(value, pointer, receipt) {
  object(value, 'orchestrator lease');
  if (value.schemaVersion !== 'orchestrator-lease-v1'
      || value.campaignId !== pointer.campaignId
      || value.campaignGenerationId !== pointer.campaignGenerationId
      || value.controlCommit !== receipt.controllerCommit) {
    throw new TypeError('orchestrator lease binding mismatch');
  }
  return {
    authorityState: string(value.authorityState, 'lease.authorityState', 120),
    primaryPollEnabledVerified: bool(value.primaryPollEnabledVerified, 'lease.primaryPollEnabledVerified'),
  };
}

function buildProjection(pointer, receipt, topology, assignments, failover, lease) {
  return {
    schemaVersion: 'controller-operator-state-v2',
    compatibility: {
      controllerCommit: receipt.controllerCommit,
      controllerRelease: TIER3_CONTROLLER_COMPATIBILITY_V2.controller.releaseIdentity,
      skillReleaseIdentity: pointer.skillReleaseIdentity,
      automationRelease: TIER3_CONTROLLER_COMPATIBILITY_V2.automation.releaseIdentity,
    },
    campaign: {
      campaignId: pointer.campaignId,
      processId: 'deep-assurance-v6',
      title: pointer.projectSlug,
      status: 'ACTIVE',
      launchAuthorized: pointer.launchAuthorized,
      phaseSequence: pointer.phaseSequence,
      completionStatus: null,
      securityVerdict: null,
      terminalReason: null,
      source: {
        repository: pointer.sourceRepository,
        commit: pointer.sourceCommit,
        revision: 0,
        archiveSha256: pointer.sourceArchiveSha256,
      },
      preflight: receipt.preflight,
      instructionPolicyRequired: true,
      createdAt: receipt.createdAt,
      updatedAt: receipt.activatedAt,
    },
    topology: {
      gateIds: topology.gates.map((gate) => gate.gateId),
      laneRoleIds: topology.lanes.map((lane) => lane.roleId),
    },
    gates: topology.gates,
    workers: [],
    assignments: assignments.assignments,
    instructionProofs: [receipt.instructionProof],
    findings: [],
    remediation: null,
    report: null,
    publication: { status: 'PENDING' },
    userDelivery: { status: 'PENDING' },
    events: [receipt.createEvent, receipt.activateEvent],
    controlPlane: {
      bootstrapStatus: assignments.status,
      launchAuthorized: pointer.launchAuthorized,
      claimAuthorized: assignments.claimAuthorized,
      sourceAccessAuthorized: assignments.sourceAccessAuthorized,
      assignmentClaimsAuthorized: topology.assignmentClaimsAuthorized,
      substantiveWorkAuthorized: topology.substantiveWorkAuthorized,
      failoverStatus: failover.status,
      authorityState: lease.authorityState,
      primaryPollEnabledVerified: lease.primaryPollEnabledVerified,
      primaryTaskEnabled: failover.primaryTaskEnabled,
      requiredSkillPackageVersion: pointer.requiredSkillPackageVersion,
    },
  };
}

function extractProjectSlug(pathname) {
  const prefix = '/api/v1/controller/projects/';
  if (!pathname.startsWith(prefix)) return null;
  const encoded = pathname.slice(prefix.length);
  if (!encoded || encoded.includes('/')) return '';
  try { return decodeURIComponent(encoded); } catch { return ''; }
}

export async function handleControllerRouteV2(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/v1/controller/')) return null;
  if (request.method === 'OPTIONS') return json({ ok: true }, env);
  if (!await browserAuthorized(request, env)) {
    return error(env, 'unauthorized', 'Valid browser client authentication is required', 401);
  }
  if (request.method === 'GET' && url.pathname === '/api/v1/controller/compatibility') {
    return json({ status: controllerSetupReadinessV2(env).status, ...compatibility() }, env);
  }
  if (request.method !== 'GET') return error(env, 'not_found', 'Controller route not found', 404);

  const projectSlug = extractProjectSlug(url.pathname);
  if (projectSlug === null) return error(env, 'not_found', 'Controller route not found', 404);
  if (!PROJECT_SLUG.test(projectSlug)) return error(env, 'invalid_project_slug', 'The controller project slug is invalid', 400);
  if (typeof env.AUDIT_CONTROLLER_GITHUB_TOKEN !== 'string' || env.AUDIT_CONTROLLER_GITHUB_TOKEN.length === 0) {
    return error(env, 'controller_configuration_required', 'The audit controller GitHub connection is not configured', 503);
  }

  const pointerResult = await readGithubJson(`.deep-assurance/active/${projectSlug}.json`, env);
  if (pointerResult.kind === 'not_found') return error(env, 'controller_project_not_found', 'No audit controller project pointer exists', 404);
  if (pointerResult.kind !== 'ok') return error(env, 'controller_upstream_unavailable', 'The audit controller could not be read safely', 502);

  try {
    const rawPointer = object(pointerResult.value, 'active pointer');
    if (rawPointer.schemaVersion === 'deep-assurance-active-pointer-tombstone-v1') {
      const project = normalizeTombstone(rawPointer, projectSlug);
      return json({ ...compatibility(), project, campaign: null }, env);
    }

    const pointer = normalizeActivePointer(rawPointer, projectSlug);
    const [receiptResult, topologyResult, assignmentResult, failoverResult, leaseResult] = await Promise.all([
      readGithubJson(pointer.controllerCampaignCreateReceipt, env),
      readGithubJson(`${pointer.workspacePath}control/CONTROLLER_TOPOLOGY-v1.json`, env),
      readGithubJson(`${pointer.workspacePath}control/ASSIGNMENT_PLAN-v1.json`, env),
      readGithubJson(`${pointer.workspacePath}control/FAILOVER_STATE-v1.json`, env),
      readGithubJson(`${pointer.workspacePath}control/ORCHESTRATOR_LEASE-v1.json`, env),
    ]);
    if ([receiptResult, topologyResult, assignmentResult, failoverResult, leaseResult].some((result) => result.kind !== 'ok')) {
      return error(env, 'controller_upstream_unavailable', 'The audit controller could not be read safely', 502);
    }
    const receipt = normalizeReceipt(receiptResult.value, pointer);
    const topology = normalizeTopology(topologyResult.value, pointer, receipt);
    const assignments = normalizeAssignments(assignmentResult.value, pointer, topology);
    const failover = normalizeFailover(failoverResult.value, pointer);
    const lease = normalizeLease(leaseResult.value, pointer, receipt);
    const reason = pointer.launchAuthorized ? 'MAILBOX_UNPUBLISHED' : 'PHASE0_BOOTSTRAP_FENCED';
    const project = {
      projectSlug,
      status: 'ACTIVE',
      campaignId: pointer.campaignId,
      campaignGenerationId: pointer.campaignGenerationId,
      phaseSequence: pointer.phaseSequence,
      launchAuthorized: pointer.launchAuthorized,
      workspacePath: pointer.workspacePath,
      controllerCommit: receipt.controllerCommit,
      skillReleaseIdentity: pointer.skillReleaseIdentity,
      sourceRepository: pointer.sourceRepository,
      sourceCommit: pointer.sourceCommit,
      commandRouting: { available: false, reason },
    };
    return json({ ...compatibility(), project, campaign: buildProjection(pointer, receipt, topology, assignments, failover, lease) }, env);
  } catch {
    return error(env, 'controller_pointer_incompatible', 'The audit controller pointer or control-plane records are incompatible with this browser release', 409);
  }
}
