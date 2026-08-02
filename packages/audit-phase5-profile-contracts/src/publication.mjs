import { ValidationError } from '../../audit-protocol/src/index.mjs';
import { deepFreeze } from './templates.mjs';
import { getPhase5ProfileTemplate } from './validation.mjs';

function plain(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new ValidationError('invalid_plain_object', `${path} must be an ordinary object`, path);
}
function validatePublication(publication) {
  plain(publication, '$.publication');
  const keys = ['digest', 'publishedAt'];
  for (const key of Object.keys(publication)) if (!keys.includes(key)) throw new ValidationError('unknown_field', `$.publication.${key} is not allowed`, `$.publication.${key}`);
  for (const key of keys) if (!Object.hasOwn(publication, key)) throw new ValidationError('missing_field', `$.publication.${key} is required`, `$.publication.${key}`);
  if (typeof publication.digest !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(publication.digest)) throw new ValidationError('invalid_digest', 'digest must be immutable sha256', '$.publication.digest');
  const time = new Date(publication.publishedAt);
  if (typeof publication.publishedAt !== 'string' || Number.isNaN(time.getTime()) || time.toISOString() !== publication.publishedAt) throw new ValidationError('invalid_timestamp', 'publishedAt must be canonical', '$.publication.publishedAt');
}
export function createPublishedPhase5ProfileContract(profileId, publication) {
  const template = getPhase5ProfileTemplate(profileId); validatePublication(publication);
  return deepFreeze({
    ...structuredClone(template),
    schemaVersion: 'phase5-tool-profile-contract-v1',
    publicationState: 'published',
    digestRequired: false,
    registryArtifact: { repository: template.registryRepository, digest: publication.digest },
    publishedAt: publication.publishedAt,
    executionEnabled: false,
    executorState: 'unavailable'
  });
}
export function validatePublishedPhase5ProfileContract(value) {
  plain(value, '$');
  const template = getPhase5ProfileTemplate(value.profileId);
  if (value.schemaVersion !== 'phase5-tool-profile-contract-v1' || value.publicationState !== 'published') throw new ValidationError('invalid_publication_state', 'profile is not published', '$.publicationState');
  if (value.executionEnabled !== false || value.executorState !== 'unavailable') throw new ValidationError('execution_boundary_violation', 'execution remains unavailable', '$');
  if (value.registryArtifact?.repository !== template.registryRepository || !/^sha256:[0-9a-f]{64}$/.test(value.registryArtifact?.digest ?? '')) throw new ValidationError('immutable_profile_mismatch', 'registry identity drift', '$.registryArtifact');
  for (const key of ['tool','adapterVersion','parserVersion','programId','resourcePolicy','networkPolicy','seedPolicy','timeoutContract','cancellationContract','evidenceContract','artifactContract','configurationFields','fixedRuntimeContract']) {
    if (JSON.stringify(value[key]) !== JSON.stringify(template[key])) throw new ValidationError('immutable_profile_mismatch', `${key} drift`, `$.${key}`);
  }
  return deepFreeze(structuredClone(value));
}
