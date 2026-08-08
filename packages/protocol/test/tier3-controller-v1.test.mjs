import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TIER3_CONTROLLER_ADAPTER_VERSION_V1,
  assertControllerCompatibilityV1,
  normalizeControllerProjectionV1,
} from '../src/tier3-controller-v1.mjs';

const SHA = '853b77b92018f4e42068cef6def56f9902a02f27';
const AUTOMATION_SHA = '0edb1751be297deaad610a6a73a5b3a4fcc84be5';

function validProjection(overrides = {}) {
  return {
    schemaVersion: 'tier3-controller-projection-v1',
    adapterVersion: 'tier3-controller-adapter-v1',
    controller: {
      repository: 'CurveYield/audit-controller',
      compatibilityCommit: SHA,
      processId: 'deep-assurance-v6',
      instructionReleaseIdentity: 'ai-auditor-deep-assurance-v6@16.13.0',
    },
    automation: {
      repository: 'CurveYield/contract-automation',
      compatibilityCommit: AUTOMATION_SHA,
    },
    networkScope: {
      chains: ['ethereum', 'base'],
      defaultChain: 'base',
    },
    campaign: {
      campaignId: 'campaign-1',
      title: 'Example audit',
      status: 'ACTIVE',
      completionStatus: null,
      securityVerdict: null,
      source: {
        repository: 'CurveYield/example',
        commit: '1111111111111111111111111111111111111111',
      },
      preflight: { status: 'READY' },
      phases: [
        { phaseId: 'scope-and-provenance', status: 'PASS' },
        { phaseId: 'manual-implementation-review', status: 'PENDING' },
      ],
      lanes: [
        { roleId: 'manual-implementation-auditor', status: 'ACCEPTED' },
      ],
      instructionProofs: [
        {
          actorId: 'worker-1',
          sessionId: 'session-1',
          roleId: 'manual-implementation-auditor',
          phaseId: 'manual-implementation-review',
          status: 'ACCEPTED',
        },
      ],
      assignments: [
        { assignmentId: 'assignment-1', roleId: 'manual-implementation-auditor', status: 'LEASED' },
      ],
      findings: [
        { findingId: 'F-01', title: 'Example', severity: 'MEDIUM', status: 'VALIDATED' },
      ],
      remediation: [
        { findingId: 'F-01', status: 'PENDING' },
      ],
      evidence: { acceptedCount: 3, rejectedCount: 0 },
      report: { status: 'NOT_READY', complete: false, exactReleaseCommit: null },
      updatedAt: '2026-08-08T04:00:00.000Z',
    },
    ...overrides,
  };
}

test('exports the exact v1 adapter identity', () => {
  assert.equal(TIER3_CONTROLLER_ADAPTER_VERSION_V1, 'tier3-controller-adapter-v1');
});

test('normalizes a bounded active campaign projection without conflating completion and verdict', () => {
  const normalized = normalizeControllerProjectionV1(validProjection());
  assert.equal(normalized.controller.repository, 'CurveYield/audit-controller');
  assert.deepEqual(normalized.networkScope, { chains: ['ethereum', 'base'], defaultChain: 'base' });
  assert.equal(normalized.campaign.status, 'ACTIVE');
  assert.equal(normalized.campaign.completionStatus, null);
  assert.equal(normalized.campaign.securityVerdict, null);
  assert.equal(normalized.campaign.findings[0].severity, 'MEDIUM');
  assert.equal(normalized.campaign.report.complete, false);
});

test('accepts a compatible controller projection and returns the normalized value', () => {
  const normalized = assertControllerCompatibilityV1(validProjection());
  assert.equal(normalized.controller.processId, 'deep-assurance-v6');
  assert.equal(normalized.controller.instructionReleaseIdentity, 'ai-auditor-deep-assurance-v6@16.13.0');
});

test('rejects missing or incompatible controller release identity', () => {
  const missing = validProjection();
  delete missing.controller.instructionReleaseIdentity;
  assert.throws(() => assertControllerCompatibilityV1(missing), /instructionReleaseIdentity/);

  const wrong = validProjection();
  wrong.controller.instructionReleaseIdentity = 'ai-auditor-deep-assurance-v6@16.12.0';
  assert.throws(() => assertControllerCompatibilityV1(wrong), /16\.13\.0/);

  const wrongCommit = validProjection();
  wrongCommit.controller.compatibilityCommit = '1111111111111111111111111111111111111111';
  assert.throws(() => assertControllerCompatibilityV1(wrongCommit), /853b77b/);
});

test('rejects any network scope other than exactly Ethereum then Base with Base default', () => {
  for (const networkScope of [
    { chains: ['base', 'ethereum'], defaultChain: 'base' },
    { chains: ['ethereum', 'base', 'polygon'], defaultChain: 'base' },
    { chains: ['ethereum', 'base'], defaultChain: 'ethereum' },
  ]) {
    const value = validProjection({ networkScope });
    assert.throws(() => normalizeControllerProjectionV1(value), /networkScope/);
  }
});

test('rejects malformed phase, lane, proof, finding, remediation, evidence, and report summaries', () => {
  const mutations = [
    (value) => { value.campaign.phases[0].status = 'VULNERABLE'; },
    (value) => { value.campaign.lanes[0].roleId = ''; },
    (value) => { value.campaign.instructionProofs[0].status = 'BYPASSED'; },
    (value) => { value.campaign.findings[0].severity = 'EXTREME'; },
    (value) => { value.campaign.remediation[0].status = 'MAGICALLY_FIXED'; },
    (value) => { value.campaign.evidence.acceptedCount = -1; },
    (value) => { value.campaign.report.complete = 'yes'; },
  ];
  for (const mutate of mutations) {
    const value = validProjection();
    mutate(value);
    assert.throws(() => normalizeControllerProjectionV1(value));
  }
});

test('requires COMPLETE campaigns to have PASS or NO_GO and forbids verdicts on incomplete campaigns', () => {
  const premature = validProjection();
  premature.campaign.securityVerdict = 'PASS';
  assert.throws(() => normalizeControllerProjectionV1(premature), /securityVerdict/);

  const missingVerdict = validProjection();
  missingVerdict.campaign.status = 'COMPLETE';
  missingVerdict.campaign.completionStatus = 'COMPLETE';
  missingVerdict.campaign.report = {
    status: 'COMPLETE',
    complete: true,
    exactReleaseCommit: '2222222222222222222222222222222222222222',
  };
  assert.throws(() => normalizeControllerProjectionV1(missingVerdict), /securityVerdict/);

  for (const verdict of ['PASS', 'NO_GO']) {
    const complete = validProjection();
    complete.campaign.status = 'COMPLETE';
    complete.campaign.completionStatus = 'COMPLETE';
    complete.campaign.securityVerdict = verdict;
    complete.campaign.report = {
      status: 'COMPLETE',
      complete: true,
      exactReleaseCommit: '2222222222222222222222222222222222222222',
    };
    assert.equal(normalizeControllerProjectionV1(complete).campaign.securityVerdict, verdict);
  }
});

test('supports an explicit no-active-campaign projection without inventing campaign state', () => {
  const value = validProjection({ campaign: null });
  assert.equal(normalizeControllerProjectionV1(value).campaign, null);
});
