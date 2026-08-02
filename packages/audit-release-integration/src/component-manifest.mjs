import { COMPONENT_MANIFEST_SCHEMA } from './contracts.mjs';
import {
  canonicalJson,
  exact,
  fail,
  frozen,
  identifier,
  ordinaryArray,
  optionalSha40,
  pathValue,
  positiveInteger,
  sha40
} from './boundary.mjs';
import { digestOf } from './digest.mjs';
import { validatePublicInterfaceLock } from './interface-lock.mjs';

const ALLOWED_RECOMMENDATIONS = new Set(['ACCEPT', 'ACCEPT WITH REPAIR']);
const ADAPTATION_KINDS = new Set(['exact', 'repaired', 'added', 'deleted']);

function validateReport(value, issueNumber, path = '$.report') {
  const safe = exact(value, ['issueNumber', 'commentId', 'url'], path);
  const reportIssue = positiveInteger(safe.issueNumber, `${path}.issueNumber`);
  const commentId = positiveInteger(safe.commentId, `${path}.commentId`);
  if (reportIssue !== issueNumber) {
    fail('report_issue_mismatch', `${path}.issueNumber`);
  }

  const expectedUrl = `https://github.com/CurveYield/contract-automation/issues/${reportIssue}#issuecomment-${commentId}`;
  if (safe.url !== expectedUrl) {
    fail('invalid_report_url', `${path}.url`);
  }

  return frozen({ issueNumber: reportIssue, commentId, url: expectedUrl });
}

function validatePathOperation(entry, path) {
  const safe = exact(entry, [
    'path',
    'sourceBlobSha',
    'destinationBlobSha',
    'adaptationKind',
    'repairId'
  ], path);

  const operation = {
    path: pathValue(safe.path, `${path}.path`),
    sourceBlobSha: optionalSha40(safe.sourceBlobSha, `${path}.sourceBlobSha`),
    destinationBlobSha: optionalSha40(safe.destinationBlobSha, `${path}.destinationBlobSha`),
    adaptationKind: safe.adaptationKind,
    repairId: safe.repairId
  };

  if (!ADAPTATION_KINDS.has(operation.adaptationKind)) {
    fail('invalid_adaptation', `${path}.adaptationKind`);
  }

  if (operation.adaptationKind === 'exact') {
    if (
      !operation.sourceBlobSha ||
      operation.sourceBlobSha !== operation.destinationBlobSha ||
      operation.repairId !== null
    ) {
      fail('invalid_adaptation', path);
    }
  } else if (operation.adaptationKind === 'repaired') {
    if (
      !operation.sourceBlobSha ||
      !operation.destinationBlobSha ||
      operation.sourceBlobSha === operation.destinationBlobSha
    ) {
      fail('invalid_adaptation', path);
    }
    operation.repairId = identifier(operation.repairId, `${path}.repairId`);
  } else if (operation.adaptationKind === 'added') {
    if (operation.sourceBlobSha !== null || !operation.destinationBlobSha) {
      fail('invalid_adaptation', path);
    }
    operation.repairId = identifier(operation.repairId, `${path}.repairId`);
  } else if (operation.adaptationKind === 'deleted') {
    if (!operation.sourceBlobSha || operation.destinationBlobSha !== null) {
      fail('invalid_adaptation', path);
    }
    operation.repairId = identifier(operation.repairId, `${path}.repairId`);
  }

  return frozen(operation);
}

export function createComponentManifest(input) {
  const safe = exact(input, [
    'componentId',
    'issueNumber',
    'branch',
    'finalSha',
    'status',
    'recommendation',
    'report',
    'paths',
    'publicInterface'
  ]);

  if (safe.status !== 'completed') fail('candidate_incomplete', '$.status');
  if (!ALLOWED_RECOMMENDATIONS.has(safe.recommendation)) {
    fail('candidate_rejected', '$.recommendation');
  }

  const issueNumber = positiveInteger(safe.issueNumber, '$.issueNumber');
  const componentId = identifier(safe.componentId, '$.componentId');
  const paths = ordinaryArray(safe.paths, '$.paths', 10_000)
    .map((entry, index) => validatePathOperation(entry, `$.paths[${index}]`))
    .sort((left, right) => left.path.localeCompare(right.path));

  if (paths.length < 1) fail('missing_path', '$.paths');
  if (new Set(paths.map((item) => item.path)).size !== paths.length) {
    fail('duplicate_path', '$.paths');
  }

  const publicInterface = validatePublicInterfaceLock(safe.publicInterface);
  if (publicInterface.componentId !== componentId) {
    fail('interface_component_mismatch', '$.publicInterface.componentId');
  }

  const ownedPaths = paths
    .filter((item) => item.destinationBlobSha !== null)
    .map((item) => item.path);
  const removedPaths = paths
    .filter((item) => item.destinationBlobSha === null)
    .map((item) => item.path);

  const body = {
    schemaVersion: COMPONENT_MANIFEST_SCHEMA,
    componentId,
    issueNumber,
    branch: pathValue(safe.branch, '$.branch'),
    finalSha: sha40(safe.finalSha, '$.finalSha'),
    status: safe.status,
    recommendation: safe.recommendation,
    report: validateReport(safe.report, issueNumber),
    paths,
    ownedPaths,
    removedPaths,
    publicInterface
  };

  return frozen({ ...body, manifestDigest: digestOf(body) });
}

export function validateComponentManifest(value) {
  const safe = exact(value, [
    'schemaVersion',
    'componentId',
    'issueNumber',
    'branch',
    'finalSha',
    'status',
    'recommendation',
    'report',
    'paths',
    'ownedPaths',
    'removedPaths',
    'publicInterface',
    'manifestDigest'
  ]);

  if (safe.schemaVersion !== COMPONENT_MANIFEST_SCHEMA) {
    fail('invalid_schema_version', '$.schemaVersion');
  }

  const rebuilt = createComponentManifest({
    componentId: safe.componentId,
    issueNumber: safe.issueNumber,
    branch: safe.branch,
    finalSha: safe.finalSha,
    status: safe.status,
    recommendation: safe.recommendation,
    report: safe.report,
    paths: safe.paths,
    publicInterface: safe.publicInterface
  });

  if (canonicalJson(safe.ownedPaths) !== canonicalJson(rebuilt.ownedPaths)) {
    fail('path_membership_mismatch', '$.ownedPaths');
  }
  if (canonicalJson(safe.removedPaths) !== canonicalJson(rebuilt.removedPaths)) {
    fail('path_membership_mismatch', '$.removedPaths');
  }
  if (safe.manifestDigest !== rebuilt.manifestDigest) {
    fail('digest_mismatch', '$.manifestDigest');
  }

  return rebuilt;
}
