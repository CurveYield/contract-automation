import {SERVICE_OPERATIONS} from './constants.mjs';
import {identifier,enumValue,timestamp,sha256,frozenClone} from './boundary.mjs';

const PUBLIC_ERRORS=Object.freeze({
 resource_not_found:Object.freeze({message:'Resource not found',retryable:false}),
 stale_state:Object.freeze({message:'Resource changed',retryable:true}),
 stale_cursor:Object.freeze({message:'Cursor is stale',retryable:false}),
 quota_exceeded:Object.freeze({message:'Quota exceeded',retryable:false}),
 request_cancelled:Object.freeze({message:'Request cancelled',retryable:false}),
 invalid_request:Object.freeze({message:'Invalid request',retryable:false}),
 unauthorized:Object.freeze({message:'Access denied',retryable:false}),
 forbidden:Object.freeze({message:'Access denied',retryable:false}),
 internal_error:Object.freeze({message:'Request failed',retryable:false})
});
const KNOWN=new Set(Object.keys(PUBLIC_ERRORS));

export function normalizePhase78ServiceError(error,{requestId,operation,at}){
 const sourceCode=typeof error?.code==='string'&&KNOWN.has(error.code)?error.code:'internal_error';
 const publicCode=['tenant_mismatch','workspace_mismatch','attempt_mismatch','fork_not_found','checkpoint_not_found'].includes(error?.code)?'resource_not_found':sourceCode;
 const spec=PUBLIC_ERRORS[publicCode]??PUBLIC_ERRORS.internal_error;
 const core={
  schemaVersion:'audit-phase9-normalized-error-v1',
  requestId:identifier(requestId,'$.requestId'),
  operation:enumValue(operation,SERVICE_OPERATIONS,'$.operation'),
  code:publicCode,message:spec.message,retryable:spec.retryable,path:'$',at:timestamp(at,'$.at')
 };
 return frozenClone({...core,errorDigest:sha256(core)});
}
