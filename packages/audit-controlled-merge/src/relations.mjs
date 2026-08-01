import { exactKeys, identifier, digest, enumValue, stringArray, denseArray, frozenClone, sha256, fail } from '../../audit-clean-room-protocol/src/index.mjs';

export const DUPLICATE_RELATION_SCHEMA='phase8-duplicate-relation-v1';
export const CONFLICT_RELATION_SCHEMA='phase8-conflict-relation-v1';

function relationFinding(value,path){
  const v=exactKeys(value,['findingId','campaignId','identityKey','severity','status','remediation','location','materialDigest','evidenceRefs'],path);
  const evidenceRefs=denseArray(v.evidenceRefs,`${path}.evidenceRefs`,256).map((entry,index)=>{
    const r=exactKeys(entry,['id','digest'],`${path}.evidenceRefs[${index}]`);return {id:identifier(r.id,`${path}.evidenceRefs[${index}].id`),digest:digest(r.digest,`${path}.evidenceRefs[${index}].digest`)};
  }).sort((a,b)=>a.id.localeCompare(b.id));
  return {findingId:identifier(v.findingId,`${path}.findingId`),campaignId:identifier(v.campaignId,`${path}.campaignId`),identityKey:identifier(v.identityKey,`${path}.identityKey`),severity:identifier(v.severity,`${path}.severity`),status:identifier(v.status,`${path}.status`),remediation:identifier(v.remediation,`${path}.remediation`),location:identifier(v.location,`${path}.location`),materialDigest:digest(v.materialDigest,`${path}.materialDigest`),evidenceRefs};
}
function material(item){return {identityKey:item.identityKey,severity:item.severity,status:item.status,remediation:item.remediation,location:item.location,materialDigest:item.materialDigest};}
function member(item){return {campaignId:item.campaignId,findingId:item.findingId,materialDigest:item.materialDigest,evidenceRefs:item.evidenceRefs};}

export function buildRelationMaps(input){
  const findings=denseArray(input,'$',100_000).map((entry,index)=>relationFinding(entry,`$[${index}]`));
  findings.sort((a,b)=>`${a.identityKey}\u0000${a.campaignId}\u0000${a.findingId}`.localeCompare(`${b.identityKey}\u0000${b.campaignId}\u0000${b.findingId}`));
  const unique=new Set();for(const item of findings){const key=`${item.campaignId}\u0000${item.findingId}`;if(unique.has(key)) fail('duplicate_identity','$');unique.add(key);}
  const groups=new Map();for(const item of findings){if(!groups.has(item.identityKey))groups.set(item.identityKey,[]);groups.get(item.identityKey).push(item);}
  const duplicateRelations=[];const conflictRelations=[];
  for(const [identityKey,items] of [...groups.entries()].sort(([a],[b])=>a.localeCompare(b))){
    if(items.length<2)continue;
    const variants=new Map();for(const item of items){const key=JSON.stringify(material(item));if(!variants.has(key))variants.set(key,[]);variants.get(key).push(item);}
    for(const variantItems of variants.values()) if(variantItems.length>1){
      const members=variantItems.map(member).sort((a,b)=>`${a.campaignId}\u0000${a.findingId}`.localeCompare(`${b.campaignId}\u0000${b.findingId}`));
      const core={schemaVersion:DUPLICATE_RELATION_SCHEMA,identityKey,material:material(variantItems[0]),members};const relationDigest=sha256(core);
      duplicateRelations.push(frozenClone({...core,relationId:`duplicate-${relationDigest.slice(7,31)}`,relationDigest}));
    }
    if(variants.size>1){
      const values=items.map((item)=>({campaignId:item.campaignId,findingId:item.findingId,severity:item.severity,status:item.status,remediation:item.remediation,location:item.location,materialDigest:item.materialDigest,evidenceRefs:item.evidenceRefs})).sort((a,b)=>`${a.campaignId}\u0000${a.findingId}`.localeCompare(`${b.campaignId}\u0000${b.findingId}`));
      const fields=['severity','status','remediation','location','materialDigest'].filter((field)=>new Set(values.map((item)=>item[field])).size>1);
      const core={schemaVersion:CONFLICT_RELATION_SCHEMA,identityKey,conflictFields:fields,values};const relationDigest=sha256(core);
      conflictRelations.push(frozenClone({...core,relationId:`conflict-${relationDigest.slice(7,31)}`,relationDigest}));
    }
  }
  duplicateRelations.sort((a,b)=>a.relationId.localeCompare(b.relationId));conflictRelations.sort((a,b)=>a.relationId.localeCompare(b.relationId));
  const duplicateMapDigest=sha256(duplicateRelations),conflictMapDigest=sha256(conflictRelations);
  return frozenClone({schemaVersion:'phase8-relation-maps-v1',duplicateRelations,conflictRelations,duplicateMapDigest,conflictMapDigest,originalFindingDigests:findings.map((item)=>item.materialDigest).sort()});
}

