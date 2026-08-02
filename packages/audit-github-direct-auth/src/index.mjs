import {
  exactKeys, validateDirectRequest, createCapabilityManifest, integer, fullName,
  commitSha, timestamp, enumValue, denseArray, identifier, frozenClone, fail, plainObject
} from '../../audit-github-direct-protocol/src/index.mjs';

const TRANSPORT_METHODS=Object.freeze([
  'getRepository','getCommit','getBlob','getContents','applyLedgerMutation',
  'getPublication','publish','getArtifactMetadata'
]);

function validateTransport(value,path='$.authorization.transport'){
  const descriptors=plainObject(value,path);
  const keys=Object.keys(descriptors).sort();
  if(JSON.stringify(keys)!==JSON.stringify([...TRANSPORT_METHODS].sort()))fail('invalid_transport_shape',path);
  for(const name of TRANSPORT_METHODS)if(typeof descriptors[name].value!=='function')fail('invalid_transport_method',`${path}.${name}`);
  return value;
}

function validateAuthorizationAttestation(input,request,requestedCapabilities){
  const v=exactKeys(input,[
    'authorizationKind','repositoryId','installationId','repositoryFullName','targetCommitSha',
    'issuedAt','expiresAt','capabilities','transport'
  ],'$.authorization');
  const authorizationKind=enumValue(v.authorizationKind,['github-token','app-installation-token'],'$.authorization.authorizationKind');
  const repositoryId=integer(v.repositoryId,'$.authorization.repositoryId',1);
  const installationId=integer(v.installationId,'$.authorization.installationId',1);
  const repositoryFullName=fullName(v.repositoryFullName,'$.authorization.repositoryFullName');
  const targetCommitSha=commitSha(v.targetCommitSha,'$.authorization.targetCommitSha');
  const issuedAt=timestamp(v.issuedAt,'$.authorization.issuedAt');
  const expiresAt=timestamp(v.expiresAt,'$.authorization.expiresAt');
  const capabilities=denseArray(v.capabilities,'$.authorization.capabilities',16).map((x,i)=>identifier(x,`$.authorization.capabilities[${i}]`)).sort();
  if(expiresAt<=issuedAt)fail('invalid_expiry','$.authorization.expiresAt');
  if(repositoryId!==request.repositoryId||installationId!==request.installationId||repositoryFullName!==request.repositoryFullName||targetCommitSha!==request.targetCommitSha)fail('authorization_identity_mismatch','$.authorization');
  if(JSON.stringify(capabilities)!==JSON.stringify([...requestedCapabilities].sort()))fail('authorization_capability_mismatch','$.authorization.capabilities');
  const transport=validateTransport(v.transport);
  return {authorizationKind,repositoryId,installationId,repositoryFullName,targetCommitSha,issuedAt,expiresAt,capabilities,transport};
}

export function createInjectedAuthorizationBroker(input){
  const v=exactKeys(input,['issueTransport'],'$');
  if(typeof v.issueTransport!=='function')fail('invalid_authorization_provider','$.issueTransport');
  return Object.freeze({
    async authorize(requestInput,capabilitiesInput){
      const request=validateDirectRequest(requestInput);
      const capabilities=[...new Set(denseArray(capabilitiesInput,'$.capabilities',16).map((x,i)=>identifier(x,`$.capabilities[${i}]`)))].sort();
      const raw=await v.issueTransport(frozenClone({
        repositoryId:request.repositoryId,
        installationId:request.installationId,
        repositoryFullName:request.repositoryFullName,
        targetCommitSha:request.targetCommitSha,
        requesterId:request.requesterId,
        capabilities
      }));
      const attestation=validateAuthorizationAttestation(raw,request,capabilities);
      const capabilityManifest=createCapabilityManifest({
        request,
        authorizationKind:attestation.authorizationKind,
        capabilities,
        issuedAt:attestation.issuedAt,
        expiresAt:attestation.expiresAt
      });
      return Object.freeze({capabilityManifest,transport:attestation.transport});
    }
  });
}

export const AUTH_TRANSPORT_METHODS=TRANSPORT_METHODS;
