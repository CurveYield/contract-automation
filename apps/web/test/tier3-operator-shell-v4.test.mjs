import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const publicDir = new URL('../public/', import.meta.url);

test('operator shell loads versioned Tier 3 operator v4 and labels campaign-scoped freshness', async () => {
  const html = await fs.readFile(new URL('index.html', publicDir), 'utf8');
  assert.match(html, /tier3-operator-v4\.js/);
  assert.doesNotMatch(html, /tier3-operator-v3\.js/);
  assert.match(html, /Exact campaign commit/);
  assert.match(html, /Freshness mode/);
  assert.match(html, /campaign-path-latest-commit-v1/);
});

test('operator v4 renders controllerCampaignCommit and never consumes deprecated controllerStateCommit', async () => {
  const source = await fs.readFile(new URL('tier3-operator-v4.js', publicDir), 'utf8');
  assert.match(source, /controllerCampaignCommit/);
  assert.match(source, /freshnessMode/);
  assert.doesNotMatch(source, /controllerStateCommit/);
});
