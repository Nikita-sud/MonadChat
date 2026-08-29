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

/**
 * Connects the injected wallet and makes sure it is on Monad Testnet,
 * adding the network to the wallet first if it has never seen it.
 */
export async function connectMetaMask(): Promise<Address> {
  const eth = window.ethereum
  if (!eth) throw new Error('MetaMask is not installed in this browser')

  const [account] = (await eth.request({ method: 'eth_requestAccounts' })) as Address[]
  if (!account) throw new Error('MetaMask returned no account')

  const chainIdHex = `0x${chain.id.toString(16)}`
  const current = (await eth.request({ method: 'eth_chainId' })) as string
  if (current.toLowerCase() !== chainIdHex) {
    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      })
    } catch (e) {
      // 4902 — the wallet does not know this chain yet
      if ((e as { code?: number }).code !== 4902) throw e
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
    }
  }
  return account
}

export function metaMaskClient() {
  if (!window.ethereum) throw new Error('MetaMask is not installed in this browser')
  return createWalletClient({ chain, transport: custom(window.ethereum) })
}
