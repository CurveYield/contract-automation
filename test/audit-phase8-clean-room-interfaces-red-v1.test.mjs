import test from 'node:test';
import assert from 'node:assert/strict';

const packages = [
  '../packages/audit-clean-room-protocol/src/index.mjs',
  '../packages/audit-clean-room-access/src/index.mjs',
  '../packages/audit-clean-room-campaigns/src/index.mjs',
  '../packages/audit-controlled-merge/src/index.mjs',
  '../packages/audit-provenance/src/index.mjs'
];

const expected = [
  ['createCleanRoomPolicy', 'validateCleanRoomPolicy', 'createCampaignAccessContext', 'validateCampaignAccessContext', 'createShareGrant', 'validateShareGrant'],
  ['authorizeCampaignAccess', 'decideResourceVisibility', 'createHiddenResourceEnvelope', 'planScopedStorageKeys'],
  ['createTerminalCampaignManifest', 'validateTerminalCampaignManifest'],
  ['createMergeRequest', 'transitionMergeState', 'buildRelationMaps', 'createMergeManifest', 'planMergeStorageTransaction'],
  ['createProvenanceNode', 'createProvenanceEdge', 'createProvenanceIndex', 'createMergedReportReference']
];

for (let index = 0; index < packages.length; index += 1) {
  test(`Phase 8 package ${index + 1} exposes required interfaces`, async () => {
    const module = await import(new URL(packages[index], import.meta.url));
    for (const name of expected[index]) assert.equal(typeof module[name], 'function', `${name} missing`);
  });
}
