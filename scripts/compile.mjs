import solc from 'solc'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(resolve(root, 'contracts/StreamChat.sol'), 'utf8')

const input = {
  language: 'Solidity',
  sources: { 'StreamChat.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'cancun',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } },
  },
}

const out = JSON.parse(solc.compile(JSON.stringify(input)))

const errors = (out.errors ?? []).filter((e) => e.severity === 'error')
const warnings = (out.errors ?? []).filter((e) => e.severity !== 'error')
for (const w of warnings) console.warn('WARN:', w.formattedMessage.trim())
if (errors.length) {
  for (const e of errors) console.error(e.formattedMessage)
  process.exit(1)
}

const c = out.contracts['StreamChat.sol'].StreamChat
mkdirSync(resolve(root, 'contracts/out'), { recursive: true })
writeFileSync(
  resolve(root, 'contracts/out/StreamChat.json'),
  JSON.stringify({ abi: c.abi, bytecode: '0x' + c.evm.bytecode.object }, null, 2),
)
writeFileSync(resolve(root, 'contracts/out/standard-input.json'), JSON.stringify(input, null, 2))

console.log('compiled OK')
console.log('  solc:      ', solc.version())
console.log('  bytecode:  ', c.evm.bytecode.object.length / 2, 'bytes')
console.log('  deployed:  ', c.evm.deployedBytecode.object.length / 2, 'bytes (limit 128 KB on Monad)')
