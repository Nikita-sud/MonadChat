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
      setError('Это не адрес кошелька — нужен формат 0x…')
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
        Чат, где слово<br />стоит денег
      </h1>

      <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
        Каждое сообщение в чате стрима — транзакция в Monad. Чтобы написать, нужно заплатить,
        и деньги уходят стримеру сразу, без платформы-посредника. Спам становится дорогим,
        а внимание — честно оплаченным.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Fact title="0.5 секунды" body="от нажатия «отправить» до подтверждения в блокчейне" />
        <Fact title="Без кошелька" body="приложение создаёт его само, расширения не нужны" />
        <Fact title="Анти-спам сети" body="ограничение частоты обеспечивает консенсус Monad, а не наш сервер" />
      </div>

      <form onSubmit={go} className="mt-10">
        <label className="block text-sm font-medium">Зайти в комнату стримера</label>
        <div className="mt-2 flex gap-2">
          <input
            value={addr}
            onChange={(e) => { setAddr(e.target.value); setError(null) }}
            placeholder="0x… адрес стримера"
            className="min-w-0 flex-1 rounded-md border border-edge bg-panel px-3 py-2.5 font-mono text-sm outline-none placeholder:font-sans placeholder:text-muted focus:border-mon"
          />
          <button className="shrink-0 rounded-md bg-mon px-5 py-2.5 text-sm font-semibold text-white hover:bg-mon-soft">
            Войти
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </form>

      <p className="mt-6 text-sm text-muted">
        Стример?{' '}
        <Link href="/dashboard" className="font-medium text-mon-soft hover:underline">
          Открой свою комнату
        </Link>{' '}
        — это одна транзакция.
      </p>

      <footer className="mt-16 border-t border-edge pt-5 text-xs text-muted">
        Monad Testnet · контракт{' '}
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
