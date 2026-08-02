import {
  DIRECT_MODE_ID,
  exactKeys,
  validateDirectRequest,
  identifier,
  timestamp,
  createReportIndex,
  denseArray,
  sha256,
  canonicalJson,
  frozenClone,
  fail,
  digest,
  commitSha,
  validateResultManifest,
  validateReportIndex
} from '../../audit-github-direct-protocol/src/index.mjs';
import {
  buildLedgerPaths,
  ledgerPathInfo,
  planImmutableCreate,
  validateLedgerMutation
} from '../../audit-github-direct-ledger/src/index.mjs';
import {
  planCheckPublication,
  planStatusPublication,
  validatePublicationPlan
} from '../../audit-github-direct-adapter/src/index.mjs';
import { validateRunnerOutcome } from './orchestration.mjs';

function publicationBindingMismatch(path) {
  fail('publication_binding_mismatch', path, 'Publication children do not describe the same outcome');
}

function expectedPublicationMessages(fixture) {
  return fixture
    ? {
        checkSummary: 'Modeled repository fixture result published',
        checkConclusion: 'success',
        statusState: 'success',
        statusDescription: 'Modeled fixture result available'
      }
    : {
        checkSummary: 'Execution plane unavailable; no submitted project was executed',
        checkConclusion: 'neutral',
        statusState: 'error',
        statusDescription: 'Execution plane unavailable'
      };
}

export function planRunnerPublication(input) {
  const v = exactKeys(input, ['request', 'outcome', 'resultId', 'reportId', 'publishedAt'], '$');
  const request = validateDirectRequest(v.request);
  const outcome = validateRunnerOutcome(v.outcome);
  const resultId = identifier(v.resultId, '$.resultId');
  const reportId = identifier(v.reportId, '$.reportId');
  const publishedAt = timestamp(v.publishedAt, '$.publishedAt');
  if (outcome.jobId !== request.jobId || outcome.targetCommitSha !== request.targetCommitSha) {
    fail('outcome_request_mismatch', '$.outcome');
  }

  const reportIndex = createReportIndex({
    request,
    entries: [{
      reportId,
      reportDigest: outcome.resultManifest.manifestDigest,
      kind: 'machine-json'
    }],
    publishedAt
  });
  const paths = buildLedgerPaths({
    jobId: request.jobId,
    eventId: 'publication',
    resultId,
    reportId
  });
  const ledgerPlans = [
    planImmutableCreate({ path: paths.result, content: outcome.resultManifest }),
    planImmutableCreate({ path: paths.report, content: reportIndex })
  ];
  const fixture = outcome.fixtureId !== null;
  const messages = expectedPublicationMessages(fixture);
  const adapterPlans = [
    planCheckPublication({
      request,
      name: 'CurveYield Direct Audit',
      summary: messages.checkSummary,
      conclusion: messages.checkConclusion,
      at: publishedAt
    }),
    planStatusPublication({
      request,
      state: messages.statusState,
      description: messages.statusDescription,
      context: 'curveyield/direct-audit',
      at: publishedAt
    })
  ];
  const core = {
    schemaVersion: 'github-direct-runner-publication-plan-v1',
    modeId: DIRECT_MODE_ID,
    jobId: request.jobId,
    targetCommitSha: request.targetCommitSha,
    outcomeId: outcome.outcomeId,
    resultManifest: outcome.resultManifest,
    reportIndex,
    ledgerPlans,
    adapterPlans,
    publishedAt
  };
  const publicationDigest = sha256(core);
  return frozenClone({
    ...core,
    publicationId: `direct-runner-publication-${publicationDigest.slice(7, 31)}`,
    publicationDigest
  });
}

function validateLedgerBindings(ledgerPlans, jobId, resultManifest, reportIndex) {
  if (ledgerPlans.length !== 2 || ledgerPlans.some((plan) => plan.operation !== 'create-immutable')) {
    fail('publication_shape', '$.ledgerPlans');
  }
  const resultInfo = ledgerPathInfo(ledgerPlans[0].path, '$.ledgerPlans[0].path');
  const reportInfo = ledgerPathInfo(ledgerPlans[1].path, '$.ledgerPlans[1].path');
  if (
    resultInfo.kind !== 'result' ||
    reportInfo.kind !== 'report' ||
    resultInfo.jobId !== jobId ||
    reportInfo.jobId !== jobId
  ) {
    publicationBindingMismatch('$.ledgerPlans');
  }
  if (
    canonicalJson(ledgerPlans[0].content) !== canonicalJson(resultManifest) ||
    canonicalJson(ledgerPlans[1].content) !== canonicalJson(reportIndex)
  ) {
    publicationBindingMismatch('$.ledgerPlans');
  }
  if (
    reportIndex.entries.length !== 1 ||
    reportIndex.entries[0].reportId !== reportInfo.reportId ||
    reportIndex.entries[0].reportDigest !== resultManifest.manifestDigest ||
    reportIndex.entries[0].kind !== 'machine-json'
  ) {
    publicationBindingMismatch('$.reportIndex');
  }
}

