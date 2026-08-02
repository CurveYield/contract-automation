import {validateDuplicateRelation,validateConflictRelation} from '../../audit-controlled-merge/src/index.mjs';
import {denseArray,identifier,frozenClone} from '../../audit-phase78-service/src/index.mjs';

function fullyVisible(members,visible){
 return members.every(member=>visible.has(member.campaignId));
}
export function createRelationSummary({duplicateRelations,conflictRelations,visibleCampaignIds}){
 const visible=new Set(denseArray(visibleCampaignIds,'$.visibleCampaignIds',10000).map((x,i)=>identifier(x,`$.visibleCampaignIds[${i}]`)));
 const duplicates=denseArray(duplicateRelations,'$.duplicateRelations',100000).map((relation)=>validateDuplicateRelation(relation));
 const conflicts=denseArray(conflictRelations,'$.conflictRelations',100000).map((relation)=>validateConflictRelation(relation));
 const visibleDuplicates=duplicates.filter(relation=>fullyVisible(relation.members,visible));
 const visibleConflicts=conflicts.filter(relation=>fullyVisible(relation.values,visible));
 const visibleMembers=visibleDuplicates.reduce((sum,relation)=>sum+relation.members.length,0)+visibleConflicts.reduce((sum,relation)=>sum+relation.values.length,0);
 return frozenClone({
  schemaVersion:'audit-phase9-relation-summary-v2',
  duplicateGroups:visibleDuplicates.length,conflictGroups:visibleConflicts.length,visibleMembers
 });
}
