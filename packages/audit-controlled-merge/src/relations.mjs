import {
  exactKeys, identifier, digest, enumValue, stringArray, denseArray,
  frozenClone, sha256, fail
} from '../../audit-clean-room-protocol/src/index.mjs';

export const DUPLICATE_RELATION_SCHEMA='phase8-duplicate-relation-v1';
export const CONFLICT_RELATION_SCHEMA='phase8-conflict-relation-v1';
const CONFLICT_FIELDS=['severity','status','remediation','location','materialDigest'];

function evidenceReferences(value,path){
  const refs=denseArray(value,path,256).map((entry,index)=>{
    const p=`${path}[${index}]`;
    const r=exactKeys(entry,['id','digest'],p);
    return {id:identifier(r.id,`${p}.id`),digest:digest(r.digest,`${p}.digest`)};
  });
  if(new Set(refs.map((item)=>item.id)).size!==refs.length)fail('duplicate_identity',path);
  return refs.sort((a,b)=>a.id.localeCompare(b.id));
}

function relationFinding(value,path){
  const v=exactKeys(value,[
    'findingId','campaignId','identityKey','severity','status','remediation',
    'location','materialDigest','evidenceRefs'
  ],path);
  return {
    findingId:identifier(v.findingId,`${path}.findingId`),
    campaignId:identifier(v.campaignId,`${path}.campaignId`),
    identityKey:identifier(v.identityKey,`${path}.identityKey`),
    severity:identifier(v.severity,`${path}.severity`),
    status:identifier(v.status,`${path}.status`),
    remediation:identifier(v.remediation,`${path}.remediation`),
    location:identifier(v.location,`${path}.location`),
    materialDigest:digest(v.materialDigest,`${path}.materialDigest`),
    evidenceRefs:evidenceReferences(v.evidenceRefs,`${path}.evidenceRefs`)
  };
}
function material(item){return {identityKey:item.identityKey,severity:item.severity,status:item.status,remediation:item.remediation,location:item.location,materialDigest:item.materialDigest};}
function member(item){return {campaignId:item.campaignId,findingId:item.findingId,materialDigest:item.materialDigest,evidenceRefs:item.evidenceRefs};}

export function buildRelationMaps(input){
  const findings=denseArray(input,'$',100_000).map((entry,index)=>relationFinding(entry,`$[${index}]`));
  findings.sort((a,b)=>`${a.identityKey}\u0000${a.campaignId}\u0000${a.findingId}`.localeCompare(`${b.identityKey}\u0000${b.campaignId}\u0000${b.findingId}`));
  const unique=new Set();
  for(const item of findings){const key=`${item.campaignId}\u0000${item.findingId}`;if(unique.has(key))fail('duplicate_identity','$');unique.add(key);}
  const groups=new Map();
  for(const item of findings){if(!groups.has(item.identityKey))groups.set(item.identityKey,[]);groups.get(item.identityKey).push(item);}
  const duplicateRelations=[];
  const conflictRelations=[];
  for(const [identityKey,items] of [...groups.entries()].sort(([a],[b])=>a.localeCompare(b))){
    if(items.length<2)continue;
    const variants=new Map();
    for(const item of items){const key=JSON.stringify(material(item));if(!variants.has(key))variants.set(key,[]);variants.get(key).push(item);}
    for(const variantItems of variants.values())if(variantItems.length>1){
      const members=variantItems.map(member).sort((a,b)=>`${a.campaignId}\u0000${a.findingId}`.localeCompare(`${b.campaignId}\u0000${b.findingId}`));
      const core={schemaVersion:DUPLICATE_RELATION_SCHEMA,identityKey,material:material(variantItems[0]),members};
      const relationDigest=sha256(core);
      duplicateRelations.push(frozenClone({...core,relationId:`duplicate-${relationDigest.slice(7,31)}`,relationDigest}));
    }
    if(variants.size>1){
      const values=items.map((item)=>({
        campaignId:item.campaignId,findingId:item.findingId,severity:item.severity,status:item.status,
        remediation:item.remediation,location:item.location,materialDigest:item.materialDigest,evidenceRefs:item.evidenceRefs
      })).sort((a,b)=>`${a.campaignId}\u0000${a.findingId}`.localeCompare(`${b.campaignId}\u0000${b.findingId}`));
      const fields=CONFLICT_FIELDS.filter((field)=>new Set(values.map((item)=>item[field])).size>1);
      const core={schemaVersion:CONFLICT_RELATION_SCHEMA,identityKey,conflictFields:fields,values};
      const relationDigest=sha256(core);
      conflictRelations.push(frozenClone({...core,relationId:`conflict-${relationDigest.slice(7,31)}`,relationDigest}));
    }
  }
  duplicateRelations.sort((a,b)=>a.relationId.localeCompare(b.relationId));
  conflictRelations.sort((a,b)=>a.relationId.localeCompare(b.relationId));
  const duplicateMapDigest=sha256(duplicateRelations),conflictMapDigest=sha256(conflictRelations);
  return frozenClone({
    schemaVersion:'phase8-relation-maps-v1',duplicateRelations,conflictRelations,
    duplicateMapDigest,conflictMapDigest,
    originalFindingDigests:findings.map((item)=>item.materialDigest).sort()
  });
}

