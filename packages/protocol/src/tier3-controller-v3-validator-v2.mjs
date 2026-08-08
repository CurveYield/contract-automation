export const TIER3_CONTROLLER_ADAPTER_VERSION_V3 = 'tier3-controller-adapter-v3';
export const TIER3_CONTROLLER_RELEASE_V3 = 'ai-auditor-deep-assurance-v6@16.13.0';
export const TIER3_ACTIVE_NETWORKS_V3 = Object.freeze(['ethereum', 'base']);
export const TIER3_DEFAULT_NETWORK_V3 = 'base';

const GIT_SHA = /^[0-9a-f]{40}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const COMPLETION = new Set([null, 'COMPLETE']);
const VERDICTS = new Set([null, 'PASS', 'NO_GO']);

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}
function array(value, name) { if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`); return value; }
function text(value, name) { if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${name} must be a non-empty string`); return value; }
function gitSha(value, name) { if (!GIT_SHA.test(String(value ?? ''))) throw new TypeError(`${name} must be an exact lowercase 40-character git SHA`); return value; }
function eventHash(value, name) { if (!SHA256_HEX.test(String(value ?? ''))) throw new TypeError(`${name} must be an exact lowercase 64-character SHA-256 hash`); return value; }
function cloneEntries(value, name) { return array(value, name).map((entry, index) => structuredClone(object(entry, `${name}[${index}]`))); }

export function normalizeControllerProjectionV3(value) {
  object(value, 'projection');
  if (value.adapterVersion !== TIER3_CONTROLLER_ADAPTER_VERSION_V3) throw new TypeError('adapterVersion is not supported');
  if (value.controllerRelease !== TIER3_CONTROLLER_RELEASE_V3) throw new TypeError('controllerRelease is not compatible with Tier 3 v3');
  gitSha(value.controllerProtocolSha, 'controllerProtocolSha');
  gitSha(value.automationRelease, 'automationRelease');

  const networkScope = object(value.networkScope, 'networkScope');
  const active = array(networkScope.active, 'networkScope.active');
  if (active.length !== 2 || active[0] !== 'ethereum' || active[1] !== 'base' || networkScope.default !== 'base') throw new TypeError('network scope must be exactly Ethereum and Base with Base default');

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

  const provenance = object(value.provenance, 'provenance');
  if (!Number.isSafeInteger(provenance.eventCount) || provenance.eventCount < 0) throw new TypeError('provenance.eventCount must be a non-negative integer');
  if (provenance.eventHead !== null && provenance.eventHead !== undefined) eventHash(provenance.eventHead, 'provenance.eventHead');
  const recentEvents = cloneEntries(provenance.recentEvents, 'provenance.recentEvents');
  if (recentEvents.length > 100) throw new TypeError('provenance.recentEvents exceeds bounded maximum');
  for (let index = 0; index < recentEvents.length; index += 1) {
    const event = recentEvents[index];
    if (event.hash !== null && event.hash !== undefined) eventHash(event.hash, `provenance.recentEvents[${index}].hash`);
    if (event.previousHash !== null && event.previousHash !== undefined) eventHash(event.previousHash, `provenance.recentEvents[${index}].previousHash`);
  }

  const instructionProofs = cloneEntries(value.instructionProofs, 'instructionProofs');
  for (let index = 0; index < instructionProofs.length; index += 1) {
    for (const key of ['actorId', 'sessionId', 'roleId', 'phaseId', 'status']) text(instructionProofs[index][key], `instructionProofs[${index}].${key}`);
  }

  return {
    adapterVersion: value.adapterVersion,
    controllerRelease: value.controllerRelease,
    controllerProtocolSha: value.controllerProtocolSha,
    automationRelease: value.automationRelease,
    networkScope: { active: [...TIER3_ACTIVE_NETWORKS_V3], default: TIER3_DEFAULT_NETWORK_V3 },
    campaign: { ...structuredClone(campaign), completionStatus, securityVerdict },
    phases: cloneEntries(value.phases, 'phases'), lanes: cloneEntries(value.lanes, 'lanes'), workers: cloneEntries(value.workers, 'workers'), assignments: cloneEntries(value.assignments, 'assignments'),
    instructionProofs, findings: cloneEntries(value.findings, 'findings'), remediation: cloneEntries(value.remediation, 'remediation'), evidence: cloneEntries(value.evidence, 'evidence'),
    provenance: { eventCount: provenance.eventCount, eventHead: provenance.eventHead ?? null, recentEvents }, report: structuredClone(report)
  };
}
