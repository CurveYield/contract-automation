import {validateForkState} from '../../audit-fork-protocol/src/index.mjs';
import {finalize,stripTransportFields,serviceDigestFromRaw,identifier,timestamp} from './common.mjs';

export function createForkReportProjection({state,requestedBy,reportedAt}){
 const normalized=validateForkState(stripTransportFields(state,'$.state'));
 const status=normalized.state;
 const body={
  forkId:normalized.forkId,tenantId:normalized.tenantId,attemptId:normalized.attemptId,
  requestDigest:serviceDigestFromRaw(normalized.requestDigest,'$.state.requestDigest'),
  status,version:normalized.version,executionGate:normalized.executionGate,adapterKind:normalized.adapterKind,
  chainId:normalized.chainId,blockNumber:normalized.blockNumber,blockHash:normalized.blockHash,
  requestedBy:identifier(requestedBy,'$.requestedBy'),reportedAt:timestamp(reportedAt,'$.reportedAt'),
  ready:status==='ready',executionEnabled:false,terminal:['deleted','failed','cancelled'].includes(status)
 };
 return finalize('fork',body);
}
export function createAwaitingExecutorProjection({forkId,tenantId,attemptId=null,reportedAt}){
 return finalize('fork-awaiting-executor',{
  forkId:identifier(forkId,'$.forkId'),tenantId:identifier(tenantId,'$.tenantId'),
  attemptId:attemptId===null?null:identifier(attemptId,'$.attemptId'),status:'awaiting_executor',
  ready:false,executionEnabled:false,reportedAt:timestamp(reportedAt,'$.reportedAt'),
  message:'External executor not connected'
 });
}
