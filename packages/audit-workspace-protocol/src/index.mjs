import {
  ValidationError,
  assertAuditId,
  createOperationBudget,
  scanAuditForbiddenFields
} from '../../audit-protocol/src/index.mjs';

export const MAX_SOURCE_BYTES = 250 * 1024 * 1024;
export const MAX_LAYER_BYTES = 100_000_000;
export const MAX_WORKSPACE_MANIFEST_BYTES = 2_000_000;
export const ZIP_CONTENT_TYPE = 'application/zip';

export const WORKSPACE_OPERATION_BUDGETS = Object.freeze({
  uploadSource: Object.freeze(createOperationBudget({ classA: 1, classB: 0, storageBytes: 10_000_000 })),
  sealWorkspace: Object.freeze(createOperationBudget({ classA: 4, classB: 2, storageBytes: 10_500_000 })),
  importGitHub: Object.freeze(createOperationBudget({ classA: 4, classB: 0, storageBytes: 10_500_000 })),
  attachLayer: Object.freeze(createOperationBudget({ classA: 4, classB: 1, storageBytes: 5_250_000 })),
  readLayerIndex: Object.freeze(createOperationBudget({ classA: 0, classB: 1, storageBytes: 0 }))
});

function assertPlainObject(value, path = '$') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('invalid_type', `${path} must be an object`, path);
  }
}

function assertAllowedKeys(value, allowed, path = '$') {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new ValidationError('unknown_field', `${path}.${key} is not allowed`, `${path}.${key}`);
  }
}

function assertRequiredKeys(value, required, path = '$') {
  for (const key of required) {
    if (!(key in value)) throw new ValidationError('missing_field', `${path}.${key} is required`, `${path}.${key}`);
  }
}

function assertString(value, path, max = 256) {
  if (typeof value !== 'string' || value.length < 1 || value.length > max) {
    throw new ValidationError('invalid_string', `${path} must be a non-empty string up to ${max} characters`, path);
  }
  return value;
}

function assertSha256(value, path) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw new ValidationError('invalid_sha256', `${path} must be a lowercase SHA-256 digest`, path);
  }
  return value;
}

function assertBytes(value, path, maximum) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new ValidationError('invalid_size', `${path} must be an integer from 1 to ${maximum}`, path);
  }
  return value;
}

function assertCount(value, path) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100_000) {
    throw new ValidationError('invalid_count', `${path} must be an integer from 0 to 100000`, path);
  }
  return value;
}

function assertIsoInstant(value, path) {
  assertString(value, path, 40);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new ValidationError('invalid_timestamp', `${path} must be a canonical ISO-8601 instant`, path);
  }
  return value;
}

function assertSafeObjectKey(value, path) {
  assertString(value, path, 1024);
  if (value.startsWith('/') || value.includes('..') || value.includes('\\') || /[\u0000-\u001f]/.test(value)) {
    throw new ValidationError('invalid_object_key', `${path} must be a safe relative R2 object key`, path);
  }
  return value;
}

function assertManifestSize(value, path) {
  const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  if (bytes > MAX_WORKSPACE_MANIFEST_BYTES) {
    throw new ValidationError('manifest_too_large', `${path} exceeds ${MAX_WORKSPACE_MANIFEST_BYTES} bytes`, path);
  }
}

export function ingressKey(tenantId, sha256) {
  assertAuditId(tenantId, 'tenant', '$.tenantId');
  assertSha256(sha256, '$.sha256');
  return `ingress/${tenantId}/${sha256}.zip`;
}

export function workspaceSealKey(workspaceId) {
  assertAuditId(workspaceId, 'workspace', '$.workspaceId');
  return `workspaces/${workspaceId}/seal-v1.json`;
}

export function workspaceSourceManifestKey(workspaceId) {
  assertAuditId(workspaceId, 'workspace', '$.workspaceId');
  return `workspaces/${workspaceId}/source-manifest-v1.json`;
}

export function tenantWorkspaceIndexKey(tenantId) {
  assertAuditId(tenantId, 'tenant', '$.tenantId');
  return `indexes/tenant/${tenantId}/workspaces-v1.json`;
}

export function layerArchiveKey(workspaceId, layerId) {
  assertAuditId(workspaceId, 'workspace', '$.workspaceId');
  assertAuditId(layerId, 'layer', '$.layerId');
  return `workspaces/${workspaceId}/layers/${layerId}.tar.zst`;
}

export function layerManifestKey(workspaceId, layerId) {
  assertAuditId(workspaceId, 'workspace', '$.workspaceId');
  assertAuditId(layerId, 'layer', '$.layerId');
  return `workspaces/${workspaceId}/layers/${layerId}-manifest-v1.json`;
}

export function workspaceLayerIndexKey(workspaceId) {
  assertAuditId(workspaceId, 'workspace', '$.workspaceId');
  return `indexes/workspace/${workspaceId}/layers-v1.json`;
}

