import { PUBLIC_INTERFACE_LOCK_SCHEMA, SAFE_CAPABILITIES } from './contracts.mjs';
import {
  canonicalJson,
  exact,
  exportName,
  frozen,
  identifier,
  ordinaryArray,
  pathValue,
  sortedUnique,
  validateCapabilities,
  version,
  fail
} from './boundary.mjs';

export function createPublicInterfaceLock(input) {
  const safe = exact(input, [
    'componentId',
    'schemaVersion',
    'entrypoints',
    'exports',
    'storagePrefixes',
    'lifecycleOutcomes',
    'capabilities'
  ]);

  return frozen({
    lockSchemaVersion: PUBLIC_INTERFACE_LOCK_SCHEMA,
    componentId: identifier(safe.componentId, '$.componentId'),
    schemaVersion: version(safe.schemaVersion, '$.schemaVersion'),
    entrypoints: sortedUnique(safe.entrypoints, '$.entrypoints', 128, pathValue),
    exports: sortedUnique(safe.exports, '$.exports', 512, exportName),
    storagePrefixes: sortedUnique(safe.storagePrefixes, '$.storagePrefixes', 128, pathValue),
    lifecycleOutcomes: sortedUnique(safe.lifecycleOutcomes, '$.lifecycleOutcomes', 128, identifier),
    capabilities: validateCapabilities(safe.capabilities, '$.capabilities')
  });
}

export function validatePublicInterfaceLock(value) {
  const safe = exact(value, [
    'lockSchemaVersion',
    'componentId',
    'schemaVersion',
    'entrypoints',
    'exports',
    'storagePrefixes',
    'lifecycleOutcomes',
    'capabilities'
  ]);

  if (safe.lockSchemaVersion !== PUBLIC_INTERFACE_LOCK_SCHEMA) {
    fail('invalid_schema_version', '$.lockSchemaVersion');
  }

  return createPublicInterfaceLock({
    componentId: safe.componentId,
    schemaVersion: safe.schemaVersion,
    entrypoints: safe.entrypoints,
    exports: safe.exports,
    storagePrefixes: safe.storagePrefixes,
    lifecycleOutcomes: safe.lifecycleOutcomes,
    capabilities: safe.capabilities
  });
}

export function assertPublicInterfaceCompatibility(expected, actual) {
  const left = validatePublicInterfaceLock(expected);
  const right = validatePublicInterfaceLock(actual);

  for (const key of [
    'componentId',
    'schemaVersion',
    'entrypoints',
    'exports',
    'storagePrefixes',
    'lifecycleOutcomes',
    'capabilities'
  ]) {
    if (canonicalJson(left[key]) !== canonicalJson(right[key])) {
      fail('public_interface_drift', `$.${key}`);
    }
  }

  return frozen({ compatible: true, componentId: left.componentId });
}

export function composeReleaseCapabilities(locks) {
  const checked = ordinaryArray(locks, '$.locks', 128).map(validatePublicInterfaceLock);
  const componentIds = checked.map((item) => item.componentId).sort();
  if (new Set(componentIds).size !== componentIds.length) {
    fail('duplicate_component', '$.locks');
  }

  return frozen({ ...SAFE_CAPABILITIES, components: componentIds });
}
