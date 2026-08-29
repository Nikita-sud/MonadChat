'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatEther, parseEther } from 'viem'
import {
  CONTRACT_ADDRESS,
  STREAM_CHAT_ABI,
  addressUrl,
  gasMargin,
  publicClient,
  txUrl,
} from '@/lib/chain'
import { enqueue } from '@/lib/sender'
import { useBurner } from '@/lib/useBurner'
import { humanError } from '@/lib/useChat'
import { useRoom } from '@/lib/useRoom'
import { walletFor } from '@/lib/wallet'
import { fmtMon } from './Chat'

const SOURCES = [
  { kind: 'twitch', label: 'Twitch', hint: 'channel name, e.g. monad' },
  { kind: 'youtube', label: 'YouTube', hint: 'video ID from the watch?v= link' },
  { kind: 'kick', label: 'Kick', hint: 'channel name' },
] as const

export function Dashboard() {
  const { account, balance, fund, funding, faucetError } = useBurner()
  const { room, refresh } = useRoom(account?.address)

  const [price, setPrice] = useState('0.05')
  const [kind, setKind] = useState<(typeof SOURCES)[number]['kind']>('twitch')
  const [channel, setChannel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastTx, setLastTx] = useState<string | null>(null)

  // prefill with the current room settings if one is already open
  useEffect(() => {
    if (!room || room.price === 0n) return
    setPrice(formatEther(room.price))
    const [k, ...rest] = room.streamUrl.split(':')
    if (SOURCES.some((s) => s.kind === k)) {
      setKind(k as typeof kind)
      setChannel(rest.join(':'))
    }
  }, [room])

  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const isOpen = !!room && room.price > 0n

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!account) return
    setBusy(true)
    setError(null)
    setLastTx(null)
    try {
      let wei: bigint
      try {
        wei = parseEther(price.replace(',', '.'))
      } catch {
        throw new Error('Price must be a number, for example 0.05')
      }
      if (wei <= 0n) throw new Error('Price must be above zero — zero means the room is closed')

      const args = [wei, channel.trim() ? `${kind}:${channel.trim()}` : ''] as const
      const call = { address: CONTRACT_ADDRESS, abi: STREAM_CHAT_ABI, functionName: 'setRoom', args } as const

      await enqueue(async () => {
        const gas = gasMargin(await publicClient.estimateContractGas({ ...call, account }))
        const hash = await walletFor(account).writeContract({ ...call, gas })
        setLastTx(hash)
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        if (receipt.status !== 'success') throw new Error('Transaction reverted')
      })
      await refresh()
    } catch (err) {
      setError(humanError(err))
    } finally {
      setBusy(false)
    }
  }

  if (!account) {
    return <p className="p-8 text-sm text-muted">Creating your wallet…</p>
  }

  const enoughGas = balance > parseEther('0.05')

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <Link href="/" className="text-sm font-bold tracking-tight">
        <span className="text-mon">◆</span> MonadChat
      </Link>

      <h1 className="mt-6 text-2xl font-bold">Streamer dashboard</h1>
      <p className="mt-2 text-sm text-muted">
        Your room is tied to the wallet this browser created. Money for messages lands there
        instantly — no withdrawals, no middlemen.
      </p>

      <section className="mt-6 rounded-lg border border-edge bg-panel p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-muted">your address</div>
            <a
              href={addressUrl(account.address)}
              target="_blank"
              rel="noreferrer"
              className="block truncate font-mono text-xs text-mon-soft hover:underline"
            >
              {account.address}
            </a>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted">balance</div>
            <div className="text-sm font-bold tabular-nums">{fmtMon(balance)} MON</div>
          </div>
          <button
            onClick={fund}
            disabled={funding}
            className="shrink-0 rounded bg-mon px-3 py-1.5 text-xs font-medium text-white hover:bg-mon-soft disabled:opacity-50"
          >
            {funding ? 'funding…' : '+1 MON'}
          </button>
        </div>
        {faucetError && <p className="mt-2 text-xs text-red-400">Faucet: {faucetError}</p>}
        {!enoughGas && !faucetError && (
          <p className="mt-2 text-xs text-amber-400">
            Not enough for gas — hit “+1 MON” before opening the room.
          </p>
        )}
        {isOpen && (
          <p className="mt-3 border-t border-edge pt-3 text-xs text-muted">
            earned all time: <b className="text-white tabular-nums">{fmtMon(room!.earned)} MON</b>
          </p>
        )}
      </section>

      <form onSubmit={save} className="mt-6 space-y-5 rounded-lg border border-edge bg-panel p-5">
        <div>
          <label className="block text-sm font-medium">Price per message</label>
          <p className="mt-1 text-xs text-muted">
            Below 0.02 MON it stops making sense: gas alone costs about 0.013 MON per message.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              className="w-36 rounded-md border border-edge bg-panel-2 px-3 py-2 text-sm tabular-nums outline-none focus:border-mon"
            />
            <span className="text-sm text-muted">MON</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Where you stream</label>
          <p className="mt-1 text-xs text-muted">
            We do not replace Twitch — we add a paid chat on top of it. Leave empty if you are not
            live yet.
          </p>
          <div className="mt-2 flex gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
              className="rounded-md border border-edge bg-panel-2 px-3 py-2 text-sm outline-none focus:border-mon"
            >
              {SOURCES.map((s) => (
                <option key={s.kind} value={s.kind}>{s.label}</option>
              ))}
            </select>
            <input
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder={SOURCES.find((s) => s.kind === kind)!.hint}
              className="flex-1 rounded-md border border-edge bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-mon"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-mon px-4 py-2.5 text-sm font-semibold text-white hover:bg-mon-soft disabled:opacity-50"
        >
          {busy ? 'sending transaction…' : isOpen ? 'Update room' : 'Open room'}
        </button>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {lastTx && !error && !busy && (
          <p className="text-xs text-muted">
            done ·{' '}
            <a href={txUrl(lastTx)} target="_blank" rel="noreferrer" className="text-mon-soft hover:underline">
              transaction in the explorer
            </a>
          </p>
        )}
      </form>

      {isOpen && (
        <section className="mt-6 space-y-3 rounded-lg border border-mon/30 bg-mon/5 p-5">
          <h2 className="text-sm font-semibold">Room is open. Share these links:</h2>
          <LinkRow label="For viewers" href={`${origin}/r/${account.address}`} />
          <LinkRow label="For OBS Browser Source" href={`${origin}/overlay/${account.address}`} />
        </section>
      )}
    </main>
  )
}

function LinkRow({ label, href }: { label: string; href: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded border border-edge bg-panel-2 px-2 py-1.5 text-xs">
          {href}
        </code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(href)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="shrink-0 rounded border border-edge px-2 py-1.5 text-xs hover:border-mon"
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
    </div>
  )
}
