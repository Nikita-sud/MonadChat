import { parseEther, formatEther, decodeEventLog } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { root, publicClient, wallet, gasMargin, spacing } from './lib.mjs'

const { address, abi } = JSON.parse(readFileSync(resolve(root, 'deployment.json'), 'utf8'))
const streamer = wallet()
const PRICE = parseEther('0.01')

let pass = 0, fail = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`)
  ok ? pass++ : fail++
}

const send = async (client, fn, args, value, gasOverride) => {
  const gas = gasOverride ?? gasMargin(
    await publicClient.estimateContractGas({ address, abi, functionName: fn, args, value, account: client.account })
  )
  const hash = await client.writeContract({ address, abi, functionName: fn, args, value, gas })
  return { hash, receipt: await publicClient.waitForTransactionReceipt({ hash }), gas }
}

console.log('\n1. setRoom — стример открывает комнату')
{
  const { receipt } = await send(streamer, 'setRoom', [PRICE, 'twitch:monad'], undefined)
  check('транзакция прошла', receipt.status === 'success')
  const room = await publicClient.readContract({ address, abi, functionName: 'rooms', args: [streamer.account.address] })
  check('цена записана', room[0] === PRICE, formatEther(room[0]) + ' MON')
  check('streamUrl записан', room[1] === 'twitch:monad', room[1])
}

console.log('\n2. Зритель получает MON из крана')
const viewer = (await import('viem')).createWalletClient({
  account: privateKeyToAccount(generatePrivateKey()),
  chain: (await import('viem/chains')).monadTestnet,
  transport: (await import('viem')).http(),
})
{
  const res = await fetch('https://agents.devnads.com/v1/faucet', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chainId: 10143, address: viewer.account.address }),
  })
  const body = await res.json()
  await publicClient.waitForTransactionReceipt({ hash: body.txHash })
  const bal = await publicClient.getBalance({ address: viewer.account.address })
  check('кран налил', bal > 0n, formatEther(bal) + ' MON на ' + viewer.account.address)
  await spacing()
}

console.log('\n3. sendMessage — зритель платит, стример получает')
{
  const before = await publicClient.getBalance({ address: streamer.account.address })
  const { receipt, gas } = await send(viewer, 'sendMessage', [streamer.account.address, 'nikita', 'gm monad'], PRICE)
  check('транзакция прошла', receipt.status === 'success')
  console.log(`     ⛽ gas limit ${gas} / фактически ${receipt.gasUsed} → цена сообщения по лимиту: ${formatEther(gas * receipt.effectiveGasPrice)} MON`)

  const log = receipt.logs.find((l) => l.address.toLowerCase() === address.toLowerCase())
  const ev = decodeEventLog({ abi, data: log.data, topics: log.topics })
  check('событие MessageSent', ev.eventName === 'MessageSent')
  check('текст в событии', ev.args.text === 'gm monad', `"${ev.args.text}"`)
  check('ник в событии', ev.args.nickname === 'nikita', `"${ev.args.nickname}"`)
  check('сумма в событии', ev.args.amount === PRICE, formatEther(ev.args.amount) + ' MON')

  const after = await publicClient.getBalance({ address: streamer.account.address })
  check('баланс стримера вырос', after - before === PRICE, '+' + formatEther(after - before) + ' MON')
  const earned = await publicClient.readContract({ address, abi, functionName: 'earned', args: [streamer.account.address] })
  check('earned учтён', earned === PRICE, formatEther(earned) + ' MON')
  await spacing()
}

console.log('\n4. Недоплата отклоняется')
{
  try {
    await publicClient.simulateContract({ address, abi, functionName: 'sendMessage',
      args: [streamer.account.address, 'bob', 'cheap'], value: parseEther('0.001'), account: viewer.account })
    check('Underpaid', false, 'симуляция прошла, а не должна была')
  } catch (e) {
    check('Underpaid', /Underpaid/.test(e.message), 'контракт отверг недоплату')
  }
}

console.log('\n5. Закрытая комната отклоняется')
{
  try {
    await publicClient.simulateContract({ address, abi, functionName: 'sendMessage',
      args: ['0x000000000000000000000000000000000000dEaD', 'bob', 'hi'], value: PRICE, account: viewer.account })
    check('RoomClosed', false, 'симуляция прошла, а не должна была')
  } catch (e) {
    check('RoomClosed', /RoomClosed/.test(e.message), 'контракт отверг закрытую комнату')
  }
}

console.log('\n6. Пустой текст отклоняется')
{
  try {
    await publicClient.simulateContract({ address, abi, functionName: 'sendMessage',
      args: [streamer.account.address, 'bob', ''], value: PRICE, account: viewer.account })
    check('EmptyText', false, 'симуляция прошла, а не должна была')
  } catch (e) {
    check('EmptyText', /EmptyText/.test(e.message), 'контракт отверг пустое сообщение')
  }
}

console.log(`\n${fail === 0 ? '✅ ВСЁ ЗЕЛЁНОЕ' : '❌ ЕСТЬ ПАДЕНИЯ'}: ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
