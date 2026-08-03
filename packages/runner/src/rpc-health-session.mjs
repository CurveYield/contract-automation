import { createGithubRpcHealthStoreFromEnvironment } from './github-rpc-health-store.mjs';

function enabled(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return value === '1' || value === 'true';
}

export async function openRpcHealthSession({
  environment = process.env,
  chain,
  crossSessionFailureThreshold = 4,
  store,
  fetchImpl = globalThis.fetch
}) {
  const resolvedStore = store === undefined
    ? createGithubRpcHealthStoreFromEnvironment({
        environment,
        chain,
        crossSessionFailureThreshold,
        fetchImpl
      })
    : store;
  if (!resolvedStore) {
    return {
      store: null,
      backend: 'disabled',
      disabledSlotIds: [],
      load: { status: 'disabled' }
    };
  }
  try {
    const loaded = await resolvedStore.load();
    return {
      store: resolvedStore,
      backend: 'github-issue',
      disabledSlotIds: loaded.disabledSlotIds ?? [],
      load: {
        status: 'loaded',
        ledgerIssueNumber: loaded.issueNumber,
        disabledSlotIds: loaded.disabledSlotIds ?? [],
        state: loaded.state
      }
    };
  } catch (error) {
    if (!enabled(environment.SIM_RPC_HEALTH_LOAD_FAIL_OPEN, false)) throw error;
    return {
      store: resolvedStore,
      backend: 'github-issue',
      disabledSlotIds: [],
      load: { status: 'failed-open', error: error?.message ?? String(error) }
    };
  }
}

export function filterDisabledRpcSlots(slots, disabledIds = []) {
  const disabled = new Set(disabledIds);
  return slots.filter((slot) => !disabled.has(slot.id));
}

export async function closeRpcHealthSession({
  session,
  environment = process.env,
  diagnostics,
  runId
}) {
  if (!session?.store || !diagnostics?.slots) {
    return { status: session?.store ? 'no-diagnostics' : 'disabled', backend: session?.backend ?? 'disabled' };
  }
  try {
    const persisted = await session.store.recordSession({ diagnostics, runId });
    return { status: 'recorded', ...persisted };
  } catch (error) {
    if (!enabled(environment.SIM_RPC_HEALTH_RECORD_FAIL_OPEN, true)) throw error;
    return {
      status: 'failed-open',
      backend: session.backend,
      error: error?.message ?? String(error)
    };
  }
}