export function createDuplicateRelation(input){const maps=buildRelationMaps(input);if(maps.duplicateRelations.length!==1||maps.conflictRelations.length)fail('relation_shape','$.input');return maps.duplicateRelations[0];}
export function createConflictRelation(input){const maps=buildRelationMaps(input);if(maps.conflictRelations.length!==1)fail('relation_shape','$.input');return maps.conflictRelations[0];}

function validateRelationMembers(value,path){
  return denseArray(value,path,100_000).map((entry,index)=>{const p=`${path}[${index}]`;const v=exactKeys(entry,['campaignId','findingId','materialDigest','evidenceRefs'],p);const evidenceRefs=denseArray(v.evidenceRefs,`${p}.evidenceRefs`,256).map((ref,index2)=>{const q=`${p}.evidenceRefs[${index2}]`;const r=exactKeys(ref,['id','digest'],q);return{id:identifier(r.id,`${q}.id`),digest:digest(r.digest,`${q}.digest`)};}).sort((a,b)=>a.id.localeCompare(b.id));return{campaignId:identifier(v.campaignId,`${p}.campaignId`),findingId:identifier(v.findingId,`${p}.findingId`),materialDigest:digest(v.materialDigest,`${p}.materialDigest`),evidenceRefs};}).sort((a,b)=>`${a.campaignId}\u0000${a.findingId}`.localeCompare(`${b.campaignId}\u0000${b.findingId}`));
}

export function validateDuplicateRelation(input){
  const v=exactKeys(input,['schemaVersion','relationId','relationDigest','identityKey','material','members'],'$');if(v.schemaVersion!==DUPLICATE_RELATION_SCHEMA)fail('invalid_schema','$.schemaVersion');
  const m=exactKeys(v.material,['identityKey','severity','status','remediation','location','materialDigest'],'$.material');
  const material={identityKey:identifier(m.identityKey,'$.material.identityKey'),severity:identifier(m.severity,'$.material.severity'),status:identifier(m.status,'$.material.status'),remediation:identifier(m.remediation,'$.material.remediation'),location:identifier(m.location,'$.material.location'),materialDigest:digest(m.materialDigest,'$.material.materialDigest')};
  const identityKey=identifier(v.identityKey,'$.identityKey');if(material.identityKey!==identityKey)fail('identity_mismatch','$.material.identityKey');
  const members=validateRelationMembers(v.members,'$.members');if(members.length<2)fail('relation_shape','$.members');
  const core={schemaVersion:v.schemaVersion,identityKey,material,members};const expected=sha256(core);if(v.relationDigest!==expected)fail('digest_mismatch','$.relationDigest');if(v.relationId!==`duplicate-${expected.slice(7,31)}`)fail('identity_mismatch','$.relationId');return frozenClone({...core,relationId:v.relationId,relationDigest:v.relationDigest});
}

export function validateConflictRelation(input){
  const v=exactKeys(input,['schemaVersion','relationId','relationDigest','identityKey','conflictFields','values'],'$');if(v.schemaVersion!==CONFLICT_RELATION_SCHEMA)fail('invalid_schema','$.schemaVersion');
  const identityKey=identifier(v.identityKey,'$.identityKey');const conflictFields=stringArray(v.conflictFields,'$.conflictFields',{maximum:5,item:(value,path)=>enumValue(value,['severity','status','remediation','location','materialDigest'],path),sorted:false});
  const values=denseArray(v.values,'$.values',100_000).map((entry,index)=>{const p=`$.values[${index}]`;const x=exactKeys(entry,['campaignId','findingId','severity','status','remediation','location','materialDigest','evidenceRefs'],p);return{campaignId:identifier(x.campaignId,`${p}.campaignId`),findingId:identifier(x.findingId,`${p}.findingId`),severity:identifier(x.severity,`${p}.severity`),status:identifier(x.status,`${p}.status`),remediation:identifier(x.remediation,`${p}.remediation`),location:identifier(x.location,`${p}.location`),materialDigest:digest(x.materialDigest,`${p}.materialDigest`),evidenceRefs:denseArray(x.evidenceRefs,`${p}.evidenceRefs`,256).map((ref,j)=>{const q=`${p}.evidenceRefs[${j}]`;const r=exactKeys(ref,['id','digest'],q);return{id:identifier(r.id,`${q}.id`),digest:digest(r.digest,`${q}.digest`)};}).sort((a,b)=>a.id.localeCompare(b.id))};}).sort((a,b)=>`${a.campaignId}\u0000${a.findingId}`.localeCompare(`${b.campaignId}\u0000${b.findingId}`));
  if(values.length<2||conflictFields.length<1)fail('relation_shape','$.values');const core={schemaVersion:v.schemaVersion,identityKey,conflictFields,values};const expected=sha256(core);if(v.relationDigest!==expected)fail('digest_mismatch','$.relationDigest');if(v.relationId!==`conflict-${expected.slice(7,31)}`)fail('identity_mismatch','$.relationId');return frozenClone({...core,relationId:v.relationId,relationDigest:v.relationDigest});
}
