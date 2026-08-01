import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_LAYER_BYTES,
  MAX_SOURCE_BYTES,
  MAX_WORKSPACE_MANIFEST_BYTES,
  WORKSPACE_OPERATION_BUDGETS,
  ingressKey,
  layerArchiveKey,
  layerManifestKey,
  tenantWorkspaceIndexKey,
  validateGitHubWorkspaceSource,
  validateLayerManifest,
  validateUploadGrantRequest,
  validateWorkspaceManifest,
  workspaceLayerIndexKey,
  workspaceSealKey,
  workspaceSourceManifestKey
} from '../src/index.mjs';

const tenantId = `ten_${'1'.repeat(32)}`;
const workspaceId = `ws_${'2'.repeat(32)}`;
const layerId = `lyr_${'3'.repeat(32)}`;
const digest = 'a'.repeat(64);

function upload(overrides = {}) {
  return {
    tenantId,
    sha256: digest,
    bytes: 10_000_000,
    contentType: 'application/zip',
    expiresAt: '2026-08-01T12:00:00.000Z',
    ...overrides
  };
}

test('publishes exact Phase 2 size limits and operation budgets', () => {
  assert.equal(MAX_SOURCE_BYTES, 250 * 1024 * 1024);
  assert.equal(MAX_LAYER_BYTES, 100_000_000);
  assert.equal(MAX_WORKSPACE_MANIFEST_BYTES, 2_000_000);
  assert.deepEqual(WORKSPACE_OPERATION_BUDGETS.uploadSource, { classA: 1, classB: 0, storageBytes: 10_000_000 });
  assert.deepEqual(WORKSPACE_OPERATION_BUDGETS.sealWorkspace, { classA: 4, classB: 2, storageBytes: 10_500_000 });
  assert.deepEqual(WORKSPACE_OPERATION_BUDGETS.importGitHub, { classA: 4, classB: 0, storageBytes: 10_500_000 });
  assert.deepEqual(WORKSPACE_OPERATION_BUDGETS.attachLayer, { classA: 4, classB: 1, storageBytes: 5_250_000 });
  assert.deepEqual(WORKSPACE_OPERATION_BUDGETS.readLayerIndex, { classA: 0, classB: 1, storageBytes: 0 });
});

test('validates a bound stateless upload grant request', () => {
  assert.deepEqual(validateUploadGrantRequest(upload()), upload());
  assert.throws(() => validateUploadGrantRequest(upload({ contentType: 'application/octet-stream' })), /contentType/);
  assert.throws(() => validateUploadGrantRequest(upload({ bytes: MAX_SOURCE_BYTES + 1 })), /bytes/);
  assert.throws(() => validateUploadGrantRequest(upload({ sha256: 'xyz' })), /sha256/);
  assert.throws(() => validateUploadGrantRequest({ ...upload(), extra: true }), /extra/);
  assert.throws(() => validateUploadGrantRequest({ ...upload(), command: 'npm test' }), /command/);
});

test('requires public GitHub identity and an exact resolved commit SHA', () => {
  const source = {
    tenantId,
    repository: 'CurveYield/contract-automation',
    commitSha: 'b'.repeat(40),
    refName: 'main',
    archiveSha256: digest,
    bytes: 2_000_000
  };
  assert.deepEqual(validateGitHubWorkspaceSource(source), source);
  assert.throws(() => validateGitHubWorkspaceSource({ ...source, commitSha: 'main' }), /commitSha/);
  assert.throws(() => validateGitHubWorkspaceSource({ ...source, repository: 'https:\/\/github.com\/CurveYield\/contract-automation' }), /repository/);
  assert.throws(() => validateGitHubWorkspaceSource({ ...source, url: 'https:\/\/example.com' }), /url/);
});

test('generates deterministic versioned R2 keys without listing', () => {
  assert.equal(ingressKey(tenantId, digest), `ingress/${tenantId}/${digest}.zip`);
  assert.equal(workspaceSealKey(workspaceId), `workspaces/${workspaceId}/seal-v1.json`);
  assert.equal(workspaceSourceManifestKey(workspaceId), `workspaces/${workspaceId}/source-manifest-v1.json`);
  assert.equal(tenantWorkspaceIndexKey(tenantId), `indexes/tenant/${tenantId}/workspaces-v1.json`);
  assert.equal(layerArchiveKey(workspaceId, layerId), `workspaces/${workspaceId}/layers/${layerId}.tar.zst`);
  assert.equal(layerManifestKey(workspaceId, layerId), `workspaces/${workspaceId}/layers/${layerId}-manifest-v1.json`);
  assert.equal(workspaceLayerIndexKey(workspaceId), `indexes/workspace/${workspaceId}/layers-v1.json`);
});

test('validates strict immutable workspace and layer manifests', () => {
  const workspace = {
    schemaVersion: 'workspace-manifest-v1',
    workspaceId,
    tenantId,
    sourceKind: 'upload',
    sourceSha256: digest,
    sourceBytes: 10_000_000,
    sourceObjectKey: ingressKey(tenantId, digest),
    sealedAt: '2026-07-31T12:00:00.000Z',
    canonicalArchiveSha256: 'c'.repeat(64),
    fileCount: 12
  };
  assert.deepEqual(validateWorkspaceManifest(workspace), workspace);
  assert.throws(() => validateWorkspaceManifest({ ...workspace, shell: 'bash' }), /shell/);
  assert.throws(() => validateWorkspaceManifest({ ...workspace, mutable: true }), /mutable/);

  const layer = {
    schemaVersion: 'layer-manifest-v1',
    layerId,
    workspaceId,
    archiveSha256: 'd'.repeat(64),
    archiveBytes: 5_000_000,
    archiveObjectKey: layerArchiveKey(workspaceId, layerId),
    createdAt: '2026-07-31T12:05:00.000Z',
    generator: 'curveyield-audit-spec-layer-v1',
    fileCount: 8
  };
  assert.deepEqual(validateLayerManifest(layer), layer);
  assert.throws(() => validateLayerManifest({ ...layer, archiveBytes: MAX_LAYER_BYTES + 1 }), /archiveBytes/);
  assert.throws(() => validateLayerManifest({ ...layer, rpcUrl: 'https:\/\/rpc.example' }), /rpcUrl/);
});
