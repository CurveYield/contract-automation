export * from './index-legacy.mjs';

import * as legacy from './index-legacy.mjs';

const SHA = /^[0-9a-f]{40}$/u;
const SAFE_TEXT = /^[^\u0000-\u001f\u007f]+$/u;
const SAFE_PATH = /^[A-Za-z0-9_.@+*/\/-]+$/u;
const TRUSTED_ATTESTATION_BLOB_SHA = '2a0c85ca831bf30b042b057adb643c0d2d001435';
const ACCEPT = new Set(['ACCEPT', 'ACCEPT WITH REPAIR']);
const WORKER_EVIDENCE_KEYS = Object.freeze(['manifests', 'report', 'resolvedBranchHead', 'status']);
const TAKEOVER_EVIDENCE_KEYS = Object.freeze([
  'attestation',
  'attestationBlobSha',
  'resolvedReviewedCodeSnapshotSha',
  'resolvedTakeoverBranchHead'
]);
const ATTESTATION_KEYS = Object.freeze([
  'integrationIssue',
  'masterIssue',
  'protocolVersion',
  'purpose',
  'recordedAt',
  'repository',
  'safety',
  'schemaVersion',
  'takeovers',
  'validationRules'
]);
const TAKEOVER_KEYS = Object.freeze([
  'evidenceHeadSha',
  'issueNumber',
  'manifests',
  'originalBranch',
  'recommendation',
  'report',
  'reviewedCodeSnapshotSha',
  'sequence',
  'startingSha',
  'takeoverBranch',
  'workerId'
]);
const REPORT_KEYS = Object.freeze(['commentId', 'url']);
const MANIFEST_KEYS = Object.freeze(['blobSha', 'path', 'schemaVersion']);
const SAFETY_KEYS = Object.freeze([
  'mainModified',
  'originalWorkerBranchesModifiedByOrchestrator',
  'pr126Modified',
  'workerOwnedStatusesModified',
  'workflowsModified'
]);

const TRUSTED_TAKEOVERS = Object.freeze({
  'worker-1': Object.freeze({
    workerId: 'worker-1',
    issueNumber: 121,
    sequence: 5,
    originalBranch: 'audit-round4/review-phase78-api-compat-v1',
    startingSha: '4d7513b7eabd2e2217b1e3fed43d999df828a93f',
    takeoverBranch: 'orchestrator/worker1-round4-takeover-v1',
    reviewedCodeSnapshotSha: 'e26b78c2c26f3c11897e8fea397c8615fc66a5a0',
    evidenceHeadSha: 'df983ab905266ddd2dad39866f0e0341aaa0f100',
    recommendation: 'ACCEPT WITH REPAIR',
    report: Object.freeze({
      commentId: 5157596912,
      url: 'https://github.com/CurveYield/contract-automation/issues/121#issuecomment-5157596912'
    }),
    manifests: Object.freeze([
      Object.freeze({
        schemaVersion: 'audit-round4-worker1-independent-verification-receipt-v1',
        path: 'docs/audit/round4/worker1/2026-08-02-phase78-independent-verification-receipt-v1.json',
        blobSha: 'aa6505d93908e187329ce53d8d9d1c9a2455835c'
      }),
      Object.freeze({
        schemaVersion: 'audit-round4-worker1-phase78-public-compatibility-manifest-v1',
        path: 'docs/audit/round4/worker1/2026-08-02-phase78-public-compatibility-manifest-v1.json',
        blobSha: 'f7c37a6df3c23652e2cb3e885dd12b0be0b09920'
      }),
      Object.freeze({
        schemaVersion: 'audit-round4-worker1-stage-a-path-blob-manifest-v1',
        path: 'docs/audit/round4/worker1/2026-08-02-phase78-stage-a-path-blob-manifest-v1.json',
        blobSha: '3ddd153e315459bfb9f1e2673a297e6f8552e8b7'
      }),
      Object.freeze({
        schemaVersion: 'audit-round4-worker1-stage-a-review-v1',
        path: 'docs/audit/round4/worker1/2026-08-02-phase78-api-compat-stage-a-review-v1.md',
        blobSha: '4314115cf2a767f43a8d75b3b56cd50d4fb8091e'
      })
    ])
  }),
  'worker-3': Object.freeze({
    workerId: 'worker-3',
    issueNumber: 123,
    sequence: 8,
    originalBranch: 'audit-round4/review-api-auth-security-v1',
    startingSha: '6d877e2d87f1a91380a6c5d1efc47550527d8729',
    takeoverBranch: 'orchestrator/worker3-round4-takeover-v1',
    reviewedCodeSnapshotSha: 'a70e6d762530bf0ce8c7dfd467c8b1278b6dd43d',
    evidenceHeadSha: '8bb81ace67855e0a4bc214059b5ce3ad6c9c7ba1',
    recommendation: 'ACCEPT WITH REPAIR',
    report: Object.freeze({
      commentId: 5157962261,
      url: 'https://github.com/CurveYield/contract-automation/issues/123#issuecomment-5157962261'
    }),
    manifests: Object.freeze([
      Object.freeze({
        schemaVersion: 'audit-round4-worker3-independent-verification-receipt-v1',
        path: 'docs/audit/round4/worker3/2026-08-02-worker3-independent-verification-receipt-v1.json',
        blobSha: 'ae4fb3832a30dadaa089927b334276491750b182'
      }),
      Object.freeze({
        schemaVersion: 'audit-round4-worker3-public-trust-compatibility-manifest-v1',
        path: 'docs/audit/round4/worker3/2026-08-02-worker3-public-trust-compatibility-manifest-v1.json',
        blobSha: '376cc03ec9309694495364a52586120901cc2bdb'
      }),
      Object.freeze({
        schemaVersion: 'audit-round4-worker3-stage-a-path-blob-manifest-v1',
        path: 'docs/audit/round4/worker3/2026-08-02-worker3-stage-a-path-blob-manifest-v1.json',
        blobSha: '246ae11f0c1b377773f941394cfcee9defac5301'
      }),
      Object.freeze({
        schemaVersion: 'audit-round4-worker3-stage-a-review-v1',
        path: 'docs/audit/round4/worker3/2026-08-02-worker3-stage-a-review-v1.md',
        blobSha: '0ea216f641c4396998d20dce7e07f96aad750c81'
      })
    ])
  })
});

