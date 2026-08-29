'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Address } from 'viem'
import { addressUrl, shortAddress } from '@/lib/chain'
import { displaySource, embedUrl, useRoom } from '@/lib/useRoom'
import { Chat, fmtMon } from './Chat'

export function RoomView({ streamer }: { streamer: Address }) {
  const { room, loading } = useRoom(streamer)
  const [host, setHost] = useState('')

  useEffect(() => setHost(window.location.host), [])

  const embed = room?.streamUrl && host ? embedUrl(room.streamUrl, host) : null

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-baseline justify-between border-b border-ink px-4 py-2">
        <Link href="/" className="font-display text-xl leading-none">MonadChat</Link>
        <div className="flex items-baseline gap-4 font-mono text-[11px] text-ink-soft">
          <span className="hidden sm:inline">
            room{' '}
            <a href={addressUrl(streamer)} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
              {shortAddress(streamer)}
            </a>
          </span>
          {room && room.price > 0n && (
            <span className="tabular-nums">
              earned <b className="text-money">{fmtMon(room.earned)} MON</b>
            </span>
          )}
          <Link href={`/overlay/${streamer}`} className="hidden underline underline-offset-2 hover:text-ink md:inline">
            OBS overlay
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="flex min-w-0 shrink-0 flex-col lg:flex-1 lg:shrink">
          <div className="relative aspect-video w-full bg-ink lg:aspect-auto lg:flex-1">
            {embed ? (
              <iframe
                src={embed}
                allow="autoplay; fullscreen; encrypted-media"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="live-dot h-2 w-2 rounded-full bg-stamp" />
                  <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-stamp">Live</span>
                </div>
                <p className="text-sm italic text-paper-2/70">
                  {loading
                    ? 'Reading the room from the contract…'
                    : room?.streamUrl
                      ? `Could not parse the source: ${room.streamUrl}`
                      : 'The streamer has not set a source yet'}
                </p>
              </div>
            )}
          </div>

          <div className="hidden shrink-0 items-baseline justify-between gap-4 border-t border-ink px-4 py-2.5 sm:flex">
            <div className="min-w-0">
              <h1 className="truncate font-mono text-[12px] uppercase tracking-[0.12em]">
                {room?.streamUrl ? displaySource(room.streamUrl) : 'Stream without a source'}
              </h1>
              <p className="truncate text-[13px] italic text-ink-soft">
                Every message is a Monad transaction. The streamer is paid instantly.
              </p>
            </div>
            {room && (
              <div className="shrink-0 text-right">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">price per word</div>
                <div className="font-mono text-sm font-bold text-money tabular-nums">
                  {room.price > 0n ? `${fmtMon(room.price)} MON` : 'closed'}
                </div>
              </div>
            )}
          </div>
        </main>

        <aside className="flex min-h-0 flex-1 flex-col lg:w-[360px] lg:flex-none">
          {room ? (
            <Chat streamer={streamer} price={room.price} />
          ) : (
            <div className="flex h-full items-center justify-center border-l border-ink bg-paper font-mono text-[11px] text-ink-soft">
              loading room…
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
