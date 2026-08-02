import {
  exactKeys, identifier, digest, timestamp, enumValue, denseArray, frozenClone,
  sha256, fail, nullable, boundedString, plainObject
} from '../../audit-clean-room-protocol/src/index.mjs';

export const PROVENANCE_NODE_SCHEMA='phase8-provenance-node-v1';
export const PROVENANCE_EDGE_SCHEMA='phase8-provenance-edge-v1';
export const PROVENANCE_INDEX_SCHEMA='phase8-provenance-index-v1';
export const MERGED_REPORT_REFERENCE_SCHEMA='phase8-merged-report-reference-v1';

const NODE_TYPES=['source','workspace','base_artifact','campaign','layer','job','attempt','finding','evidence','report','duplicate_relation','conflict_relation','merge_request','merge_attempt','merge_manifest','merged_report_reference'];
const EDGE_TYPES=['derived_from','belongs_to','produced','supports','reported_by','member_of','merged_into','references'];
const SOURCE_STATES=['complete','partial','cancelled','policy_rejected'];

function schemaVersionOf(value,path){
  const {desc}=plainObject(value,path);
  return Object.hasOwn(desc,'schemaVersion')?desc.schemaVersion.value:undefined;
}

export function createProvenanceNode(input){
  const v=exactKeys(input,['nodeId','type','tenantId','workspaceId','campaignId','digest','sourceRef'],'$');
  return frozenClone({
    schemaVersion:PROVENANCE_NODE_SCHEMA,
    nodeId:identifier(v.nodeId,'$.nodeId'),
    type:enumValue(v.type,NODE_TYPES,'$.type'),
    tenantId:identifier(v.tenantId,'$.tenantId'),
    workspaceId:identifier(v.workspaceId,'$.workspaceId'),
    campaignId:nullable(v.campaignId,identifier,'$.campaignId'),
    digest:digest(v.digest,'$.digest'),
    sourceRef:nullable(v.sourceRef,identifier,'$.sourceRef')
  });
}

export function validateProvenanceNode(input){
  const v=exactKeys(input,['schemaVersion','nodeId','type','tenantId','workspaceId','campaignId','digest','sourceRef'],'$');
  if(v.schemaVersion!==PROVENANCE_NODE_SCHEMA)fail('invalid_schema','$.schemaVersion');
  return createProvenanceNode({
    nodeId:v.nodeId,type:v.type,tenantId:v.tenantId,workspaceId:v.workspaceId,
    campaignId:v.campaignId,digest:v.digest,sourceRef:v.sourceRef
  });
}

export function createProvenanceEdge(input){
  const v=exactKeys(input,['type','from','to'],'$');
  const core={
    schemaVersion:PROVENANCE_EDGE_SCHEMA,
    type:enumValue(v.type,EDGE_TYPES,'$.type'),
    from:identifier(v.from,'$.from'),
    to:identifier(v.to,'$.to')
  };
  const edgeDigest=sha256(core);
  return frozenClone({...core,edgeId:`edge-${edgeDigest.slice(7,31)}`,edgeDigest});
}

function detectCycle(nodes,edges){
  const outgoing=new Map(nodes.map((node)=>[node.nodeId,[]]));
  for(const edge of edges)outgoing.get(edge.from).push(edge.to);
  const visiting=new Set(),visited=new Set();
  function visit(id){
    if(visiting.has(id))return true;
    if(visited.has(id))return false;
    visiting.add(id);
    for(const next of outgoing.get(id))if(visit(next))return true;
    visiting.delete(id);visited.add(id);return false;
  }
  return nodes.some((node)=>visit(node.nodeId));
}

