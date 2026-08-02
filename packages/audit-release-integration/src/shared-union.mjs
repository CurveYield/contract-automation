import { SHARED_FILE_UNION_SCHEMA } from './contracts.mjs';
import {
  exact,
  fail,
  fieldOverlap,
  frozen,
  identifier,
  ordinaryArray,
  pathValue,
  sha40,
  sortedUnique,
  text
} from './boundary.mjs';

export function validateSharedFileUnion(input) {
  const safe = exact(input, [
    'schemaVersion',
    'path',
    'baseBlobSha',
    'inputs',
    'outputBlobSha',
    'strategy'
  ]);

  if (safe.schemaVersion !== SHARED_FILE_UNION_SCHEMA) {
    fail('invalid_schema_version', '$.schemaVersion');
  }
  if (safe.strategy !== 'field-owned-v1') {
    fail('invalid_union_strategy', '$.strategy');
  }

  const inputs = ordinaryArray(safe.inputs, '$.inputs', 32)
    .map((entry, index) => {
      const item = exact(entry, ['componentId', 'blobSha', 'fields'], `$.inputs[${index}]`);
      return {
        componentId: identifier(item.componentId, `$.inputs[${index}].componentId`),
        blobSha: sha40(item.blobSha, `$.inputs[${index}].blobSha`),
        fields: sortedUnique(
          item.fields,
          `$.inputs[${index}].fields`,
          256,
          (value, path) => text(value, path, 240)
        )
      };
    })
    .sort((left, right) => left.componentId.localeCompare(right.componentId));

  if (inputs.length < 2 || new Set(inputs.map((item) => item.componentId)).size !== inputs.length) {
    fail('invalid_union_inputs', '$.inputs');
  }

  const owned = [];
  for (const item of inputs) {
    for (const field of item.fields) {
      const conflict = owned.find((entry) => fieldOverlap(entry.field, field));
      if (conflict) fail('union_field_overlap', '$.inputs');
      owned.push({ componentId: item.componentId, field });
    }
  }

  return frozen({
    schemaVersion: SHARED_FILE_UNION_SCHEMA,
    path: pathValue(safe.path, '$.path'),
    baseBlobSha: sha40(safe.baseBlobSha, '$.baseBlobSha'),
    inputs,
    outputBlobSha: sha40(safe.outputBlobSha, '$.outputBlobSha'),
    strategy: safe.strategy
  });
}
