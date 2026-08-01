import { exactKeys,validateCapabilityManifest,frozenClone,sha256,fail } from '../../audit-github-direct-protocol/src/index.mjs';
const map=Object.freeze({
  'read-source':[{resource:'contents',access:'read'}],
  'write-control-ledger':[{resource:'contents',access:'write'}],
  'publish-check':[{resource:'checks',access:'write'}],
  'publish-comment':[{resource:'issues-comments',access:'write'}],
  'publish-status':[{resource:'statuses',access:'write'}],
  'read-artifact-metadata':[{resource:'actions-artifact-metadata',access:'read'}]
});
export function createPermissionManifest(input){const v=exactKeys(input,['capabilityManifest'],'$'),capability=validateCapabilityManifest(v.capabilityManifest);if(capability.expiresAt<=capability.issuedAt)fail('invalid_expiry','$.capabilityManifest.expiresAt');const unique=new Map();for(const name of capability.capabilities)for(const permission of map[name]??[])unique.set(`${permission.resource}:${permission.access}`,permission);const permissions=[...unique.values()].sort((a,b)=>a.resource.localeCompare(b.resource)||a.access.localeCompare(b.access));const body={schemaVersion:'github-direct-permission-manifest-v1',modeId:capability.modeId,capabilityId:capability.capabilityId,repositoryId:capability.repositoryId,installationId:capability.installationId,repositoryFullName:capability.repositoryFullName,targetCommitSha:capability.targetCommitSha,permissions};const permissionDigest=sha256(body);return frozenClone({...body,permissionId:`direct-permissions-${permissionDigest.slice(7,31)}`,permissionDigest});}
