import {validateProvenanceIndex} from '../../audit-provenance/src/index.mjs';
import {denseArray,identifier,timestamp,sha256,frozenClone} from '../../audit-phase78-service/src/index.mjs';
import {createHiddenReportProjection} from './hidden.mjs';

export function createProvenanceReportProjection({index,nodeId,visibleCampaignIds,reportedAt}){
 const normalized=validateProvenanceIndex(index);
 const visible=new Set(denseArray(visibleCampaignIds,'$.visibleCampaignIds',10000).map((x,i)=>identifier(x,`$.visibleCampaignIds[${i}]`)));
 const target=identifier(nodeId,'$.nodeId');
 const node=normalized.nodes.find(item=>item.nodeId===target);
 if(!node||(node.campaignId!==null&&!visible.has(node.campaignId)))return createHiddenReportProjection();
 const nodes=normalized.nodes.filter(item=>item.campaignId===null||visible.has(item.campaignId)).map(item=>({
  nodeId:item.nodeId,campaignId:item.campaignId,type:item.type,digest:item.digest
 })).sort((a,b)=>a.nodeId.localeCompare(b.nodeId));
 const ids=new Set(nodes.map(item=>item.nodeId));
 const edges=normalized.edges.filter(item=>ids.has(item.from)&&ids.has(item.to)).map(item=>({
  edgeId:item.edgeId,from:item.from,to:item.to,type:item.type
 })).sort((a,b)=>a.edgeId.localeCompare(b.edgeId));
 const visibleIndexCore={mergeId:normalized.mergeId,nodes,edges};
 const indexDigest=sha256(visibleIndexCore);
 const core={
  schemaVersion:'audit-phase9-provenance-report-v2',mergeId:normalized.mergeId,nodeId:target,
  indexDigest,nodes,edges,reportedAt:timestamp(reportedAt,'$.reportedAt')
 };
 const reportDigest=sha256(core);
 return frozenClone({...core,reportId:`provenance-report-${reportDigest.slice(7,31)}`,reportDigest});
}