function fail(code, path, message = code) {
  throw new legacy.Round4IntegrationError(code, path, message);
}

function descriptors(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('invalid_object', path);
  let prototype;
  let own;
  try {
    prototype = Object.getPrototypeOf(value);
    own = Object.getOwnPropertyDescriptors(value);
  } catch {
    fail('hostile_reflection', path);
  }
  if (prototype !== Object.prototype && prototype !== null) fail('invalid_object', path);
  const keys = Reflect.ownKeys(own);
  if (keys.some((key) => typeof key === 'symbol')) fail('symbol_field', path);
  for (const key of keys) {
    const descriptor = own[key];
    if (!Object.hasOwn(descriptor, 'value')) fail('accessor_field', `${path}.${String(key)}`);
    if (descriptor.enumerable !== true) fail('hidden_field', `${path}.${String(key)}`);
  }
  return own;
}

function record(value, path, expectedKeys) {
  const own = descriptors(value, path);
  const actual = Object.keys(own).sort();
  const expected = [...expectedKeys].sort();
  if (actual.join('\0') !== expected.join('\0')) fail('unknown_field', path);
  const output = {};
  for (const key of expected) output[key] = own[key].value;
  return output;
}

function list(value, path, maximum = 64) {
  if (!Array.isArray(value)) fail('invalid_array', path);
  let prototype;
  let own;
  try {
    prototype = Object.getPrototypeOf(value);
    own = Object.getOwnPropertyDescriptors(value);
  } catch {
    fail('hostile_reflection', path);
  }
  if (prototype !== Array.prototype) fail('invalid_array', path);
  const length = own.length?.value;
  if (!Number.isSafeInteger(length) || length < 0 || length > maximum) fail('invalid_array', path);
  const output = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = own[String(index)];
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) {
      fail('invalid_array', `${path}[${index}]`);
    }
    output.push(descriptor.value);
  }
  for (const key of Reflect.ownKeys(own)) {
    if (key === 'length') continue;
    if (typeof key === 'symbol' || !/^(0|[1-9][0-9]*)$/u.test(String(key)) || Number(key) >= length) {
      fail('array_property', path);
    }
  }
  return output;
}

function text(value, path, maximum = 512) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || !SAFE_TEXT.test(value)) {
    fail('invalid_string', path);
  }
  return value;
}

function sha(value, path) {
  if (typeof value !== 'string' || !SHA.test(value)) fail('invalid_sha', path);
  return value;
}

function integer(value, path, minimum = 1) {
  if (!Number.isSafeInteger(value) || value < minimum) fail('invalid_integer', path);
  return value;
}

function pathValue(value, path) {
  const output = text(value, path, 512).replaceAll('\\', '/');
  if (output.startsWith('/') || output.includes('//') || output.split('/').includes('..') || !SAFE_PATH.test(output)) {
    fail('unsafe_path', path);
  }
  return output;
}