export function createProvenanceIndex(input){
  const v=exactKeys(input,['tenantId','workspaceId','mergeId','nodes','edges','createdAt'],'$');
  const tenantId=identifier(v.tenantId,'$.tenantId');
  const workspaceId=identifier(v.workspaceId,'$.workspaceId');
  const mergeId=identifier(v.mergeId,'$.mergeId');
  const nodes=denseArray(v.nodes,'$.nodes',200_000).map((item,index)=>{
    const path=`$.nodes[${index}]`;
    const schema=schemaVersionOf(item,path);
    return schema===PROVENANCE_NODE_SCHEMA?validateProvenanceNode(item):createProvenanceNode(item);
  }).sort((a,b)=>a.nodeId.localeCompare(b.nodeId));
  const edges=denseArray(v.edges,'$.edges',400_000).map((item,index)=>{
    const path=`$.edges[${index}]`;
    const schema=schemaVersionOf(item,path);
    return schema===PROVENANCE_EDGE_SCHEMA?validateProvenanceEdge(item):createProvenanceEdge(item);
  }).sort((a,b)=>a.edgeId.localeCompare(b.edgeId));
  const byId=new Map();
  for(const node of nodes){
    const previous=byId.get(node.nodeId);
    if(previous&&JSON.stringify(previous)!==JSON.stringify(node))fail('conflicting_node','$.nodes');
    if(previous)fail('duplicate_identity','$.nodes');
    byId.set(node.nodeId,node);
    if(node.tenantId!==tenantId)fail('tenant_mismatch','$.nodes');
    if(node.workspaceId!==workspaceId)fail('workspace_mismatch','$.nodes');
  }
  for(const edge of edges){
    if(!byId.has(edge.from))fail('dangling_reference','$.edges.from');
    if(!byId.has(edge.to))fail('dangling_reference','$.edges.to');
  }
  if(detectCycle(nodes,edges))fail('provenance_cycle','$.edges');
  const body={schemaVersion:PROVENANCE_INDEX_SCHEMA,tenantId,workspaceId,mergeId,nodes,edges,createdAt:timestamp(v.createdAt,'$.createdAt')};
  const indexDigest=sha256(body);
  return frozenClone({...body,indexId:`provenance-${indexDigest.slice(7,31)}`,indexDigest});
}

export function validateProvenanceEdge(input){
  const v=exactKeys(input,['schemaVersion','edgeId','edgeDigest','type','from','to'],'$');
  if(v.schemaVersion!==PROVENANCE_EDGE_SCHEMA)fail('invalid_schema','$.schemaVersion');
  const rebuilt=createProvenanceEdge({type:v.type,from:v.from,to:v.to});
  if(v.edgeId!==rebuilt.edgeId)fail('identity_mismatch','$.edgeId');
  if(v.edgeDigest!==rebuilt.edgeDigest)fail('digest_mismatch','$.edgeDigest');
  return rebuilt;
}

export function validateProvenanceIndex(input){
  const v=exactKeys(input,['schemaVersion','indexId','indexDigest','tenantId','workspaceId','mergeId','nodes','edges','createdAt'],'$');
  if(v.schemaVersion!==PROVENANCE_INDEX_SCHEMA)fail('invalid_schema','$.schemaVersion');
  const rebuilt=createProvenanceIndex({
    tenantId:v.tenantId,workspaceId:v.workspaceId,mergeId:v.mergeId,
    nodes:v.nodes,edges:v.edges,createdAt:v.createdAt
  });
  if(v.indexId!==rebuilt.indexId)fail('identity_mismatch','$.indexId');
  if(v.indexDigest!==rebuilt.indexDigest)fail('digest_mismatch','$.indexDigest');
  return rebuilt;
}

