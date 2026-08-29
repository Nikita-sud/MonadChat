import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { monadTestnet } from 'viem/chains'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { root, artifact, env, gasMargin } from './lib.mjs'

// Официальный RPC сегодня перегружен участниками — ходим через ankr
const RPC = 'https://rpc.ankr.com/monad_testnet'
const pub = createPublicClient({ chain: monadTestnet, transport: http(RPC), pollingInterval: 300 })
const { address: CONTRACT } = JSON.parse(readFileSync(resolve(root, 'deployment.json'), 'utf8'))
const { abi } = { abi: JSON.parse(readFileSync(resolve(root, 'deployment.json'), 'utf8')).abi }

const FRIEND = '0x048F0d82121ff2bE7bD6FEDED2C263366001A0bc'
const PRICE = parseEther('0.05')
const STREAM = 'youtube:jfKfPfyJRdk' // Lofi Girl, 24/7, нейтральный

const room = async (a) => {
  const [price, url] = await pub.readContract({ address: CONTRACT, abi, functionName: 'rooms', args: [a] })
  return { price, url }
}

console.log('=== 1. Комната друга ===')
const fr = await room(FRIEND)
console.log(FRIEND, fr.price > 0n ? `открыта: ${formatEther(fr.price)} MON, "${fr.url}"` : 'НЕ открыта — нужен один клик владельца')

console.log('\n=== 2. Демо-комната на деплоере ===')
const deployer = privateKeyToAccount(env('DEPLOYER_PRIVATE_KEY'))
const w = createWalletClient({ account: deployer, chain: monadTestnet, transport: http(RPC) })
const cur = await room(deployer.address)
if (cur.price === PRICE && cur.url === STREAM) {
  console.log('уже настроена как надо')
} else {
  const call = { address: CONTRACT, abi, functionName: 'setRoom', args: [PRICE, STREAM] }
  const gas = gasMargin(await pub.estimateContractGas({ ...call, account: deployer }))
  const hash = await w.writeContract({ ...call, gas })
  const rc = await pub.waitForTransactionReceipt({ hash })
  console.log('setRoom:', rc.status, '| комната:', deployer.address)
}

console.log('\n=== 3. Затравочные сообщения ===')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const seedPk = generatePrivateKey()
const seed = privateKeyToAccount(seedPk)
const sw = createWalletClient({ account: seed, chain: monadTestnet, transport: http(RPC) })
const f = await fetch('https://agents.devnads.com/v1/faucet', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chainId: 10143, address: seed.address }),
})
const { txHash } = await f.json()
await pub.waitForTransactionReceipt({ hash: txHash })
console.log('затравочный зритель профинансирован:', seed.address)
await sleep(1800)

const MESSAGES = [
  ['mona', 'gm Amsterdam — this line cost 0.05 MON'],
  ['nad_holder', 'every message here is a real Monad transaction'],
  ['blitz_fan', 'half a second from send to chain. watch the badge'],
]
for (const [nick, text] of MESSAGES) {
  const call = { address: CONTRACT, abi, functionName: 'sendMessage', args: [deployer.address, nick, text], value: PRICE }
  const gas = gasMargin(await pub.estimateContractGas({ ...call, account: seed }))
  const hash = await sw.writeContract({ ...call, gas })
  const rc = await pub.waitForTransactionReceipt({ hash })
  console.log(` "${text.slice(0, 40)}…" → ${rc.status}`)
  await sleep(1800)
}

const after = await room(deployer.address)
const earned = await pub.readContract({ address: CONTRACT, abi, functionName: 'earned', args: [deployer.address] })
console.log('\n=== Итог ===')
console.log('демо-комната:', deployer.address)
console.log('цена:', formatEther(after.price), 'MON | источник:', after.url, '| заработано:', formatEther(earned), 'MON')
