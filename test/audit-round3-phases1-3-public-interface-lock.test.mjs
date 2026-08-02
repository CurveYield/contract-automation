import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CampaignService } from '../packages/audit-campaigns/src/index.mjs';

const sourceUrl = new URL('../packages/audit-campaigns/src/index.mjs', import.meta.url);

test('CampaignService public entrypoint preserves accepted method names', () => {
  assert.equal(typeof CampaignService, 'function');
  for (const method of [
    'createCampaign', 'submitJob', 'claimAttempt', 'heartbeat', 'appendEventBatch',
    'pollJob', 'completeJob', 'cancelJob', 'transitionJob'
  ]) {
    assert.equal(typeof CampaignService.prototype[method], 'function', method);
  }
});

test('CampaignService compatibility wrapper unwraps only the three extended internal results', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  assert.match(source, /result\?\.batch \?\? result/);
  assert.equal((source.match(/result\?\.status \?\? result/g) ?? []).length, 2);
  assert.doesNotMatch(source, /completeJob\s*\(/);
  assert.doesNotMatch(source, /createCampaign\s*\(/);
  assert.doesNotMatch(source, /submitJob\s*\(/);
});