function timestamp(value, path) {
  const output = text(value, path, 64);
  const parsed = new Date(output);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== output) fail('invalid_timestamp', path);
  return output;
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function sortedManifests(value, path) {
  const manifests = list(value, path, 16).map((raw, index) => {
    const item = record(raw, `${path}[${index}]`, MANIFEST_KEYS);
    return {
      schemaVersion: text(item.schemaVersion, `${path}[${index}].schemaVersion`, 160),
      path: pathValue(item.path, `${path}[${index}].path`),
      blobSha: sha(item.blobSha, `${path}[${index}].blobSha`)
    };
  }).sort((left, right) => left.schemaVersion.localeCompare(right.schemaVersion));
  if (new Set(manifests.map((item) => item.schemaVersion)).size !== manifests.length) {
    fail('duplicate_manifest_schema', path);
  }
  return manifests;
}

function canonicalTakeover(raw, path) {
  const item = record(raw, path, TAKEOVER_KEYS);
  const reportRaw = record(item.report, `${path}.report`, REPORT_KEYS);
  const report = {
    commentId: integer(reportRaw.commentId, `${path}.report.commentId`),
    url: text(reportRaw.url, `${path}.report.url`, 512)
  };
  return {
    workerId: text(item.workerId, `${path}.workerId`, 64),
    issueNumber: integer(item.issueNumber, `${path}.issueNumber`),
    sequence: integer(item.sequence, `${path}.sequence`),
    originalBranch: pathValue(item.originalBranch, `${path}.originalBranch`),
    startingSha: sha(item.startingSha, `${path}.startingSha`),
    takeoverBranch: pathValue(item.takeoverBranch, `${path}.takeoverBranch`),
    reviewedCodeSnapshotSha: sha(item.reviewedCodeSnapshotSha, `${path}.reviewedCodeSnapshotSha`),
    evidenceHeadSha: sha(item.evidenceHeadSha, `${path}.evidenceHeadSha`),
    recommendation: text(item.recommendation, `${path}.recommendation`, 64),
    report,
    manifests: sortedManifests(item.manifests, `${path}.manifests`)
  };
}

function equalTakeover(actual, expected) {
  return actual.workerId === expected.workerId
    && actual.issueNumber === expected.issueNumber
    && actual.sequence === expected.sequence
    && actual.originalBranch === expected.originalBranch
    && actual.startingSha === expected.startingSha
    && actual.takeoverBranch === expected.takeoverBranch
    && actual.reviewedCodeSnapshotSha === expected.reviewedCodeSnapshotSha
    && actual.evidenceHeadSha === expected.evidenceHeadSha
    && actual.recommendation === expected.recommendation
    && actual.report.commentId === expected.report.commentId
    && actual.report.url === expected.report.url
    && JSON.stringify(actual.manifests) === JSON.stringify(expected.manifests);
}

