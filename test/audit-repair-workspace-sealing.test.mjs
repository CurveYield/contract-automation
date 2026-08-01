import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryAuditStore } from '../packages/audit-r2-store/src/index.mjs';
import { ingressKey, tenantWorkspaceIndexKey } from '../packages/audit-workspace-protocol/src/index.mjs';
import {
  createUploadGrant,
  WorkspaceService,
  workspaceSourceArchiveKey
} from '../packages/audit-workspaces/src/index.mjs';

const tenantId = `ten_${'1'.repeat(32)}`;
const workspaceOne = `ws_${'2'.repeat(32)}`;
const workspaceTwo = `ws_${'3'.repeat(32)}`;

function concat(parts) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
function u16(value) { return Uint8Array.of(value & 255, (value >>> 8) & 255); }
function u32(value) { return Uint8Array.of(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255); }
function zip(name, contents) {
  const encoder = new TextEncoder();
  const fileName = encoder.encode(name);
  const data = encoder.encode(contents);
  const local = concat([u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(0), u32(data.length), u32(data.length), u16(fileName.length), u16(0), fileName, data]);
  const central = concat([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(0), u32(data.length), u32(data.length), u16(fileName.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(0), fileName]);
  return concat([local, central, u32(0x06054b50), u16(0), u16(0), u16(1), u16(1), u32(central.length), u32(local.length), u16(0)]);
}
async function sha256(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function parse(record) {
  return JSON.parse(typeof record.value === 'string' ? record.value : new TextDecoder().decode(record.value));
}
async function grantFor(bytes, now = '2026-08-01T06:40:00.000Z') {
  const digest = await sha256(bytes);
  const grant = await createUploadGrant({
    tenantId,
    sha256: digest,
    bytes: bytes.length,
    contentType: 'application/zip',
    expiresAt: '2026-08-01T07:40:00.000Z'
  }, { now: () => new Date(now), sign: async () => 'valid-signature' });
  return { digest, grant };
}

function service(store) {
  return new WorkspaceService(store, {
    now: () => new Date('2026-08-01T06:45:00.000Z'),
    verifyGrant: async () => true
  });
}

test('sealing an upload copies source bytes into the durable workspace namespace', async () => {
  const bytes = zip('contracts/BoostHub.sol', 'contract BoostHub {}');
  const { digest, grant } = await grantFor(bytes);
  const store = new InMemoryAuditStore();
  await store.put(ingressKey(tenantId, digest), bytes);

  const result = await service(store).sealUploadedWorkspace({
    workspaceId: workspaceOne,
    grant
  });

  const durableKey = workspaceSourceArchiveKey(workspaceOne);
  const durable = await store.get(durableKey);
  assert.ok(durable, 'sealed workspace must retain a durable source bundle');
  assert.deepEqual([...durable.value], [...bytes]);
  assert.equal(result.manifest.sourceObjectKey, durableKey);
});

test('sealing a second workspace preserves the first server-owned tenant index entry', async () => {
  const firstBytes = zip('contracts/One.sol', 'contract One {}');
  const first = await grantFor(firstBytes);
  const store = new InMemoryAuditStore();
  await store.put(ingressKey(tenantId, first.digest), firstBytes);
  await service(store).sealUploadedWorkspace({
    workspaceId: workspaceOne,
    grant: first.grant
  });

  const indexBefore = await store.get(tenantWorkspaceIndexKey(tenantId));
  const secondBytes = zip('contracts/Two.sol', 'contract Two {}');
  const second = await grantFor(secondBytes);
  await store.put(ingressKey(tenantId, second.digest), secondBytes);
  await service(store).sealUploadedWorkspace({
    workspaceId: workspaceTwo,
    grant: second.grant,
    indexEtag: indexBefore.etag
  });

  assert.deepEqual(parse(await store.get(tenantWorkspaceIndexKey(tenantId))).workspaces, [workspaceOne, workspaceTwo]);
});