export function createDuplicateRelation(input){const maps=buildRelationMaps(input);if(maps.duplicateRelations.length!==1||maps.conflictRelations.length)fail('relation_shape','$.input');return maps.duplicateRelations[0];}
export function createConflictRelation(input){const maps=buildRelationMaps(input);if(maps.conflictRelations.length!==1)fail('relation_shape','$.input');return maps.conflictRelations[0];}

function validateRelationMembers(value,path){
  const members=denseArray(value,path,100_000).map((entry,index)=>{
    const p=`${path}[${index}]`;
    const v=exactKeys(entry,['campaignId','findingId','materialDigest','evidenceRefs'],p);
    return {
      campaignId:identifier(v.campaignId,`${p}.campaignId`),
      findingId:identifier(v.findingId,`${p}.findingId`),
      materialDigest:digest(v.materialDigest,`${p}.materialDigest`),
      evidenceRefs:evidenceReferences(v.evidenceRefs,`${p}.evidenceRefs`)
    };
  }).sort((a,b)=>`${a.campaignId}\u0000${a.findingId}`.localeCompare(`${b.campaignId}\u0000${b.findingId}`));
  if(new Set(members.map((item)=>`${item.campaignId}\u0000${item.findingId}`)).size!==members.length)fail('duplicate_identity',path);
  return members;
}

export function validateDuplicateRelation(input){
  const v=exactKeys(input,['schemaVersion','relationId','relationDigest','identityKey','material','members'],'$');
  if(v.schemaVersion!==DUPLICATE_RELATION_SCHEMA)fail('invalid_schema','$.schemaVersion');
  const m=exactKeys(v.material,['identityKey','severity','status','remediation','location','materialDigest'],'$.material');
  const relationMaterial={
    identityKey:identifier(m.identityKey,'$.material.identityKey'),
    severity:identifier(m.severity,'$.material.severity'),
    status:identifier(m.status,'$.material.status'),
    remediation:identifier(m.remediation,'$.material.remediation'),
    location:identifier(m.location,'$.material.location'),
    materialDigest:digest(m.materialDigest,'$.material.materialDigest')
  };
  const identityKey=identifier(v.identityKey,'$.identityKey');
  if(relationMaterial.identityKey!==identityKey)fail('identity_mismatch','$.material.identityKey');
  const members=validateRelationMembers(v.members,'$.members');
  if(members.length<2)fail('relation_shape','$.members');
  if(members.some((item)=>item.materialDigest!==relationMaterial.materialDigest))fail('relation_semantic_mismatch','$.members');
  const core={schemaVersion:v.schemaVersion,identityKey,material:relationMaterial,members};
  const expected=sha256(core);
  if(digest(v.relationDigest,'$.relationDigest')!==expected)fail('digest_mismatch','$.relationDigest');
  if(identifier(v.relationId,'$.relationId')!==`duplicate-${expected.slice(7,31)}`)fail('identity_mismatch','$.relationId');
  return frozenClone({...core,relationId:v.relationId,relationDigest:v.relationDigest});
}

export function validateConflictRelation(input){
  const v=exactKeys(input,['schemaVersion','relationId','relationDigest','identityKey','conflictFields','values'],'$');
  if(v.schemaVersion!==CONFLICT_RELATION_SCHEMA)fail('invalid_schema','$.schemaVersion');
  const identityKey=identifier(v.identityKey,'$.identityKey');
  const conflictFields=stringArray(v.conflictFields,'$.conflictFields',{
    maximum:5,
    item:(value,path)=>enumValue(value,CONFLICT_FIELDS,path),
    sorted:false
  });
  const values=denseArray(v.values,'$.values',100_000).map((entry,index)=>{
    const p=`$.values[${index}]`;
    const x=exactKeys(entry,['campaignId','findingId','severity','status','remediation','location','materialDigest','evidenceRefs'],p);
    return {
      campaignId:identifier(x.campaignId,`${p}.campaignId`),
      findingId:identifier(x.findingId,`${p}.findingId`),
      severity:identifier(x.severity,`${p}.severity`),
      status:identifier(x.status,`${p}.status`),
      remediation:identifier(x.remediation,`${p}.remediation`),
      location:identifier(x.location,`${p}.location`),
      materialDigest:digest(x.materialDigest,`${p}.materialDigest`),
      evidenceRefs:evidenceReferences(x.evidenceRefs,`${p}.evidenceRefs`)
    };
  }).sort((a,b)=>`${a.campaignId}\u0000${a.findingId}`.localeCompare(`${b.campaignId}\u0000${b.findingId}`));
  if(values.length<2)fail('relation_shape','$.values');
  if(new Set(values.map((item)=>`${item.campaignId}\u0000${item.findingId}`)).size!==values.length)fail('duplicate_identity','$.values');
  const actualFields=CONFLICT_FIELDS.filter((field)=>new Set(values.map((item)=>item[field])).size>1);
  if(actualFields.length<1||JSON.stringify(actualFields)!==JSON.stringify(conflictFields))fail('relation_semantic_mismatch','$.conflictFields');
  const core={schemaVersion:v.schemaVersion,identityKey,conflictFields,values};
  const expected=sha256(core);
  if(digest(v.relationDigest,'$.relationDigest')!==expected)fail('digest_mismatch','$.relationDigest');
  if(identifier(v.relationId,'$.relationId')!==`conflict-${expected.slice(7,31)}`)fail('identity_mismatch','$.relationId');
  return frozenClone({...core,relationId:v.relationId,relationDigest:v.relationDigest});
}
