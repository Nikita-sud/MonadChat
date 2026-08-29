import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { monadTestnet } from 'viem/chains'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function env(name) {
  const raw = readFileSync(resolve(root, '.env.local'), 'utf8')
  const line = raw.split('\n').find((l) => l.startsWith(name + '='))
  if (!line) throw new Error(`${name} не найден в .env.local`)
  return line.slice(name.length + 1).trim()
}

export const artifact = () =>
  JSON.parse(readFileSync(resolve(root, 'contracts/out/StreamChat.json'), 'utf8'))

export const publicClient = createPublicClient({ chain: monadTestnet, transport: http() })

export function wallet(pk = env('DEPLOYER_PRIVATE_KEY')) {
  const account = privateKeyToAccount(pk)
  return createWalletClient({ account, chain: monadTestnet, transport: http() })
}

/// Monad: газ списывается по gas_limit, а не по gas_used → буфер 7.5%, не x2.
export const gasMargin = (estimated) => (estimated * 10_750n + 9_999n) / 10_000n

/// Monad: при балансе < 10 MON проходит одна тратящая tx за k=3 блока (~1.2 с).
export const spacing = () => new Promise((r) => setTimeout(r, 1500))