export function validateUploadGrantRequest(value) {
  assertPlainObject(value);
  scanAuditForbiddenFields(value);
  const keys = new Set(['tenantId', 'sha256', 'bytes', 'contentType', 'expiresAt']);
  assertAllowedKeys(value, keys);
  assertRequiredKeys(value, keys);
  assertAuditId(value.tenantId, 'tenant', '$.tenantId');
  assertSha256(value.sha256, '$.sha256');
  assertBytes(value.bytes, '$.bytes', MAX_SOURCE_BYTES);
  if (value.contentType !== ZIP_CONTENT_TYPE) {
    throw new ValidationError('invalid_content_type', `$.contentType must be ${ZIP_CONTENT_TYPE}`, '$.contentType');
  }
  assertIsoInstant(value.expiresAt, '$.expiresAt');
  return structuredClone(value);
}

export function validateGitHubWorkspaceSource(value) {
  assertPlainObject(value);
  scanAuditForbiddenFields(value);
  const keys = new Set(['tenantId', 'repository', 'commitSha', 'refName', 'archiveSha256', 'bytes']);
  assertAllowedKeys(value, keys);
  assertRequiredKeys(value, keys);
  assertAuditId(value.tenantId, 'tenant', '$.tenantId');
  if (typeof value.repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value.repository)) {
    throw new ValidationError('invalid_repository', '$.repository must be an owner/name GitHub repository identity', '$.repository');
  }
  if (typeof value.commitSha !== 'string' || !/^[0-9a-f]{40}$/.test(value.commitSha)) {
    throw new ValidationError('unresolved_git_ref', '$.commitSha must be an exact lowercase 40-hex commit SHA', '$.commitSha');
  }
  assertString(value.refName, '$.refName', 255);
  assertSha256(value.archiveSha256, '$.archiveSha256');
  assertBytes(value.bytes, '$.bytes', MAX_SOURCE_BYTES);
  return structuredClone(value);
}

export function validateWorkspaceManifest(value) {
  assertPlainObject(value);
  scanAuditForbiddenFields(value);
  const keys = new Set([
    'schemaVersion', 'workspaceId', 'tenantId', 'sourceKind', 'sourceSha256',
    'sourceBytes', 'sourceObjectKey', 'sealedAt', 'canonicalArchiveSha256', 'fileCount'
  ]);
  assertAllowedKeys(value, keys);
  assertRequiredKeys(value, keys);
  if (value.schemaVersion !== 'workspace-manifest-v1') {
    throw new ValidationError('invalid_schema_version', '$.schemaVersion must be workspace-manifest-v1', '$.schemaVersion');
  }
  assertAuditId(value.workspaceId, 'workspace', '$.workspaceId');
  assertAuditId(value.tenantId, 'tenant', '$.tenantId');
  if (!['inline', 'upload', 'github'].includes(value.sourceKind)) {
    throw new ValidationError('invalid_source_kind', '$.sourceKind is unsupported', '$.sourceKind');
  }
  assertSha256(value.sourceSha256, '$.sourceSha256');
  assertBytes(value.sourceBytes, '$.sourceBytes', MAX_SOURCE_BYTES);
  assertSafeObjectKey(value.sourceObjectKey, '$.sourceObjectKey');
  assertIsoInstant(value.sealedAt, '$.sealedAt');
  assertSha256(value.canonicalArchiveSha256, '$.canonicalArchiveSha256');
  assertCount(value.fileCount, '$.fileCount');
  assertManifestSize(value, '$');
  return structuredClone(value);
}

export function validateLayerManifest(value) {
  assertPlainObject(value);
  scanAuditForbiddenFields(value);
  const keys = new Set([
    'schemaVersion', 'layerId', 'workspaceId', 'archiveSha256', 'archiveBytes',
    'archiveObjectKey', 'createdAt', 'generator', 'fileCount'
  ]);
  assertAllowedKeys(value, keys);
  assertRequiredKeys(value, keys);
  if (value.schemaVersion !== 'layer-manifest-v1') {
    throw new ValidationError('invalid_schema_version', '$.schemaVersion must be layer-manifest-v1', '$.schemaVersion');
  }
  assertAuditId(value.layerId, 'layer', '$.layerId');
  assertAuditId(value.workspaceId, 'workspace', '$.workspaceId');
  assertSha256(value.archiveSha256, '$.archiveSha256');
  assertBytes(value.archiveBytes, '$.archiveBytes', MAX_LAYER_BYTES);
  assertSafeObjectKey(value.archiveObjectKey, '$.archiveObjectKey');
  assertIsoInstant(value.createdAt, '$.createdAt');
  assertString(value.generator, '$.generator', 160);
  assertCount(value.fileCount, '$.fileCount');
  assertManifestSize(value, '$');
  return structuredClone(value);
}
