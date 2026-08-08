export const TIER3_CONTROLLER_ADAPTER_VERSION_V2 = 'tier3-controller-adapter-v2';
export const TIER3_CONTROLLER_RELEASE_V2 = 'ai-auditor-deep-assurance-v6@16.13.0';
export const TIER3_ACTIVE_NETWORKS_V2 = Object.freeze(['ethereum', 'base']);
export const TIER3_DEFAULT_NETWORK_V2 = 'base';

const FULL_SHA = /^[0-9a-f]{40}$/;
const COMPLETION = new Set([null, 'COMPLETE']);
const VERDICTS = new Set([null, 'PASS', 'NO_GO']);

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${name} must be a non-empty string`);
  return value;
}

function array(value, name) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  return value;
}

function exactSha(value, name) {
  if (!FULL_SHA.test(String(value ?? ''))) throw new TypeError(`${name} must be an exact lowercase 40-character git SHA`);
  return value;
}

function normalizeEntries(value, name, required = ['id', 'status']) {
  return array(value, name).map((entry, index) => {
    object(entry, `${name}[${index}]`);
    for (const key of required) text(entry[key], `${name}[${index}].${key}`);
    return structuredClone(entry);
  });
}

export function assertControllerCompatibilityV2(value) {
  object(value, 'projection');
  if (value.adapterVersion !== TIER3_CONTROLLER_ADAPTER_VERSION_V2) throw new TypeError('adapterVersion is not supported');
  if (value.controllerRelease !== TIER3_CONTROLLER_RELEASE_V2) throw new TypeError('controllerRelease is not compatible with Tier 3 v2');
  exactSha(value.controllerProtocolSha, 'controllerProtocolSha');
  exactSha(value.automationRelease, 'automationRelease');
  object(value.networkScope, 'networkScope');
  const active = array(value.networkScope.active, 'networkScope.active');
  if (active.length !== 2 || active[0] !== 'ethereum' || active[1] !== 'base' || value.networkScope.default !== 'base') {
    throw new TypeError('network scope must be exactly Ethereum and Base with Base default');
  }
  return true;
}

export function normalizeControllerProjectionV2(value) {
  assertControllerCompatibilityV2(value);
  const campaign = object(value.campaign, 'campaign');
  text(campaign.id, 'campaign.id');
  text(campaign.status, 'campaign.status');
  const completionStatus = campaign.completionStatus ?? null;
  const securityVerdict = campaign.securityVerdict ?? null;
  if (!COMPLETION.has(completionStatus)) throw new TypeError('campaign.completionStatus is invalid');
  if (!VERDICTS.has(securityVerdict)) throw new TypeError('campaign.securityVerdict is invalid');
  if (completionStatus !== 'COMPLETE' && securityVerdict !== null) throw new TypeError('security verdict is forbidden until completionStatus is COMPLETE');

  const report = object(value.report, 'report');
  if (typeof report.complete !== 'boolean') throw new TypeError('report.complete must be boolean');
  if (report.complete !== (completionStatus === 'COMPLETE')) throw new TypeError('report.complete must match campaign completion status');
  if (report.exactRelease !== null && report.exactRelease !== undefined) text(report.exactRelease, 'report.exactRelease');

  const instructionProofs = array(value.instructionProofs, 'instructionProofs').map((proof, index) => {
    object(proof, `instructionProofs[${index}]`);
    for (const key of ['actorId', 'sessionId', 'roleId', 'phaseId', 'status']) text(proof[key], `instructionProofs[${index}].${key}`);
    return structuredClone(proof);
  });

  return {
    adapterVersion: value.adapterVersion,
    controllerRelease: value.controllerRelease,
    controllerProtocolSha: value.controllerProtocolSha,
    automationRelease: value.automationRelease,
    networkScope: { active: [...TIER3_ACTIVE_NETWORKS_V2], default: TIER3_DEFAULT_NETWORK_V2 },
    campaign: { ...structuredClone(campaign), completionStatus, securityVerdict },
    phases: normalizeEntries(value.phases, 'phases'),
    lanes: normalizeEntries(value.lanes, 'lanes'),
    instructionProofs,
    findings: normalizeEntries(value.findings, 'findings', ['id', 'severity', 'status']),
    remediation: array(value.remediation, 'remediation').map((entry) => structuredClone(object(entry, 'remediation entry'))),
    evidence: array(value.evidence, 'evidence').map((entry) => structuredClone(object(entry, 'evidence entry'))),
    report: structuredClone(report)
  };
}
