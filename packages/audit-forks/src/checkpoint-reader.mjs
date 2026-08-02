import { checkpointManifestKey, validateCheckpointManifest } from '../../audit-fork-protocol/src/index.mjs';
import { ForkStateError } from './storage.mjs';

export async function readCheckpointOperation(service, forkId, checkpointId) {
  const record = await service.storage.get(checkpointManifestKey(forkId, checkpointId));
  if (!record) throw new ForkStateError('checkpoint_not_found', 'Checkpoint manifest does not exist');
  return validateCheckpointManifest(JSON.parse(typeof record.value === 'string' ? record.value : new TextDecoder().decode(record.value)));
}
