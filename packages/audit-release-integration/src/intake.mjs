import { INTAKE_PLAN_SCHEMA } from './contracts.mjs';
import {
  canonicalJson,
  fail,
  frozen,
  ordinaryArray,
  pathOverlap,
  pathValue,
  sha40,
  sortedUnique,
  exact
} from './boundary.mjs';
import { validateComponentManifest } from './component-manifest.mjs';
import { composeReleaseCapabilities } from './interface-lock.mjs';
import { validateSharedFileUnion } from './shared-union.mjs';

function operationFor(candidate, path) {
  return candidate.paths.find(
    (operation) => operation.path === path && operation.destinationBlobSha !== null
  );
}

export function createReleaseIntakePlan(input) {
  const safe = exact(input, ['baseSha', 'candidates', 'protectedPaths', 'sharedUnions']);
  const protectedPaths = sortedUnique(
    safe.protectedPaths,
    '$.protectedPaths',
    10_000,
    pathValue
  );
  const candidates = ordinaryArray(safe.candidates, '$.candidates', 128)
    .map(validateComponentManifest)
    .sort((left, right) => left.componentId.localeCompare(right.componentId));

  if (new Set(candidates.map((item) => item.componentId)).size !== candidates.length) {
    fail('duplicate_component', '$.candidates');
  }

  const sharedUnions = ordinaryArray(safe.sharedUnions, '$.sharedUnions', 128)
    .map(validateSharedFileUnion)
    .sort((left, right) => left.path.localeCompare(right.path));
  if (new Set(sharedUnions.map((item) => item.path)).size !== sharedUnions.length) {
    fail('duplicate_union_path', '$.sharedUnions');
  }

  const unionByPath = new Map(sharedUnions.map((item) => [item.path, item]));
  const ownership = [];

  for (const candidate of candidates) {
    for (const operation of candidate.paths) {
      if (protectedPaths.some((protectedPath) => pathOverlap(protectedPath, operation.path))) {
        fail('protected_path', '$.candidates');
      }

      const conflicts = ownership.filter((entry) => pathOverlap(entry.path, operation.path));
      for (const conflict of conflicts) {
        const exactSharedFile =
          conflict.path === operation.path &&
          conflict.destinationBlobSha !== null &&
          operation.destinationBlobSha !== null &&
          unionByPath.has(operation.path);
        if (!exactSharedFile) fail('path_overlap', '$.candidates');
      }

      ownership.push({
        componentId: candidate.componentId,
        path: operation.path,
        sourceBlobSha: operation.sourceBlobSha,
        destinationBlobSha: operation.destinationBlobSha
      });
    }
  }

  for (const union of sharedUnions) {
    if (protectedPaths.some((protectedPath) => pathOverlap(protectedPath, union.path))) {
      fail('protected_path', '$.sharedUnions');
    }

    const owners = ownership.filter(
      (entry) => entry.path === union.path && entry.destinationBlobSha !== null
    );
    const expectedIds = owners.map((item) => item.componentId).sort();
    const inputIds = union.inputs.map((item) => item.componentId).sort();
    if (owners.length < 2 || canonicalJson(expectedIds) !== canonicalJson(inputIds)) {
      fail('union_ownership_mismatch', '$.sharedUnions');
    }

    for (const inputEntry of union.inputs) {
      const candidate = candidates.find((item) => item.componentId === inputEntry.componentId);
      const operation = candidate ? operationFor(candidate, union.path) : null;
      if (!operation) fail('union_ownership_mismatch', '$.sharedUnions');
      if (operation.sourceBlobSha !== union.baseBlobSha) {
        fail('union_base_mismatch', '$.sharedUnions');
      }
      if (operation.destinationBlobSha !== inputEntry.blobSha) {
        fail('union_blob_mismatch', '$.sharedUnions');
      }
    }
  }

  for (const [path] of unionByPath) {
    const ownerCount = ownership.filter(
      (entry) => entry.path === path && entry.destinationBlobSha !== null
    ).length;
    if (ownerCount < 2) fail('union_ownership_mismatch', '$.sharedUnions');
  }

  return frozen({
    schemaVersion: INTAKE_PLAN_SCHEMA,
    baseSha: sha40(safe.baseSha, '$.baseSha'),
    candidates,
    protectedPaths,
    sharedUnions,
    capabilities: composeReleaseCapabilities(
      candidates.map((item) => item.publicInterface)
    )
  });
}
