import {
  exactKeys,
  plainObject,
  validateCapabilityManifest,
  integer,
  fullName,
  commitSha,
  boundedString,
  denseArray,
  booleanValue,
  identifier,
  fail,
  frozenClone
} from '../../audit-github-direct-protocol/src/index.mjs';
import { blobSha, validateLedgerMutation } from '../../audit-github-direct-ledger/src/index.mjs';
import { normalizeGitHubError, wrapTransportPromise } from './errors.mjs';
import { reconcilePublication, validatePublicationPlan } from './publications.mjs';
import { createArtifactMetadata, validateArtifactMetadata } from './artifacts.mjs';

const methods = [
  'getRepository', 'getCommit', 'getBlob', 'getContents', 'applyLedgerMutation',
  'getPublication', 'publish', 'getArtifactMetadata'
];

function validateTransport(value) {
  const desc = plainObject(value, '$.transport');
  const keys = Object.keys(desc).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...methods].sort())) {
    const extra = keys.find((key) => !methods.includes(key));
    const missing = methods.find((key) => !keys.includes(key));
    fail(extra ? 'unknown_field' : 'missing_field', extra ? `$.transport.${extra}` : `$.transport.${missing}`);
  }
  const result = {};
  for (const name of methods) {
    const fn = desc[name].value;
    if (typeof fn !== 'function') fail('invalid_transport_method', `$.transport.${name}`);
    result[name] = fn.bind(value);
  }
  return result;
}

function repoPath(value, path) {
  const result = boundedString(value, path, 512);
  if (
    result.startsWith('/') || result.includes('..') || result.includes('\\') ||
    result.includes('//') || !/^[A-Za-z0-9_.@+\/-]+$/.test(result)
  ) {
    fail('unsafe_path', path);
  }
  return result;
}

function transportIdentityMismatch(path = '$.transportResult') {
  fail('transport_identity_mismatch', path, 'Transport response does not match the bound request');
}

function validateRepositoryResponse(value, bound) {
  const v = exactKeys(value, ['repositoryId', 'fullName'], '$.transportResult');
  const result = {
    repositoryId: integer(v.repositoryId, '$.transportResult.repositoryId', 1),
    fullName: fullName(v.fullName, '$.transportResult.fullName')
  };
  if (result.repositoryId !== bound.repositoryId || result.fullName !== bound.repositoryFullName) {
    transportIdentityMismatch();
  }
  return frozenClone(result);
}

function validateCommitResponse(value, bound) {
  const v = exactKeys(value, ['sha'], '$.transportResult');
  const sha = commitSha(v.sha, '$.transportResult.sha');
  if (sha !== bound.targetCommitSha) transportIdentityMismatch();
  return frozenClone({ sha });
}

function validateBlobResponse(value, requestedBlobSha) {
  const v = exactKeys(value, ['blobSha', 'sizeBytes'], '$.transportResult');
  const result = {
    blobSha: blobSha(v.blobSha, '$.transportResult.blobSha'),
    sizeBytes: integer(v.sizeBytes, '$.transportResult.sizeBytes', 0, 2_000_000_000)
  };
  if (result.blobSha !== requestedBlobSha) transportIdentityMismatch();
  return frozenClone(result);
}

function validateContentsResponse(value, requestedPath) {
  const v = exactKeys(value, ['path', 'blobSha'], '$.transportResult');
  const result = {
    path: repoPath(v.path, '$.transportResult.path'),
    blobSha: blobSha(v.blobSha, '$.transportResult.blobSha')
  };
  if (result.path !== requestedPath) transportIdentityMismatch();
  return frozenClone(result);
}

function validateMutationResponse(value, mutation) {
  const v = exactKeys(value, ['applied', 'nextBlobSha'], '$.transportResult');
  const result = {
    applied: booleanValue(v.applied, '$.transportResult.applied'),
    nextBlobSha: blobSha(v.nextBlobSha, '$.transportResult.nextBlobSha')
  };
  if (!result.applied || result.nextBlobSha !== mutation.nextContentBlobSha) transportIdentityMismatch();
  return frozenClone(result);
}

function validatePublishResponse(value, plan) {
  const v = exactKeys(value, ['published', 'publicationId'], '$.transportResult');
  const result = {
    published: booleanValue(v.published, '$.transportResult.published'),
    publicationId: identifier(v.publicationId, '$.transportResult.publicationId')
  };
  if (!result.published || result.publicationId !== plan.publicationId) transportIdentityMismatch();
  return frozenClone(result);
}

