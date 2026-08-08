const CONTROLLER_COMMIT = 'd4851886ece3e8793dcc2a99f97f6d34da10e1cd';
const CONTROLLER_RELEASE = 'audit-controller@hosted-tier3-v1';
const SKILL_RELEASE = 'ai-auditor-deep-assurance-v6@16.13.0';
const AUTOMATION_RELEASE = 'contract-automation@round5-tier3-v1';

function shortSha(value) {
  return typeof value === 'string' && value.length >= 12 ? value.slice(0, 12) : String(value ?? '—');
}

function countBy(values, key) {
  const counts = new Map();
  for (const value of values ?? []) {
    const name = value?.[key] ?? 'UNKNOWN';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

function countText(counts, order = []) {
  const keys = [
    ...order.filter((key) => counts.has(key)),
    ...[...counts.keys()].filter((key) => !order.includes(key)).sort(),
  ];
  return keys.map((key) => `${counts.get(key)} ${key}`).join(' · ');
}

export function assertTier3BrowserCompatibilityV1(value) {
  if (!value || typeof value !== 'object') throw new TypeError('Controller compatibility response is missing.');
  if (value.adapterVersion !== 'tier3-controller-adapter-v1') {
    throw new TypeError('This browser release is incompatible with the controller adapter.');
  }
  if (value.controller?.repository !== 'CurveYield/audit-controller'
      || value.controller?.compatibilityCommit !== CONTROLLER_COMMIT
      || value.controller?.releaseIdentity !== CONTROLLER_RELEASE
      || value.controller?.processId !== 'deep-assurance-v6'
      || value.controller?.instructionReleaseIdentity !== SKILL_RELEASE) {
    throw new TypeError('Controller release identity is incompatible with this browser release.');
  }
  if (value.automation?.repository !== 'CurveYield/contract-automation'
      || value.automation?.releaseIdentity !== AUTOMATION_RELEASE) {
    throw new TypeError('Contract-automation release identity is incompatible with this browser release.');
  }
  const chains = value.networkScope?.chains;
  if (!Array.isArray(chains)
      || chains.length !== 2
      || chains[0] !== 'ethereum'
      || chains[1] !== 'base'
      || value.networkScope?.defaultChain !== 'base') {
    throw new TypeError('Controller network scope does not match the accepted Ethereum/Base release.');
  }
  return value;
}

function noActiveView(value) {
  const project = value.project;
  const message = 'Not applicable — no active campaign is authorized.';
  return {
    stateMessage: `No active campaign for ${project.projectSlug}: ${project.reason}.`,
    controllerRelease: `${value.controller.repository} @ ${shortSha(value.controller.compatibilityCommit)}`,
    instructionRelease: value.controller.instructionReleaseIdentity,
    activeCampaign: 'No active campaign',
    campaignSource: '—',
    phaseSummary: message,
    laneSummary: message,
    instructionProofSummary: message,
    assignmentSummary: message,
    findingSummary: message,
    remediationSummary: message,
    evidenceSummary: message,
    finalizationSummary: message,
  };
}

function activeView(value) {
  const projection = value.campaign;
  if (!projection || projection.schemaVersion !== 'hosted-operator-state-v1') {
    throw new TypeError('Active controller pointer has no compatible hosted projection.');
  }
  if (projection.compatibility?.controllerCommit !== value.controller.compatibilityCommit
      || projection.compatibility?.controllerRelease !== value.controller.releaseIdentity
      || projection.compatibility?.skillReleaseIdentity !== value.controller.instructionReleaseIdentity
      || projection.compatibility?.automationRelease !== value.automation.releaseIdentity) {
    throw new TypeError('Hosted projection release binding is incompatible.');
  }
  const campaign = projection.campaign;
  if (campaign?.campaignId !== value.project.campaignId || campaign?.processId !== 'deep-assurance-v6') {
    throw new TypeError('Hosted projection campaign binding is incompatible.');
  }

  const gateCounts = countBy(projection.gates, 'status');
  const phaseSummary = projection.gates.length === 0
    ? 'No gates projected yet.'
    : `${projection.gates.length} gates · ${countText(gateCounts, [
      'PENDING', 'PASS', 'INFORMATIONAL_ISSUE_FOUND', 'LOW_ISSUE_FOUND', 'MEDIUM_ISSUE_FOUND',
      'HIGH_ISSUE_FOUND', 'CRITICAL_ISSUE_FOUND', 'FAIL',
    ])}`;

  const laneCount = projection.topology?.laneRoleIds?.length ?? 0;
  const workerCount = projection.workers?.length ?? 0;
  const laneSummary = `${laneCount} required lanes · ${workerCount} registered ${workerCount === 1 ? 'worker' : 'workers'}`;

  const proofCount = projection.instructionProofs?.length ?? 0;
  const instructionProofSummary = `${proofCount} accepted proof ${proofCount === 1 ? 'record' : 'records'} · instruction policy ${campaign.instructionPolicyRequired ? 'required' : 'not required'}`;

  const assignmentCounts = countBy(projection.assignments, 'status');
  const assignmentSummary = projection.assignments.length === 0
    ? 'No assignments projected yet.'
    : countText(assignmentCounts, ['READY', 'LEASED', 'SUBMITTED', 'ACCEPTED', 'REJECTED']);

  const findingCounts = countBy(projection.findings, 'severity');
  const unresolvedFindings = (projection.findings ?? []).filter((finding) => finding?.status === 'UNRESOLVED').length;
  const findingSummary = projection.findings.length === 0
    ? 'No projected findings.'
    : `${countText(findingCounts, ['INFORMATIONAL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])} · ${unresolvedFindings} unresolved`;

  const remediationSummary = projection.remediation
    ? `${projection.remediation.status ?? 'UNKNOWN'} · ${projection.remediation.unresolvedHighCriticalCount ?? 'unknown'} unresolved High/Critical`
    : 'No remediation summary projected yet.';

  const gateEvidence = (projection.gates ?? []).reduce((total, gate) => total + (gate.evidenceRefCount ?? 0), 0);
  const assignmentEvidence = (projection.assignments ?? []).reduce(
    (total, assignment) => total + (assignment.submission?.evidenceRefCount ?? 0),
    0,
  );
  const boundedEvidence = gateEvidence + assignmentEvidence;
  const reportEvidence = projection.report?.evidenceCount;
  const evidenceSummary = reportEvidence == null
    ? `${boundedEvidence} bounded evidence references · ${projection.events?.length ?? 0} event-chain records`
    : `${boundedEvidence} bounded evidence references · ${reportEvidence} final-report evidence entries · ${projection.events?.length ?? 0} event-chain records`;

  const completion = campaign.completionStatus ?? 'not complete';
  const verdict = campaign.securityVerdict ?? 'not final';
  const reportStatus = projection.report?.status ?? 'not ready';
  const finalizationSummary = `Completion: ${completion} · Security verdict: ${verdict} · Report: ${reportStatus} · Publication: ${projection.publication?.status ?? 'unknown'} · Delivery: ${projection.userDelivery?.status ?? 'unknown'}`;

  return {
    stateMessage: `Active projection ${campaign.status} · ${value.project.controllerBranch} · updated ${campaign.updatedAt ?? 'unknown'}.`,
    controllerRelease: `${value.controller.repository} @ ${shortSha(value.controller.compatibilityCommit)}`,
    instructionRelease: value.controller.instructionReleaseIdentity,
    activeCampaign: `${campaign.campaignId} · ${campaign.status}`,
    campaignSource: `${campaign.source?.repository ?? 'unknown'} @ ${shortSha(campaign.source?.commit)} · revision ${campaign.source?.revision ?? 'unknown'}`,
    phaseSummary,
    laneSummary,
    instructionProofSummary,
    assignmentSummary,
    findingSummary,
    remediationSummary,
    evidenceSummary,
    finalizationSummary,
  };
}

export function controllerViewModelV1(value) {
  assertTier3BrowserCompatibilityV1(value);
  if (value.project?.status === 'NO_ACTIVE_CAMPAIGN' && value.campaign === null) return noActiveView(value);
  if (value.project?.status === 'ACTIVE') return activeView(value);
  throw new TypeError('Controller returned an unsupported project state.');
}
