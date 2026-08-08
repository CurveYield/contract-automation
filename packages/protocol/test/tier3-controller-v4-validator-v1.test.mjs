import test from 'node:test';
import assert from 'node:assert/strict';

async function loadValidator() {
  try { return await import('../src/tier3-controller-v4-validator-v1.mjs'); }
  catch { return {}; }
}

const SHA = (digit) => digit.repeat(40);
const valid = {
  projectionVersion: 'hosted-tier3-projection-v2',
  adapterVersion: 'tier3-controller-adapter-v4',
  controllerRelease: 'ai-auditor-deep-assurance-v6@16.13.0',
  controllerProtocolSha: SHA('2'),
  automationRelease: SHA('4'),
  campaignSource: { path: 'campaigns/CurveYield-example-v1', commit: SHA('3') },
  networkScope: { active: ['ethereum', 'base'], default: 'base' },
  campaign: { id: 'cmp_1', status: 'ACTIVE', completionStatus: null, securityVerdict: null },
  phases: [], lanes: [], workers: [], assignments: [], instructionProofs: [], findings: [], remediation: [], evidence: [],
  provenance: { eventCount: 0, eventHead: null, recentEvents: [] },
  report: { complete: false, exactRelease: null }
};

test('accepts exact campaign path and source commit binding', async () => {
  const { normalizeControllerProjectionV4 } = await loadValidator();
  assert.equal(typeof normalizeControllerProjectionV4, 'function');
  const output = normalizeControllerProjectionV4(valid);
  assert.deepEqual(output.campaignSource, valid.campaignSource);
});

test('rejects campaign path traversal or non-campaign namespaces', async () => {
  const { normalizeControllerProjectionV4 } = await loadValidator();
  assert.equal(typeof normalizeControllerProjectionV4, 'function');
  for (const path of ['campaigns/../secret', 'hosted-projections/v3/cmp_1.json', '/campaigns/example']) {
    assert.throws(() => normalizeControllerProjectionV4({ ...valid, campaignSource: { ...valid.campaignSource, path } }), /campaignSource.path/);
  }
});

test('rejects non-exact campaign source commit', async () => {
  const { normalizeControllerProjectionV4 } = await loadValidator();
  assert.equal(typeof normalizeControllerProjectionV4, 'function');
  assert.throws(() => normalizeControllerProjectionV4({ ...valid, campaignSource: { ...valid.campaignSource, commit: 'main' } }), /campaignSource.commit/);
});
