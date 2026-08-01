import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryAuditStore } from '../../audit-r2-store/src/index.mjs';
import { WorkspaceService, createUploadGrant, workspaceEventBatchKey, workspaceSourceArchiveKey } from '../src/index.mjs';
import { ingressKey, layerArchiveKey, tenantWorkspaceIndexKey, workspaceLayerIndexKey } from '../../audit-workspace-protocol/src/index.mjs';

const tenantId = `ten_${'1'.repeat(32)}`;
const workspaceA = `ws_${'2'.repeat(32)}`;
const workspaceB = `ws_${'3'.repeat(32)}`;
const layerA = `lyr_${'4'.repeat(32)}`;
const layerB = `lyr_${'5'.repeat(32)}`;
function concat(parts) { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; }
const u16 = (v) => Uint8Array.of(v & 255, (v >>> 8) & 255);
const u32 = (v) => Uint8Array.of(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255);
function zip(name = 'a.sol', text = 'contract A{}') { const e = new TextEncoder(); const n = e.encode(name), d = e.encode(text); const local = concat([u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(0), u32(d.length), u32(d.length), u16(n.length), u16(0), n, d]); const central = concat([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(0), u32(d.length), u32(d.length), u16(n.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(0), n]); return concat([local, central, u32(0x06054b50), u16(0), u16(0), u16(1), u16(1), u32(central.length), u32(local.length), u16(0)]); }
async function digest(data) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map((x) => x.toString(16).padStart(2, '0')).join(''); }
const parse = (record) => JSON.parse(typeof record.value === 'string' ? record.value : new TextDecoder().decode(record.value));
function failPutOnce(store, key) {
  let pending = true;
  return {
    get: (...args) => store.get(...args),
    head: (...args) => store.head(...args),
    delete: (...args) => store.delete(...args),
    put: async (...args) => {
      if (pending && args[0] === key) { pending = false; throw new Error(`injected put failure: ${key}`); }
      return store.put(...args);
    }
  };
}
async function githubInput(workspaceId, archive = zip()) { return { workspaceId, source: { tenantId, repository: 'CurveYield/contract-automation', commitSha: 'a'.repeat(40), refName: 'main', archiveSha256: await digest(archive), bytes: archive.length }, archiveBytes: archive }; }
function layerInput(workspaceId, layerId, archive = new TextEncoder().encode('layer')) { return digest(archive).then((sha) => ({ archiveBytes: archive, manifest: { schemaVersion: 'layer-manifest-v1', layerId, workspaceId, archiveSha256: sha, archiveBytes: archive.length, archiveObjectKey: layerArchiveKey(workspaceId, layerId), createdAt: '2026-08-01T10:00:00.000Z', generator: 'fixture', fileCount: 1 }, eventBatch: { schemaVersion: 'workspace-event-batch-v1', batchId: layerId === layerA ? '00000001' : '00000002', workspaceId, events: [{ type: 'layer_attached', layerId }] } })); }

test('uploaded sealing no longer accepts or requires tenantIndex', async () => {
  const archive = zip(), sha = await digest(archive), store = new InMemoryAuditStore(); await store.put(ingressKey(tenantId, sha), archive);
  const grant = await createUploadGrant({ tenantId, sha256: sha, bytes: archive.length, contentType: 'application/zip', expiresAt: '2026-08-01T11:00:00.000Z' }, { now: () => new Date('2026-08-01T10:00:00.000Z'), sign: async () => 'sig' });
  const service = new WorkspaceService(store, { now: () => new Date('2026-08-01T10:05:00.000Z'), verifyGrant: async () => true });
  await service.sealUploadedWorkspace({ workspaceId: workspaceA, grant });
  await assert.rejects(() => service.sealUploadedWorkspace({ workspaceId: workspaceB, grant, tenantIndex: { schemaVersion: 'tenant-workspaces-v1', tenantId, workspaces: [workspaceB] } }), /tenantIndex.*not allowed|unknown_field/i);
});

