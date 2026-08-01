import { ValidationError } from '../../../audit-protocol/src/index.mjs';
import { deepFreeze } from '../templates.mjs';
import {
  knownProfile,
  plainObject,
  scanPhase5ForbiddenFields,
  exactKeys
} from '../helpers.mjs';
import { immutableDigest, canonicalInstant } from '../publication-helpers.mjs';

export function validatePublishedPhase5ProfileContract(value) {
  plainObject(value);
  scanPhase5ForbiddenFields(value);
  const source = knownProfile(value.profileId);
  exactKeys(value, new Set([...Object.keys(source), 'registryArtifact', 'publishedAt']));
  if (value.schemaVersion !== 'phase5-tool-profile-contract-v1') {
    throw new ValidationError('invalid_schema_version', '$.schemaVersion must be phase5-tool-profile-contract-v1', '$.schemaVersion');
  }
  if (value.publicationState !== 'published') throw new ValidationError('invalid_publication_state', '$.publicationState must be published', '$.publicationState');
  if (value.digestRequired !== false) throw new ValidationError('invalid_digest_state', '$.digestRequired must be false', '$.digestRequired');
  if (value.executionEnabled !== false) throw new ValidationError('execution_disabled', '$.executionEnabled must remain false', '$.executionEnabled');
  if (value.executorState !== 'unavailable') throw new ValidationError('executor_unavailable', '$.executorState must remain unavailable', '$.executorState');

  for (const [key, expected] of Object.entries(source)) {
    if (['schemaVersion', 'publicationState', 'digestRequired'].includes(key)) continue;
    if (JSON.stringify(value[key]) !== JSON.stringify(expected)) {
      throw new ValidationError('immutable_profile_mismatch', `$.${key} does not match the registered template`, `$.${key}`);
    }
  }
  plainObject(value.registryArtifact, '$.registryArtifact');
  exactKeys(value.registryArtifact, new Set(['repository', 'digest']), '$.registryArtifact');
  if (value.registryArtifact.repository !== source.registryRepository) {
    throw new ValidationError('invalid_registry_repository', '$.registryArtifact.repository does not match the template', '$.registryArtifact.repository');
  }
  immutableDigest(value.registryArtifact.digest, '$.registryArtifact.digest');
  canonicalInstant(value.publishedAt, '$.publishedAt');
  return deepFreeze(structuredClone(value));
}
