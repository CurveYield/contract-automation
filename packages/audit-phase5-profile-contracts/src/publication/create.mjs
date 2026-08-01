import { deepFreeze } from '../templates.mjs';
import {
  knownProfile,
  plainObject,
  scanPhase5ForbiddenFields,
  exactKeys
} from '../helpers.mjs';
import { immutableDigest, canonicalInstant } from '../publication-helpers.mjs';

export function createPublishedPhase5ProfileContract(profileId, publication) {
  const source = knownProfile(profileId);
  plainObject(publication, '$.publication');
  scanPhase5ForbiddenFields(publication, '$.publication');
  exactKeys(publication, new Set(['digest', 'publishedAt']), '$.publication');
  return deepFreeze({
    ...structuredClone(source),
    schemaVersion: 'phase5-tool-profile-contract-v1',
    publicationState: 'published',
    digestRequired: false,
    executionEnabled: false,
    executorState: 'unavailable',
    registryArtifact: {
      repository: source.registryRepository,
      digest: immutableDigest(publication.digest, '$.publication.digest')
    },
    publishedAt: canonicalInstant(publication.publishedAt, '$.publication.publishedAt')
  });
}