function validateTakeover(slotInput, evidenceInput) {
  const evidence = record(evidenceInput, '$.evidence', TAKEOVER_EVIDENCE_KEYS);
  if (sha(evidence.attestationBlobSha, '$.evidence.attestationBlobSha') !== TRUSTED_ATTESTATION_BLOB_SHA) {
    fail('attestation_blob_mismatch', '$.evidence.attestationBlobSha');
  }

  const slot = record(slotInput, '$.slot', [
    'branch',
    'candidateId',
    'issueNumber',
    'requiredManifestSchemas',
    'resolvedFinalSha',
    'sourceFinalShas',
    'sourceIssues',
    'startingSha',
    'workerId'
  ]);
  if (slot.resolvedFinalSha !== null) fail('slot_already_resolved', '$.slot.resolvedFinalSha');
  const trustedSlot = legacy.ROUND4_CANDIDATE_SLOTS.find((candidate) => candidate.candidateId === slot.candidateId);
  if (!trustedSlot
    || slot.workerId !== trustedSlot.workerId
    || slot.issueNumber !== trustedSlot.issueNumber
    || slot.branch !== trustedSlot.branch
    || slot.startingSha !== trustedSlot.startingSha) {
    fail('candidate_slot_mismatch', '$.slot');
  }

  const root = record(evidence.attestation, '$.evidence.attestation', ATTESTATION_KEYS);
  if (root.protocolVersion !== 2
    || root.schemaVersion !== 'round4-orchestrator-direct-takeover-evidence-v1'
    || root.repository !== 'CurveYield/contract-automation'
    || root.masterIssue !== 119
    || root.integrationIssue !== 122) {
    fail('attestation_header_mismatch', '$.evidence.attestation');
  }
  timestamp(root.recordedAt, '$.evidence.attestation.recordedAt');
  text(root.purpose, '$.evidence.attestation.purpose', 1000);
  const rules = list(root.validationRules, '$.evidence.attestation.validationRules', 64);
  if (rules.length < 1) fail('missing_validation_rules', '$.evidence.attestation.validationRules');
  for (let index = 0; index < rules.length; index += 1) {
    text(rules[index], `$.evidence.attestation.validationRules[${index}]`, 1000);
  }
  const safety = record(root.safety, '$.evidence.attestation.safety', SAFETY_KEYS);
  for (const key of SAFETY_KEYS) {
    if (safety[key] !== false) fail('unsafe_takeover_attestation', `$.evidence.attestation.safety.${key}`);
  }

  const takeovers = list(root.takeovers, '$.evidence.attestation.takeovers', 16).map((entry, index) => (
    canonicalTakeover(entry, `$.evidence.attestation.takeovers[${index}]`)
  ));
  if (new Set(takeovers.map((entry) => entry.workerId)).size !== takeovers.length) {
    fail('duplicate_takeover_worker', '$.evidence.attestation.takeovers');
  }
  const takeover = takeovers.find((entry) => entry.workerId === slot.workerId && entry.issueNumber === slot.issueNumber);
  const trusted = TRUSTED_TAKEOVERS[slot.workerId];
  if (!takeover || !trusted || !equalTakeover(takeover, trusted)) {
    fail('takeover_binding_mismatch', '$.evidence.attestation.takeovers');
  }
  if (!ACCEPT.has(takeover.recommendation)) fail('candidate_rejected', '$.evidence.attestation.takeovers');
  if (takeover.originalBranch !== slot.branch || takeover.startingSha !== slot.startingSha) {
    fail('candidate_slot_mismatch', '$.evidence.attestation.takeovers');
  }
  if (sha(evidence.resolvedTakeoverBranchHead, '$.evidence.resolvedTakeoverBranchHead') !== takeover.evidenceHeadSha) {
    fail('branch_head_mismatch', '$.evidence.resolvedTakeoverBranchHead');
  }
  if (sha(evidence.resolvedReviewedCodeSnapshotSha, '$.evidence.resolvedReviewedCodeSnapshotSha') !== takeover.reviewedCodeSnapshotSha) {
    fail('code_snapshot_mismatch', '$.evidence.resolvedReviewedCodeSnapshotSha');
  }
  const expectedUrl = `https://github.com/CurveYield/contract-automation/issues/${slot.issueNumber}#issuecomment-${takeover.report.commentId}`;
  if (takeover.report.url !== expectedUrl) fail('report_reference_mismatch', '$.evidence.attestation.takeovers');

  return deepFreeze({
    evidenceMode: 'orchestrator-direct-takeover',
    attestationBlobSha: TRUSTED_ATTESTATION_BLOB_SHA,
    candidateId: slot.candidateId,
    workerId: slot.workerId,
    issueNumber: slot.issueNumber,
    originalBranch: takeover.originalBranch,
    branch: takeover.takeoverBranch,
    startingSha: takeover.startingSha,
    finalSha: takeover.reviewedCodeSnapshotSha,
    evidenceHeadSha: takeover.evidenceHeadSha,
    recommendation: takeover.recommendation,
    report: { ...takeover.report },
    manifests: takeover.manifests.map((manifest) => ({ ...manifest }))
  });
}

export function validateCompletedCandidateEvidence(slotInput, evidenceInput) {
  const own = descriptors(evidenceInput, '$.evidence');
  const keys = Object.keys(own).sort();
  const hasWorkerKey = keys.some((key) => WORKER_EVIDENCE_KEYS.includes(key));
  const hasTakeoverKey = keys.some((key) => TAKEOVER_EVIDENCE_KEYS.includes(key));
  if (hasWorkerKey && hasTakeoverKey) fail('ambiguous_evidence_mode', '$.evidence');
  if (keys.join('\0') === [...WORKER_EVIDENCE_KEYS].sort().join('\0')) {
    return legacy.validateCompletedCandidateEvidence(slotInput, evidenceInput);
  }
  if (keys.join('\0') === [...TAKEOVER_EVIDENCE_KEYS].sort().join('\0')) {
    return validateTakeover(slotInput, evidenceInput);
  }
  fail('unknown_evidence_mode', '$.evidence');
}

const ownership = structuredClone(legacy.ROUND4_PRELIMINARY_OWNERSHIP);
const phase78 = ownership.domains.find((domain) => domain.domain === 'phase7-8');
if (!phase78) fail('missing_phase78_domain', '$.ROUND4_PRELIMINARY_OWNERSHIP');
phase78.ownedPrefixes = [...new Set([
  ...phase78.ownedPrefixes,
  'packages/audit-phase78-publication',
  'packages/audit-phase78-service'
])].sort();

export const ROUND4_PRELIMINARY_OWNERSHIP = deepFreeze(ownership);
