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
  { kind: 'twitch', label: 'Twitch', hint: 'ник канала, например monad' },
  { kind: 'youtube', label: 'YouTube', hint: 'ID видео из ссылки watch?v=…' },
  { kind: 'kick', label: 'Kick', hint: 'ник канала' },
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

  // подставляем текущие настройки комнаты, если она уже открыта
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
        throw new Error('Цена должна быть числом, например 0.05')
      }
      if (wei <= 0n) throw new Error('Цена должна быть больше нуля, иначе комната считается закрытой')

      const args = [wei, channel.trim() ? `${kind}:${channel.trim()}` : ''] as const
      const call = { address: CONTRACT_ADDRESS, abi: STREAM_CHAT_ABI, functionName: 'setRoom', args } as const

      await enqueue(async () => {
        const gas = gasMargin(await publicClient.estimateContractGas({ ...call, account }))
        const hash = await walletFor(account).writeContract({ ...call, gas })
        setLastTx(hash)
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        if (receipt.status !== 'success') throw new Error('Транзакция ревертнулась')
      })
      await refresh()
    } catch (err) {
      setError(humanError(err))
    } finally {
      setBusy(false)
    }
  }

  if (!account) {
    return <p className="p-8 text-sm text-muted">Создаю кошелёк…</p>
  }

  const enoughGas = balance > parseEther('0.05')

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <Link href="/" className="text-sm font-bold tracking-tight">
        <span className="text-mon">◆</span> MonadChat
      </Link>

      <h1 className="mt-6 text-2xl font-bold">Кабинет стримера</h1>
      <p className="mt-2 text-sm text-muted">
        Твоя комната привязана к кошельку, который создал этот браузер. Деньги за сообщения
        приходят на него мгновенно, без вывода и посредников.
      </p>

      <section className="mt-6 rounded-lg border border-edge bg-panel p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-muted">твой адрес</div>
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
            <div className="text-[10px] uppercase tracking-wide text-muted">баланс</div>
            <div className="text-sm font-bold tabular-nums">{fmtMon(balance)} MON</div>
          </div>
          <button
            onClick={fund}
            disabled={funding}
            className="shrink-0 rounded bg-mon px-3 py-1.5 text-xs font-medium text-white hover:bg-mon-soft disabled:opacity-50"
          >
            {funding ? 'наливаю…' : '+1 MON'}
          </button>
        </div>
        {faucetError && <p className="mt-2 text-xs text-red-400">Кран: {faucetError}</p>}
        {!enoughGas && !faucetError && (
          <p className="mt-2 text-xs text-amber-400">
            На газ не хватает — нажми «+1 MON» перед тем, как открывать комнату.
          </p>
        )}
        {isOpen && (
          <p className="mt-3 border-t border-edge pt-3 text-xs text-muted">
            заработано за всё время:{' '}
            <b className="text-white tabular-nums">{fmtMon(room!.earned)} MON</b>
          </p>
        )}
      </section>

      <form onSubmit={save} className="mt-6 space-y-5 rounded-lg border border-edge bg-panel p-5">
        <div>
          <label className="block text-sm font-medium">Цена одного сообщения</label>
          <p className="mt-1 text-xs text-muted">
            Дешевле 0.02 MON смысла нет: газ одного сообщения — около 0.013 MON.
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
          <label className="block text-sm font-medium">Где ты стримишь</label>
          <p className="mt-1 text-xs text-muted">
            Мы не заменяем Twitch — мы даём платный чат поверх него. Оставь пустым, если стрима пока нет.
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
          {busy ? 'отправляю транзакцию…' : isOpen ? 'Обновить комнату' : 'Открыть комнату'}
        </button>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {lastTx && !error && !busy && (
          <p className="text-xs text-muted">
            готово ·{' '}
            <a href={txUrl(lastTx)} target="_blank" rel="noreferrer" className="text-mon-soft hover:underline">
              транзакция в эксплорере
            </a>
          </p>
        )}
      </form>

      {isOpen && (
        <section className="mt-6 space-y-3 rounded-lg border border-mon/30 bg-mon/5 p-5">
          <h2 className="text-sm font-semibold">Комната открыта. Раздавай ссылки:</h2>
          <LinkRow label="Зрителям" href={`${origin}/r/${account.address}`} />
          <LinkRow
            label="В OBS как Browser Source"
            href={`${origin}/overlay/${account.address}`}
          />
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
          {copied ? 'скопировано' : 'копировать'}
        </button>
      </div>
    </div>
  )
}
