'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { formatEther, parseEther, type Address } from 'viem'
import {
  CONTRACT_ADDRESS,
  STREAM_CHAT_ABI,
  addressUrl,
  gasMargin,
  publicClient,
  txUrl,
} from '@/lib/chain'
import { connectMetaMask, hasMetaMask, metaMaskClient } from '@/lib/metamask'
import { enqueue } from '@/lib/sender'
import { useBurner } from '@/lib/useBurner'
import { humanError } from '@/lib/useChat'
import { normalizeChannelInput } from '@/lib/useRoom'
import { useRoom } from '@/lib/useRoom'
import { requestFaucet, walletFor } from '@/lib/wallet'
import { fmtMon } from './Chat'

const SOURCES = [
  { kind: 'twitch', label: 'Twitch', hint: 'channel name, e.g. monad' },
  { kind: 'youtube', label: 'YouTube', hint: 'video ID from the watch?v= link' },
  { kind: 'kick', label: 'Kick', hint: 'channel name' },
] as const

const label = 'font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft'

export function Dashboard() {
  const burner = useBurner()

  // Streamer identity: the browser wallet by default, MetaMask once connected.
  const [mm, setMm] = useState<Address | null>(null)
  const [mmBalance, setMmBalance] = useState<bigint>(0n)
  const [mmAvailable, setMmAvailable] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const active: Address | null = mm ?? burner.account?.address ?? null
  const balance = mm ? mmBalance : burner.balance
  const { room, refresh } = useRoom(active ?? undefined)

  const [price, setPrice] = useState('0.05')
  const [kind, setKind] = useState<(typeof SOURCES)[number]['kind']>('twitch')
  const [channel, setChannel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastTx, setLastTx] = useState<string | null>(null)
  const [funding, setFunding] = useState(false)
  const [faucetError, setFaucetError] = useState<string | null>(null)

  useEffect(() => setMmAvailable(hasMetaMask()), [])

  // Balance of the MetaMask identity — the burner hook only watches its own key.
  useEffect(() => {
    if (!mm) return
    let cancelled = false
    const tick = async () => {
      try {
        const b = await publicClient.getBalance({ address: mm })
        if (!cancelled) setMmBalance(b)
      } catch { /* next tick retries */ }
    }
    tick()
    const t = setInterval(tick, 8000)
    return () => { cancelled = true; clearInterval(t) }
  }, [mm])

  // prefill with the current room settings if one is already open
  useEffect(() => {
    if (!room || room.price === 0n) return
    setPrice(formatEther(room.price))
    const [k, ...rest] = room.streamUrl.split(':')
    if (SOURCES.some((s) => s.kind === k)) {
      setKind(k as typeof kind)
      setChannel(normalizeChannelInput(k, rest.join(':')))
    }
  }, [room])

  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const isOpen = !!room && room.price > 0n

  const connect = useCallback(async () => {
    setConnecting(true)
    setError(null)
    try {
      setMm(await connectMetaMask())
    } catch (e) {
      setError(humanError(e))
    } finally {
      setConnecting(false)
    }
  }, [])

  const fund = useCallback(async () => {
    if (!active) return
    setFunding(true)
    setFaucetError(null)
    try {
      const { txHash } = await requestFaucet(active)
      await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` })
      if (mm) setMmBalance(await publicClient.getBalance({ address: mm }))
      else await burner.refreshBalance()
    } catch (e) {
      setFaucetError(e instanceof Error ? e.message : 'Faucet unavailable')
    } finally {
      setFunding(false)
    }
  }, [active, mm, burner])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!active) return
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

      const ch = normalizeChannelInput(kind, channel)
      const args = [wei, ch ? `${kind}:${ch}` : ''] as const
      const call = { address: CONTRACT_ADDRESS, abi: STREAM_CHAT_ABI, functionName: 'setRoom', args } as const

      if (mm) {
        // MetaMask signs and paces itself — no burner queue involved
        const gas = gasMargin(await publicClient.estimateContractGas({ ...call, account: mm }))
        const hash = await metaMaskClient().writeContract({ ...call, account: mm, gas })
        setLastTx(hash)
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        if (receipt.status !== 'success') throw new Error('Transaction reverted')
      } else {
        const account = burner.account!
        await enqueue(async () => {
          const gas = gasMargin(await publicClient.estimateContractGas({ ...call, account }))
          const hash = await walletFor(account).writeContract({ ...call, gas })
          setLastTx(hash)
          const receipt = await publicClient.waitForTransactionReceipt({ hash })
          if (receipt.status !== 'success') throw new Error('Transaction reverted')
        })
      }
      await refresh()
    } catch (err) {
      setError(humanError(err))
    } finally {
      setBusy(false)
    }
  }

  if (!active) {
    return <p className="p-8 font-mono text-[11px] text-ink-soft">creating your wallet…</p>
  }

  const enoughGas = balance > parseEther('0.05')

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <Link href="/" className="flex items-center gap-2.5 font-display text-2xl">
        <span className="h-2.5 w-2.5 bg-stamp" aria-hidden />
        MonadChat
      </Link>

      <h1 className="mt-8 font-display text-5xl">Streamer&apos;s desk</h1>
      <p className="mt-4 max-w-lg text-[15px] leading-relaxed">
        {mm
          ? 'Your room is tied to your MetaMask wallet. Money for messages lands there instantly — no withdrawals, no middlemen.'
          : 'Your room is tied to the wallet this browser created. Money for messages lands there instantly — no withdrawals, no middlemen.'}
      </p>

      <section className="mt-10 border-t border-ink">
        <div className="flex items-baseline gap-3 border-b border-edge py-3">
          <span className={`w-24 shrink-0 ${label}`}>wallet</span>
          <span className="leader" />
          <span className="font-mono text-[12px]">{mm ? 'MetaMask' : 'this browser'}</span>
          {mmAvailable && !mm && (
            <button
              onClick={connect}
              disabled={connecting}
              className="bg-ink px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-stamp disabled:opacity-40"
            >
              {connecting ? 'connecting…' : 'connect MetaMask'}
            </button>
          )}
          {mm && (
            <button
              onClick={() => setMm(null)}
              className="font-mono text-[10px] uppercase tracking-[0.14em] underline underline-offset-2 hover:text-stamp"
            >
              use browser wallet
            </button>
          )}
        </div>
        <div className="flex items-baseline gap-3 border-b border-edge py-3">
          <span className={`w-24 shrink-0 ${label}`}>address</span>
          <span className="leader" />
          <a
            href={addressUrl(active)}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 truncate font-mono text-[12px] underline underline-offset-2 hover:text-stamp"
          >
            {active}
          </a>
        </div>
        <div className="flex items-baseline gap-3 border-b border-edge py-3">
          <span className={`w-24 shrink-0 ${label}`}>balance</span>
          <span className="leader" />
          <span className="font-mono text-[13px] font-bold tabular-nums">{fmtMon(balance)} MON</span>
          <button
            onClick={fund}
            disabled={funding}
            className="bg-ink px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-money disabled:opacity-40"
          >
            {funding ? 'pouring…' : '+1 MON'}
          </button>
        </div>
        {isOpen && (
          <div className="flex items-baseline gap-3 border-b border-edge py-3">
            <span className={`w-24 shrink-0 ${label}`}>earned</span>
            <span className="leader" />
            <span className="font-mono text-[13px] font-bold text-money tabular-nums">
              {fmtMon(room!.earned)} MON
            </span>
          </div>
        )}
        {faucetError && <p className="py-2 text-sm text-stamp">faucet: {faucetError}</p>}
        {!enoughGas && !faucetError && (
          <p className="py-2 text-sm text-stamp">Not enough for gas — hit “+1 MON” before opening the room.</p>
        )}
      </section>

      <form onSubmit={save} className="mt-10 space-y-8">
        <div>
          <label className={label}>Price per message</label>
          <p className="mt-1 text-[13px] italic text-ink-soft">
            Below 0.02 MON it stops making sense: gas alone costs about 0.013 MON per message.
          </p>
          <div className="mt-3 flex items-baseline gap-2">
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              className="w-32 border-b border-ink bg-transparent pb-1.5 font-mono text-sm tabular-nums outline-none"
            />
            <span className="font-mono text-[11px] text-ink-soft">MON</span>
          </div>
        </div>

        <div>
          <label className={label}>Where you stream</label>
          <p className="mt-1 text-[13px] italic text-ink-soft">
            We do not replace Twitch — we add a paid chat on top of it. Leave empty if you are not live yet.
          </p>
          <div className="mt-3 flex gap-4">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
              className="border-b border-ink bg-transparent pb-1.5 font-mono text-sm outline-none"
            >
              {SOURCES.map((s) => (
                <option key={s.kind} value={s.kind}>{s.label}</option>
              ))}
            </select>
            <input
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder={SOURCES.find((s) => s.kind === kind)!.hint}
              className="min-w-0 flex-1 border-b border-ink bg-transparent pb-1.5 text-sm outline-none placeholder:italic placeholder:text-ink-soft"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-ink px-4 py-3 font-mono text-[12px] uppercase tracking-[0.2em] text-paper transition-colors hover:bg-stamp disabled:opacity-40"
        >
          {busy
            ? mm ? 'confirm in MetaMask…' : 'sending transaction…'
            : isOpen ? 'Update room' : 'Open room'}
        </button>

        {error && <p className="text-sm text-stamp">{error}</p>}
        {lastTx && !error && !busy && (
          <p className="font-mono text-[11px] text-ink-soft">
            done ·{' '}
            <a href={txUrl(lastTx)} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
              transaction in the explorer
            </a>
          </p>
        )}
      </form>

      {isOpen && (
        <section className="mt-10 border-t border-ink pt-4">
          <h2 className={label}>Room is open — share these links</h2>
          <div className="mt-3 space-y-4">
            <LinkRow label="for viewers" href={`${origin}/r/${active}`} />
            <LinkRow label="for OBS browser source" href={`${origin}/overlay/${active}`} />
          </div>
        </section>
      )}
    </main>
  )
}

function LinkRow({ label: l, href }: { label: string; href: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">{l}</div>
      <div className="mt-1 flex items-baseline gap-3">
        <code className="min-w-0 flex-1 truncate border-b border-edge pb-1 font-mono text-[12px]">
          {href}
        </code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(href)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] underline underline-offset-2 hover:text-stamp"
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
    </div>
  )
}
