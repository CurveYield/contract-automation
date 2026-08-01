import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RpcClient, quantity } from "./rpc-client.mjs";
import { StateJournal } from "./state-journal.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const funding = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../config/funding-accounts.json"), "utf8"));
const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../config/simulation-config.json"), "utf8"));
const rpc = new RpcClient(process.env.DRPC_URL);

function pad32(hex) { return hex.replace(/^0x/, "").padStart(64, "0"); }
function encodeAddress(address) { return pad32(address.toLowerCase()); }
function encodeUint(value) { return pad32(BigInt(value).toString(16)); }
function balanceOfData(address) { return `0x70a08231${encodeAddress(address)}`; }
function transferData(address, amount) { return `0xa9059cbb${encodeAddress(address)}${encodeUint(amount)}`; }
function decodeUint(hex) { return BigInt(hex || "0x0"); }
function assert(condition, message) { if (!condition) throw new Error(message); }

const results = [];
function pass(name, detail = {}) { results.push({ name, passed: true, ...detail }); }

const chainId = await rpc.call("eth_chainId", []);
assert(BigInt(chainId) === 1n, `wrong chainId ${chainId}`);
pass("eth_chainId", { chainId });

const latest = await rpc.call("eth_blockNumber", []);
const baseBlock = process.env.FORK_BLOCK || latest;
const block = await rpc.call("eth_getBlockByNumber", [baseBlock, false]);
assert(block?.hash && block?.timestamp, "pinned block missing hash or timestamp");
pass("eth_getBlockByNumber", { blockNumber: block.number, blockHash: block.hash, timestamp: block.timestamp });

const operatorNativeBalance = BigInt(await rpc.call("eth_getBalance", [funding.operator, baseBlock]));
const operatorNonce = BigInt(await rpc.call("eth_getTransactionCount", [funding.operator, baseBlock]));
assert(operatorNativeBalance > 0n, "operator has no native ETH at pinned block");
pass("eth_getBalance and eth_getTransactionCount", { operatorNativeBalance: operatorNativeBalance.toString(), operatorNonce: operatorNonce.toString() });

for (const [label, address] of Object.entries(config.addresses)) {
  const code = await rpc.call("eth_getCode", [address, baseBlock]);
  assert(code !== "0x", `${label} has no code at pinned block`);
}
pass("eth_getCode integrations");

const operator = funding.operator;
const whale = funding.sources[1];
const token = funding.token;
const amount = 1n;
const operatorBefore = decodeUint(await rpc.call("eth_call", [{ to: token, data: balanceOfData(operator) }, baseBlock]));
const whaleBefore = decodeUint(await rpc.call("eth_call", [{ to: token, data: balanceOfData(whale.address) }, baseBlock]));
assert(whaleBefore >= BigInt(whale.minimumPinnedBalanceWei), "probe whale balance below configured minimum");
pass("eth_call pinned balances", { operatorBefore: operatorBefore.toString(), whaleBefore: whaleBefore.toString() });

const many = await rpc.call("trace_callMany", [[
  [{ from: whale.address, to: token, data: transferData(operator, amount), gas: "0x989680", gasPrice: "0x0", value: "0x0" }, ["trace", "stateDiff"]],
  [{ from: operator, to: token, data: balanceOfData(operator), gas: "0x989680", gasPrice: "0x0", value: "0x0" }, ["trace"]]
], baseBlock]);
assert(Array.isArray(many) && many.length === 2, "trace_callMany did not return two dependent results");
const manyBalance = decodeUint(many[1]?.output);
assert(manyBalance === operatorBefore + amount, `trace_callMany did not carry state: expected ${operatorBefore + amount}, got ${manyBalance}`);
pass("trace_callMany dependent state and arbitrary from", { operatorAfter: manyBalance.toString() });

const targetTime = BigInt(block.timestamp) + 86400n;
const transferCall = { from: whale.address, to: token, data: transferData(operator, amount), gas: "0x989680", gasPrice: "0x0", value: "0x0" };
const diff = await rpc.call("debug_traceCall", [transferCall, baseBlock, {
  tracer: "prestateTracer",
  tracerConfig: { diffMode: true },
  blockOverrides: { time: quantity(targetTime), number: quantity(BigInt(block.number) + 7200n) },
}]);
assert(diff?.pre && diff?.post, "debug_traceCall prestateTracer diffMode unsupported");
pass("debug_traceCall prestateTracer and blockOverrides");

const journal = new StateJournal();
journal.mergePrestateDiff(diff);
const after = decodeUint(await rpc.call("eth_call", [
  { from: operator, to: token, data: balanceOfData(operator), gas: "0x989680", gasPrice: "0x0", value: "0x0" },
  baseBlock,
  journal.toOverrides(),
  { time: quantity(targetTime), number: quantity(BigInt(block.number) + 7200n) },
]));
assert(after === operatorBefore + amount, `eth_call stateOverrides did not carry state: expected ${operatorBefore + amount}, got ${after}`);
pass("eth_call stateOverrides and blockOverrides", { operatorAfter: after.toString(), journalHash: journal.hash() });

const clientVersion = await rpc.call("web3_clientVersion", []);
pass("web3_clientVersion", { clientVersion });

console.log(JSON.stringify({ passed: true, baseBlock, capabilities: results }, null, 2));
