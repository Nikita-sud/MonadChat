'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { parseAbiItem, parseEventLogs, type Address, type Log } from 'viem'
import {
  CONTRACT_ADDRESS,
  DEPLOY_BLOCK,
  STREAM_CHAT_ABI,
  gasMargin,
  publicClient,
  wsClient,
} from './chain'
import { ensureBurner, walletFor } from './wallet'
import { enqueue } from './sender'

export const MESSAGE_SENT = parseAbiItem(
  'event MessageSent(address indexed streamer, address indexed sender, uint256 amount, string nickname, string text, uint256 timestamp, uint256 index)',
)

export type ChatMessage = {
  key: string
  sender: Address
  nickname: string
  text: string
  amount: bigint
  timestamp: number
  index: bigint
  txHash: `0x${string}`
  blockNumber: bigint
  logIndex: number
  /** сколько прошло от нажатия «отправить» до появления в цепочке */
  latencyMs?: number
}

export type PendingMessage = {
  key: string
  sender: Address
  nickname: string
  text: string
  amount: bigint
  status: 'queued' | 'sending' | 'failed'
  txHash?: `0x${string}`
  error?: string
}

/** getLogs на публичном RPC Monad ограничен 100 блоками на запрос. */
const LOG_WINDOW = 100n
const BACKFILL_WINDOWS = 8 // ~800 блоков ≈ 5 минут истории

let pendingCounter = 0

export function useChat(streamer: Address | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pending, setPending] = useState<PendingMessage[]>([])
  const [live, setLive] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const submittedAt = useRef(new Map<string, number>())
  const seen = useRef(new Set<string>())

  const ingest = useCallback((logs: readonly Log[]) => {
    const parsed = parseEventLogs({ abi: STREAM_CHAT_ABI, eventName: 'MessageSent', logs: logs as Log[] })
    const fresh: ChatMessage[] = []
    for (const log of parsed) {
      const key = `${log.transactionHash}:${log.logIndex}`
      if (seen.current.has(key)) continue
      seen.current.add(key)
      const a = log.args as {
        sender: Address; amount: bigint; nickname: string; text: string; timestamp: bigint; index: bigint
      }
      const started = submittedAt.current.get(log.transactionHash!.toLowerCase())
      fresh.push({
        key,
        sender: a.sender,
        nickname: a.nickname,
        text: a.text,
        amount: a.amount,
        timestamp: Number(a.timestamp),
        index: a.index,
        txHash: log.transactionHash!,
        blockNumber: log.blockNumber!,
        logIndex: log.logIndex!,
        latencyMs: started ? Date.now() - started : undefined,
      })
    }
    if (!fresh.length) return

    setMessages((prev) =>
      [...prev, ...fresh].sort((x, y) =>
        x.blockNumber === y.blockNumber
          ? x.logIndex - y.logIndex
          : x.blockNumber < y.blockNumber ? -1 : 1,
      ),
    )
    // своё сообщение подтвердилось — убираем оптимистичную копию
    const landed = new Set(fresh.map((m) => m.txHash.toLowerCase()))
    setPending((prev) => prev.filter((p) => !p.txHash || !landed.has(p.txHash.toLowerCase())))
  }, [])

  // История: окнами по 100 блоков назад от текущего
  useEffect(() => {
    if (!streamer) return
    let cancelled = false
    setLoadingHistory(true)
    ;(async () => {
      try {
        const latest = await publicClient.getBlockNumber()
        const requests = []
        let to = latest
        for (let i = 0; i < BACKFILL_WINDOWS && to >= DEPLOY_BLOCK; i++) {
          const rawFrom = to - LOG_WINDOW + 1n
          const from = rawFrom < DEPLOY_BLOCK ? DEPLOY_BLOCK : rawFrom
          requests.push(
            publicClient.getLogs({
              address: CONTRACT_ADDRESS,
              event: MESSAGE_SENT,
              args: { streamer },
              fromBlock: from,
              toBlock: to,
            }),
          )
          to = from - 1n
        }
        const logs = (await Promise.all(requests)).flat()
        if (!cancelled) ingest(logs)
      } catch (e) {
        console.error('backfill failed', e)
      } finally {
        if (!cancelled) setLoadingHistory(false)
      }
    })()
    return () => { cancelled = true }
  }, [streamer, ingest])

  // Живая подписка по WebSocket
  useEffect(() => {
    if (!streamer) return
    const unwatch = wsClient.watchContractEvent({
      address: CONTRACT_ADDRESS,
      abi: STREAM_CHAT_ABI,
      eventName: 'MessageSent',
      args: { streamer },
      onLogs: ingest,
      onError: (e) => { console.error('ws logs error', e); setLive(false) },
    })

    // Индикатор «live» показывает реальное состояние подписки: если блоки
    // перестали приходить по сокету — значит живых событий мы тоже не получаем.
    const unwatchBlocks = wsClient.watchBlockNumber({
      onBlockNumber: () => setLive(true),
      onError: () => setLive(false),
      emitOnBegin: true,
    })

    return () => { unwatch(); unwatchBlocks() }
  }, [streamer, ingest])

  const send = useCallback(
    async (text: string, nickname: string, value: bigint) => {
      if (!streamer) return
      const account = ensureBurner()
      const key = `pending-${++pendingCounter}`
      setPending((p) => [
        ...p,
        { key, sender: account.address, nickname, text, amount: value, status: 'queued' },
      ])

      const patch = (u: Partial<PendingMessage>) =>
        setPending((p) => p.map((m) => (m.key === key ? { ...m, ...u } : m)))

      try {
        await enqueue(async () => {
          patch({ status: 'sending' })
          const args = [streamer, nickname, text] as const
          const call = {
            address: CONTRACT_ADDRESS,
            abi: STREAM_CHAT_ABI,
            functionName: 'sendMessage',
            args,
            value,
          } as const

          const gas = gasMargin(await publicClient.estimateContractGas({ ...call, account }))
          const started = Date.now()
          const hash = await walletFor(account).writeContract({ ...call, gas })
          submittedAt.current.set(hash.toLowerCase(), started)
          patch({ txHash: hash })

          const receipt = await publicClient.waitForTransactionReceipt({ hash })
          if (receipt.status !== 'success') {
            throw new Error('Транзакция ревертнулась — вероятно, слишком часто отправляли')
          }
          // не ждём WebSocket: своё сообщение достаём прямо из receipt
          ingest(receipt.logs)
        })
      } catch (e) {
        patch({ status: 'failed', error: humanError(e) })
      }
    },
    [streamer, ingest],
  )

  const dismiss = useCallback((key: string) => {
    setPending((p) => p.filter((m) => m.key !== key))
  }, [])

  return { messages, pending, send, dismiss, live, loadingHistory }
}

export function humanError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  if (/Underpaid/.test(raw)) return 'Заплачено меньше цены комнаты'
  if (/RoomClosed/.test(raw)) return 'Комната закрыта — стример не задал цену'
  if (/TooLong/.test(raw)) return 'Сообщение слишком длинное'
  if (/EmptyText/.test(raw)) return 'Пустое сообщение'
  if (/insufficient funds|exceeds the balance/i.test(raw)) return 'Не хватает MON — пополни кошелёк'
  if (/reverted/i.test(raw)) return 'Транзакция ревертнулась — попробуй ещё раз'
  return raw.split('\n')[0].slice(0, 140)
}
