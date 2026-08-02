import {
  exactKeys, validateCapabilityManifest, frozenClone, sha256, fail,
  integer, fullName, commitSha, identifier, digest, denseArray,
  boundedString
} from '../../audit-github-direct-protocol/src/index.mjs';

const capabilityPermissionMap=Object.freeze({
  'read-source':[{resource:'contents',access:'read'}],
  'write-control-ledger':[{resource:'contents',access:'write'}],
  'publish-check':[{resource:'checks',access:'write'}],
  'publish-comment':[{resource:'issues-comments',access:'write'}],
  'publish-status':[{resource:'statuses',access:'write'}],
  'read-artifact-metadata':[{resource:'actions-artifact-metadata',access:'read'}]
});
const allowedPairs=new Set(Object.values(capabilityPermissionMap).flat().map((entry)=>`${entry.resource}:${entry.access}`));

function normalizePermissions(value,path='$.permissions'){
  const permissions=denseArray(value,path,16).map((entry,index)=>{
    const itemPath=`${path}[${index}]`;
    const v=exactKeys(entry,['resource','access'],itemPath);
    const resource=boundedString(v.resource,`${itemPath}.resource`,64);
    const access=boundedString(v.access,`${itemPath}.access`,16);
    if(!allowedPairs.has(`${resource}:${access}`))fail('permission_denied',itemPath);
    return {resource,access};
  });
  if(new Set(permissions.map((entry)=>`${entry.resource}:${entry.access}`)).size!==permissions.length){
    fail('duplicate_identity',path);
  }
  const sorted=[...permissions].sort((a,b)=>a.resource.localeCompare(b.resource)||a.access.localeCompare(b.access));
  if(JSON.stringify(sorted)!==JSON.stringify(permissions))fail('noncanonical_order',path);
  return permissions;
}

export function createPermissionManifest(input){
  const v=exactKeys(input,['capabilityManifest'],'$');
  const capability=validateCapabilityManifest(v.capabilityManifest);
  if(capability.expiresAt<=capability.issuedAt)fail('invalid_expiry','$.capabilityManifest.expiresAt');
  const unique=new Map();
  for(const name of capability.capabilities){
    for(const permission of capabilityPermissionMap[name]??[]){
      unique.set(`${permission.resource}:${permission.access}`,permission);
    }
  }
  const permissions=[...unique.values()].sort((a,b)=>a.resource.localeCompare(b.resource)||a.access.localeCompare(b.access));
  const body={
    schemaVersion:'github-direct-permission-manifest-v1',
    modeId:capability.modeId,
    capabilityId:capability.capabilityId,
    repositoryId:capability.repositoryId,
    installationId:capability.installationId,
    repositoryFullName:capability.repositoryFullName,
    targetCommitSha:capability.targetCommitSha,
    permissions
  };
  const permissionDigest=sha256(body);
  return frozenClone({...body,permissionId:`direct-permissions-${permissionDigest.slice(7,31)}`,permissionDigest});
}

export function validatePermissionManifest(input){
  const v=exactKeys(input,[
    'schemaVersion','modeId','capabilityId','repositoryId','installationId',
    'repositoryFullName','targetCommitSha','permissions','permissionId','permissionDigest'
  ],'$');
  if(v.schemaVersion!=='github-direct-permission-manifest-v1')fail('invalid_schema','$.schemaVersion');
  if(v.modeId!=='github-direct-audit-v1')fail('invalid_mode','$.modeId');
  const body={
    schemaVersion:v.schemaVersion,
    modeId:v.modeId,
    capabilityId:identifier(v.capabilityId,'$.capabilityId'),
    repositoryId:integer(v.repositoryId,'$.repositoryId',1),
    installationId:integer(v.installationId,'$.installationId',1),
    repositoryFullName:fullName(v.repositoryFullName,'$.repositoryFullName'),
    targetCommitSha:commitSha(v.targetCommitSha,'$.targetCommitSha'),
    permissions:normalizePermissions(v.permissions)
  };
  const permissionDigest=digest(v.permissionDigest,'$.permissionDigest');
  const expected=sha256(body);
  if(permissionDigest!==expected)fail('digest_mismatch','$.permissionDigest');
  const permissionId=identifier(v.permissionId,'$.permissionId');
  if(permissionId!==`direct-permissions-${expected.slice(7,31)}`)fail('identity_mismatch','$.permissionId');
  return frozenClone({...body,permissionId,permissionDigest});
}
