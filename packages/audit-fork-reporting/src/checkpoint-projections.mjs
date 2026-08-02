import {validateCheckpointManifest,validateExportManifest} from '../../audit-fork-protocol/src/index.mjs';
import {finalize,timestamp,secondsBetween} from './common.mjs';

export function createCheckpointReportProjection({manifest,reportedAt}){
 const normalized=validateCheckpointManifest(manifest);
 const retentionSeconds=secondsBetween(normalized.createdAt,normalized.expiresAt);
 return finalize('checkpoint',{
  checkpointId:normalized.checkpointId,forkId:normalized.forkId,tenantId:normalized.tenantId,
  attemptId:normalized.attemptId,chainId:normalized.chainId,blockNumber:normalized.blockNumber,
  blockHash:normalized.blockHash??null,objectKey:normalized.objectKey,sha256:normalized.sha256,
  bytes:normalized.bytes,contentType:normalized.contentType,createdAt:normalized.createdAt,
  expiresAt:normalized.expiresAt,retentionSeconds,opaque:normalized.opaque,
  reportedAt:timestamp(reportedAt,'$.reportedAt')
 });
}
export function createExportReportProjection({manifest,reportedAt}){
 const normalized=validateExportManifest(manifest);
 const retentionSeconds=secondsBetween(normalized.createdAt,normalized.expiresAt);
 return finalize('export',{
  exportId:normalized.exportId,forkId:normalized.forkId,tenantId:normalized.tenantId,
  checkpointId:normalized.checkpointId,sourceObjectKey:normalized.sourceObjectKey,
  sourceSha256:normalized.sourceSha256,createdAt:normalized.createdAt,expiresAt:normalized.expiresAt,
  retentionSeconds,copiesBytes:false,reportedAt:timestamp(reportedAt,'$.reportedAt')
 });
}
