'use client'

import { createWalletClient, custom, type Address, type EIP1193Provider } from 'viem'
import { chain } from './chain'

declare global {
  interface Window {
    ethereum?: EIP1193Provider
  }
}

export const hasMetaMask = () =>
  typeof window !== 'undefined' && typeof window.ethereum !== 'undefined'

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
  if (code === 4001) throw new Error('Cancelled in MetaMask')
  if (code === -32002)
    throw new Error('MetaMask is already showing a request — open its window and finish it')
  throw new Error(mmMessage(e))
}

/**
 * Connects the injected wallet and makes sure it is on Monad Testnet,
 * adding the network to the wallet first if it has never seen it.
 */
export async function connectMetaMask(): Promise<Address> {
  const eth = window.ethereum
  if (!eth) throw new Error('MetaMask is not installed in this browser')

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
      // 4902 means the wallet does not know the chain; some wallets answer with
      // other codes for the same situation — offering to add it is the useful
      // move either way.
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
  if (!window.ethereum) throw new Error('MetaMask is not installed in this browser')
  return createWalletClient({ chain, transport: custom(window.ethereum) })
}
