'use client'

import { useEffect, useState } from 'react'
import type { Address } from 'viem'
import { colorFor } from '@/lib/chain'
import { useChat } from '@/lib/useChat'
import { fmtMon } from './Chat'

/** How long a message stays on top of the stream */
const LIFETIME_MS = 25_000
const MAX_VISIBLE = 6

export function Overlay({ streamer }: { streamer: Address }) {
  const { messages } = useChat(streamer)
  const [now, setNow] = useState(() => Date.now())

  // OBS Browser Source needs a transparent background, otherwise it covers the video
  useEffect(() => {
    const prev = document.body.style.background
    document.body.style.background = 'transparent'
    return () => { document.body.style.background = prev }
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const visible = messages
    .filter((m) => now - m.timestamp * 1000 < LIFETIME_MS)
    .slice(-MAX_VISIBLE)

  return (
    <div className="flex h-screen flex-col items-start justify-end gap-2.5 p-6">
      {visible.map((m, i) => (
        <div
          key={m.key}
          className="msg-in max-w-lg border border-ink bg-paper px-4 py-2.5"
          style={{
            boxShadow: '3px 3px 0 rgba(26,23,18,.35)',
            transform: `rotate(${i % 2 === 0 ? '-0.4' : '0.35'}deg)`,
          }}
        >
          <div className="flex items-baseline gap-3">
            <span className="text-[15px] font-bold" style={{ color: colorFor(m.sender) }}>
              {m.nickname}
            </span>
            <span className="font-mono text-[11px] font-bold text-money tabular-nums">
              {fmtMon(m.amount)} MON
            </span>
          </div>
          <p className="mt-0.5 text-[16px] leading-snug text-ink">{m.text}</p>
        </div>
      ))}
    </div>
  )
}
