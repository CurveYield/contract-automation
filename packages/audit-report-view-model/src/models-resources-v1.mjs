import { readUiEntityData } from '../../audit-ui-contracts/src/index.mjs';
import {
  dateText, deepFreeze, denseDataValues, statusText, toBoundedInteger,
  toSafeIdentifier, toSafeText, toSafeUrl
} from './safety-v1.mjs';
import { lifecycleState } from './lifecycle-v1.mjs';

function checkpointModel(input) {
  const data = readUiEntityData('checkpoint', input);
  return {
    id: toSafeIdentifier(data.id), status: statusText(data.status), createdAt: dateText(data.createdAt),
    label: toSafeText(data.label || data.id), exportUrl: toSafeUrl(data.exportUrl), forkId: toSafeIdentifier(data.forkId)
  };
}
export function createCheckpointViewModel(input) { return deepFreeze(checkpointModel(input)); }

function exportModel(input) {
  const data = readUiEntityData('export', input);
  return {
    id: toSafeIdentifier(data.id), status: statusText(data.status), createdAt: dateText(data.createdAt),
    label: toSafeText(data.label || data.id), url: toSafeUrl(data.url), checkpointId: toSafeIdentifier(data.checkpointId),
    forkId: toSafeIdentifier(data.forkId), sizeBytes: toBoundedInteger(data.sizeBytes, { max: 1_000_000_000_000 })
  };
}
export function createExportViewModel(input) { return deepFreeze(exportModel(input)); }

export function createForkViewModel(input) {
  const data = readUiEntityData('fork', input);
  const checkpoints = denseDataValues(data.checkpoints).map(checkpointModel).filter((item) => item.id).sort((a, b) => a.id.localeCompare(b.id));
  const exports = denseDataValues(data.exports).map(exportModel).filter((item) => item.id).sort((a, b) => a.id.localeCompare(b.id));
  return deepFreeze({
    id: toSafeIdentifier(data.id), name: toSafeText(data.name || data.id), status: statusText(data.status),
    stateLabel: lifecycleState(data.status).label, exportStatus: statusText(data.exportStatus, 'not-requested'),
    restoreStatus: statusText(data.restoreStatus, 'not-requested'), deleteStatus: statusText(data.deleteStatus, 'not-requested'),
    tombstoneStatus: statusText(data.tombstoneStatus, 'not-requested'), retentionExpiresAt: dateText(data.retentionExpiresAt),
    createdAt: dateText(data.createdAt), checkpoints, exports, executionAvailable: false
  });
}

function provenanceModel(input) {
  const data = readUiEntityData('provenance', input);
  return {
    id: toSafeIdentifier(data.id), sourceType: statusText(data.sourceType, 'unknown'), label: toSafeText(data.label || data.id),
    sourceId: toSafeIdentifier(data.sourceId), commitSha: toSafeIdentifier(data.commitSha), reportId: toSafeIdentifier(data.reportId),
    visible: data.visible === true
  };
}

function mergeModel(input) {
  if (typeof input === 'string' || typeof input === 'number') {
    const id = toSafeIdentifier(input);
    return { id, status: 'unknown', label: id, sourceIds: [], commitSha: '', createdAt: null, visible: true };
  }
  const data = readUiEntityData('merge', input);
  return {
    id: toSafeIdentifier(data.id), status: statusText(data.status), label: toSafeText(data.label || data.id),
    sourceIds: denseDataValues(data.sourceIds).map(toSafeIdentifier).filter(Boolean).sort(), commitSha: toSafeIdentifier(data.commitSha),
    createdAt: dateText(data.createdAt), visible: data.visible !== false
  };
}
export function createMergeViewModel(input) { return deepFreeze(mergeModel(input)); }

export function createCleanRoomViewModel(input) {
  const data = readUiEntityData('cleanRoomCampaign', input);
  const visibleIds = new Set(denseDataValues(data.visibleResourceIds).map(toSafeIdentifier).filter(Boolean));
  const provenance = denseDataValues(data.provenance).map(provenanceModel)
    .filter((item) => item.id && item.visible && visibleIds.has(item.sourceId)).sort((a, b) => a.id.localeCompare(b.id));
  const merges = denseDataValues(data.merges).map(mergeModel).filter((item) => item.id && item.visible).sort((a, b) => a.id.localeCompare(b.id));
  return deepFreeze({
    id: toSafeIdentifier(data.id), name: toSafeText(data.name), status: statusText(data.status),
    accessStatus: statusText(data.accessStatus, 'unknown'), shareStatus: statusText(data.shareStatus, 'not-shared'),
    updatedAt: dateText(data.updatedAt), merges, provenance, executionAvailable: false
  });
}
