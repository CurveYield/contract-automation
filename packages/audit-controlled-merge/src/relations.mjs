import {
  exactKeys, identifier, digest, enumValue, denseArray,
  frozenClone, sha256, fail
} from '../../audit-clean-room-protocol/src/index.mjs';

export const DUPLICATE_RELATION_SCHEMA='phase8-duplicate-relation-v1';
export const CONFLICT_RELATION_SCHEMA='phase8-conflict-relation-v1';
const MATERIAL_FIELDS=['severity','status','remediation','location','materialDigest'];

function evidenceReferences(value,path){
  const refs=denseArray(value,path,256).map((entry,index)=>{
    const itemPath=`${path}[${index}]`,record=exactKeys(entry,['id','digest'],itemPath);
    return {id:identifier(record.id,`${itemPath}.id`),digest:digest(record.digest,`${itemPath}.digest`)};
  });
  if(new Set(refs.map((item)=>item.id)).size!==refs.length)fail('duplicate_identity',path);
  refs.sort((a,b)=>a.id.localeCompare(b.id));
  return refs;
}
function relationFinding(value,path){
  const record=exactKeys(value,['findingId','campaignId','identityKey','severity','status','remediation','location','materialDigest','evidenceRefs'],path);
  return {
    findingId:identifier(record.findingId,`${path}.findingId`),
    campaignId:identifier(record.campaignId,`${path}.campaignId`),
    identityKey:identifier(record.identityKey,`${path}.identityKey`),
    severity:identifier(record.severity,`${path}.severity`),
    status:identifier(record.status,`${path}.status`),
    remediation:identifier(record.remediation,`${path}.remediation`),
    location:identifier(record.location,`${path}.location`),
    materialDigest:digest(record.materialDigest,`${path}.materialDigest`),
    evidenceRefs:evidenceReferences(record.evidenceRefs,`${path}.evidenceRefs`)
  };
}
function material(item){
  return {identityKey:item.identityKey,severity:item.severity,status:item.status,remediation:item.remediation,location:item.location,materialDigest:item.materialDigest};
}
function member(item){
  return {campaignId:item.campaignId,findingId:item.findingId,materialDigest:item.materialDigest,evidenceRefs:item.evidenceRefs};
}
function memberKey(item){return `${item.campaignId}\u0000${item.findingId}`;}
function assertUniqueMembers(items,path){
  const seen=new Set();
  for(const item of items){const key=memberKey(item);if(seen.has(key))fail('duplicate_identity',path);seen.add(key);}
}

export function buildRelationMaps(input){
  const findings=denseArray(input,'$',100_000).map((entry,index)=>relationFinding(entry,`$[${index}]`));
  findings.sort((a,b)=>`${a.identityKey}\u0000${memberKey(a)}`.localeCompare(`${b.identityKey}\u0000${memberKey(b)}`));
  assertUniqueMembers(findings,'$');
  const groups=new Map();
  for(const item of findings){if(!groups.has(item.identityKey))groups.set(item.identityKey,[]);groups.get(item.identityKey).push(item);}
  const duplicateRelations=[],conflictRelations=[];
  for(const [identityKey,items] of [...groups.entries()].sort(([a],[b])=>a.localeCompare(b))){
    if(items.length<2)continue;
    const variants=new Map();
    for(const item of items){const key=JSON.stringify(material(item));if(!variants.has(key))variants.set(key,[]);variants.get(key).push(item);}
    for(const variantItems of variants.values())if(variantItems.length>1){
      const members=variantItems.map(member).sort((a,b)=>memberKey(a).localeCompare(memberKey(b)));
      const core={schemaVersion:DUPLICATE_RELATION_SCHEMA,identityKey,material:material(variantItems[0]),members};
      const relationDigest=sha256(core);
      duplicateRelations.push(frozenClone({...core,relationId:`duplicate-${relationDigest.slice(7,31)}`,relationDigest}));
    }
    if(variants.size>1){
      const values=items.map((item)=>({campaignId:item.campaignId,findingId:item.findingId,severity:item.severity,status:item.status,remediation:item.remediation,location:item.location,materialDigest:item.materialDigest,evidenceRefs:item.evidenceRefs})).sort((a,b)=>memberKey(a).localeCompare(memberKey(b)));
      const conflictFields=MATERIAL_FIELDS.filter((field)=>new Set(values.map((item)=>item[field])).size>1);
      const core={schemaVersion:CONFLICT_RELATION_SCHEMA,identityKey,conflictFields,values};
      const relationDigest=sha256(core);
      conflictRelations.push(frozenClone({...core,relationId:`conflict-${relationDigest.slice(7,31)}`,relationDigest}));
    }
  }
  duplicateRelations.sort((a,b)=>a.relationId.localeCompare(b.relationId));
  conflictRelations.sort((a,b)=>a.relationId.localeCompare(b.relationId));
  return frozenClone({
    schemaVersion:'phase8-relation-maps-v1',duplicateRelations,conflictRelations,
    duplicateMapDigest:sha256(duplicateRelations),conflictMapDigest:sha256(conflictRelations),
    originalFindingDigests:findings.map((item)=>item.materialDigest).sort()
  });
}
export function createDuplicateRelation(input){
  const maps=buildRelationMaps(input);
  if(maps.duplicateRelations.length!==1||maps.conflictRelations.length)fail('relation_shape','$.input');
  return maps.duplicateRelations[0];
}
export function createConflictRelation(input){
  const maps=buildRelationMaps(input);
  if(maps.conflictRelations.length!==1)fail('relation_shape','$.input');
  return maps.conflictRelations[0];
}

