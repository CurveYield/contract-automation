import { exactKeys, identifier, denseArray, frozenClone } from '../../audit-clean-room-protocol/src/index.mjs';
import { validateProvenanceIndex } from './graph.mjs';

export function traceAuthorizedOrigins(indexInput,input){
  const index=validateProvenanceIndex(indexInput);const value=exactKeys(input,['nodeId','visibleCampaignIds'],'$');const nodeId=identifier(value.nodeId,'$.nodeId');
  const visible=new Set(denseArray(value.visibleCampaignIds,'$.visibleCampaignIds',10_000).map((item,index)=>identifier(item,`$.visibleCampaignIds[${index}]`)));
  const allowedNode=(node)=>node.campaignId===null||visible.has(node.campaignId);
  if(!index.nodes.some((node)=>node.nodeId===nodeId&&allowedNode(node)))return frozenClone({schemaVersion:'phase8-origin-trace-v1',status:'not_found',nodes:[],edges:[]});
  const reverse=new Map(index.nodes.map((node)=>[node.nodeId,[]]));for(const edge of index.edges)reverse.get(edge.to).push(edge);
  const seen=new Set([nodeId]),queue=[nodeId];while(queue.length){const current=queue.shift();for(const edge of reverse.get(current)){const source=index.nodes.find((node)=>node.nodeId===edge.from);if(source&&allowedNode(source)&&!seen.has(source.nodeId)){seen.add(source.nodeId);queue.push(source.nodeId);}}}
  const nodes=index.nodes.filter((node)=>seen.has(node.nodeId)&&allowedNode(node));const ids=new Set(nodes.map((node)=>node.nodeId));const edges=index.edges.filter((edge)=>ids.has(edge.from)&&ids.has(edge.to));
  return frozenClone({schemaVersion:'phase8-origin-trace-v1',status:'ok',nodes,edges});
}
