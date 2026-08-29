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

/** 1 сообщение / 2 сообщения / 5 сообщений */
export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

const clock = (ts: number) =>
  new Date(ts * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

/** Запас на газ: сообщение стоит цену комнаты плюс ~0.013 MON газа. */
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
    send(t, nickname.trim() || 'аноним', price)
  }

  return (
    <div className="flex h-full flex-col border-l border-edge bg-panel">
      <header className="flex items-center justify-between border-b border-edge px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-wide">ЧАТ</span>
          <span
            className={`live-dot h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-400' : 'bg-muted'}`}
            title={live ? 'подписка на события активна' : 'нет соединения'}
          />
        </div>
        <span className="text-xs text-muted tabular-nums">
          {messages.length} {plural(messages.length, 'сообщение', 'сообщения', 'сообщений')}
        </span>
      </header>

      <div ref={scroller} onScroll={onScroll} className="chat-scroll flex-1 overflow-y-auto py-2">
        {loadingHistory && (
          <p className="px-4 py-2 text-xs text-muted">Загружаю историю из блокчейна…</p>
        )}
        {!loadingHistory && rows.length === 0 && (
          <p className="px-4 py-2 text-xs text-muted">
            Пока тихо. Первое сообщение стоит {fmtMon(price)} MON — напиши его.
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
              {m.status === 'queued' && <span className="text-[11px] text-muted">· в очереди</span>}
              {m.status === 'sending' && (
                <span className="text-[11px] text-mon-soft">· отправляю…</span>
              )}
              {m.status === 'failed' && (
                <span className="text-[11px] text-red-400">
                  · {m.error}{' '}
                  <button onClick={() => dismiss(m.key)} className="underline hover:no-underline">
                    убрать
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
                title="открыть транзакцию в эксплорере"
              >
                {fmtMon(m.amount)} MON
                {m.latencyMs !== undefined && ` · ⛓ ${(m.latencyMs / 1000).toFixed(2)} с`}
              </a>
            </div>
          ),
        )}
      </div>

      <div className="border-t border-edge px-3 py-2 text-[11px]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="text-muted">ты:</span>
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
                title="сменить ник"
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
              {funding ? 'наливаю…' : '+1 MON'}
            </button>
          </div>
        </div>
        {faucetError && <p className="mt-1 text-red-400">Кран: {faucetError}</p>}
        {!canAfford && !faucetError && (
          <p className="mt-1 text-amber-400">
            Не хватает на сообщение — нажми «+1 MON», кран нальёт бесплатно.
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
          placeholder={roomOpen ? 'Написать сообщение…' : 'Комната закрыта'}
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
            Отправить · {fmtMon(price)} MON
          </button>
        </div>
      </form>
    </div>
  )
}
