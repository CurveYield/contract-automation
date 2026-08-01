import {
  MAX_SOURCE_BYTES,
  ingressKey,
  layerArchiveKey,
  tenantWorkspaceIndexKey,
  validateGitHubWorkspaceSource,
  validateLayerManifest,
  validateUploadGrantRequest,
  validateWorkspaceManifest,
  workspaceLayerIndexKey,
  workspaceSealKey,
  workspaceSourceManifestKey
} from '../../audit-workspace-protocol/src/index.mjs';
import { ValidationError, assertAuditId, scanAuditForbiddenFields } from '../../audit-protocol/src/index.mjs';
import { ConditionalWriteError } from '../../audit-r2-store/src/index.mjs';

const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();
export const MAX_UPLOAD_GRANT_LIFETIME_MS = 60 * 60 * 1000;
export const MAX_ARCHIVE_COMPRESSION_RATIO = 10_000;
const SUPPORTED_ZIP_COMPRESSION_METHODS = new Set([0, 8]);

function toBytes(value) {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  if (typeof value === 'string') return encoder.encode(value);
  throw new TypeError('Workspace bytes must be a string or byte array');
}
async function digestHex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function object(value, path = '$') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('invalid_type', `${path} must be an object`, path);
}
function allowed(value, names, path = '$') {
  for (const key of Object.keys(value)) if (!names.has(key)) throw new ValidationError('unknown_field', `${path}.${key} is not allowed`, `${path}.${key}`);
}
function required(value, names, path = '$') {
  for (const key of names) if (!(key in value)) throw new ValidationError('missing_field', `${path}.${key} is required`, `${path}.${key}`);
}
function iso(value, path) {
  if (typeof value !== 'string') throw new ValidationError('invalid_timestamp', `${path} must be an ISO instant`, path);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) throw new ValidationError('invalid_timestamp', `${path} must be a canonical ISO instant`, path);
  return value;
}
function json(record) {
  if (!record) return null;
  const text = typeof record.value === 'string' ? record.value : decoder.decode(record.value);
  return JSON.parse(text);
}
function u16(view, offset) { return view.getUint16(offset, true); }
function u32(view, offset) { return view.getUint32(offset, true); }
function safeArchivePath(path) {
  if (!path || path.includes('\0') || path.includes('\\') || path.startsWith('/') || /^[A-Za-z]:/.test(path)) {
    throw new ValidationError('unsafe_archive_path', `Unsafe archive path: ${path}`, '$.archive');
  }
  const directory = path.endsWith('/');
  const trimmed = directory ? path.slice(0, -1) : path;
  const segments = trimmed.split('/');
  if (!trimmed || segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new ValidationError('unsafe_archive_path', `Unsafe archive path: ${path}`, '$.archive');
  }
  return { path, directory };
}
function decodeArchiveName(bytes, start, length) {
  try { return decoder.decode(bytes.subarray(start, start + length)); }
  catch { throw new ValidationError('invalid_zip_name', 'ZIP entry names must be valid UTF-8', '$.archive'); }
}
function assertUploadGrantLifetime(issuedAt, expiresAt, path = '$.expiresAt') {
  const issued = new Date(issuedAt).getTime();
  const expires = new Date(expiresAt).getTime();
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || expires <= issued || expires - issued > MAX_UPLOAD_GRANT_LIFETIME_MS) {
    throw new ValidationError('invalid_grant_lifetime', `${path} must be no more than one hour after issuance`, path);
  }
}

