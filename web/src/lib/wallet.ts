import { createWalletClient, http, type PrivateKeyAccount } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { chain, RPC_HTTP } from './chain'

const PK_KEY = 'monadchat.pk.v1'
const NICK_KEY = 'monadchat.nick.v1'

/**
 * Кошелёк живёт в браузере: приватный ключ в localStorage.
 * Ни расширений, ни seed-фраз — открыл ссылку и можешь платить за сообщения.
 * Это кошелёк на один вечер: реальные средства сюда класть нельзя.
 */
export function ensureBurner(): PrivateKeyAccount {
  if (typeof window === 'undefined') throw new Error('ensureBurner доступен только в браузере')
  let pk = window.localStorage.getItem(PK_KEY)
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    pk = generatePrivateKey()
    window.localStorage.setItem(PK_KEY, pk)
  }
  return privateKeyToAccount(pk as `0x${string}`)
}

export function burnerPrivateKey(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(PK_KEY)
}

export function resetBurner(): PrivateKeyAccount {
  window.localStorage.removeItem(PK_KEY)
  return ensureBurner()
}

export function walletFor(account: PrivateKeyAccount) {
  return createWalletClient({ account, chain, transport: http(RPC_HTTP) })
}

export function loadNickname(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(NICK_KEY) ?? ''
}

export function saveNickname(nick: string) {
  window.localStorage.setItem(NICK_KEY, nick.slice(0, 24))
}

export async function requestFaucet(address: string): Promise<{ txHash: string; amount: string }> {
  const res = await fetch('/api/faucet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Кран недоступен')
  return body
}
