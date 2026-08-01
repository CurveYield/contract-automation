import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const allowlistPath = path.resolve(__dirname, "../config/rpc-method-allowlist.json");
const ALLOWED = new Set(JSON.parse(fs.readFileSync(allowlistPath, "utf8")).methods);

export class RpcError extends Error {
  constructor(method, error) {
    super(`${method}: ${error?.message ?? "unknown RPC error"}`);
    this.name = "RpcError";
    this.method = method;
    this.rpcError = error;
  }
}

export class RpcClient {
  constructor(url) {
    if (!url) throw new Error("DRPC_URL is required");
    this.url = url;
    this.nextId = 1;
  }

  async call(method, params = []) {
    if (!ALLOWED.has(method)) throw new Error(`RPC method is not approved: ${method}`);
    const response = await fetch(this.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: this.nextId++, method, params }),
    });
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { body = null; }
    if (!response.ok) throw new Error(`${method}: HTTP ${response.status}${text ? `: ${text.slice(0, 500)}` : ""}`);
    if (!body) throw new Error(`${method}: invalid JSON response`);
    if (body.error) throw new RpcError(method, body.error);
    return body.result;
  }
}

export function quantity(value) {
  const n = typeof value === "bigint" ? value : BigInt(value);
  return `0x${n.toString(16)}`;
}
