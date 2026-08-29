'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { isAddress } from 'viem'
import { CONTRACT_ADDRESS, addressUrl } from '@/lib/chain'

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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
      <div className="text-sm font-bold tracking-tight">
        <span className="text-mon">◆</span> MonadChat
      </div>

      <h1 className="mt-8 text-4xl font-bold leading-tight sm:text-5xl">
        Chat where<br />words cost money
      </h1>

      <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
        Every message in a stream chat is a Monad transaction. To speak you have to pay, and the
        money lands in the streamer&apos;s wallet immediately — no platform in between. Spam gets
        expensive, attention gets honestly paid for.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Fact title="0.5 seconds" body="from hitting send to confirmation on chain" />
        <Fact title="No wallet needed" body="the app creates one in your browser, no extensions" />
        <Fact title="Consensus anti-spam" body="Monad itself rate-limits posting, not our server" />
      </div>

      <form onSubmit={go} className="mt-10">
        <label className="block text-sm font-medium">Join a streamer&apos;s room</label>
        <div className="mt-2 flex gap-2">
          <input
            value={addr}
            onChange={(e) => { setAddr(e.target.value); setError(null) }}
            placeholder="0x… streamer address"
            className="min-w-0 flex-1 rounded-md border border-edge bg-panel px-3 py-2.5 font-mono text-sm outline-none placeholder:font-sans placeholder:text-muted focus:border-mon"
          />
          <button className="shrink-0 rounded-md bg-mon px-5 py-2.5 text-sm font-semibold text-white hover:bg-mon-soft">
            Join
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </form>

      <p className="mt-6 text-sm text-muted">
        Streaming?{' '}
        <Link href="/dashboard" className="font-medium text-mon-soft hover:underline">
          Open your room
        </Link>{' '}
        — it takes one transaction.
      </p>

      <footer className="mt-16 border-t border-edge pt-5 text-xs text-muted">
        Monad Testnet · contract{' '}
        <a
          href={addressUrl(CONTRACT_ADDRESS)}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-mon-soft hover:underline"
        >
          {CONTRACT_ADDRESS}
        </a>
      </footer>
    </main>
  )
}

function Fact({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-edge bg-panel p-4">
      <div className="text-sm font-bold text-mon-soft">{title}</div>
      <div className="mt-1 text-xs leading-relaxed text-muted">{body}</div>
    </div>
  )
}
