'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { encodeFunctionData, keccak256, parseAbiItem, parseEventLogs, type Address, type Log } from 'viem'
import {
  CONTRACT_ADDRESS,
  DEPLOY_BLOCK,
  MAX_FEE_PER_GAS,
  MAX_PRIORITY_FEE_PER_GAS,
  STREAM_CHAT_ABI,
  chain,
  gasMargin,
  publicClient,
  wsClient,
} from './chain'
import { metaMaskClient } from './metamask'
import { ensureBurner, walletFor } from './wallet'
import { enqueue, resetNonce, takeNonce } from './sender'

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
  /** time from hitting send to landing on chain */
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

/** getLogs on Monad's public RPC is capped at 100 blocks per request. */
const LOG_WINDOW = 100n
// Every endpoint caps getLogs at 100 blocks (measured: ankr, thirdweb and the
// official RPC all reject larger spans), so depth comes from the number of
// windows, not their size. Batching folds them into a few HTTP calls.
const BACKFILL_WINDOWS = 60 // ~6000 blocks ≈ 40 minutes of history

/** Who signs the message: the invisible browser wallet, or the viewer's own MetaMask. */
export type SendIdentity = { kind: 'burner' } | { kind: 'metamask'; address: Address }

let pendingCounter = 0

export function useChat(streamer: Address | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pending, setPending] = useState<PendingMessage[]>([])
  const [live, setLive] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const seen = useRef(new Set<string>())
  /**
   * Metadata for messages we sent ourselves, keyed by pending id.
   *
   * We cannot rely on the transaction hash alone: on a slow RPC the hash comes
   * back AFTER the chain event has already arrived over the WebSocket, so the
   * optimistic copy would never be matched and the message showed up twice —
   * once confirmed, once stuck on "sending". Matching also by author+text
   * closes that race.
   */
  const outbox = useRef(new Map<string, { sender: Address; text: string; startedAt: number; txHash?: string }>())

  const ingest = useCallback((logs: readonly Log[]) => {
    const parsed = parseEventLogs({ abi: STREAM_CHAT_ABI, eventName: 'MessageSent', logs: logs as Log[] })
    const fresh: ChatMessage[] = []
    const landedKeys: string[] = []
    for (const log of parsed) {
      const key = `${log.transactionHash}:${log.logIndex}`
      if (seen.current.has(key)) continue
      seen.current.add(key)
      const a = log.args as {
        sender: Address; amount: bigint; nickname: string; text: string; timestamp: bigint; index: bigint
      }
      const mine = matchOutbox(outbox.current, a.sender, a.text, log.transactionHash!)
      if (mine) {
        landedKeys.push(mine.key)
        outbox.current.delete(mine.key)
      }
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
        latencyMs: mine ? Date.now() - mine.meta.startedAt : undefined,
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
    // our own message landed — drop the optimistic copy
    if (landedKeys.length) {
      const landed = new Set(landedKeys)
      setPending((prev) => prev.filter((p) => !landed.has(p.key)))
    }
  }, [])

  // History: 100-block windows walking back from the tip
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

  // Live subscription over WebSocket
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

    // The "live" dot reflects the real subscription state: if blocks stop
    // arriving over the socket, live events are not reaching us either.
    const unwatchBlocks = wsClient.watchBlockNumber({
      onBlockNumber: () => setLive(true),
      onError: () => setLive(false),
      emitOnBegin: true,
    })

    return () => { unwatch(); unwatchBlocks() }
  }, [streamer, ingest])

  /**
   * Safety net for the live feed.
   *
   * Only the official RPC serves WebSocket subscriptions (Ankr and drpc do not),
   * and on a busy day that endpoint drops connections. Without this poll a viewer
   * whose socket died would simply stop seeing messages — and so would the OBS
   * overlay. One batched getLogs every few seconds covers the gap; ingest()
   * de-duplicates whatever the socket already delivered.
   */
  useEffect(() => {
    if (!streamer) return
    let cancelled = false
    const tick = async () => {
      try {
        const latest = await publicClient.getBlockNumber()
        const from = latest - LOG_WINDOW + 1n
        const logs = await publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          event: MESSAGE_SENT,
          args: { streamer },
          fromBlock: from < DEPLOY_BLOCK ? DEPLOY_BLOCK : from,
          toBlock: latest,
        })
        if (!cancelled) ingest(logs)
      } catch {
        // a throttled RPC here is not worth surfacing: the next tick retries
      }
    }
    const t = setInterval(tick, 3000)
    return () => { cancelled = true; clearInterval(t) }
  }, [streamer, ingest])

  const send = useCallback(
    async (
      text: string,
      nickname: string,
      value: bigint,
      identity: SendIdentity = { kind: 'burner' },
    ) => {
      if (!streamer) return
      const account = identity.kind === 'burner' ? ensureBurner() : null
      const sender = identity.kind === 'metamask' ? identity.address : account!.address
      const key = `pending-${++pendingCounter}`
      setPending((p) => [
        ...p,
        { key, sender, nickname, text, amount: value, status: 'queued' },
      ])

      outbox.current.set(key, { sender, text, startedAt: Date.now() })

      const patch = (u: Partial<PendingMessage>) =>
        setPending((p) => p.map((m) => (m.key === key ? { ...m, ...u } : m)))

      try {
        if (identity.kind === 'metamask') {
          // MetaMask signs in its own popup and manages its own nonce, and a human
          // confirming is slower than the reserve-balance window anyway — so this
          // path skips the burner queue and the local-nonce fast path entirely.
          patch({ status: 'sending' })
          const call = {
            address: CONTRACT_ADDRESS,
            abi: STREAM_CHAT_ABI,
            functionName: 'sendMessage',
            args: [streamer, nickname, text],
            value,
          } as const
          const gas = gasMargin(
            await publicClient.estimateContractGas({ ...call, account: identity.address }),
          )
          const hash = await metaMaskClient().writeContract({
            ...call,
            account: identity.address,
            gas,
          })
          // The latency clock starts only after the human confirmed the popup —
          // otherwise the badge would measure their reaction time, not the chain.
          const entry = outbox.current.get(key)
          if (entry) {
            entry.startedAt = Date.now()
            entry.txHash = hash.toLowerCase()
          }
          patch({ txHash: hash })
          const receipt = await publicClient.waitForTransactionReceipt({ hash })
          if (receipt.status !== 'success') {
            throw new Error('Transaction reverted — most likely you posted too fast')
          }
          ingest(receipt.logs)
          return
        }

        await enqueue(async () => {
          patch({ status: 'sending' })
          const args = [streamer, nickname, text] as const
          const data = encodeFunctionData({
            abi: STREAM_CHAT_ABI,
            functionName: 'sendMessage',
            args,
          })

          // Gas has to be estimated: Monad charges the whole gas_limit with no
          // refund, so a padded guess would be money out of the viewer's pocket.
          const gas = gasMargin(
            await publicClient.estimateContractGas({
              address: CONTRACT_ADDRESS,
              abi: STREAM_CHAT_ABI,
              functionName: 'sendMessage',
              args,
              value,
              account: account!,
            }),
          )
          const nonce = await takeNonce(
            () => publicClient.getTransactionCount({ address: account!.address }),
            account!.address,
          )

          // Sign locally, so the hash is known before the network sees it.
          const serialized = await walletFor(account!).signTransaction({
            to: CONTRACT_ADDRESS,
            data,
            value,
            gas,
            nonce,
            chainId: chain.id,
            type: 'eip1559',
            maxFeePerGas: MAX_FEE_PER_GAS,
            maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
          })
          const hash = keccak256(serialized)

          const entry = outbox.current.get(key)
          const started = Date.now()
          if (entry) {
            entry.startedAt = started
            entry.txHash = hash.toLowerCase()
          }
          patch({ txHash: hash })

          await publicClient.sendRawTransaction({ serializedTransaction: serialized })
          const receipt = await publicClient.waitForTransactionReceipt({ hash })
          if (receipt.status !== 'success') {
            throw new Error('Transaction reverted — most likely you posted too fast')
          }
          // do not wait for the WebSocket: pull our own message straight from the receipt
          ingest(receipt.logs)
        })
      } catch (e) {
        outbox.current.delete(key)
        resetNonce()
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

/**
 * Finds the send that a chain event belongs to: by transaction hash when we
 * already know it, otherwise by author and text (oldest first, so repeating the
 * same message twice resolves in order).
 */
function matchOutbox(
  outbox: Map<string, { sender: Address; text: string; startedAt: number; txHash?: string }>,
  sender: Address,
  text: string,
  txHash: string,
) {
  const hash = txHash.toLowerCase()
  for (const [key, meta] of outbox) if (meta.txHash === hash) return { key, meta }
  let best: { key: string; meta: (typeof outbox) extends Map<string, infer V> ? V : never } | null = null
  for (const [key, meta] of outbox) {
    if (meta.sender.toLowerCase() !== sender.toLowerCase() || meta.text !== text) continue
    if (!best || meta.startedAt < best.meta.startedAt) best = { key, meta }
  }
  return best
}

export function humanError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  if (/User rejected|user denied|ACTION_REJECTED/i.test(raw)) return 'Cancelled in MetaMask'
  if (/Underpaid/.test(raw)) return 'Paid less than the room price'
  if (/RoomClosed/.test(raw)) return 'Room is closed — the streamer has not set a price'
  if (/TooLong/.test(raw)) return 'Message is too long'
  if (/EmptyText/.test(raw)) return 'Empty message'
  if (/insufficient funds|exceeds the balance/i.test(raw)) return 'Not enough MON — top up your wallet'
  if (/reverted/i.test(raw)) return 'Transaction reverted — try again'
  return raw.split('\n')[0].slice(0, 140)
}