export function traceAuthorizedOrigins(indexInput,input){
  const index=validateProvenanceIndex(indexInput);
  const v=exactKeys(input,['nodeId','visibleCampaignIds'],'$');
  const nodeId=identifier(v.nodeId,'$.nodeId');
  const visible=new Set(denseArray(v.visibleCampaignIds,'$.visibleCampaignIds',10_000).map((x,i)=>identifier(x,`$.visibleCampaignIds[${i}]`)));
  const allowedNode=(node)=>node.campaignId===null||visible.has(node.campaignId);
  if(!index.nodes.some((node)=>node.nodeId===nodeId&&allowedNode(node))){
    return frozenClone({schemaVersion:'phase8-origin-trace-v1',status:'not_found',nodes:[],edges:[]});
  }
  const reverse=new Map(index.nodes.map((node)=>[node.nodeId,[]]));
  for(const edge of index.edges)reverse.get(edge.to).push(edge);
  const seen=new Set([nodeId]),queue=[nodeId];
  while(queue.length){
    const current=queue.shift();
    for(const edge of reverse.get(current)){
      const source=index.nodes.find((node)=>node.nodeId===edge.from);
      if(source&&allowedNode(source)&&!seen.has(source.nodeId)){seen.add(source.nodeId);queue.push(source.nodeId);}
    }
  }
  const nodes=index.nodes.filter((node)=>seen.has(node.nodeId)&&allowedNode(node));
  const ids=new Set(nodes.map((node)=>node.nodeId));
  const edges=index.edges.filter((edge)=>ids.has(edge.from)&&ids.has(edge.to));
  return frozenClone({schemaVersion:'phase8-origin-trace-v1',status:'ok',nodes,edges});
}

function safeLabel(value,path){
  const text=boundedString(value,path,256);
  if(/<\/?(?:script|iframe|object)|(?:https?:\/\/)|authorization|bearer|private[_ -]?key|[A-Za-z]:\\|\/(?:home|mnt|Users)\//i.test(text))fail('unsafe_report_content',path);
  return text;
}

export function createMergedReportReference(input){
  const v=exactKeys(input,['tenantId','workspaceId','mergeId','sourceCampaignId','sourceState','reportId','reportDigest','evidenceRefs','label','createdAt'],'$');
  const evidenceRefs=denseArray(v.evidenceRefs,'$.evidenceRefs',100_000).map((entry,index)=>{
    const p=`$.evidenceRefs[${index}]`;
    const r=exactKeys(entry,['id','digest'],p);
    return {id:identifier(r.id,`${p}.id`),digest:digest(r.digest,`${p}.digest`)};
  }).sort((a,b)=>a.id.localeCompare(b.id));
  const body={
    schemaVersion:MERGED_REPORT_REFERENCE_SCHEMA,
    tenantId:identifier(v.tenantId,'$.tenantId'),
    workspaceId:identifier(v.workspaceId,'$.workspaceId'),
    mergeId:identifier(v.mergeId,'$.mergeId'),
    sourceCampaignId:identifier(v.sourceCampaignId,'$.sourceCampaignId'),
    sourceState:enumValue(v.sourceState,SOURCE_STATES,'$.sourceState'),
    reportId:identifier(v.reportId,'$.reportId'),
    reportDigest:digest(v.reportDigest,'$.reportDigest'),
    evidenceRefs,
    label:safeLabel(v.label,'$.label'),
    createdAt:timestamp(v.createdAt,'$.createdAt')
  };
  const referenceDigest=sha256(body);
  return frozenClone({...body,referenceId:`merged-report-${referenceDigest.slice(7,31)}`,referenceDigest});
}

export function validateMergedReportReference(input){
  const v=exactKeys(input,['schemaVersion','referenceId','referenceDigest','tenantId','workspaceId','mergeId','sourceCampaignId','sourceState','reportId','reportDigest','evidenceRefs','label','createdAt'],'$');
  if(v.schemaVersion!==MERGED_REPORT_REFERENCE_SCHEMA)fail('invalid_schema','$.schemaVersion');
  const rebuilt=createMergedReportReference({
    tenantId:v.tenantId,workspaceId:v.workspaceId,mergeId:v.mergeId,
    sourceCampaignId:v.sourceCampaignId,sourceState:v.sourceState,reportId:v.reportId,
    reportDigest:v.reportDigest,evidenceRefs:v.evidenceRefs,label:v.label,createdAt:v.createdAt
  });
  if(v.referenceId!==rebuilt.referenceId)fail('identity_mismatch','$.referenceId');
  if(v.referenceDigest!==rebuilt.referenceDigest)fail('digest_mismatch','$.referenceDigest');
  return rebuilt;
}