function validateRelationMembers(value,path){
  const members=denseArray(value,path,100_000).map((entry,index)=>{
    const itemPath=`${path}[${index}]`,record=exactKeys(entry,['campaignId','findingId','materialDigest','evidenceRefs'],itemPath);
    return {
      campaignId:identifier(record.campaignId,`${itemPath}.campaignId`),
      findingId:identifier(record.findingId,`${itemPath}.findingId`),
      materialDigest:digest(record.materialDigest,`${itemPath}.materialDigest`),
      evidenceRefs:evidenceReferences(record.evidenceRefs,`${itemPath}.evidenceRefs`)
    };
  });
  assertUniqueMembers(members,path);
  members.sort((a,b)=>memberKey(a).localeCompare(memberKey(b)));
  return members;
}

export function validateDuplicateRelation(input){
  const value=exactKeys(input,['schemaVersion','relationId','relationDigest','identityKey','material','members'],'$');
  if(value.schemaVersion!==DUPLICATE_RELATION_SCHEMA)fail('invalid_schema','$.schemaVersion');
  const record=exactKeys(value.material,['identityKey','severity','status','remediation','location','materialDigest'],'$.material');
  const materialValue={
    identityKey:identifier(record.identityKey,'$.material.identityKey'),
    severity:identifier(record.severity,'$.material.severity'),status:identifier(record.status,'$.material.status'),
    remediation:identifier(record.remediation,'$.material.remediation'),location:identifier(record.location,'$.material.location'),
    materialDigest:digest(record.materialDigest,'$.material.materialDigest')
  };
  const identityKey=identifier(value.identityKey,'$.identityKey');
  if(materialValue.identityKey!==identityKey)fail('identity_mismatch','$.material.identityKey');
  const members=validateRelationMembers(value.members,'$.members');
  if(members.length<2)fail('relation_shape','$.members');
  for(let index=0;index<members.length;index+=1)if(members[index].materialDigest!==materialValue.materialDigest)fail('material_mismatch',`$.members[${index}].materialDigest`);
  const core={schemaVersion:DUPLICATE_RELATION_SCHEMA,identityKey,material:materialValue,members};
  const expected=sha256(core);
  if(digest(value.relationDigest,'$.relationDigest')!==expected)fail('digest_mismatch','$.relationDigest');
  if(identifier(value.relationId,'$.relationId')!==`duplicate-${expected.slice(7,31)}`)fail('identity_mismatch','$.relationId');
  return frozenClone({...core,relationId:value.relationId,relationDigest:value.relationDigest});
}

export function validateConflictRelation(input){
  const value=exactKeys(input,['schemaVersion','relationId','relationDigest','identityKey','conflictFields','values'],'$');
  if(value.schemaVersion!==CONFLICT_RELATION_SCHEMA)fail('invalid_schema','$.schemaVersion');
  const identityKey=identifier(value.identityKey,'$.identityKey');
  const suppliedFields=denseArray(value.conflictFields,'$.conflictFields',MATERIAL_FIELDS.length).map((field,index)=>enumValue(field,MATERIAL_FIELDS,`$.conflictFields[${index}]`));
  if(new Set(suppliedFields).size!==suppliedFields.length)fail('duplicate_identity','$.conflictFields');
  const values=denseArray(value.values,'$.values',100_000).map((entry,index)=>{
    const path=`$.values[${index}]`,record=exactKeys(entry,['campaignId','findingId','severity','status','remediation','location','materialDigest','evidenceRefs'],path);
    return {
      campaignId:identifier(record.campaignId,`${path}.campaignId`),findingId:identifier(record.findingId,`${path}.findingId`),
      severity:identifier(record.severity,`${path}.severity`),status:identifier(record.status,`${path}.status`),
      remediation:identifier(record.remediation,`${path}.remediation`),location:identifier(record.location,`${path}.location`),
      materialDigest:digest(record.materialDigest,`${path}.materialDigest`),evidenceRefs:evidenceReferences(record.evidenceRefs,`${path}.evidenceRefs`)
    };
  });
  assertUniqueMembers(values,'$.values');
  values.sort((a,b)=>memberKey(a).localeCompare(memberKey(b)));
  if(values.length<2)fail('relation_shape','$.values');
  const actualFields=MATERIAL_FIELDS.filter((field)=>new Set(values.map((item)=>item[field])).size>1);
  if(actualFields.length<1)fail('relation_shape','$.conflictFields');
  if(JSON.stringify(suppliedFields)!==JSON.stringify(actualFields))fail('conflict_field_mismatch','$.conflictFields');
  const core={schemaVersion:CONFLICT_RELATION_SCHEMA,identityKey,conflictFields:actualFields,values};
  const expected=sha256(core);
  if(digest(value.relationDigest,'$.relationDigest')!==expected)fail('digest_mismatch','$.relationDigest');
  if(identifier(value.relationId,'$.relationId')!==`conflict-${expected.slice(7,31)}`)fail('identity_mismatch','$.relationId');
  return frozenClone({...core,relationId:value.relationId,relationDigest:value.relationDigest});
}
