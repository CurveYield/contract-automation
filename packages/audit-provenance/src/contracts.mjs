import {
  exactKeys, plainObject, identifier, digest, enumValue,
  frozenClone, sha256, fail, nullable
} from '../../audit-clean-room-protocol/src/index.mjs';

export const PROVENANCE_NODE_SCHEMA='phase8-provenance-node-v1';
export const PROVENANCE_EDGE_SCHEMA='phase8-provenance-edge-v1';
export const PROVENANCE_INDEX_SCHEMA='phase8-provenance-index-v1';
export const MERGED_REPORT_REFERENCE_SCHEMA='phase8-merged-report-reference-v1';
const NODE_TYPES=['source','workspace','base_artifact','campaign','layer','job','attempt','finding','evidence','report','duplicate_relation','conflict_relation','merge_request','merge_attempt','merge_manifest','merged_report_reference'];
const EDGE_TYPES=['derived_from','belongs_to','produced','supports','reported_by','member_of','merged_into','references'];
export const SOURCE_STATES=['complete','partial','cancelled','policy_rejected'];

export function schemaVersionOf(value,path){
  const {desc}=plainObject(value,path),descriptor=desc.schemaVersion;
  if(!descriptor)return null;
  return descriptor.value;
}
export function createProvenanceNode(input){
  const value=exactKeys(input,['nodeId','type','tenantId','workspaceId','campaignId','digest','sourceRef'],'$');
  return frozenClone({schemaVersion:PROVENANCE_NODE_SCHEMA,nodeId:identifier(value.nodeId,'$.nodeId'),type:enumValue(value.type,NODE_TYPES,'$.type'),tenantId:identifier(value.tenantId,'$.tenantId'),workspaceId:identifier(value.workspaceId,'$.workspaceId'),campaignId:nullable(value.campaignId,identifier,'$.campaignId'),digest:digest(value.digest,'$.digest'),sourceRef:nullable(value.sourceRef,identifier,'$.sourceRef')});
}
export function validateProvenanceNode(input){
  const value=exactKeys(input,['schemaVersion','nodeId','type','tenantId','workspaceId','campaignId','digest','sourceRef'],'$');
  if(value.schemaVersion!==PROVENANCE_NODE_SCHEMA)fail('invalid_schema','$.schemaVersion');
  return createProvenanceNode({nodeId:value.nodeId,type:value.type,tenantId:value.tenantId,workspaceId:value.workspaceId,campaignId:value.campaignId,digest:value.digest,sourceRef:value.sourceRef});
}
export function createProvenanceEdge(input){
  const value=exactKeys(input,['type','from','to'],'$');
  const core={schemaVersion:PROVENANCE_EDGE_SCHEMA,type:enumValue(value.type,EDGE_TYPES,'$.type'),from:identifier(value.from,'$.from'),to:identifier(value.to,'$.to')};
  const edgeDigest=sha256(core);
  return frozenClone({...core,edgeId:`edge-${edgeDigest.slice(7,31)}`,edgeDigest});
}
export function validateProvenanceEdge(input){
  const value=exactKeys(input,['schemaVersion','edgeId','edgeDigest','type','from','to'],'$');
  if(value.schemaVersion!==PROVENANCE_EDGE_SCHEMA)fail('invalid_schema','$.schemaVersion');
  const rebuilt=createProvenanceEdge({type:value.type,from:value.from,to:value.to});
  if(identifier(value.edgeId,'$.edgeId')!==rebuilt.edgeId)fail('identity_mismatch','$.edgeId');
  if(digest(value.edgeDigest,'$.edgeDigest')!==rebuilt.edgeDigest)fail('digest_mismatch','$.edgeDigest');
  return rebuilt;
}
