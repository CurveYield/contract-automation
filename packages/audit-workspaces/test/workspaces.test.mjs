import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryAuditStore } from '../../audit-r2-store/src/index.mjs';
import {
  createUploadGrant,
  inspectZipArchive,
  WorkspaceService,
  workspaceEventBatchKey,
  workspaceSourceArchiveKey
} from '../src/index.mjs';
import { ingressKey, layerArchiveKey } from '../../audit-workspace-protocol/src/index.mjs';

const tenantId = `ten_${'1'.repeat(32)}`;
const workspaceId = `ws_${'2'.repeat(32)}`;
const layerId = `lyr_${'3'.repeat(32)}`;

function concat(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
function u16(value) { return Uint8Array.of(value & 255, (value >>> 8) & 255); }
function u32(value) { return Uint8Array.of(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255); }
function zip(entries) {
  const encoder = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = encoder.encode(entry.data ?? '');
    const local = concat([u32(0x04034b50), u16(20), u16(entry.flags ?? 0x0800), u16(0), u16(0), u16(0), u32(0), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data]);
    locals.push(local);
    const central = concat([u32(0x02014b50), u16(20), u16(20), u16(entry.flags ?? 0x0800), u16(0), u16(0), u16(0), u32(0), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]);
    centrals.push(central);
    offset += local.length;
  }
  const centralBytes = concat(centrals);
  return concat([...locals, centralBytes, u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(centralBytes.length), u32(offset), u16(0)]);
}
async function sha256(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function delta(after, before) {
  return { classA: after.classA - before.classA, classB: after.classB - before.classB, free: after.free - before.free };
}

const sourceZip = zip([
  { name: 'contracts/BoostHub.sol', data: 'contract BoostHub {}' },
  { name: 'contracts/interfaces/IBoost.sol', data: 'interface IBoost {}' }
]);

test('inspects an inert ZIP central directory without extracting files', async () => {
  const result = await inspectZipArchive(sourceZip);
  assert.equal(result.fileCount, 2);
  assert.deepEqual(result.files.map((item) => item.path), ['contracts/BoostHub.sol', 'contracts/interfaces/IBoost.sol']);
  await assert.rejects(() => inspectZipArchive(zip([{ name: '../escape.sol', data: 'x' }])), /path/i);
  await assert.rejects(() => inspectZipArchive(zip([{ name: 'secret.sol', data: 'x', flags: 0x0801 }])), /encrypted/i);
});

test('creates a stateless upload grant bound to tenant, digest, size, type, expiry, and destination', async () => {
  const digest = await sha256(sourceZip);
  const grant = await createUploadGrant({ tenantId, sha256: digest, bytes: sourceZip.length, contentType: 'application/zip', expiresAt: '2026-08-01T12:00:00.000Z' }, {
    now: () => new Date('2026-07-31T12:00:00.000Z'),
    sign: async (payload) => `sig:${await sha256(new TextEncoder().encode(payload))}`
  });
  assert.equal(grant.destinationKey, ingressKey(tenantId, digest));
  assert.match(grant.signature, /^sig:[0-9a-f]{64}$/);
  assert.equal(grant.schemaVersion, 'upload-grant-v1');
});

test('seals one bundled upload using exactly three writes and one read', async () => {
  const digest = await sha256(sourceZip);
  const store = new InMemoryAuditStore();
  await store.put(ingressKey(tenantId, digest), sourceZip);
  const grant = await createUploadGrant({ tenantId, sha256: digest, bytes: sourceZip.length, contentType: 'application/zip', expiresAt: '2026-08-01T12:00:00.000Z' }, {
    now: () => new Date('2026-07-31T12:00:00.000Z'), sign: async () => 'valid-signature'
  });
  const writes = [];
  const wrapped = {
    get: (...args) => store.get(...args),
    put: async (...args) => { writes.push(args[0]); return store.put(...args); }
  };
  const service = new WorkspaceService(wrapped, { now: () => new Date('2026-07-31T12:05:00.000Z'), verifyGrant: async () => true });
  const before = store.usage();
  const result = await service.sealUploadedWorkspace({
    workspaceId,
    grant,
    tenantIndex: { schemaVersion: 'tenant-workspaces-v1', tenantId, workspaces: [workspaceId] }
  });
  const after = store.usage();
  assert.deepEqual(delta(after, before), { classA: 3, classB: 1, free: 0 });
  assert.equal(result.manifest.fileCount, 2);
  assert.equal(writes.length, 3);
  assert.equal(writes.some((key) => key.includes('contracts/')), false);
});

test('rejects expired grants and digest mismatches before workspace writes', async () => {
  const digest = await sha256(sourceZip);
  const store = new InMemoryAuditStore();
  await store.put(ingressKey(tenantId, digest), sourceZip);
  const service = new WorkspaceService(store, { now: () => new Date('2026-08-02T00:00:00.000Z'), verifyGrant: async () => true });
  const grant = await createUploadGrant({ tenantId, sha256: digest, bytes: sourceZip.length, contentType: 'application/zip', expiresAt: '2026-08-01T12:00:00.000Z' }, { now: () => new Date('2026-07-31T12:00:00.000Z'), sign: async () => 'sig' });
  await assert.rejects(() => service.sealUploadedWorkspace({ workspaceId, grant, tenantIndex: { schemaVersion: 'tenant-workspaces-v1', tenantId, workspaces: [workspaceId] } }), /expired/i);
  const altered = new Uint8Array(sourceZip); altered[10] ^= 1;
  const store2 = new InMemoryAuditStore(); await store2.put(ingressKey(tenantId, digest), altered);
  const service2 = new WorkspaceService(store2, { now: () => new Date('2026-07-31T12:05:00.000Z'), verifyGrant: async () => true });
  await assert.rejects(() => service2.sealUploadedWorkspace({ workspaceId, grant, tenantIndex: { schemaVersion: 'tenant-workspaces-v1', tenantId, workspaces: [workspaceId] } }), /digest/i);
});

test('imports an exact GitHub commit as one bundled source object with four writes and no reads', async () => {
  const digest = await sha256(sourceZip);
  const store = new InMemoryAuditStore();
  const service = new WorkspaceService(store, { now: () => new Date('2026-07-31T12:05:00.000Z') });
  const before = store.usage();
  await service.importGitHubWorkspace({
    workspaceId,
    source: { tenantId, repository: 'CurveYield/contract-automation', commitSha: 'a'.repeat(40), refName: 'main', archiveSha256: digest, bytes: sourceZip.length },
    archiveBytes: sourceZip,
    tenantIndex: { schemaVersion: 'tenant-workspaces-v1', tenantId, workspaces: [workspaceId] }
  });
  assert.deepEqual(delta(store.usage(), before), { classA: 4, classB: 0, free: 0 });
  assert.equal((await store.head(workspaceSourceArchiveKey(workspaceId))).size, sourceZip.length);
});

test('attaches one bundled generated layer with four writes, one verification read, and conditional index protection', async () => {
  const archive = new TextEncoder().encode('trusted generated tests bundle');
  const digest = await sha256(archive);
  const store = new InMemoryAuditStore();
  const service = new WorkspaceService(store, { now: () => new Date('2026-07-31T12:05:00.000Z') });
  const before = store.usage();
  await service.attachLayer({
    archiveBytes: archive,
    manifest: { schemaVersion: 'layer-manifest-v1', layerId, workspaceId, archiveSha256: digest, archiveBytes: archive.length, archiveObjectKey: layerArchiveKey(workspaceId, layerId), createdAt: '2026-07-31T12:05:00.000Z', generator: 'curveyield-audit-spec-layer-v1', fileCount: 3 },
    layerIndex: { schemaVersion: 'workspace-layer-index-v1', workspaceId, layers: [layerId] },
    eventBatch: { schemaVersion: 'workspace-event-batch-v1', batchId: '00000001', workspaceId, events: [{ type: 'layer_attached', layerId }] }
  });
  assert.deepEqual(delta(store.usage(), before), { classA: 4, classB: 1, free: 0 });
  assert.ok(await store.head(workspaceEventBatchKey(workspaceId, '00000001')));
  await assert.rejects(() => service.attachLayer({
    archiveBytes: archive,
    manifest: { schemaVersion: 'layer-manifest-v1', layerId, workspaceId, archiveSha256: digest, archiveBytes: archive.length, archiveObjectKey: layerArchiveKey(workspaceId, layerId), createdAt: '2026-07-31T12:05:00.000Z', generator: 'curveyield-audit-spec-layer-v1', fileCount: 3 },
    layerIndex: { schemaVersion: 'workspace-layer-index-v1', workspaceId, layers: [layerId] },
    eventBatch: { schemaVersion: 'workspace-event-batch-v1', batchId: '00000001', workspaceId, events: [{ type: 'layer_attached', layerId }] }
  }), /precondition/i);
});
