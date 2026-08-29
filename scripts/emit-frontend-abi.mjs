import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { root } from './lib.mjs'

const d = JSON.parse(readFileSync(resolve(root, 'deployment.json'), 'utf8'))
mkdirSync(resolve(root, 'web/src/lib'), { recursive: true })
writeFileSync(
  resolve(root, 'web/src/lib/deployment.ts'),
  `// СГЕНЕРИРОВАНО scripts/emit-frontend-abi.mjs — не редактировать руками.\n` +
    `export const CONTRACT_ADDRESS = '${d.address}' as const\n` +
    `/** Комната деплоера — постоянная витрина с живым эфиром и затравочными сообщениями. */\n` +
    `export const DEMO_ROOM = '${d.deployer}' as const\n` +
    `export const DEPLOY_BLOCK = ${d.blockNumber}n\n` +
    `export const CHAIN_ID = ${d.chainId}\n\n` +
    `export const STREAM_CHAT_ABI = ${JSON.stringify(d.abi, null, 2)} as const\n`,
)
console.log('web/src/lib/deployment.ts обновлён →', d.address)
