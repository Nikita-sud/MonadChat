'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatEther, parseEther, type Address } from 'viem'
import { colorFor, publicClient, shortAddress, txUrl } from '@/lib/chain'
import { connectMetaMask, hasMetaMask, metaMaskClient } from '@/lib/metamask'
import { useBurner } from '@/lib/useBurner'
import { useChat, humanError } from '@/lib/useChat'

export function fmtMon(wei: bigint, digits = 3): string {
  const n = Number(formatEther(wei))
  if (n === 0) return '0'
  if (n < 0.001) return n.toExponential(1)
  return n.toFixed(digits).replace(/\.?0+$/, '')
}

const clock = (ts: number) =>
  new Date(ts * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

/** A message costs the room price plus roughly 0.013 MON of gas. */
const GAS_HEADROOM = parseEther('0.02')

/** One MetaMask confirmation buys this much popup-free chatting. */
const TOPUP = parseEther('0.5')

export function Chat({ streamer, price }: { streamer: Address; price: bigint }) {
  const { messages, pending, send, dismiss, live, loadingHistory } = useChat(streamer)
  const { account, balance, refreshBalance, nickname, setNickname, fund, funding, faucetError } =
    useBurner()
  const [text, setText] = useState('')
  const [editingNick, setEditingNick] = useState(false)

  // MetaMask is a fuel pump here, not a signer: one confirmation moves MON into
  // the session wallet, and every message keeps flowing popup-free from it.
  const [mmAvailable, setMmAvailable] = useState(false)
  const [toppingUp, setToppingUp] = useState(false)
  const [topupNote, setTopupNote] = useState<string | null>(null)
  const [topupError, setTopupError] = useState<string | null>(null)

  useEffect(() => setMmAvailable(hasMetaMask()), [])

  const scroller = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)

  const rows = useMemo(() => [...messages, ...pending], [messages, pending])

  useEffect(() => {
    const el = scroller.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [rows.length])

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
  }

  const topUp = useCallback(async () => {
    if (!account) return
    setToppingUp(true)
    setTopupError(null)
    setTopupNote(null)
    try {
      const from = await connectMetaMask()
      const hash = await metaMaskClient().sendTransaction({
        account: from,
        to: account.address,
        value: TOPUP,
        gas: 21000n, // plain transfer is exactly 21000, and Monad charges the limit
      })
      setTopupNote('confirming on chain…')
      await publicClient.waitForTransactionReceipt({ hash })
      await refreshBalance()
      setTopupNote(`+${fmtMon(TOPUP)} MON from ${shortAddress(from)}`)
    } catch (e) {
      setTopupError(humanError(e))
    } finally {
      setToppingUp(false)
    }
  }, [account, refreshBalance])

  const canAfford = balance >= price + GAS_HEADROOM
  const roomOpen = price > 0n
  const disabled = !roomOpen || !canAfford || !text.trim()

  const submit = (e: { preventDefault: () => void }) => {
    e.preventDefault()
    const t = text.trim()
    if (!t || disabled) return
    setText('')
    send(t, nickname.trim() || 'anon', price)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-ink bg-paper lg:border-l lg:border-t-0">
      <header className="flex items-baseline justify-between border-b border-ink px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em]">Chat</span>
          <span
            className={`live-dot h-1.5 w-1.5 rounded-full ${live ? 'bg-money' : 'bg-ink-soft'}`}
            title={live ? 'live subscription active' : 'disconnected'}
          />
        </div>
        <span className="font-mono text-[11px] text-ink-soft tabular-nums">
          {messages.length} {messages.length === 1 ? 'entry' : 'entries'}
        </span>
      </header>

      <div ref={scroller} onScroll={onScroll} className="chat-scroll flex-1 overflow-y-auto py-1.5">
        {loadingHistory && (
          <p className="px-4 py-2 font-mono text-[11px] text-ink-soft">reading the ledger…</p>
        )}
        {!loadingHistory && rows.length === 0 && (
          <p className="px-4 py-3 text-[14px] italic text-ink-soft">
            Quiet in here. The first word costs {fmtMon(price)} MON — go write it.
          </p>
        )}

        {rows.map((m) =>
          'status' in m ? (
            <div
              key={m.key}
              className={`msg-in flex items-baseline gap-2 px-4 py-1 text-[14px] leading-relaxed ${
                m.status === 'failed' ? 'bg-stamp/10' : 'opacity-50'
              }`}
            >
              <span className="min-w-0">
                <b style={{ color: colorFor(m.sender) }}>{m.nickname}</b>
                <span className="text-ink-soft"> · </span>
                <span className="break-words">{m.text}</span>
              </span>
              <span className="leader" />
              {m.status === 'queued' && <span className="shrink-0 font-mono text-[10px] text-ink-soft">queued</span>}
              {m.status === 'sending' && <span className="shrink-0 font-mono text-[10px] text-ink-soft">sending…</span>}
              {m.status === 'failed' && (
                <span className="shrink-0 font-mono text-[10px] text-stamp">
                  {m.error}{' '}
                  <button onClick={() => dismiss(m.key)} className="underline">dismiss</button>
                </span>
              )}
            </div>
          ) : (
            <div key={m.key} className="msg-in flex items-baseline gap-2 px-4 py-1 text-[14px] leading-relaxed hover:bg-paper-2">
              <span className="min-w-0">
                <span className="mr-1.5 font-mono text-[10px] text-ink-soft tabular-nums">{clock(m.timestamp)}</span>
                <b style={{ color: colorFor(m.sender) }}>{m.nickname || shortAddress(m.sender)}</b>
                <span className="text-ink-soft"> · </span>
                <span className="break-words">{m.text}</span>
              </span>
              <span className="leader" />
              <a
                href={txUrl(m.txHash)}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 font-mono text-[11px] text-money tabular-nums hover:underline"
                title="open transaction in the explorer"
              >
                {fmtMon(m.amount)}
                {m.latencyMs !== undefined && (
                  <span className="text-ink-soft"> · {(m.latencyMs / 1000).toFixed(2)}s</span>
                )}
              </a>
            </div>
          ),
        )}
      </div>

      <div className="border-t border-edge px-4 py-2 font-mono text-[11px]">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="text-ink-soft">you:</span>
            {editingNick ? (
              <input
                autoFocus
                value={nickname}
                maxLength={24}
                onChange={(e) => setNickname(e.target.value)}
                onBlur={() => setEditingNick(false)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingNick(false)}
                className="w-28 border-b border-ink bg-transparent outline-none"
              />
            ) : (
              <button
                onClick={() => setEditingNick(true)}
                className="font-bold hover:underline"
                style={{ color: account ? colorFor(account.address) : undefined }}
                title="change nickname"
              >
                {nickname || '…'}
              </button>
            )}
          </div>
          <div className="flex shrink-0 items-baseline gap-3">
            <span className={`tabular-nums ${canAfford ? 'text-ink-soft' : 'text-stamp'}`}>
              {fmtMon(balance)} MON
            </span>
            <button
              onClick={fund}
              disabled={funding}
              className="bg-ink px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-money disabled:opacity-40"
            >
              {funding ? 'pouring…' : '+1 MON'}
            </button>
          </div>
        </div>
        {mmAvailable && (
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-ink-soft">
            <button
              onClick={topUp}
              disabled={toppingUp}
              className="underline underline-offset-2 hover:text-stamp disabled:opacity-40"
              title="one MetaMask confirmation moves 0.5 MON into this session wallet — then keep chatting with zero popups"
            >
              {toppingUp ? 'waiting for MetaMask…' : `top up ${fmtMon(TOPUP)} MON from MetaMask →`}
            </button>
            {topupNote && <span className="text-money">{topupNote}</span>}
          </div>
        )}
        {topupError && <p className="mt-1.5 text-stamp">{topupError}</p>}
        {faucetError && <p className="mt-1.5 text-stamp">faucet: {faucetError}</p>}
        {!canAfford && !faucetError && (
          <p className="mt-1.5 text-stamp">
            not enough to post — hit “+1 MON”, the faucet is free
          </p>
        )}
      </div>

      <form onSubmit={submit} className="border-t border-ink p-3">
        <input
          value={text}
          maxLength={280}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit(e)
            }
          }}
          placeholder={roomOpen ? 'Write a word…' : 'Room is closed'}
          disabled={!roomOpen}
          className="w-full border-b border-ink bg-transparent pb-2 text-[15px] outline-none placeholder:italic placeholder:text-ink-soft disabled:opacity-50"
        />
        <div className="mt-2.5 flex items-baseline justify-between">
          <span className="font-mono text-[10px] text-ink-soft tabular-nums">{text.length}/280</span>
          <button
            type="submit"
            disabled={disabled}
            className="bg-ink px-5 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-paper transition-colors hover:bg-stamp disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send · {fmtMon(price)} MON
          </button>
        </div>
      </form>
    </div>
  )
}
