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
        <div className="flex items-center gap-3 text-xs text-muted sm:gap-4">
          <span className="hidden sm:inline">
            room{' '}
            <a href={addressUrl(streamer)} target="_blank" rel="noreferrer" className="font-mono text-mon-soft hover:underline">
              {shortAddress(streamer)}
            </a>
          </span>
          {room && room.price > 0n && (
            <span className="tabular-nums">
              earned <b className="text-white">{fmtMon(room.earned)} MON</b>
            </span>
          )}
          <Link
            href={`/overlay/${streamer}`}
            className="hidden hover:text-white hover:underline md:inline"
          >
            OBS overlay
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="flex min-w-0 shrink-0 flex-col lg:flex-1 lg:shrink">
          <div className="relative aspect-video w-full bg-black lg:aspect-auto lg:flex-1">
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
                    ? 'Reading the room from the contract…'
                    : room?.streamUrl
                      ? `Could not parse the source: ${room.streamUrl}`
                      : 'The streamer has not set a source yet'}
                </p>
              </div>
            )}
          </div>

          <div className="hidden shrink-0 items-center justify-between gap-4 border-t border-edge px-4 py-3 sm:flex">
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">
                {room?.streamUrl || 'Stream without a source'}
              </h1>
              <p className="truncate text-xs text-muted">
                Every message is a Monad transaction. The streamer is paid instantly.
              </p>
            </div>
            {room && (
              <div className="shrink-0 rounded-md border border-edge bg-panel px-3 py-1.5 text-right">
                <div className="text-[10px] uppercase tracking-wide text-muted">price per word</div>
                <div className="text-sm font-bold tabular-nums text-mon-soft">
                  {room.price > 0n ? `${fmtMon(room.price)} MON` : 'closed'}
                </div>
              </div>
            )}
          </div>
        </main>

        <aside className="flex min-h-0 flex-1 flex-col lg:w-[340px] lg:flex-none">
          {room ? (
            <Chat streamer={streamer} price={room.price} />
          ) : (
            <div className="flex h-full items-center justify-center border-l border-edge bg-panel text-xs text-muted">
              loading room…
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
