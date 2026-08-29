'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { formatEther, parseEther, type Address } from 'viem'
import { colorFor, shortAddress, txUrl } from '@/lib/chain'
import { useBurner } from '@/lib/useBurner'
import { useChat } from '@/lib/useChat'

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

export function Chat({ streamer, price }: { streamer: Address; price: bigint }) {
  const { messages, pending, send, dismiss, live, loadingHistory } = useChat(streamer)
  const { account, balance, nickname, setNickname, fund, funding, faucetError } = useBurner()
  const [text, setText] = useState('')
  const [editingNick, setEditingNick] = useState(false)

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
    <div className="flex min-h-0 flex-1 flex-col border-t border-edge bg-panel lg:border-l lg:border-t-0">
      <header className="flex items-center justify-between border-b border-edge px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-wide">CHAT</span>
          <span
            className={`live-dot h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-400' : 'bg-muted'}`}
            title={live ? 'live subscription active' : 'disconnected'}
          />
        </div>
        <span className="text-xs text-muted tabular-nums">
          {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </span>
      </header>

      <div ref={scroller} onScroll={onScroll} className="chat-scroll flex-1 overflow-y-auto py-2">
        {loadingHistory && (
          <p className="px-4 py-2 text-xs text-muted">Loading history from the chain…</p>
        )}
        {!loadingHistory && rows.length === 0 && (
          <p className="px-4 py-2 text-xs text-muted">
            Quiet in here. The first message costs {fmtMon(price)} MON — go write it.
          </p>
        )}

        {rows.map((m) =>
          'status' in m ? (
            <div
              key={m.key}
              className={`msg-in px-4 py-1 text-[13px] leading-relaxed ${
                m.status === 'failed' ? 'bg-red-950/40' : 'opacity-55'
              }`}
            >
              <span className="font-semibold" style={{ color: colorFor(m.sender) }}>
                {m.nickname}
              </span>
              <span className="text-muted">: </span>
              <span className="break-words">{m.text}</span>{' '}
              {m.status === 'queued' && <span className="text-[11px] text-muted">· queued</span>}
              {m.status === 'sending' && (
                <span className="text-[11px] text-mon-soft">· sending…</span>
              )}
              {m.status === 'failed' && (
                <span className="text-[11px] text-red-400">
                  · {m.error}{' '}
                  <button onClick={() => dismiss(m.key)} className="underline hover:no-underline">
                    dismiss
                  </button>
                </span>
              )}
            </div>
          ) : (
            <div key={m.key} className="msg-in group px-4 py-1 text-[13px] leading-relaxed hover:bg-panel-2">
              <span className="mr-1.5 text-[11px] text-muted tabular-nums">{clock(m.timestamp)}</span>
              <span className="font-semibold" style={{ color: colorFor(m.sender) }}>
                {m.nickname || shortAddress(m.sender)}
              </span>
              <span className="text-muted">: </span>
              <span className="break-words">{m.text}</span>
              <a
                href={txUrl(m.txHash)}
                target="_blank"
                rel="noreferrer"
                className="ml-2 rounded bg-mon/15 px-1.5 py-0.5 text-[10px] font-medium text-mon-soft tabular-nums hover:bg-mon/25"
                title="open transaction in the explorer"
              >
                {fmtMon(m.amount)} MON
                {m.latencyMs !== undefined && ` · ⛓ ${(m.latencyMs / 1000).toFixed(2)}s`}
              </a>
            </div>
          ),
        )}
      </div>

      <div className="border-t border-edge px-3 py-2 text-[11px]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="text-muted">you:</span>
            {editingNick ? (
              <input
                autoFocus
                value={nickname}
                maxLength={24}
                onChange={(e) => setNickname(e.target.value)}
                onBlur={() => setEditingNick(false)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingNick(false)}
                className="w-28 rounded border border-edge bg-panel-2 px-1.5 py-0.5 outline-none focus:border-mon"
              />
            ) : (
              <button
                onClick={() => setEditingNick(true)}
                className="font-semibold hover:underline"
                style={{ color: account ? colorFor(account.address) : undefined }}
                title="change nickname"
              >
                {nickname || '…'}
              </button>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`tabular-nums ${canAfford ? 'text-muted' : 'text-amber-400'}`}>
              {fmtMon(balance)} MON
            </span>
            <button
              onClick={fund}
              disabled={funding}
              className="rounded bg-mon px-2 py-1 font-medium text-white hover:bg-mon-soft disabled:opacity-50"
            >
              {funding ? 'funding…' : '+1 MON'}
            </button>
          </div>
        </div>
        {faucetError && <p className="mt-1 text-red-400">Faucet: {faucetError}</p>}
        {!canAfford && !faucetError && (
          <p className="mt-1 text-amber-400">
            Not enough to post — hit “+1 MON”, the faucet tops you up for free.
          </p>
        )}
      </div>

      <form onSubmit={submit} className="border-t border-edge p-3">
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
          placeholder={roomOpen ? 'Send a message…' : 'Room is closed'}
          disabled={!roomOpen}
          className="w-full rounded-md border border-edge bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-mon disabled:opacity-50"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-muted tabular-nums">{text.length}/280</span>
          <button
            type="submit"
            disabled={disabled}
            className="rounded-md bg-mon px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-mon-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send · {fmtMon(price)} MON
          </button>
        </div>
      </form>
    </div>
  )
}
