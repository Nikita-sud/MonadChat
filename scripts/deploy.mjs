import { formatEther } from 'viem'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { root, artifact, publicClient, wallet, gasMargin } from './lib.mjs'

const { abi, bytecode } = artifact()
const w = wallet()
const deployer = w.account.address

const balance = await publicClient.getBalance({ address: deployer })
console.log('deployer:', deployer, '|', formatEther(balance), 'MON')

const gas = gasMargin(await publicClient.estimateGas({ account: deployer, data: bytecode }))
const gasPrice = await publicClient.getGasPrice()
console.log('gas limit:', gas, '| стоимость деплоя (по лимиту):', formatEther(gas * gasPrice), 'MON')

const hash = await w.deployContract({ abi, bytecode, gas })
console.log('tx:', hash)

const receipt = await publicClient.waitForTransactionReceipt({ hash })
if (receipt.status !== 'success') throw new Error('деплой ревертнулся: ' + receipt.status)

const address = receipt.contractAddress
console.log('\n✅ StreamChat задеплоен:', address)
console.log('   explorer: https://testnet.monadvision.com/address/' + address)

writeFileSync(
  resolve(root, 'deployment.json'),
  JSON.stringify({ address, deployer, chainId: 10143, blockNumber: Number(receipt.blockNumber), abi }, null, 2),
)
console.log('   записано в deployment.json')

await import('./emit-frontend-abi.mjs')
