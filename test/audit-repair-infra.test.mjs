import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ingressKey,
  layerArchiveKey,
  workspaceSourceManifestKey
} from '../packages/audit-workspace-protocol/src/index.mjs';
import {
  profileManifestKey,
  profileRevocationKey
} from '../packages/audit-profile-registry/src/index.mjs';
import {
  campaignCreationKey,
  eventBatchKey,
  evidenceAcceptedKey,
  jobRequestKey,
  logChunkKey,
  reportBundleKey
} from '../packages/audit-campaign-protocol/src/index.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const readJson = async (relative) => JSON.parse(await fs.readFile(path.join(root, relative), 'utf8'));
const tenantId = `ten_${'1'.repeat(32)}`;
const workspaceId = `ws_${'2'.repeat(32)}`;
const layerId = `lyr_${'3'.repeat(32)}`;
const campaignId = `cmp_${'4'.repeat(32)}`;
const jobId = `ajob_${'5'.repeat(32)}`;
const attemptId = `att_${'6'.repeat(32)}`;
const artifactId = `art_${'7'.repeat(32)}`;

function matchingRules(rules, key) {
  return rules.filter((rule) => key.startsWith(rule.Filter.Prefix));
}

test('R2 lifecycle rules match every expiring Phase 1-3 object family', async () => {
  const lifecycle = await readJson('infra/audit-cloudflare/r2-lifecycle.json');
  const expiringKeys = [
    ingressKey(tenantId, 'a'.repeat(64)),
    workspaceSourceManifestKey(workspaceId),
    layerArchiveKey(workspaceId, layerId),
    campaignCreationKey(campaignId),
    jobRequestKey(jobId),
    eventBatchKey(jobId, '00000001'),
    logChunkKey(jobId, attemptId, 1),
    evidenceAcceptedKey(jobId, artifactId),
    reportBundleKey(jobId, artifactId),
    `internal-nonces/1722470400/nonce-1234567890.json`
  ];

  for (const key of expiringKeys) {
    assert.equal(
      matchingRules(lifecycle.Rules, key).length,
      1,
      `${key} must match exactly one lifecycle rule`
    );
  }

  const persistentKeys = [profileManifestKey('slither-solidity-v1'), profileRevocationKey('slither-solidity-v1')];
  for (const key of persistentKeys) {
    assert.equal(matchingRules(lifecycle.Rules, key).length, 0, `${key} must not expire automatically`);
  }
});

test('Audit R2 CORS permits origin-scoped signed uploads without broad write methods', async () => {
  const cors = await readJson('infra/audit-cloudflare/r2-cors.json');
  assert.equal(cors.rules.length, 1);
  const allowed = cors.rules[0].allowed;
  assert.deepEqual(allowed.origins, ['https://audit.preflight.curveyield.online']);
  assert.deepEqual([...allowed.methods].sort(), ['GET', 'HEAD', 'PUT']);
  assert.ok(allowed.headers.includes('content-type'));
  assert.ok(allowed.headers.includes('if-match'));
  assert.ok(allowed.headers.includes('if-none-match'));
  assert.doesNotMatch(allowed.methods.join(','), /POST|PATCH|DELETE/);
});
