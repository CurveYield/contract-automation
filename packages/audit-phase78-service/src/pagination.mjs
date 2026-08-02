import {exactKeys,plainObject,identifier,nullable,digest,integer,sha256,frozenClone,fail,denseArray,timestamp} from './boundary.mjs';

export const PAGE_CURSOR_SCHEMA_V1='audit-phase9-page-cursor-v1';
export const PAGE_CURSOR_SCHEMA_V2='audit-phase9-page-cursor-v2';

const V1_KEYS=['tenantId','workspaceId','resourceKind','indexDigest','offset','pageSize','sortKey'];
const V2_KEYS=['tenantId','workspaceId','campaignId','forkId','attemptId','mergeId','resourceKind','indexDigest','viewDigest','offset','pageSize','sortKey'];

function usesV2(input){
 const desc=plainObject(input,'$');
 return ['campaignId','forkId','attemptId','mergeId','viewDigest'].some(key=>Object.hasOwn(desc,key));
}
function scopeBody(v){
 return {
  tenantId:identifier(v.tenantId,'$.tenantId'),workspaceId:identifier(v.workspaceId,'$.workspaceId'),
  campaignId:nullable(v.campaignId,identifier,'$.campaignId'),forkId:nullable(v.forkId,identifier,'$.forkId'),
  attemptId:nullable(v.attemptId,identifier,'$.attemptId'),mergeId:nullable(v.mergeId,identifier,'$.mergeId'),
  resourceKind:identifier(v.resourceKind,'$.resourceKind'),indexDigest:digest(v.indexDigest,'$.indexDigest'),
  viewDigest:digest(v.viewDigest,'$.viewDigest')
 };
}
export function createScopedCacheMetadata(input){
 const v=exactKeys(input,['tenantId','workspaceId','campaignId','forkId','attemptId','mergeId','resourceKind','indexDigest','viewDigest'],'$');
 const scope=scopeBody(v),scopeDigest=sha256(scope);
 return frozenClone({
  schemaVersion:'audit-phase9-scoped-cache-metadata-v1',...scope,scopeDigest,
  etag:sha256({scopeDigest,viewDigest:scope.viewDigest,indexDigest:scope.indexDigest}),
  cacheControl:'private, no-store',vary:'authorization'
 });
}
export function createPageCursor(input){
 const v2=usesV2(input),v=exactKeys(input,v2?V2_KEYS:V1_KEYS,'$');
 const core=v2?{
  schemaVersion:PAGE_CURSOR_SCHEMA_V2,...scopeBody(v),
  offset:integer(v.offset,'$.offset',0),pageSize:integer(v.pageSize,'$.pageSize',1,100),sortKey:identifier(v.sortKey,'$.sortKey')
 }:{
  schemaVersion:PAGE_CURSOR_SCHEMA_V1,tenantId:identifier(v.tenantId,'$.tenantId'),workspaceId:identifier(v.workspaceId,'$.workspaceId'),
  resourceKind:identifier(v.resourceKind,'$.resourceKind'),indexDigest:digest(v.indexDigest,'$.indexDigest'),
  offset:integer(v.offset,'$.offset',0),pageSize:integer(v.pageSize,'$.pageSize',1,100),sortKey:identifier(v.sortKey,'$.sortKey')
 };
 return frozenClone({...core,cursorDigest:sha256(core)});
}
export function validatePageCursor(input){
 const desc=plainObject(input,'$'),schema=desc.schemaVersion?.value,v2=schema===PAGE_CURSOR_SCHEMA_V2;
 if(!v2&&schema!==PAGE_CURSOR_SCHEMA_V1)fail('invalid_cursor','$.schemaVersion');
 const keys=v2?[...V2_KEYS,'schemaVersion','cursorDigest']:[...V1_KEYS,'schemaVersion','cursorDigest'];
 const v=exactKeys(input,keys,'$');
 const rebuilt=createPageCursor(v2?{
  tenantId:v.tenantId,workspaceId:v.workspaceId,campaignId:v.campaignId,forkId:v.forkId,attemptId:v.attemptId,mergeId:v.mergeId,
  resourceKind:v.resourceKind,indexDigest:v.indexDigest,viewDigest:v.viewDigest,offset:v.offset,pageSize:v.pageSize,sortKey:v.sortKey
 }:{
  tenantId:v.tenantId,workspaceId:v.workspaceId,resourceKind:v.resourceKind,indexDigest:v.indexDigest,offset:v.offset,pageSize:v.pageSize,sortKey:v.sortKey
 });
 if(v.cursorDigest!==rebuilt.cursorDigest)fail('cursor_digest_mismatch','$.cursorDigest');
 return rebuilt;
}
function sameNullable(a,b){return (a??null)===(b??null);}
export function paginateDeterministically(itemsInput,options){
 const desc=plainObject(options,'$'),v2=['campaignId','forkId','attemptId','mergeId','viewDigest'].some(key=>Object.hasOwn(desc,key));
 const expected=v2?['tenantId','workspaceId','campaignId','forkId','attemptId','mergeId','resourceKind','indexDigest','viewDigest','pageSize','cursor']:
  ['tenantId','workspaceId','resourceKind','indexDigest','pageSize','cursor'];
 const o=exactKeys(options,expected,'$');
 const items=denseArray(itemsInput,'$.items',100000).map((item,i)=>{
  const v=exactKeys(item,['id','createdAt','digest'],`$.items[${i}]`);
  return{id:identifier(v.id,`$.items[${i}].id`),createdAt:timestamp(v.createdAt,`$.items[${i}].createdAt`),digest:digest(v.digest,`$.items[${i}].digest`)};
 }).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
 const size=integer(o.pageSize,'$.pageSize',1,100);let offset=0;
 if(o.cursor!==null){
  const c=validatePageCursor(o.cursor);
  if(v2){
   if(c.schemaVersion!==PAGE_CURSOR_SCHEMA_V2||
      c.tenantId!==o.tenantId||c.workspaceId!==o.workspaceId||
      !sameNullable(c.campaignId,o.campaignId)||!sameNullable(c.forkId,o.forkId)||
      !sameNullable(c.attemptId,o.attemptId)||!sameNullable(c.mergeId,o.mergeId)||
      c.resourceKind!==o.resourceKind||c.pageSize!==size)fail('cursor_scope_mismatch','$.cursor');
   if(c.indexDigest!==o.indexDigest||c.viewDigest!==o.viewDigest)fail('stale_cursor','$.cursor');
  }else{
   if(c.schemaVersion!==PAGE_CURSOR_SCHEMA_V1||c.tenantId!==o.tenantId||c.workspaceId!==o.workspaceId||
      c.resourceKind!==o.resourceKind||c.pageSize!==size)fail('cursor_scope_mismatch','$.cursor');
   if(c.indexDigest!==o.indexDigest)fail('stale_cursor','$.cursor');
  }
  offset=c.offset;
 }
 const page=items.slice(offset,offset+size),nextOffset=offset+page.length;
 const nextCursor=nextOffset<items.length?createPageCursor(v2?{
  tenantId:o.tenantId,workspaceId:o.workspaceId,campaignId:o.campaignId,forkId:o.forkId,attemptId:o.attemptId,mergeId:o.mergeId,
  resourceKind:o.resourceKind,indexDigest:o.indexDigest,viewDigest:o.viewDigest,offset:nextOffset,pageSize:size,sortKey:'created-at-id'
 }:{
  tenantId:o.tenantId,workspaceId:o.workspaceId,resourceKind:o.resourceKind,indexDigest:o.indexDigest,offset:nextOffset,pageSize:size,sortKey:'created-at-id'
 }):null;
 if(v2){
  const cacheMetadata=createScopedCacheMetadata({
   tenantId:o.tenantId,workspaceId:o.workspaceId,campaignId:o.campaignId,forkId:o.forkId,attemptId:o.attemptId,mergeId:o.mergeId,
   resourceKind:o.resourceKind,indexDigest:o.indexDigest,viewDigest:o.viewDigest
  });
  return frozenClone({schemaVersion:'audit-phase9-page-v2',items:page,offset,pageSize:size,nextCursor,cacheMetadata,usesPrefixListing:false});
 }
 return frozenClone({schemaVersion:'audit-phase9-page-v1',items:page,total:items.length,offset,pageSize:size,nextCursor,usesPrefixListing:false});
}
