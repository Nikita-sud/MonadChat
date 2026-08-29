import { createPublicClient, http, webSocket, type Address } from 'viem'
import { monadTestnet } from 'viem/chains'
import { CONTRACT_ADDRESS, STREAM_CHAT_ABI, DEPLOY_BLOCK } from './deployment'

export { CONTRACT_ADDRESS, STREAM_CHAT_ABI, DEPLOY_BLOCK }
export const chain = monadTestnet

export const RPC_HTTP = 'https://testnet-rpc.monad.xyz'
export const RPC_WS = 'wss://testnet-rpc.monad.xyz'
export const EXPLORER = 'https://testnet.monadvision.com'

/**
 * Публичный RPC Monad ограничен 25 запросами в секунду. Поэтому:
 *  - batch: параллельные вызовы склеиваются в один HTTP-запрос (лимит пачки — 100);
 *  - retry: 429 переживаем с отступом, а не роняем страницу.
 * Без этого бэкфилл выбивал квоту и заодно ронял рукопожатие WebSocket.
 */
export const publicClient = createPublicClient({
  chain,
  transport: http(RPC_HTTP, {
    batch: { wait: 20, batchSize: 20 },
    retryCount: 3,
    retryDelay: 400,
  }),
})

/** Отдельный клиент на WebSocket — только для подписки на события. */
export const wsClient = createPublicClient({
  chain,
  transport: webSocket(RPC_WS, { reconnect: { attempts: 20, delay: 1000 } }),
})

/**
 * Monad списывает газ по gas_limit, а не по фактическому расходу, и возврата нет.
 * Поэтому буфер 7.5%, а не привычные x2 — иначе зритель переплачивает вдвое.
 */
export const gasMargin = (estimated: bigint) => (estimated * 10_750n + 9_999n) / 10_000n

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`
export const addressUrl = (a: string) => `${EXPLORER}/address/${a}`

export const shortAddress = (a: Address) => `${a.slice(0, 6)}…${a.slice(-4)}`

/** Детерминированный цвет ника из адреса — как в Twitch. */
export function colorFor(address: string): string {
  const hues = [0, 25, 45, 90, 140, 170, 195, 220, 265, 290, 320, 345]
  let h = 0
  for (let i = 2; i < address.length; i++) h = (h * 31 + address.charCodeAt(i)) >>> 0
  return `hsl(${hues[h % hues.length]} 85% 68%)`
}
