import {validateForkState,validateForkTombstone} from '../../audit-fork-protocol/src/index.mjs';
import {finalize,stripTransportFields,serviceDigestFromRaw,timestamp,fail} from './common.mjs';

export function createDeleteReportProjection({state,tombstone,reportedAt}){
 const normalizedState=validateForkState(stripTransportFields(state,'$.state'));
 const normalizedTombstone=validateForkTombstone(tombstone);
 if(normalizedState.state!=='deleted'||normalizedState.tombstone!==true)fail('invalid_deletion','$.state.state');
 for(const field of ['forkId','tenantId','attemptId','requestDigest']){
  if(normalizedState[field]!==normalizedTombstone[field])fail('deletion_identity_mismatch',`$.tombstone.${field}`);
 }
 if(normalizedState.deletedAt!==normalizedTombstone.deletedAt)fail('deletion_identity_mismatch','$.tombstone.deletedAt');
 return finalize('fork-delete',{
  forkId:normalizedState.forkId,tenantId:normalizedState.tenantId,attemptId:normalizedState.attemptId,
  requestDigest:serviceDigestFromRaw(normalizedState.requestDigest,'$.state.requestDigest'),
  status:'deleted',version:normalizedState.version,deletedAt:normalizedState.deletedAt,
  reason:normalizedTombstone.reason,tombstone:true,terminal:true,
  reportedAt:timestamp(reportedAt,'$.reportedAt')
 });
}