export async function inspectZipArchive(value) {
  const bytes = toBytes(value);
  if (bytes.byteLength < 22 || bytes.byteLength > MAX_SOURCE_BYTES) throw new ValidationError('invalid_zip', 'ZIP archive size is invalid', '$.archive');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minimum = Math.max(0, bytes.byteLength - 22 - 65_535);
  let eocd = -1;
  for (let offset = bytes.byteLength - 22; offset >= minimum; offset -= 1) {
    if (u32(view, offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new ValidationError('invalid_zip', 'ZIP end-of-central-directory record is missing', '$.archive');
  if (u16(view, eocd + 4) !== 0 || u16(view, eocd + 6) !== 0) throw new ValidationError('unsupported_zip', 'Multi-disk ZIP archives are not supported', '$.archive');
  const diskEntries = u16(view, eocd + 8);
  const totalEntries = u16(view, eocd + 10);
  const centralSize = u32(view, eocd + 12);
  const centralOffset = u32(view, eocd + 16);
  if (diskEntries === 0xffff || totalEntries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) throw new ValidationError('unsupported_zip', 'ZIP64 archives are not supported', '$.archive');
  if (diskEntries !== totalEntries || totalEntries > 20_000 || centralOffset + centralSize > eocd) throw new ValidationError('invalid_zip', 'ZIP central directory is invalid', '$.archive');
  const files = [];
  const seen = new Set();
  let totalUncompressedBytes = 0;
  let cursor = centralOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > eocd || u32(view, cursor) !== 0x02014b50) throw new ValidationError('invalid_zip', 'ZIP central directory entry is invalid', '$.archive');
    const versionMadeBy = u16(view, cursor + 4);
    const flags = u16(view, cursor + 8);
    if ((flags & 0x0001) !== 0) throw new ValidationError('unsupported_zip', 'Encrypted ZIP entries are not supported', '$.archive');
    const compressionMethod = u16(view, cursor + 10);
    if (!SUPPORTED_ZIP_COMPRESSION_METHODS.has(compressionMethod)) throw new ValidationError('unsupported_zip', `ZIP compression method ${compressionMethod} is not supported`, '$.archive');
    const crc32 = u32(view, cursor + 16);
    const compressedBytes = u32(view, cursor + 20);
    const uncompressedBytes = u32(view, cursor + 24);
    const nameLength = u16(view, cursor + 28);
    const extraLength = u16(view, cursor + 30);
    const commentLength = u16(view, cursor + 32);
    const externalAttributes = u32(view, cursor + 38);
    const localHeaderOffset = u32(view, cursor + 42);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (nameLength < 1 || next > eocd || localHeaderOffset + 30 > centralOffset) throw new ValidationError('invalid_zip', 'ZIP entry bounds are invalid', '$.archive');
    const name = decodeArchiveName(bytes, cursor + 46, nameLength);
    const safe = safeArchivePath(name);
    if (seen.has(name)) throw new ValidationError('duplicate_archive_path', `Duplicate archive path: ${name}`, '$.archive');
    seen.add(name);

    const platform = versionMadeBy >>> 8;
    const unixMode = externalAttributes >>> 16;
    if (platform === 3 && (unixMode & 0xf000) === 0xa000) throw new ValidationError('unsupported_zip', `Symbolic links are not supported: ${name}`, '$.archive');
    totalUncompressedBytes += uncompressedBytes;
    if (!Number.isSafeInteger(totalUncompressedBytes) || totalUncompressedBytes > MAX_SOURCE_BYTES) throw new ValidationError('archive_too_large', 'ZIP total uncompressed size exceeds the source limit', '$.archive');
    if (uncompressedBytes > 0 && uncompressedBytes / Math.max(compressedBytes, 1) > MAX_ARCHIVE_COMPRESSION_RATIO) {
      throw new ValidationError('compression_ratio_exceeded', `ZIP entry compression ratio is too large: ${name}`, '$.archive');
    }

    if (u32(view, localHeaderOffset) !== 0x04034b50) throw new ValidationError('invalid_zip', `ZIP local header is missing: ${name}`, '$.archive');
    const localFlags = u16(view, localHeaderOffset + 6);
    const localMethod = u16(view, localHeaderOffset + 8);
    const localCrc32 = u32(view, localHeaderOffset + 14);
    const localCompressedBytes = u32(view, localHeaderOffset + 18);
    const localUncompressedBytes = u32(view, localHeaderOffset + 22);
    const localNameLength = u16(view, localHeaderOffset + 26);
    const localExtraLength = u16(view, localHeaderOffset + 28);
    const localNameStart = localHeaderOffset + 30;
    const localDataStart = localNameStart + localNameLength + localExtraLength;
    const localDataEnd = localDataStart + compressedBytes;
    if (localNameLength < 1 || localDataStart > centralOffset || localDataEnd > centralOffset) throw new ValidationError('invalid_zip', `ZIP local entry bounds are invalid: ${name}`, '$.archive');
    const localName = decodeArchiveName(bytes, localNameStart, localNameLength);
    if (localName !== name) throw new ValidationError('invalid_zip', `ZIP local and central entry paths do not match: ${name}`, '$.archive');
    if (localFlags !== flags) throw new ValidationError('invalid_zip', `ZIP local and central flags do not match: ${name}`, '$.archive');
    if ((localFlags & 0x0001) !== 0) throw new ValidationError('unsupported_zip', 'Encrypted ZIP entries are not supported', '$.archive');
    if (localMethod !== compressionMethod) throw new ValidationError('invalid_zip', `ZIP local and central compression methods do not match: ${name}`, '$.archive');
    if ((flags & 0x0008) === 0 && (localCrc32 !== crc32 || localCompressedBytes !== compressedBytes || localUncompressedBytes !== uncompressedBytes)) {
      throw new ValidationError('invalid_zip', `ZIP local and central entry metadata do not match: ${name}`, '$.archive');
    }

    files.push({ path: safe.path, directory: safe.directory, compressionMethod, crc32, compressedBytes, uncompressedBytes });
    cursor = next;
  }
  if (cursor !== centralOffset + centralSize) throw new ValidationError('invalid_zip', 'ZIP central directory size does not match entries', '$.archive');
  files.sort((left, right) => left.path.localeCompare(right.path));
  const canonicalBytes = encoder.encode(JSON.stringify(files));
  return Object.freeze({
    schemaVersion: 'zip-manifest-v1',
    files: Object.freeze(files.map((item) => Object.freeze(item))),
    fileCount: files.filter((item) => !item.directory).length,
    totalUncompressedBytes,
    canonicalArchiveSha256: await digestHex(canonicalBytes)
  });
}

export function workspaceSourceArchiveKey(workspaceId) {
  assertAuditId(workspaceId, 'workspace', '$.workspaceId');
  return `workspaces/${workspaceId}/source-v1.zip`;
}
export function workspaceEventBatchKey(workspaceId, batchId) {
  assertAuditId(workspaceId, 'workspace', '$.workspaceId');
  if (typeof batchId !== 'string' || !/^[0-9]{8}$/.test(batchId)) throw new ValidationError('invalid_batch_id', '$.batchId must be eight digits', '$.batchId');
  return `workspaces/${workspaceId}/events/${batchId}.jsonl`;
}
function canonicalGrantPayload(grant) {
  return JSON.stringify({
    schemaVersion: grant.schemaVersion,
    tenantId: grant.tenantId,
    sha256: grant.sha256,
    bytes: grant.bytes,
    contentType: grant.contentType,
    expiresAt: grant.expiresAt,
    destinationKey: grant.destinationKey,
    issuedAt: grant.issuedAt
  });
}
export async function createUploadGrant(request, options = {}) {
  const validated = validateUploadGrantRequest(request);
  const now = (options.now ?? (() => new Date()))();
  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime())) throw new TypeError('now must produce a valid date');
  if (new Date(validated.expiresAt).getTime() <= nowDate.getTime()) throw new ValidationError('expired_grant', '$.expiresAt must be in the future', '$.expiresAt');
  assertUploadGrantLifetime(nowDate.toISOString(), validated.expiresAt);
  if (typeof options.sign !== 'function') throw new TypeError('createUploadGrant requires a signing callback');
  const grant = {
    schemaVersion: 'upload-grant-v1',
    ...validated,
    destinationKey: ingressKey(validated.tenantId, validated.sha256),
    issuedAt: nowDate.toISOString()
  };
  return Object.freeze({ ...grant, signature: await options.sign(canonicalGrantPayload(grant)) });
}
function validateGrant(grant) {
  object(grant, '$.grant');
  const names = new Set(['schemaVersion', 'tenantId', 'sha256', 'bytes', 'contentType', 'expiresAt', 'destinationKey', 'issuedAt', 'signature']);
  allowed(grant, names, '$.grant'); required(grant, names, '$.grant');
  if (grant.schemaVersion !== 'upload-grant-v1') throw new ValidationError('invalid_schema_version', '$.grant.schemaVersion must be upload-grant-v1', '$.grant.schemaVersion');
  const request = validateUploadGrantRequest({ tenantId: grant.tenantId, sha256: grant.sha256, bytes: grant.bytes, contentType: grant.contentType, expiresAt: grant.expiresAt });
  if (grant.destinationKey !== ingressKey(request.tenantId, request.sha256)) throw new ValidationError('invalid_destination', '$.grant.destinationKey is invalid', '$.grant.destinationKey');
  iso(grant.issuedAt, '$.grant.issuedAt');
  assertUploadGrantLifetime(grant.issuedAt, grant.expiresAt, '$.grant.expiresAt');
  if (typeof grant.signature !== 'string' || grant.signature.length < 1 || grant.signature.length > 512) throw new ValidationError('invalid_signature', '$.grant.signature is invalid', '$.grant.signature');
  return structuredClone(grant);
}
function validateTenantIndex(index, tenantId, workspaceId) {
  object(index, '$.tenantIndex'); scanAuditForbiddenFields(index, '$.tenantIndex');
  const names = new Set(['schemaVersion', 'tenantId', 'workspaces', 'records']);
  allowed(index, names, '$.tenantIndex'); required(index, new Set(['schemaVersion', 'tenantId', 'workspaces']), '$.tenantIndex');
  if (index.schemaVersion !== 'tenant-workspaces-v1') throw new ValidationError('invalid_schema_version', '$.tenantIndex.schemaVersion must be tenant-workspaces-v1', '$.tenantIndex.schemaVersion');
  if (index.tenantId !== tenantId) throw new ValidationError('tenant_mismatch', '$.tenantIndex.tenantId must match', '$.tenantIndex.tenantId');
  if (!Array.isArray(index.workspaces) || !index.workspaces.includes(workspaceId)) throw new ValidationError('invalid_workspace_index', '$.tenantIndex.workspaces must include the workspace', '$.tenantIndex.workspaces');
  index.workspaces.forEach((id, i) => assertAuditId(id, 'workspace', `$.tenantIndex.workspaces[${i}]`));
  if (index.records !== undefined) object(index.records, '$.tenantIndex.records');
  return structuredClone(index);
}
function validateStoredTenantIndex(index, tenantId) {
  object(index, '$.storedTenantIndex'); scanAuditForbiddenFields(index, '$.storedTenantIndex');
  const names = new Set(['schemaVersion', 'tenantId', 'workspaces', 'records']);
  allowed(index, names, '$.storedTenantIndex'); required(index, new Set(['schemaVersion', 'tenantId', 'workspaces']), '$.storedTenantIndex');
  if (index.schemaVersion !== 'tenant-workspaces-v1' || index.tenantId !== tenantId || !Array.isArray(index.workspaces)) {
    throw new ValidationError('invalid_workspace_index', 'Stored tenant workspace index is invalid', '$.storedTenantIndex');
  }
  index.workspaces.forEach((id, i) => assertAuditId(id, 'workspace', `$.storedTenantIndex.workspaces[${i}]`));
  if (index.records !== undefined) object(index.records, '$.storedTenantIndex.records');
  return structuredClone(index);
}
function emptyTenantIndex(tenantId) {
  return { schemaVersion: 'tenant-workspaces-v1', tenantId, workspaces: [], records: {} };
}
function indexCondition(etag) { return etag ? { etagMatches: etag } : { etagDoesNotMatch: '*' }; }
function assertExpectedIndexEtag(expected, record) {
  if (expected === undefined) return;
  if (!record || record.etag !== expected) throw new ValidationError('stale_index', '$.indexEtag is stale', '$.indexEtag');
}
async function putImmutable(store, key, value, verifyExisting) {
  try {
    await store.put(key, value, { onlyIf: { etagDoesNotMatch: '*' } });
    return false;
  } catch (error) {
    if (!(error instanceof ConditionalWriteError)) throw error;
    const existing = await store.get(key);
    if (!existing || !(await verifyExisting(existing))) throw error;
    return true;
  }
}

