import { createPublicClient, fallback, http, webSocket, type Address } from 'viem'
import { monadTestnet } from 'viem/chains'
import { CONTRACT_ADDRESS, STREAM_CHAT_ABI, DEPLOY_BLOCK } from './deployment'

export { CONTRACT_ADDRESS, STREAM_CHAT_ABI, DEPLOY_BLOCK }
export const chain = monadTestnet

/**
 * Several independent Monad testnet RPCs, ordered by measured reliability.
 *
 * The official endpoint is shared by every builder on the network and on a busy
 * day rejects most calls ("requests limited to 15/sec"). Measured on hackathon
 * day, 6 identical eth_call requests each:
 *
 *   ankr      6/6 ok, median 180 ms
 *   thirdweb  6/6 ok, median 437 ms
 *   official  2/6 ok, median 132 ms   <- rejected two thirds of calls
 *   drpc      3/6 ok, median 202 ms
 *
 * With the official endpoint first, every send waited for it to fail before
 * failing over, which pushed eth_sendRawTransaction to ~2 s. Reliability first.
 */
export const RPC_URLS = [
  'https://rpc.ankr.com/monad_testnet',
  'https://10143.rpc.thirdweb.com',
  'https://testnet-rpc.monad.xyz',
  'https://monad-testnet.drpc.org',
] as const

export const RPC_WS = 'wss://testnet-rpc.monad.xyz'
export const EXPLORER = 'https://testnet.monadvision.com'

/**
 * Monad's public RPC throttles at 15-25 requests per second (the limit floats). So:
 *  - batch: concurrent calls are merged into a single HTTP request (batch cap is 100);
 *  - retry: survive a 429 with backoff instead of breaking the page.
 * Without this the backfill exhausted the quota and took the WebSocket handshake down with it.
 */
export const rpcTransport = fallback(
  RPC_URLS.map((url) =>
    http(url, {
      // Concurrent calls are merged into one HTTP request (batch cap is 100).
      batch: { wait: 20, batchSize: 25 },
      // No retries per endpoint: a throttled RPC should hand over to the next one
      // immediately. Retrying here added ~2 s to how long a message took to appear.
      retryCount: 0,
    }),
  ),
  { retryCount: 2, retryDelay: 150 },
)

export const publicClient = createPublicClient({
  chain,
  transport: rpcTransport,
  // Monad produces a block every ~300-400 ms. The viem default of 4 s would make
  // waitForTransactionReceipt the slowest part of sending a message and would
  // show a latency the network is not actually responsible for.
  pollingInterval: 250,
})

/** Separate WebSocket client - used only for event subscriptions. */
export const wsClient = createPublicClient({
  chain,
  // Only the official endpoint serves eth_subscribe — Ankr and drpc do not — so
  // this one cannot be part of the fallback list. It is also the flakiest, hence
  // the patient reconnect and the polling safety net in useChat.
  transport: webSocket(RPC_WS, { reconnect: { attempts: 100, delay: 1000 } }),
})

/**
 * Monad charges gas on gas_limit, not on actual usage, and there is no refund.
 * Hence a 7.5% buffer instead of the usual 2x - otherwise viewers pay double.
 */
export const gasMargin = (estimated: bigint) => (estimated * 10_750n + 9_999n) / 10_000n

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`
export const addressUrl = (a: string) => `${EXPLORER}/address/${a}`

export const shortAddress = (a: Address) => `${a.slice(0, 6)}…${a.slice(-4)}`

/** Deterministic nickname colour derived from the address, Twitch-style. */
export function colorFor(address: string): string {
  const hues = [0, 25, 45, 90, 140, 170, 195, 220, 265, 290, 320, 345]
  let h = 0
  for (let i = 2; i < address.length; i++) h = (h * 31 + address.charCodeAt(i)) >>> 0
  return `hsl(${hues[h % hues.length]} 85% 68%)`
}

/**
 * Fixed fee parameters instead of asking the RPC every time.
 *
 * Monad's minimum base fee is 100 gwei and eth_maxPriorityFeePerGas is a
 * hardcoded 2 gwei. The charge is min(base + priority, max), so a generous max
 * costs nothing extra and saves a round trip on every message.
 */
export const MAX_FEE_PER_GAS = 300_000_000_000n // 300 gwei
export const MAX_PRIORITY_FEE_PER_GAS = 2_000_000_000n // 2 gwei
