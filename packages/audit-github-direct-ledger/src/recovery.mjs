import { exactKeys,denseArray,digest,frozenClone,fail,plainObject } from '../../audit-github-direct-protocol/src/index.mjs';
import { ledgerPath } from './paths.mjs';
import { blobSha,validateLedgerMutation } from './mutations.mjs';

function currentMap(value) {
  const desc = plainObject(value, '$.currentBlobShas');
  const out = {};
  for (const [key, item] of Object.entries(desc)) {
    const path = ledgerPath(key, `$.currentBlobShas.${key}`);
    out[path] = blobSha(item.value, `$.currentBlobShas.${key}`);
  }
  return out;
}

function observedRecords(value) {
  const entries = denseArray(value, '$.observed', 1000).map((entry, index) => {
    const path = `$.observed[${index}]`;
    const v = exactKeys(entry, ['path','contentDigest','blobSha'], path);
    return {
      path: ledgerPath(v.path, `${path}.path`),
      contentDigest: digest(v.contentDigest, `${path}.contentDigest`),
      blobSha: blobSha(v.blobSha, `${path}.blobSha`)
    };
  });
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.path)) fail('duplicate_identity', '$.observed');
    seen.add(entry.path);
  }
  return entries;
}

export function planPartialWriteRecovery(input) {
  const v = exactKeys(input, ['plans','observed','currentBlobShas'], '$');
  const plans = denseArray(v.plans, '$.plans', 1000).map((entry, index) => {
    try {
      return validateLedgerMutation(entry);
    } catch (error) {
      if (error.path?.startsWith('$')) error.path = `$.plans[${index}]${error.path.slice(1)}`;
      throw error;
    }
  });
  const planByPath = new Map();
  for (const plan of plans) {
    if (planByPath.has(plan.path)) fail('duplicate_identity', '$.plans');
    planByPath.set(plan.path, plan);
  }

  const observed = observedRecords(v.observed);
  for (const record of observed) {
    const plan = planByPath.get(record.path);
    if (!plan || plan.operation !== 'create-immutable') {
      fail('unrelated_observation', '$.observed');
    }
  }
  const byPath = new Map(observed.map((entry) => [entry.path, entry]));

  const currentBlobShas = currentMap(v.currentBlobShas);
  for (const path of Object.keys(currentBlobShas)) {
    const plan = planByPath.get(path);
    if (!plan || plan.operation !== 'update-cas') {
      fail('unrelated_observation', '$.currentBlobShas');
    }
  }

  const remaining = [];
  for (const plan of plans) {
    if (plan.operation === 'create-immutable') {
      const found = byPath.get(plan.path);
      if (!found) {
        remaining.push(plan);
        continue;
      }
      if (found.contentDigest !== plan.contentDigest) fail('immutable_conflict', '$.observed');
    } else {
      const actual = currentBlobShas[plan.path];
      if (actual === plan.nextContentBlobSha) continue;
      if (actual === plan.expectedBlobSha) {
        remaining.push(plan);
        continue;
      }
      fail('stale_blob_sha', '$.currentBlobShas');
    }
  }
  return frozenClone({
    schemaVersion: 'github-direct-ledger-recovery-v1',
    converged: remaining.length === 0,
    remaining,
    usesPrefixListing: false
  });
}

export function validateRecoveryPlan(input) {
  const v = exactKeys(input, ['schemaVersion','converged','remaining','usesPrefixListing'], '$');
  if (v.schemaVersion !== 'github-direct-ledger-recovery-v1') fail('invalid_schema', '$.schemaVersion');
  if (typeof v.converged !== 'boolean') fail('invalid_boolean', '$.converged');
  const remaining = denseArray(v.remaining, '$.remaining', 1000).map((entry) => validateLedgerMutation(entry));
  if (new Set(remaining.map((plan) => plan.path)).size !== remaining.length) fail('duplicate_identity', '$.remaining');
  if (v.converged !== (remaining.length === 0)) fail('recovery_contradiction', '$.converged');
  if (v.usesPrefixListing !== false) fail('prefix_listing_violation', '$.usesPrefixListing');
  return frozenClone({ ...v, remaining });
}
