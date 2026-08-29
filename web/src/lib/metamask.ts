'use client'

import { createWalletClient, custom, type Address, type EIP1193Provider } from 'viem'
import { chain } from './chain'

declare global {
  interface Window {
    ethereum?: EIP1193Provider & { providers?: (EIP1193Provider & Flags)[] } & Flags
  }
}

type Flags = { isMetaMask?: boolean; isPhantom?: boolean; isRabby?: boolean; isCoinbaseWallet?: boolean }

export const hasMetaMask = () =>
  typeof window !== 'undefined' && typeof window.ethereum !== 'undefined'

/**
 * With several wallet extensions installed, window.ethereum belongs to whoever
 * grabbed it last — often not MetaMask. A request then gets silently rejected
 * by a wallet whose window never opens. EIP-6963 lets every wallet announce
 * itself, so we can address MetaMask specifically.
 */
let cachedProvider: EIP1193Provider | null = null

type Announcement = { info?: { rdns?: string; name?: string }; provider: EIP1193Provider }

function discoverProvider(): Promise<EIP1193Provider | null> {
  return new Promise((resolve) => {
    const found: Announcement[] = []
    const onAnnounce = (e: Event) => {
      const d = (e as CustomEvent<Announcement>).detail
      if (d?.provider) found.push(d)
    }
    window.addEventListener('eip6963:announceProvider', onAnnounce)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce)
      const mm = found.find(
        (d) => d.info?.rdns === 'io.metamask' || /metamask/i.test(d.info?.name ?? ''),
      )
      if (mm) return resolve(mm.provider)
      // Legacy multi-inject: several providers stuffed into an array
      const eth = window.ethereum
      const fromArray = eth?.providers?.find((p) => p.isMetaMask && !p.isPhantom && !p.isRabby)
      if (fromArray) return resolve(fromArray)
      resolve(eth ?? null)
    }, 200)
  })
}

/** MetaMask rejects with plain objects ({ code, message }), not Error instances. */
function mmMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'object' && e !== null) {
    const o = e as { message?: unknown }
    if (typeof o.message === 'string') return o.message
    try {
      return JSON.stringify(e)
    } catch {
      return String(e)
    }
  }
  return String(e)
}

const mmCode = (e: unknown): number | undefined =>
  typeof e === 'object' && e !== null ? (e as { code?: number }).code : undefined

function rethrow(e: unknown): never {
  const code = mmCode(e)
  if (code === 4001)
    throw new Error(
      'Cancelled in the wallet — if you never saw a popup, click the MetaMask fox icon and retry',
    )
  if (code === -32002)
    throw new Error('MetaMask is already showing a request — open its window and finish it')
  throw new Error(mmMessage(e))
}

/**
 * Connects MetaMask (found via EIP-6963 even when other wallets are installed)
 * and makes sure it is on Monad Testnet, adding the network if needed.
 */
export async function connectMetaMask(): Promise<Address> {
  const eth = await discoverProvider()
  if (!eth) throw new Error('MetaMask is not installed in this browser')
  cachedProvider = eth

  let account: Address | undefined
  try {
    ;[account] = (await eth.request({ method: 'eth_requestAccounts' })) as Address[]
  } catch (e) {
    rethrow(e)
  }
  if (!account) throw new Error('MetaMask returned no account')

  const chainIdHex = `0x${chain.id.toString(16)}`
  const current = (await eth.request({ method: 'eth_chainId' })) as string
  if (current.toLowerCase() !== chainIdHex) {
    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      })
    } catch (switchErr) {
      if (mmCode(switchErr) === 4001) rethrow(switchErr)
      try {
        await eth.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: chainIdHex,
              chainName: 'Monad Testnet',
              nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
              rpcUrls: ['https://testnet-rpc.monad.xyz'],
              blockExplorerUrls: ['https://testnet.monadvision.com'],
            },
          ],
        })
      } catch (addErr) {
        rethrow(addErr)
      }
    }
  }
  return account
}

export function metaMaskClient() {
  const eth = cachedProvider ?? window.ethereum
  if (!eth) throw new Error('MetaMask is not installed in this browser')
  return createWalletClient({ chain, transport: custom(eth) })
}