function normalizeArtifactRecord(value) {
  const descriptors = plainObject(value, '$.transportResult[]');
  if (Object.hasOwn(descriptors, 'schemaVersion')) return validateArtifactMetadata(value);
  return createArtifactMetadata(value);
}

export function createInjectedGitHubAdapter(input) {
  const v = exactKeys(input, ['capabilityManifest', 'transport'], '$');
  const capability = validateCapabilityManifest(v.capabilityManifest);
  const transport = validateTransport(v.transport);
  const caps = new Set(capability.capabilities);

  function requireCap(name) {
    if (!caps.has(name)) fail('capability_denied', '$.capabilityManifest.capabilities');
  }

  function identity(value, extra = []) {
    const x = exactKeys(
      value,
      ['repositoryId', 'installationId', 'repositoryFullName', 'targetCommitSha', ...extra],
      '$'
    );
    const bound = {
      repositoryId: integer(x.repositoryId, '$.repositoryId', 1),
      installationId: integer(x.installationId, '$.installationId', 1),
      repositoryFullName: fullName(x.repositoryFullName, '$.repositoryFullName'),
      targetCommitSha: commitSha(x.targetCommitSha, '$.targetCommitSha')
    };
    if (
      bound.repositoryId !== capability.repositoryId ||
      bound.installationId !== capability.installationId ||
      bound.repositoryFullName !== capability.repositoryFullName ||
      bound.targetCommitSha !== capability.targetCommitSha
    ) {
      fail('identity_mismatch', '$');
    }
    return { x, bound };
  }

  const call = (name, args) => wrapTransportPromise(transport[name](frozenClone(args)));

  return Object.freeze({
    getRepository(value) {
      requireCap('read-source');
      const { bound } = identity(value);
      return call('getRepository', bound).then((result) => validateRepositoryResponse(result, bound));
    },
    getCommit(value) {
      requireCap('read-source');
      const { bound } = identity(value);
      return call('getCommit', bound).then((result) => validateCommitResponse(result, bound));
    },
    getBlob(value) {
      requireCap('read-source');
      const { x, bound } = identity(value, ['blobSha']);
      const requestedBlobSha = blobSha(x.blobSha, '$.blobSha');
      return call('getBlob', { ...bound, blobSha: requestedBlobSha })
        .then((result) => validateBlobResponse(result, requestedBlobSha));
    },
    getContents(value) {
      requireCap('read-source');
      const { x, bound } = identity(value, ['path']);
      const requestedPath = repoPath(x.path, '$.path');
      return call('getContents', { ...bound, path: requestedPath })
        .then((result) => validateContentsResponse(result, requestedPath));
    },
    applyLedgerMutation(value) {
      requireCap('write-control-ledger');
      const { x, bound } = identity(value, ['mutation']);
      const mutation = validateLedgerMutation(x.mutation);
      return call('applyLedgerMutation', { ...bound, mutation })
        .then((result) => validateMutationResponse(result, mutation));
    },
    publish(value) {
      const { x, bound } = identity(value, ['plan']);
      const plan = validatePublicationPlan(x.plan);
      const cap = {
        check: 'publish-check',
        comment: 'publish-comment',
        status: 'publish-status'
      }[plan.kind];
      requireCap(cap);
      return (async () => {
        const observedRaw = await call('getPublication', {
          ...bound,
          kind: plan.kind,
          idempotencyKey: plan.idempotencyKey
        });
        const observed = observedRaw === null ? null : validatePublicationPlan(observedRaw);
        const decision = reconcilePublication({ plan, observed });
        if (decision.action === 'noop') return decision;
        const resultRaw = await call('publish', plan);
        const result = validatePublishResponse(resultRaw, plan);
        return frozenClone({ action: 'create', plan, result });
      })();
    },
    getArtifactMetadata(value) {
      requireCap('read-artifact-metadata');
      const { bound } = identity(value);
      return call('getArtifactMetadata', bound).then((items) =>
        denseArray(items, '$.transportResult', 100).map((item) => normalizeArtifactRecord(item))
      );
    }
  });
}

export { normalizeGitHubError };
