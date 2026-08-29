'use client'

import { useEffect, useState } from 'react'
import type { Address } from 'viem'
import { colorFor } from '@/lib/chain'
import { useChat } from '@/lib/useChat'
import { fmtMon } from './Chat'

/** Сколько сообщение висит поверх стрима */
const LIFETIME_MS = 25_000
const MAX_VISIBLE = 6

export function Overlay({ streamer }: { streamer: Address }) {
  const { messages } = useChat(streamer)
  const [now, setNow] = useState(() => Date.now())

  // OBS Browser Source: фон должен быть прозрачным, иначе перекроет видео
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
    <div className="flex h-screen flex-col justify-end gap-2 p-6">
      {visible.map((m) => (
        <div
          key={m.key}
          className="msg-in max-w-lg rounded-lg border border-white/10 bg-black/75 px-4 py-2.5 backdrop-blur-sm"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,.5)' }}
        >
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold" style={{ color: colorFor(m.sender) }}>
              {m.nickname}
            </span>
            <span className="rounded bg-mon/25 px-1.5 py-0.5 text-[11px] font-semibold text-mon-soft tabular-nums">
              {fmtMon(m.amount)} MON
            </span>
          </div>
          <p className="mt-0.5 text-[15px] leading-snug text-white">{m.text}</p>
        </div>
      ))}
    </div>
  )
}
