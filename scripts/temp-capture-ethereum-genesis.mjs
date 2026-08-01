import fs from 'node:fs';

const rpcUrl = process.env.RPC_ETHEREUM;
if (!rpcUrl) throw new Error('RPC_ETHEREUM is missing');

const delays = [0, 250, 1000, 2500, 5000, 8000];
let captured;
let lastError;

for (let attempt = 0; attempt < delays.length; attempt += 1) {
  if (delays[attempt] > 0) await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json',
        'connection': 'close'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBlockByNumber',
        params: ['0x0', false]
      }),
      signal: controller.signal
    });
    const decoded = await response.json();
    if (response.ok && decoded?.result?.number === '0x0' && decoded.result.hash) {
      captured = decoded;
      console.log(JSON.stringify({
        success: true,
        attempt: attempt + 1,
        status: response.status,
        hash: decoded.result.hash,
        fields: Object.keys(decoded.result).sort()
      }));
      break;
    }
    lastError = new Error(decoded?.error?.message ?? `HTTP ${response.status}`);
    console.log(JSON.stringify({
      success: false,
      attempt: attempt + 1,
      status: response.status,
      rpcError: decoded?.error ?? null
    }));
  } catch (error) {
    lastError = error;
    console.log(JSON.stringify({
      success: false,
      attempt: attempt + 1,
      error: {
        name: error?.name,
        message: error?.message,
        code: error?.code,
        causeCode: error?.cause?.code
      }
    }));
  } finally {
    clearTimeout(timeout);
  }
}

if (!captured) throw lastError ?? new Error('Could not capture Ethereum genesis block');
fs.writeFileSync('ethereum-genesis-rpc-response.json', `${JSON.stringify(captured, null, 2)}\n`);
