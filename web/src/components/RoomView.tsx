'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Address } from 'viem'
import { addressUrl, shortAddress } from '@/lib/chain'
import { embedUrl, useRoom } from '@/lib/useRoom'
import { Chat, fmtMon } from './Chat'

export function RoomView({ streamer }: { streamer: Address }) {
  const { room, loading } = useRoom(streamer)
  const [host, setHost] = useState('')

  useEffect(() => setHost(window.location.host), [])

  const embed = room?.streamUrl && host ? embedUrl(room.streamUrl, host) : null

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-edge px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2 text-sm font-bold tracking-tight">
          <span className="text-mon">◆</span> MonadChat
        </Link>
        <div className="flex items-center gap-4 text-xs text-muted">
          <span>
            комната{' '}
            <a href={addressUrl(streamer)} target="_blank" rel="noreferrer" className="font-mono text-mon-soft hover:underline">
              {shortAddress(streamer)}
            </a>
          </span>
          {room && room.price > 0n && (
            <span className="tabular-nums">
              заработано <b className="text-white">{fmtMon(room.earned)} MON</b>
            </span>
          )}
          <Link href={`/overlay/${streamer}`} className="hover:text-white hover:underline">
            оверлей для OBS
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative flex-1 bg-black">
            {embed ? (
              <iframe
                src={embed}
                allow="autoplay; fullscreen; encrypted-media"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-panel to-ink">
                <div className="flex items-center gap-2 rounded-full bg-live/15 px-3 py-1">
                  <span className="live-dot h-2 w-2 rounded-full bg-live" />
                  <span className="text-xs font-semibold tracking-widest text-live">LIVE</span>
                </div>
                <p className="text-sm text-muted">
                  {loading
                    ? 'Читаю комнату из контракта…'
                    : room?.streamUrl
                      ? `Не разобрал источник: ${room.streamUrl}`
                      : 'Стример не указал, где он вещает'}
                </p>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-4 border-t border-edge px-4 py-3">
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">
                {room?.streamUrl || 'Стрим без источника'}
              </h1>
              <p className="truncate text-xs text-muted">
                Каждое сообщение в чате — транзакция в Monad. Деньги уходят стримеру сразу.
              </p>
            </div>
            {room && (
              <div className="shrink-0 rounded-md border border-edge bg-panel px-3 py-1.5 text-right">
                <div className="text-[10px] uppercase tracking-wide text-muted">цена слова</div>
                <div className="text-sm font-bold tabular-nums text-mon-soft">
                  {room.price > 0n ? `${fmtMon(room.price)} MON` : 'закрыто'}
                </div>
              </div>
            )}
          </div>
        </main>

        <aside className="w-[340px] shrink-0">
          {room ? (
            <Chat streamer={streamer} price={room.price} />
          ) : (
            <div className="flex h-full items-center justify-center border-l border-edge bg-panel text-xs text-muted">
              загружаю комнату…
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
