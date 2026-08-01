import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SOURCE_BYTES } from '../packages/audit-workspace-protocol/src/index.mjs';
import { createUploadGrant, inspectZipArchive } from '../packages/audit-workspaces/src/index.mjs';

const tenantId = `ten_${'1'.repeat(32)}`;

function concat(parts) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
function u16(value) { return Uint8Array.of(value & 255, (value >>> 8) & 255); }
function u32(value) { return Uint8Array.of(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255); }
function bytes(length) { return new Uint8Array(length); }
function zipEntry({
  centralName = 'contracts/Safe.sol',
  localName = centralName,
  method = 0,
  centralMethod = method,
  compressedBytes = 1,
  uncompressedBytes = compressedBytes,
  versionMadeBy = 20,
  externalAttributes = 0,
  flags = 0x0800,
  localFlags = flags
} = {}) {
  const encoder = new TextEncoder();
  const localPath = encoder.encode(localName);
  const centralPath = encoder.encode(centralName);
  const data = bytes(compressedBytes);
  const local = concat([
    u32(0x04034b50), u16(20), u16(localFlags), u16(method), u16(0), u16(0), u32(0),
    u32(compressedBytes), u32(uncompressedBytes), u16(localPath.length), u16(0), localPath, data
  ]);
  const central = concat([
    u32(0x02014b50), u16(versionMadeBy), u16(20), u16(flags), u16(centralMethod), u16(0), u16(0), u32(0),
    u32(compressedBytes), u32(uncompressedBytes), u16(centralPath.length), u16(0), u16(0), u16(0), u16(0),
    u32(externalAttributes), u32(0), centralPath
  ]);
  return concat([
    local,
    central,
    u32(0x06054b50), u16(0), u16(0), u16(1), u16(1), u32(central.length), u32(local.length), u16(0)
  ]);
}

async function digest(bytesValue) {
  const value = new Uint8Array(await crypto.subtle.digest('SHA-256', bytesValue));
  return [...value].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

test('upload grants cannot exceed one hour', async () => {
  const archive = zipEntry();
  const request = {
    tenantId,
    sha256: await digest(archive),
    bytes: archive.byteLength,
    contentType: 'application/zip',
    expiresAt: '2026-08-01T08:00:00.001Z'
  };
  await assert.rejects(() => createUploadGrant(request, {
    now: () => new Date('2026-08-01T07:00:00.000Z'),
    sign: async () => 'signature'
  }), /lifetime|expiresAt/i);
});

test('ZIP central and local headers must agree on path, flags, method, and bounds', async () => {
  await assert.rejects(() => inspectZipArchive(zipEntry({ localName: '../hidden.sol' })), /local|header|path|mismatch/i);
  await assert.rejects(() => inspectZipArchive(zipEntry({ method: 0, centralMethod: 8 })), /method|header|mismatch/i);
  await assert.rejects(() => inspectZipArchive(zipEntry({ localFlags: 0x0801 })), /encrypted|flags|header|mismatch/i);
});

test('ZIP entries allow only stored or deflate compression and reject Unix symlinks', async () => {
  await assert.rejects(() => inspectZipArchive(zipEntry({ method: 99 })), /compression|unsupported/i);
  const unixSymlink = (3 << 8) | 20;
  const symlinkMode = 0xa1ff << 16;
  await assert.rejects(() => inspectZipArchive(zipEntry({ versionMadeBy: unixSymlink, externalAttributes: symlinkMode >>> 0 })), /symlink|unsupported/i);
});

test('ZIP metadata is bounded by total uncompressed bytes and compression ratio', async () => {
  await assert.rejects(() => inspectZipArchive(zipEntry({ compressedBytes: 1, uncompressedBytes: MAX_SOURCE_BYTES + 1 })), /uncompressed|size|large/i);
  await assert.rejects(() => inspectZipArchive(zipEntry({ method: 8, compressedBytes: 1, uncompressedBytes: 10_001 })), /ratio|compressed|large/i);
});
