'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { isAddress } from 'viem'
import { CONTRACT_ADDRESS, addressUrl } from '@/lib/chain'
import { DEMO_ROOM } from '@/lib/deployment'

export default function Home() {
  const router = useRouter()
  const [addr, setAddr] = useState('')
  const [error, setError] = useState<string | null>(null)

  const go = (e: React.FormEvent) => {
    e.preventDefault()
    const v = addr.trim()
    if (!isAddress(v)) {
      setError('That is not a wallet address — it should look like 0x…')
      return
    }
    router.push(`/r/${v}`)
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-8">
      <div className="flex items-center gap-2.5 font-display text-2xl">
        <span className="h-2.5 w-2.5 bg-stamp" aria-hidden />
        MonadChat
      </div>

      <h1 className="mt-6 font-display text-5xl leading-[0.95] sm:text-6xl">
        Chat where<br />words cost <span className="text-stamp">money</span>
      </h1>

      <p className="mt-5 max-w-xl text-[16px] leading-relaxed">
        Every message in a stream chat is a Monad transaction. To speak you have to pay, and the
        money lands in the streamer&apos;s wallet immediately — no platform in between. Spam gets
        expensive, attention gets honestly paid for.
      </p>

      <div className="mt-7 border-t border-ink">
        <Fact k="latency" v="0.5 seconds from hitting send to confirmation on chain" />
        <Fact k="wallet" v="none needed — the app creates one in your browser" />
        <Fact k="anti-spam" v="Monad consensus rate-limits posting, not our server" />
      </div>

      <Link
        href={`/r/${DEMO_ROOM}`}
        className="mt-7 block bg-ink px-6 py-4 text-center transition-colors hover:bg-stamp"
      >
        <span className="font-display text-2xl text-paper">Open the live demo →</span>
        <span className="mt-1 block font-mono text-[11px] uppercase tracking-[0.18em] text-paper/70">
          a real room · live lofi stream · every message lands on Monad
        </span>
      </Link>

      <form onSubmit={go} className="mt-6">
        <label className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
          …or join a specific streamer&apos;s room
        </label>
        <div className="mt-3 flex items-end gap-4">
          <input
            value={addr}
            onChange={(e) => { setAddr(e.target.value); setError(null) }}
            placeholder="0x… streamer address"
            className="min-w-0 flex-1 border-b border-ink bg-transparent pb-2 font-mono text-sm outline-none placeholder:text-ink-soft"
          />
          <button className="shrink-0 bg-ink px-6 py-2.5 font-mono text-[12px] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-stamp">
            Join
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-stamp">{error}</p>}
      </form>

      <p className="mt-5 text-[15px]">
        Streaming?{' '}
        <Link href="/dashboard" className="underline decoration-ink-soft underline-offset-4 hover:decoration-stamp">
          Open your room
        </Link>{' '}
        — it takes one transaction.
      </p>

      <footer className="mt-8 border-t border-edge pt-3 font-mono text-[11px] text-ink-soft">
        Monad Testnet · contract{' '}
        <a href={addressUrl(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
          {CONTRACT_ADDRESS}
        </a>
      </footer>
    </main>
  )
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-edge py-2.5">
      <span className="w-24 shrink-0 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">{k}</span>
      <span className="leader" />
      <span className="max-w-md text-right text-[15px]">{v}</span>
    </div>
  )
}
