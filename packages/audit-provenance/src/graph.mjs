import {
  exactKeys, identifier, digest, timestamp, denseArray, frozenClone, sha256, fail
} from '../../audit-clean-room-protocol/src/index.mjs';
import {
  PROVENANCE_NODE_SCHEMA, PROVENANCE_EDGE_SCHEMA, PROVENANCE_INDEX_SCHEMA,
  schemaVersionOf, createProvenanceNode, validateProvenanceNode,
  createProvenanceEdge, validateProvenanceEdge
} from './contracts.mjs';

function normalizeNode(item,path){
  const schema=schemaVersionOf(item,path);
  if(schema===null)return createProvenanceNode(item);
  if(schema!==PROVENANCE_NODE_SCHEMA)fail('invalid_schema',`${path}.schemaVersion`);
  return validateProvenanceNode(item);
}
function normalizeEdge(item,path){
  const schema=schemaVersionOf(item,path);
  if(schema===null)return createProvenanceEdge(item);
  if(schema!==PROVENANCE_EDGE_SCHEMA)fail('invalid_schema',`${path}.schemaVersion`);
  return validateProvenanceEdge(item);
}
function detectCycle(nodes,edges){
  const outgoing=new Map(nodes.map((node)=>[node.nodeId,[]]));
  for(const edge of edges)outgoing.get(edge.from).push(edge.to);
  const visiting=new Set(),visited=new Set();
  function visit(id){
    if(visiting.has(id))return true;if(visited.has(id))return false;
    visiting.add(id);for(const next of outgoing.get(id))if(visit(next))return true;
    visiting.delete(id);visited.add(id);return false;
  }
  return nodes.some((node)=>visit(node.nodeId));
}
export function createProvenanceIndex(input){
  const value=exactKeys(input,['tenantId','workspaceId','mergeId','nodes','edges','createdAt'],'$');
  const tenantId=identifier(value.tenantId,'$.tenantId'),workspaceId=identifier(value.workspaceId,'$.workspaceId'),mergeId=identifier(value.mergeId,'$.mergeId');
  const nodes=denseArray(value.nodes,'$.nodes',200_000).map((item,index)=>normalizeNode(item,`$.nodes[${index}]`)).sort((a,b)=>a.nodeId.localeCompare(b.nodeId));
  const edges=denseArray(value.edges,'$.edges',400_000).map((item,index)=>normalizeEdge(item,`$.edges[${index}]`)).sort((a,b)=>a.edgeId.localeCompare(b.edgeId));
  const byId=new Map();
  for(const node of nodes){
    const previous=byId.get(node.nodeId);
    if(previous&&JSON.stringify(previous)!==JSON.stringify(node))fail('conflicting_node','$.nodes');
    if(previous)fail('duplicate_identity','$.nodes');
    byId.set(node.nodeId,node);
    if(node.tenantId!==tenantId)fail('tenant_mismatch','$.nodes');
    if(node.workspaceId!==workspaceId)fail('workspace_mismatch','$.nodes');
  }
  const edgeIds=new Set();
  for(const edge of edges){
    if(edgeIds.has(edge.edgeId))fail('duplicate_identity','$.edges');edgeIds.add(edge.edgeId);
    if(!byId.has(edge.from))fail('dangling_reference','$.edges.from');
    if(!byId.has(edge.to))fail('dangling_reference','$.edges.to');
  }
  if(detectCycle(nodes,edges))fail('provenance_cycle','$.edges');
  const body={schemaVersion:PROVENANCE_INDEX_SCHEMA,tenantId,workspaceId,mergeId,nodes,edges,createdAt:timestamp(value.createdAt,'$.createdAt')};
  const indexDigest=sha256(body);
  return frozenClone({...body,indexId:`provenance-${indexDigest.slice(7,31)}`,indexDigest});
}
export function validateProvenanceIndex(input){
  const value=exactKeys(input,['schemaVersion','indexId','indexDigest','tenantId','workspaceId','mergeId','nodes','edges','createdAt'],'$');
  if(value.schemaVersion!==PROVENANCE_INDEX_SCHEMA)fail('invalid_schema','$.schemaVersion');
  const rebuilt=createProvenanceIndex({tenantId:value.tenantId,workspaceId:value.workspaceId,mergeId:value.mergeId,nodes:value.nodes,edges:value.edges,createdAt:value.createdAt});
  if(identifier(value.indexId,'$.indexId')!==rebuilt.indexId)fail('identity_mismatch','$.indexId');
  if(digest(value.indexDigest,'$.indexDigest')!==rebuilt.indexDigest)fail('digest_mismatch','$.indexDigest');
  return rebuilt;
}