function validateAdapterBindings(adapterPlans, jobId, targetCommitSha, resultManifest, publishedAt) {
  if (adapterPlans.length !== 2 || adapterPlans[0].kind !== 'check' || adapterPlans[1].kind !== 'status') {
    fail('publication_shape', '$.adapterPlans');
  }
  const [check, status] = adapterPlans;
  if (
    check.jobId !== jobId || status.jobId !== jobId ||
    check.targetCommitSha !== targetCommitSha || status.targetCommitSha !== targetCommitSha ||
    check.repositoryId !== status.repositoryId ||
    check.installationId !== status.installationId ||
    check.repositoryFullName !== status.repositoryFullName ||
    check.at !== publishedAt || status.at !== publishedAt
  ) {
    publicationBindingMismatch('$.adapterPlans');
  }
  const fixture = resultManifest.executionState === 'fixture_modeled';
  const expected = expectedPublicationMessages(fixture);
  if (
    check.name !== 'CurveYield Direct Audit' ||
    check.summary !== expected.checkSummary ||
    check.conclusion !== expected.checkConclusion ||
    status.state !== expected.statusState ||
    status.description !== expected.statusDescription ||
    status.context !== 'curveyield/direct-audit'
  ) {
    publicationBindingMismatch('$.adapterPlans');
  }
}

export function validateRunnerPublicationPlan(input) {
  const v = exactKeys(input, [
    'schemaVersion', 'modeId', 'jobId', 'targetCommitSha', 'outcomeId',
    'resultManifest', 'reportIndex', 'ledgerPlans', 'adapterPlans', 'publishedAt',
    'publicationId', 'publicationDigest'
  ], '$');
  if (v.schemaVersion !== 'github-direct-runner-publication-plan-v1') fail('invalid_schema', '$.schemaVersion');
  if (v.modeId !== DIRECT_MODE_ID) fail('invalid_mode', '$.modeId');
  const jobId = identifier(v.jobId, '$.jobId');
  const targetCommitSha = commitSha(v.targetCommitSha, '$.targetCommitSha');
  const outcomeId = identifier(v.outcomeId, '$.outcomeId');
  if (!/^direct-outcome-[0-9a-f]{24}$/.test(outcomeId)) fail('identity_mismatch', '$.outcomeId');
  const resultManifest = validateResultManifest(v.resultManifest);
  const reportIndex = validateReportIndex(v.reportIndex);
  if (
    resultManifest.jobId !== jobId ||
    resultManifest.targetCommitSha !== targetCommitSha ||
    reportIndex.jobId !== jobId ||
    reportIndex.targetCommitSha !== targetCommitSha
  ) {
    fail('publication_identity_mismatch', '$.resultManifest');
  }
  const ledgerPlans = denseArray(v.ledgerPlans, '$.ledgerPlans', 2)
    .map((plan) => validateLedgerMutation(plan));
  const adapterPlans = denseArray(v.adapterPlans, '$.adapterPlans', 2)
    .map((plan) => validatePublicationPlan(plan));
  const publishedAt = timestamp(v.publishedAt, '$.publishedAt');
  validateLedgerBindings(ledgerPlans, jobId, resultManifest, reportIndex);
  validateAdapterBindings(adapterPlans, jobId, targetCommitSha, resultManifest, publishedAt);

  const core = {
    schemaVersion: v.schemaVersion,
    modeId: v.modeId,
    jobId,
    targetCommitSha,
    outcomeId,
    resultManifest,
    reportIndex,
    ledgerPlans,
    adapterPlans,
    publishedAt
  };
  const publicationDigest = digest(v.publicationDigest, '$.publicationDigest');
  const expected = sha256(core);
  if (publicationDigest !== expected) fail('digest_mismatch', '$.publicationDigest');
  const publicationId = identifier(v.publicationId, '$.publicationId');
  if (publicationId !== `direct-runner-publication-${expected.slice(7, 31)}`) {
    fail('identity_mismatch', '$.publicationId');
  }
  return frozenClone({ ...core, publicationId, publicationDigest });
}
