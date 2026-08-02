import { canonicalJson, sha256Hex } from '../../audit-fork-protocol/src/index.mjs';
import { ForkStateError } from './storage.mjs';

async function lifecycleIds(kind, value) {
  const digest = await sha256Hex(canonicalJson(value));
  return {
    enter: `tr_${kind}_enter_${digest.slice(0, 32)}`,
    exit: `tr_${kind}_ready_${digest.slice(0, 32)}`
  };
}

export async function enterTransient(service, { kind, transientState, forkId, tenantId, attemptId, occurredAt, identity }) {
  const ids = await lifecycleIds(kind, identity);
  let current = await service.readForkForTenant(tenantId, forkId);
  const enter = {
    forkId, tenantId, attemptId, from: 'ready', to: transientState,
    expectedEtag: current.etag, transitionId: ids.enter, occurredAt
  };
  if (current.state === 'ready' && current.lastTransitionId === ids.exit) {
    await service.transitionFork({ ...enter, from: transientState, to: 'ready', transitionId: ids.exit });
    return { current: await service.readForkForTenant(tenantId, forkId), ids, completed: true };
  }
  if (current.state === 'ready') current = await service.transitionFork(enter);
  else if (current.state === transientState && current.lastTransitionId === ids.enter) current = await service.transitionFork(enter);
  else throw new ForkStateError('operation_conflict', `${kind} does not match the current fork lifecycle`);
  return { current, ids, completed: false };
}

export function returnReady(service, { transientState, forkId, tenantId, attemptId, occurredAt, current, ids, blockNumber, blockHash }) {
  return service.transitionFork({
    forkId, tenantId, attemptId, from: transientState, to: 'ready',
    expectedEtag: current.etag, transitionId: ids.exit, occurredAt,
    ...(blockNumber === undefined ? {} : { blockNumber }),
    ...(blockHash === undefined ? {} : { blockHash })
  });
}