test('GitHub imports initialize and preserve the server-owned tenant index', async () => {
  const store = new InMemoryAuditStore(), service = new WorkspaceService(store, { now: () => new Date('2026-08-01T10:05:00.000Z') });
  await service.importGitHubWorkspace(await githubInput(workspaceA));
  await service.importGitHubWorkspace(await githubInput(workspaceB, zip('b.sol', 'contract B{}')));
  const index = parse(await store.get(tenantWorkspaceIndexKey(tenantId)));
  assert.deepEqual(index.workspaces, [workspaceA, workspaceB]);
  assert.ok(index.records[workspaceA]); assert.ok(index.records[workspaceB]);
});

test('GitHub import rejects stale ETags before immutable writes', async () => {
  const store = new InMemoryAuditStore(), service = new WorkspaceService(store, { now: () => new Date('2026-08-01T10:05:00.000Z') });
  await service.importGitHubWorkspace(await githubInput(workspaceA));
  const input = await githubInput(workspaceB, zip('b.sol', 'contract B{}')); input.indexEtag = 'stale';
  await assert.rejects(() => service.importGitHubWorkspace(input), /stale/i);
  assert.equal(await store.head(workspaceSourceArchiveKey(workspaceB)), null);
});

test('GitHub import recovers after partial immutable writes and duplicate retry is idempotent', async () => {
  const store = new InMemoryAuditStore();
  const input = await githubInput(workspaceA);
  const failingService = new WorkspaceService(failPutOnce(store, tenantWorkspaceIndexKey(tenantId)), { now: () => new Date('2026-08-01T10:05:00.000Z') });
  await assert.rejects(() => failingService.importGitHubWorkspace(input), /injected put failure/);
  const service = new WorkspaceService(store, { now: () => new Date('2026-08-01T10:05:00.000Z') });
  assert.equal((await service.importGitHubWorkspace(input)).idempotent, true);
  assert.equal((await service.importGitHubWorkspace(input)).idempotent, true);
});

test('layer attachment initializes and preserves the server-owned layer index', async () => {
  const store = new InMemoryAuditStore(), service = new WorkspaceService(store);
  await service.attachLayer(await layerInput(workspaceA, layerA));
  await service.attachLayer(await layerInput(workspaceA, layerB, new TextEncoder().encode('layer-b')));
  const index = parse(await store.get(workspaceLayerIndexKey(workspaceA)));
  assert.deepEqual(index.layers, [layerA, layerB]); assert.ok(index.records[layerA]); assert.ok(index.records[layerB]);
});

test('layer attachment rejects caller snapshots and stale ETags before writes', async () => {
  const store = new InMemoryAuditStore(), service = new WorkspaceService(store); await service.attachLayer(await layerInput(workspaceA, layerA));
  const withSnapshot = { ...(await layerInput(workspaceA, layerB, new TextEncoder().encode('layer-b'))), layerIndex: { schemaVersion: 'workspace-layer-index-v1', workspaceId: workspaceA, layers: [layerB] } };
  await assert.rejects(() => service.attachLayer(withSnapshot), /layerIndex.*not allowed|unknown_field/i);
  const stale = await layerInput(workspaceA, layerB, new TextEncoder().encode('layer-b')); stale.indexEtag = 'stale';
  await assert.rejects(() => service.attachLayer(stale), /stale/i);
  assert.equal(await store.head(layerArchiveKey(workspaceA, layerB)), null);
});

test('layer attachment recovers after partial writes and duplicate retry is idempotent', async () => {
  const store = new InMemoryAuditStore(); const input = await layerInput(workspaceA, layerA);
  const failingService = new WorkspaceService(failPutOnce(store, workspaceLayerIndexKey(workspaceA)));
  await assert.rejects(() => failingService.attachLayer(input), /injected put failure/);
  const service = new WorkspaceService(store);
  assert.equal((await service.attachLayer(input)).idempotent, true);
  assert.equal((await service.attachLayer(input)).idempotent, true);
  assert.ok(await store.head(workspaceEventBatchKey(workspaceA, '00000001')));
});
