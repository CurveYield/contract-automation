import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAX_LAYER_BYTES,
  MAX_SOURCE_BYTES,
  MAX_WORKSPACE_MANIFEST_BYTES,
  WORKSPACE_OPERATION_BUDGETS
} from '../../packages/audit-workspace-protocol/src/index.mjs';
import {
  MAX_PROFILE_METADATA_BYTES,
  PROFILE_OPERATION_BUDGETS
} from '../../packages/audit-profile-registry/src/index.mjs';
import { AUDIT_CAPABILITIES } from '../../packages/audit-protocol/src/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relative) => fs.readFile(path.join(root, relative), 'utf8');

const PHASE_2_ROOTS = [
  'packages/audit-workspace-protocol/src/index.mjs',
  'packages/audit-workspaces/src/index.mjs',
  'packages/audit-profile-registry/src/index.mjs',
  'apps/audit-api/src/index.mjs',
  'apps/audit-web/src/client.mjs'
];

test('Phase 2 packages preserve the approved R2 size and operation budgets', () => {
  assert.equal(MAX_SOURCE_BYTES, 250 * 1024 * 1024);
  assert.equal(MAX_LAYER_BYTES, 100_000_000);
  assert.equal(MAX_WORKSPACE_MANIFEST_BYTES, 2_000_000);
  assert.equal(MAX_PROFILE_METADATA_BYTES, 5_000_000);
  assert.deepEqual(WORKSPACE_OPERATION_BUDGETS, {
    uploadSource: { classA: 1, classB: 0, storageBytes: 10_000_000 },
    sealWorkspace: { classA: 4, classB: 2, storageBytes: 10_500_000 },
    importGitHub: { classA: 4, classB: 0, storageBytes: 10_500_000 },
    attachLayer: { classA: 4, classB: 1, storageBytes: 5_250_000 },
    readLayerIndex: { classA: 0, classB: 1, storageBytes: 0 }
  });
  assert.deepEqual(PROFILE_OPERATION_BUDGETS, {
    publish: { classA: 4, classB: 1, storageBytes: 1_000_000 },
    read: { classA: 0, classB: 1, storageBytes: 0 },
    revoke: { classA: 2, classB: 1, storageBytes: 64_000 }
  });
});

test('Phase 2 production code contains no bucket listing or Lite integration surface', async () => {
  for (const relative of PHASE_2_ROOTS) {
    const text = await read(relative);
    assert.doesNotMatch(text, /ListObjects|\.list\s*\(/, relative);
    assert.doesNotMatch(text, /PREFLIGHTSIM_|preflightsim-lite-runner|\/api\/v1\/|\/internal\/v1\//, relative);
  }
});

test('GitHub workspace imports require exact commits and never accept arbitrary URLs', async () => {
  const protocol = await read('packages/audit-workspace-protocol/src/index.mjs');
  const api = await read('apps/audit-api/src/index.mjs');
  assert.match(protocol, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(api, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(protocol, /owner\/name GitHub repository identity/);
  assert.doesNotMatch(protocol, /https?:\/\//);
  assert.doesNotMatch(await read('packages/audit-workspaces/src/index.mjs'), /\bfetch\s*\(/);
});

test('workspace storage inspects bundled ZIP metadata without extraction or file fan-out', async () => {
  const source = await read('packages/audit-workspaces/src/index.mjs');
  assert.match(source, /inspectZipArchive/);
  assert.match(source, /central directory/i);
  assert.doesNotMatch(source, /unzipper|extractTo|extractAll|writeFile|mkdir|node:fs/);
  assert.match(source, /workspaceSourceArchiveKey/);
  assert.match(source, /layerArchiveKey/);
});

test('Phase 2 API and web expose metadata only while execution remains disabled', async () => {
  const api = await read('apps/audit-api/src/index.mjs');
  const client = await read('apps/audit-web/src/client.mjs');
  assert.equal(AUDIT_CAPABILITIES.executionEnabled, false);
  assert.match(api, /executionEnabled:\s*false/);
  assert.match(api, /execution_plane_unavailable/);
  assert.match(api, /workspaces:\s*true/);
  assert.match(api, /profileRegistry:\s*true/);
  assert.doesNotMatch(client, /listR2Objects|putR2Object|executeJob|runCommand|broadcastTransaction|setRpcUrl/);
});

test('Wrangler binds a separate Phase 2 control store and keeps execution disabled', async () => {
  const wrangler = await read('apps/audit-api/wrangler.toml');
  assert.match(wrangler, /binding = "AUDIT_NONCE_STORE"/);
  assert.match(wrangler, /binding = "AUDIT_CONTROL_STORE"/);
  assert.match(wrangler, /bucket_name = "curveyield-audit-control"/);
  assert.match(wrangler, /AUDIT_EXECUTION_ENABLED = "false"/);
  assert.doesNotMatch(wrangler, /PREFLIGHTSIM_|curveyield-preflight/);
});
