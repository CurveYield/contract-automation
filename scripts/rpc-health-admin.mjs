#!/usr/bin/env node

import {
  createGithubRpcHealthStore
} from '../packages/runner/src/github-rpc-health-store.mjs';
import {
  manualDisableEvent,
  reduceRpcHealth
} from '../packages/runner/src/rpc-health-ledger.mjs';

function parseArgs(argv) {
  const output = { command: argv[0] };
  for (let index = 1; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${key} requires a value`);
    output[key.slice(2)] = value;
    index += 1;
  }
  return output;
}

function required(value, name) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} is required`);
  return value;
}

const args = parseArgs(process.argv.slice(2));
const command = required(args.command, 'command');
const repository = required(args.repository ?? process.env.GITHUB_REPOSITORY, '--repository or GITHUB_REPOSITORY');
const token = required(
  process.env.SIM_RPC_HEALTH_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN,
  'SIM_RPC_HEALTH_GITHUB_TOKEN, GITHUB_TOKEN, or GH_TOKEN'
);
const chain = required(args.chain, '--chain');
const store = createGithubRpcHealthStore({
  token,
  repository,
  chain,
  crossSessionFailureThreshold: Number(args.threshold ?? 4),
  runId: process.env.GITHUB_RUN_ID ?? `admin-${Date.now()}`
});

if (command === 'status') {
  const current = await store.load();
  process.stdout.write(`${JSON.stringify({
    backend: 'github-issue',
    ledgerIssueNumber: current.issueNumber,
    disabledSlotIds: current.disabledSlotIds,
    state: current.state
  }, null, 2)}\n`);
} else if (command === 'recover') {
  const result = await store.recover({
    slotId: required(args.slot, '--slot'),
    actor: args.actor ?? process.env.GITHUB_ACTOR ?? 'administrator'
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else if (command === 'disable') {
  const current = await store.load();
  const event = manualDisableEvent({
    chain,
    slotId: required(args.slot, '--slot'),
    actor: args.actor ?? process.env.GITHUB_ACTOR ?? 'administrator',
    reason: args.reason ?? 'manual_disable'
  });
  const state = reduceRpcHealth([...current.events, event], {
    crossSessionFailureThreshold: Number(args.threshold ?? 4)
  });
  throw new Error(
    `Manual disable event prepared but direct append is intentionally unavailable through this CLI. `
    + `Append the following event to ledger issue #${current.issueNumber}: ${JSON.stringify(event)}. `
    + `Projected disabled state: ${state.slots[event.slotId]?.disabled}`
  );
} else {
  throw new Error('command must be status, recover, or disable');
}
