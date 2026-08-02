import {
  DIRECT_MODE_ID,
  exactKeys,
  validateDirectRequest,
  timestamp,
  createResultManifest,
  validateResultManifest,
  denseArray,
  enumValue,
  booleanValue,
  identifier,
  digest,
  commitSha,
  sha256,
  frozenClone,
  fail
} from '../../audit-github-direct-protocol/src/index.mjs';
import { validateRunnerAdmission } from './admission.mjs';

const EMPTY_SUMMARY = Object.freeze({
  findingCount: 0,
  evidenceCount: 0,
  artifactCount: 0,
  truncated: false
});

function isEmptySummary(summary) {
  return Object.entries(EMPTY_SUMMARY).every(([key, value]) => summary[key] === value);
}

function validateOutcomeTruth({ fixtureId, terminalState, transitions, resultManifest, producedAt }) {
  const fixture = fixtureId !== null;
  const expectedTransitions = fixture
    ? ['admitted', 'fixture_running', 'publishing', 'completed']
    : ['admitted', 'awaiting_executor', 'execution_plane_unavailable'];
  if (JSON.stringify(transitions) !== JSON.stringify(expectedTransitions)) {
    fail('transition_mismatch', '$.transitions');
  }

  if (fixture) {
    if (
      terminalState !== 'completed' ||
      resultManifest.outcome !== 'modeled_fixture' ||
      resultManifest.executionState !== 'fixture_modeled' ||
      resultManifest.resultDigest === null
    ) {
      fail('outcome_contradiction', '$.fixtureId');
    }
  } else if (
    terminalState !== 'execution_plane_unavailable' ||
    resultManifest.outcome !== 'execution_unavailable' ||
    resultManifest.executionState !== 'execution_plane_unavailable' ||
    resultManifest.resultDigest !== null ||
    !isEmptySummary(resultManifest.summary)
  ) {
    fail('outcome_contradiction', '$.fixtureId');
  }
  if (resultManifest.producedAt !== producedAt) fail('outcome_contradiction', '$.producedAt');
}

export function orchestrateDirectJob(input) {
  const v = exactKeys(input, ['request', 'admission', 'producedAt'], '$');
  const request = validateDirectRequest(v.request);
  const admission = validateRunnerAdmission(v.admission);
  const producedAt = timestamp(v.producedAt, '$.producedAt');
  if (
    admission.jobId !== request.jobId ||
    admission.targetCommitSha !== request.targetCommitSha ||
    admission.repositoryId !== request.repositoryId ||
    admission.installationId !== request.installationId ||
    admission.repositoryFullName !== request.repositoryFullName
  ) {
    fail('admission_request_mismatch', '$.admission');
  }
  const fixture = admission.fixtureId !== null;
  const resultManifest = createResultManifest({
    request,
    outcome: fixture ? 'modeled_fixture' : 'execution_unavailable',
    executionState: fixture ? 'fixture_modeled' : 'execution_plane_unavailable',
    resultDigest: fixture ? admission.modeledResultDigest : null,
    summary: admission.summary,
    producedAt
  });
  const core = {
    schemaVersion: 'github-direct-runner-outcome-v1',
    modeId: DIRECT_MODE_ID,
    jobId: request.jobId,
    targetCommitSha: request.targetCommitSha,
    fixtureId: admission.fixtureId,
    terminalState: fixture ? 'completed' : 'execution_plane_unavailable',
    transitions: fixture
      ? ['admitted', 'fixture_running', 'publishing', 'completed']
      : ['admitted', 'awaiting_executor', 'execution_plane_unavailable'],
    executionPerformed: false,
    resultManifest,
    producedAt
  };
  const outcomeDigest = sha256(core);
  return frozenClone({
    ...core,
    outcomeId: `direct-outcome-${outcomeDigest.slice(7, 31)}`,
    outcomeDigest
  });
}

export function validateRunnerOutcome(input) {
  const v = exactKeys(input, [
    'schemaVersion', 'modeId', 'jobId', 'targetCommitSha', 'fixtureId',
    'terminalState', 'transitions', 'executionPerformed', 'resultManifest',
    'producedAt', 'outcomeId', 'outcomeDigest'
  ], '$');
  if (v.schemaVersion !== 'github-direct-runner-outcome-v1') fail('invalid_schema', '$.schemaVersion');
  if (v.modeId !== DIRECT_MODE_ID) fail('invalid_mode', '$.modeId');
  const core = {
    schemaVersion: v.schemaVersion,
    modeId: v.modeId,
    jobId: identifier(v.jobId, '$.jobId'),
    targetCommitSha: commitSha(v.targetCommitSha, '$.targetCommitSha'),
    fixtureId: v.fixtureId === null ? null : identifier(v.fixtureId, '$.fixtureId'),
    terminalState: enumValue(v.terminalState, ['completed', 'execution_plane_unavailable'], '$.terminalState'),
    transitions: denseArray(v.transitions, '$.transitions', 4).map((entry, index) =>
      enumValue(
        entry,
        ['admitted', 'awaiting_executor', 'execution_plane_unavailable', 'fixture_running', 'publishing', 'completed'],
        `$.transitions[${index}]`
      )
    ),
    executionPerformed: booleanValue(v.executionPerformed, '$.executionPerformed'),
    resultManifest: validateResultManifest(v.resultManifest),
    producedAt: timestamp(v.producedAt, '$.producedAt')
  };
  if (core.executionPerformed !== false) fail('execution_boundary_violation', '$.executionPerformed');
  if (
    core.resultManifest.jobId !== core.jobId ||
    core.resultManifest.targetCommitSha !== core.targetCommitSha
  ) {
    fail('result_identity_mismatch', '$.resultManifest');
  }
  validateOutcomeTruth(core);

  const outcomeDigest = digest(v.outcomeDigest, '$.outcomeDigest');
  const expected = sha256(core);
  if (outcomeDigest !== expected) fail('digest_mismatch', '$.outcomeDigest');
  const outcomeId = identifier(v.outcomeId, '$.outcomeId');
  if (outcomeId !== `direct-outcome-${expected.slice(7, 31)}`) {
    fail('identity_mismatch', '$.outcomeId');
  }
  return frozenClone({ ...core, outcomeId, outcomeDigest });
}
