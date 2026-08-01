import fs from 'node:fs';
import crypto from 'node:crypto';

const candidates = [
  { label: 'repository-rpc', url: process.env.RPC_ETHEREUM },
  { label: 'publicnode', url: 'https://ethereum-rpc.publicnode.com' },
  { label: 'cloudflare', url: 'https://cloudflare-eth.com' },
  { label: 'llamarpc', url: 'https://eth.llamarpc.com' },
  { label: '1rpc', url: 'https://1rpc.io/eth' }
].filter((entry) => entry.url);

let captured;
let capturedFrom;
let lastError;
let requestId = 1;

for (const candidate of candidates) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(candidate.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json',
          'connection': 'close'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: requestId++,
          method: 'eth_getBlockByNumber',
          params: ['0x0', false]
        }),
        signal: controller.signal
      });
      const decoded = await response.json();
      if (response.ok && decoded?.result?.number === '0x0' && decoded.result.hash) {
        captured = { jsonrpc: '2.0', id: 1, result: decoded.result };
        capturedFrom = candidate.label;
        console.log(JSON.stringify({
          success: true,
          source: candidate.label,
          attempt,
          status: response.status,
          hash: decoded.result.hash,
          fields: Object.keys(decoded.result).sort()
        }));
        break;
      }
      lastError = new Error(decoded?.error?.message ?? `HTTP ${response.status}`);
      console.log(JSON.stringify({
        success: false,
        source: candidate.label,
        attempt,
        status: response.status,
        rpcError: decoded?.error ?? null
      }));
    } catch (error) {
      lastError = error;
      console.log(JSON.stringify({
        success: false,
        source: candidate.label,
        attempt,
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
  if (captured) break;
}

if (!captured) throw lastError ?? new Error('Could not capture Ethereum genesis block');
const serialized = `${JSON.stringify(captured, null, 2)}\n`;
fs.writeFileSync('ethereum-genesis-rpc-response.json', serialized);
fs.writeFileSync('ethereum-genesis-rpc-response.sha256', `${crypto.createHash('sha256').update(serialized).digest('hex')}  ethereum-genesis-rpc-response.json\n`);
fs.writeFileSync('ethereum-genesis-rpc-response-source.txt', `${capturedFrom}\n`);
