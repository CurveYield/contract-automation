import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROUND4_CANDIDATE_SLOTS,
  ROUND4_PRELIMINARY_OWNERSHIP,
  validateCompletedCandidateEvidence,
  validatePathOwnershipRegistry
} from '../packages/audit-integration-round4/src/index.mjs';

const worker1Slot = () => ROUND4_CANDIDATE_SLOTS.find((item) => item.workerId === 'worker-1');

function takeoverEntry() {
  return {
    workerId: 'worker-1',
    issueNumber: 121,
    sequence: 5,
    originalBranch: 'audit-round4/review-phase78-api-compat-v1',
    startingSha: '4d7513b7eabd2e2217b1e3fed43d999df828a93f',
    takeoverBranch: 'orchestrator/worker1-round4-takeover-v1',
    reviewedCodeSnapshotSha: 'e26b78c2c26f3c11897e8fea397c8615fc66a5a0',
    evidenceHeadSha: 'df983ab905266ddd2dad39866f0e0341aaa0f100',
    recommendation: 'ACCEPT WITH REPAIR',
    report: {
      commentId: 5157596912,
      url: 'https://github.com/CurveYield/contract-automation/issues/121#issuecomment-5157596912'
    },
    manifests: [
      {
        schemaVersion: 'audit-round4-worker1-stage-a-path-blob-manifest-v1',
        path: 'docs/audit/round4/worker1/2026-08-02-phase78-stage-a-path-blob-manifest-v1.json',
        blobSha: '3ddd153e315459bfb9f1e2673a297e6f8552e8b7'
      },
      {
        schemaVersion: 'audit-round4-worker1-phase78-public-compatibility-manifest-v1',
        path: 'docs/audit/round4/worker1/2026-08-02-phase78-public-compatibility-manifest-v1.json',
        blobSha: 'f7c37a6df3c23652e2cb3e885dd12b0be0b09920'
      },
      {
        schemaVersion: 'audit-round4-worker1-independent-verification-receipt-v1',
        path: 'docs/audit/round4/worker1/2026-08-02-phase78-independent-verification-receipt-v1.json',
        blobSha: 'aa6505d93908e187329ce53d8d9d1c9a2455835c'
      },
      {
        schemaVersion: 'audit-round4-worker1-stage-a-review-v1',
        path: 'docs/audit/round4/worker1/2026-08-02-phase78-api-compat-stage-a-review-v1.md',
        blobSha: '4314115cf2a767f43a8d75b3b56cd50d4fb8091e'
      }
    ]
  };
}

function attestation() {
  return {
    protocolVersion: 2,
    schemaVersion: 'round4-orchestrator-direct-takeover-evidence-v1',
    repository: 'CurveYield/contract-automation',
    recordedAt: '2026-08-02T12:47:46.000Z',
    masterIssue: 119,
    integrationIssue: 122,
    purpose: 'Deterministic direct-takeover evidence.',
    takeovers: [takeoverEntry()],
    validationRules: ['Bind exact assignment and evidence.'],
    safety: {
      workerOwnedStatusesModified: false,
      originalWorkerBranchesModifiedByOrchestrator: false,
      mainModified: false,
      pr126Modified: false,
      workflowsModified: false
    }
  };
}

function takeoverEvidence() {
  return {
    attestation: attestation(),
    resolvedTakeoverBranchHead: 'df983ab905266ddd2dad39866f0e0341aaa0f100',
    resolvedReviewedCodeSnapshotSha: 'e26b78c2c26f3c11897e8fea397c8615fc66a5a0'
  };
}

test('accepts exact orchestrator direct-takeover evidence without a completed worker status', () => {
  const value = validateCompletedCandidateEvidence(worker1Slot(), takeoverEvidence());
  assert.equal(value.evidenceMode, 'orchestrator-direct-takeover');
  assert.equal(value.finalSha, 'e26b78c2c26f3c11897e8fea397c8615fc66a5a0');
  assert.equal(value.evidenceHeadSha, 'df983ab905266ddd2dad39866f0e0341aaa0f100');
  assert.equal(value.branch, 'orchestrator/worker1-round4-takeover-v1');
  assert.equal(value.originalBranch, 'audit-round4/review-phase78-api-compat-v1');
  assert.equal(value.manifests.length, 4);
});

test('rejects forged takeover branch, code snapshot, evidence head, report, or manifest binding', () => {
  const mutations = [
    (value) => { value.attestation.takeovers[0].originalBranch = 'audit-round4/wrong-v1'; },
    (value) => { value.resolvedReviewedCodeSnapshotSha = '0'.repeat(40); },
    (value) => { value.resolvedTakeoverBranchHead = '1'.repeat(40); },
    (value) => { value.attestation.takeovers[0].report.commentId = 1; },
    (value) => { value.attestation.takeovers[0].manifests[0].blobSha = '2'.repeat(40); }
  ];
  for (const mutate of mutations) {
    const value = structuredClone(takeoverEvidence());
    mutate(value);
    assert.throws(() => validateCompletedCandidateEvidence(worker1Slot(), value));
  }
});

test('worker-status evidence and takeover evidence are mutually exclusive', () => {
  const mixed = {
    ...takeoverEvidence(),
    status: {},
    resolvedBranchHead: '0'.repeat(40),
    report: {},
    manifests: []
  };
  assert.throws(
    () => validateCompletedCandidateEvidence(worker1Slot(), mixed),
    (error) => error.code === 'ambiguous_evidence_mode' || error.code === 'unknown_field'
  );
});

test('takeover attestation safety flags must remain false', () => {
  for (const key of Object.keys(attestation().safety)) {
    const value = takeoverEvidence();
    value.attestation.safety[key] = true;
    assert.throws(() => validateCompletedCandidateEvidence(worker1Slot(), value), undefined, key);
  }
});

test('phase 7-8 ownership includes service and publication packages and rejects cross-domain overlap', () => {
  const validated = validatePathOwnershipRegistry(ROUND4_PRELIMINARY_OWNERSHIP);
  const phase78 = validated.domains.find((item) => item.domain === 'phase7-8');
  assert.ok(phase78.ownedPrefixes.includes('packages/audit-phase78-service'));
  assert.ok(phase78.ownedPrefixes.includes('packages/audit-phase78-publication'));

  const overlap = structuredClone(ROUND4_PRELIMINARY_OWNERSHIP);
  const api = overlap.domains.find((item) => item.domain === 'api');
  api.ownedPrefixes.push('packages/audit-phase78-service/internal');
  assert.throws(
    () => validatePathOwnershipRegistry(overlap),
    (error) => error.code === 'ownership_overlap'
  );
});
