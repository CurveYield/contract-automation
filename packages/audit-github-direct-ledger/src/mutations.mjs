import {
  DIRECT_MODE_ID,
  CONTROL_BRANCH,
  exactKeys,
  canonicalJson,
  sha256,
  frozenClone,
  fail,
  digest
} from '../../audit-github-direct-protocol/src/index.mjs';
import { ledgerPathInfo } from './paths.mjs';

const contentBlobSha = (content) => sha256(canonicalJson(content)).slice(7,47);
const CAS_PATH_KINDS = new Set(['current','job-index']);

export const blobSha = (value, path) => {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/.test(value)) fail('invalid_blob_sha', path);
  return value;
};

function assertOperationPath(operation, info, path = '$.path') {
  if (operation === 'update-cas' && !CAS_PATH_KINDS.has(info.kind)) {
    fail('mutation_path_violation', path, 'CAS updates are limited to mutable current and index records');
  }
  if (operation === 'create-immutable' && info.kind === 'job-index') {
    fail('mutation_path_violation', path, 'The jobs index is mutable and cannot use create-only publication');
  }
}

export function planImmutableCreate(input) {
  const v = exactKeys(input, ['path','content'], '$');
  const info = ledgerPathInfo(v.path, '$.path');
  assertOperationPath('create-immutable', info);
  const content = frozenClone(v.content);
  const contentDigest = sha256(content);
  return frozenClone({
    schemaVersion: 'github-direct-ledger-mutation-v1',
    modeId: DIRECT_MODE_ID,
    branch: CONTROL_BRANCH,
    operation: 'create-immutable',
    path: info.path,
    content,
    contentDigest,
    expectedBlobSha: null,
    nextContentBlobSha: contentBlobSha(content),
    sideEffects: false,
    usesPrefixListing: false
  });
}

export function planCasUpdate(input) {
  const v = exactKeys(input, ['path','content','currentBlobSha','expectedBlobSha'], '$');
  const info = ledgerPathInfo(v.path, '$.path');
  assertOperationPath('update-cas', info);
  const currentBlobSha = blobSha(v.currentBlobSha, '$.currentBlobSha');
  const expectedBlobSha = blobSha(v.expectedBlobSha, '$.expectedBlobSha');
  if (currentBlobSha !== expectedBlobSha) fail('stale_blob_sha', '$.expectedBlobSha');
  const content = frozenClone(v.content);
  const contentDigest = sha256(content);
  return frozenClone({
    schemaVersion: 'github-direct-ledger-mutation-v1',
    modeId: DIRECT_MODE_ID,
    branch: CONTROL_BRANCH,
    operation: 'update-cas',
    path: info.path,
    content,
    contentDigest,
    expectedBlobSha,
    nextContentBlobSha: contentBlobSha(content),
    sideEffects: false,
    usesPrefixListing: false
  });
}

export function validateLedgerMutation(input) {
  const v = exactKeys(input, [
    'schemaVersion','modeId','branch','operation','path','content','contentDigest',
    'expectedBlobSha','nextContentBlobSha','sideEffects','usesPrefixListing'
  ], '$');
  if (v.schemaVersion !== 'github-direct-ledger-mutation-v1') fail('invalid_schema', '$.schemaVersion');
  if (v.modeId !== DIRECT_MODE_ID) fail('invalid_mode', '$.modeId');
  if (v.branch !== CONTROL_BRANCH) fail('invalid_control_branch', '$.branch');
  if (!['create-immutable','update-cas'].includes(v.operation)) fail('invalid_operation', '$.operation');
  const info = ledgerPathInfo(v.path, '$.path');
  assertOperationPath(v.operation, info);
  const content = frozenClone(v.content);
  const contentDigest = digest(v.contentDigest, '$.contentDigest');
  if (contentDigest !== sha256(content)) fail('digest_mismatch', '$.contentDigest');
  const nextContentBlobSha = blobSha(v.nextContentBlobSha, '$.nextContentBlobSha');
  if (nextContentBlobSha !== contentBlobSha(content)) fail('blob_sha_mismatch', '$.nextContentBlobSha');
  let expectedBlobSha = v.expectedBlobSha;
  if (v.operation === 'create-immutable') {
    if (expectedBlobSha !== null) fail('create_only_violation', '$.expectedBlobSha');
  } else {
    expectedBlobSha = blobSha(expectedBlobSha, '$.expectedBlobSha');
  }
  if (v.sideEffects !== false) fail('side_effect_violation', '$.sideEffects');
  if (v.usesPrefixListing !== false) fail('prefix_listing_violation', '$.usesPrefixListing');
  return frozenClone({
    ...v,
    path: info.path,
    content,
    contentDigest,
    expectedBlobSha,
    nextContentBlobSha
  });
}