export class WorkspaceService {
  constructor(store, options = {}) {
    if (!store || typeof store.get !== 'function' || typeof store.put !== 'function') throw new TypeError('WorkspaceService requires an Audit store');
    this.store = store;
    this.now = options.now ?? (() => new Date());
    this.verifyGrant = options.verifyGrant ?? (async () => false);
  }
  currentInstant() {
    const value = this.now();
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) throw new TypeError('now must produce a valid date');
    return date;
  }
  async sealUploadedWorkspace(input) {
    object(input); scanAuditForbiddenFields(input);
    allowed(input, new Set(['workspaceId', 'grant', 'tenantIndex', 'indexEtag'])); required(input, new Set(['workspaceId', 'grant', 'tenantIndex']));
    assertAuditId(input.workspaceId, 'workspace', '$.workspaceId');
    const grant = validateGrant(input.grant);
    validateTenantIndex(input.tenantIndex, grant.tenantId, input.workspaceId);
    const now = this.currentInstant();
    if (new Date(grant.expiresAt).getTime() <= now.getTime()) throw new ValidationError('expired_grant', 'Upload grant has expired', '$.grant.expiresAt');
    if (!(await this.verifyGrant(canonicalGrantPayload(grant), grant.signature))) throw new ValidationError('invalid_signature', 'Upload grant signature is invalid', '$.grant.signature');
    const indexKey = tenantWorkspaceIndexKey(grant.tenantId);
    const [sourceRecord, indexRecord] = await Promise.all([
      this.store.get(grant.destinationKey),
      this.store.get(indexKey)
    ]);
    if (!sourceRecord) throw new ValidationError('source_missing', 'Uploaded source object is missing', '$.grant.destinationKey');
    assertExpectedIndexEtag(input.indexEtag, indexRecord);
    const bytes = toBytes(sourceRecord.value);
    if (bytes.byteLength !== grant.bytes) throw new ValidationError('size_mismatch', 'Uploaded source size does not match grant', '$.grant.bytes');
    if (await digestHex(bytes) !== grant.sha256) throw new ValidationError('digest_mismatch', 'Uploaded source digest does not match grant', '$.grant.sha256');
    const inspected = await inspectZipArchive(bytes);
    const durableKey = workspaceSourceArchiveKey(input.workspaceId);
    const manifest = validateWorkspaceManifest({
      schemaVersion: 'workspace-manifest-v1', workspaceId: input.workspaceId, tenantId: grant.tenantId, sourceKind: 'upload',
      sourceSha256: grant.sha256, sourceBytes: grant.bytes, sourceObjectKey: durableKey, sealedAt: now.toISOString(),
      canonicalArchiveSha256: inspected.canonicalArchiveSha256, fileCount: inspected.fileCount
    });
    const seal = { schemaVersion: 'workspace-seal-v1', workspaceId: input.workspaceId, tenantId: grant.tenantId, sourceManifestKey: workspaceSourceManifestKey(input.workspaceId), sourceSha256: grant.sha256, sealedAt: manifest.sealedAt };
    const currentIndex = indexRecord ? validateStoredTenantIndex(json(indexRecord), grant.tenantId) : emptyTenantIndex(grant.tenantId);
    const storedIndex = {
      ...currentIndex,
      workspaces: [...new Set([...currentIndex.workspaces, input.workspaceId])].sort(),
      records: { ...(currentIndex.records ?? {}), [input.workspaceId]: { sourceKind: 'upload', sourceSha256: grant.sha256, sealedAt: manifest.sealedAt } }
    };
    const archiveExisting = await putImmutable(this.store, durableKey, bytes, async (existing) => existing.size === bytes.byteLength && await digestHex(toBytes(existing.value)) === grant.sha256);
    const manifestExisting = await putImmutable(this.store, workspaceSourceManifestKey(input.workspaceId), JSON.stringify(manifest), async (existing) => {
      const parsed = json(existing);
      return parsed?.workspaceId === input.workspaceId && parsed?.tenantId === grant.tenantId && parsed?.sourceSha256 === grant.sha256 && parsed?.sourceObjectKey === durableKey;
    });
    const sealExisting = await putImmutable(this.store, workspaceSealKey(input.workspaceId), JSON.stringify(seal), async (existing) => {
      const parsed = json(existing);
      return parsed?.workspaceId === input.workspaceId && parsed?.tenantId === grant.tenantId && parsed?.sourceSha256 === grant.sha256;
    });
    await this.store.put(indexKey, JSON.stringify(storedIndex), { onlyIf: indexCondition(indexRecord?.etag) });
    return Object.freeze({ workspaceId: input.workspaceId, manifest: Object.freeze(manifest), idempotent: archiveExisting || manifestExisting || sealExisting });
  }
  async importGitHubWorkspace(input) {
    object(input); scanAuditForbiddenFields(input);
    allowed(input, new Set(['workspaceId', 'source', 'archiveBytes', 'tenantIndex', 'indexEtag'])); required(input, new Set(['workspaceId', 'source', 'archiveBytes', 'tenantIndex']));
    assertAuditId(input.workspaceId, 'workspace', '$.workspaceId');
    const source = validateGitHubWorkspaceSource(input.source);
    const bytes = toBytes(input.archiveBytes);
    if (bytes.byteLength !== source.bytes) throw new ValidationError('size_mismatch', 'GitHub source size does not match metadata', '$.source.bytes');
    if (await digestHex(bytes) !== source.archiveSha256) throw new ValidationError('digest_mismatch', 'GitHub source digest does not match metadata', '$.source.archiveSha256');
    const inspected = await inspectZipArchive(bytes); const now = this.currentInstant().toISOString();
    const archiveKey = workspaceSourceArchiveKey(input.workspaceId);
    const manifest = validateWorkspaceManifest({ schemaVersion: 'workspace-manifest-v1', workspaceId: input.workspaceId, tenantId: source.tenantId, sourceKind: 'github', sourceSha256: source.archiveSha256, sourceBytes: source.bytes, sourceObjectKey: archiveKey, sealedAt: now, canonicalArchiveSha256: inspected.canonicalArchiveSha256, fileCount: inspected.fileCount });
    const seal = { schemaVersion: 'workspace-seal-v1', workspaceId: input.workspaceId, tenantId: source.tenantId, sourceManifestKey: workspaceSourceManifestKey(input.workspaceId), sourceSha256: source.archiveSha256, sealedAt: now, repository: source.repository, commitSha: source.commitSha, refName: source.refName };
    const suppliedIndex = validateTenantIndex(input.tenantIndex, source.tenantId, input.workspaceId);
    const storedIndex = { ...suppliedIndex, workspaces: [...new Set(suppliedIndex.workspaces)].sort(), records: { ...(suppliedIndex.records ?? {}), [input.workspaceId]: { sourceKind: 'github', sourceSha256: source.archiveSha256, repository: source.repository, commitSha: source.commitSha, sealedAt: now } } };
    await this.store.put(archiveKey, bytes, { onlyIf: { etagDoesNotMatch: '*' } });
    await this.store.put(workspaceSourceManifestKey(input.workspaceId), JSON.stringify(manifest), { onlyIf: { etagDoesNotMatch: '*' } });
    await this.store.put(workspaceSealKey(input.workspaceId), JSON.stringify(seal), { onlyIf: { etagDoesNotMatch: '*' } });
    await this.store.put(tenantWorkspaceIndexKey(source.tenantId), JSON.stringify(storedIndex), { onlyIf: indexCondition(input.indexEtag) });
    return Object.freeze({ workspaceId: input.workspaceId, manifest: Object.freeze(manifest) });
  }
  async attachLayer(input) {
    object(input); scanAuditForbiddenFields(input);
    allowed(input, new Set(['archiveBytes', 'manifest', 'layerIndex', 'indexEtag', 'eventBatch'])); required(input, new Set(['archiveBytes', 'manifest', 'layerIndex', 'eventBatch']));
    const manifest = validateLayerManifest(input.manifest); const bytes = toBytes(input.archiveBytes);
    if (bytes.byteLength !== manifest.archiveBytes) throw new ValidationError('size_mismatch', 'Layer archive size does not match manifest', '$.manifest.archiveBytes');
    if (await digestHex(bytes) !== manifest.archiveSha256) throw new ValidationError('digest_mismatch', 'Layer archive digest does not match manifest', '$.manifest.archiveSha256');
    if (manifest.archiveObjectKey !== layerArchiveKey(manifest.workspaceId, manifest.layerId)) throw new ValidationError('invalid_object_key', 'Layer archive object key is not deterministic', '$.manifest.archiveObjectKey');
    const index = this.validateLayerIndex(input.layerIndex, manifest.workspaceId, manifest.layerId);
    const event = this.validateEventBatch(input.eventBatch, manifest.workspaceId, manifest.layerId);
    await this.store.put(manifest.archiveObjectKey, bytes, { onlyIf: { etagDoesNotMatch: '*' } });
    const verified = await this.store.get(manifest.archiveObjectKey);
    if (!verified || verified.size !== bytes.byteLength) throw new ValidationError('verification_failed', 'Layer archive verification failed', '$.archiveBytes');
    await this.store.put(`workspaces/${manifest.workspaceId}/layers/${manifest.layerId}-manifest-v1.json`, JSON.stringify(manifest), { onlyIf: { etagDoesNotMatch: '*' } });
    await this.store.put(workspaceLayerIndexKey(manifest.workspaceId), JSON.stringify(index), { onlyIf: indexCondition(input.indexEtag) });
    await this.store.put(workspaceEventBatchKey(manifest.workspaceId, event.batchId), `${JSON.stringify(event)}\n`, { onlyIf: { etagDoesNotMatch: '*' } });
    return Object.freeze({ workspaceId: manifest.workspaceId, layerId: manifest.layerId });
  }
  validateLayerIndex(index, workspaceId, layerId) {
    object(index, '$.layerIndex'); scanAuditForbiddenFields(index, '$.layerIndex');
    const names = new Set(['schemaVersion', 'workspaceId', 'layers', 'records']); allowed(index, names, '$.layerIndex'); required(index, new Set(['schemaVersion', 'workspaceId', 'layers']), '$.layerIndex');
    if (index.schemaVersion !== 'workspace-layer-index-v1' || index.workspaceId !== workspaceId) throw new ValidationError('invalid_layer_index', 'Layer index identity is invalid', '$.layerIndex');
    if (!Array.isArray(index.layers) || !index.layers.includes(layerId)) throw new ValidationError('invalid_layer_index', 'Layer index must include the layer', '$.layerIndex.layers');
    index.layers.forEach((id, i) => assertAuditId(id, 'layer', `$.layerIndex.layers[${i}]`));
    return { ...structuredClone(index), layers: [...new Set(index.layers)].sort(), records: { ...(index.records ?? {}), [layerId]: { attached: true } } };
  }
  validateEventBatch(batch, workspaceId, layerId) {
    object(batch, '$.eventBatch'); scanAuditForbiddenFields(batch, '$.eventBatch');
    const names = new Set(['schemaVersion', 'batchId', 'workspaceId', 'events']); allowed(batch, names, '$.eventBatch'); required(batch, names, '$.eventBatch');
    if (batch.schemaVersion !== 'workspace-event-batch-v1' || batch.workspaceId !== workspaceId) throw new ValidationError('invalid_event_batch', 'Event batch identity is invalid', '$.eventBatch');
    workspaceEventBatchKey(workspaceId, batch.batchId);
    if (!Array.isArray(batch.events) || batch.events.length < 1 || batch.events.length > 32) throw new ValidationError('invalid_event_batch', 'Event batch must contain 1 to 32 events', '$.eventBatch.events');
    if (!batch.events.some((event) => event?.type === 'layer_attached' && event.layerId === layerId)) throw new ValidationError('invalid_event_batch', 'Event batch must contain the layer attachment event', '$.eventBatch.events');
    return structuredClone(batch);
  }
  async readWorkspace(workspaceId) {
    assertAuditId(workspaceId, 'workspace', '$.workspaceId');
    const record = await this.store.get(workspaceSourceManifestKey(workspaceId));
    if (!record) throw new ValidationError('not_found', 'Workspace not found', '$.workspaceId');
    return Object.freeze(json(record));
  }
  async readLayerIndex(workspaceId) {
    assertAuditId(workspaceId, 'workspace', '$.workspaceId');
    const record = await this.store.get(workspaceLayerIndexKey(workspaceId));
    return Object.freeze(record ? json(record) : { schemaVersion: 'workspace-layer-index-v1', workspaceId, layers: [], records: {} });
  }
}
