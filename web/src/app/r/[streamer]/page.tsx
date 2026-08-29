import { isAddress } from 'viem'
import Link from 'next/link'
import { RoomView } from '@/components/RoomView'

export default async function RoomPage({ params }: PageProps<'/r/[streamer]'>) {
  const { streamer } = await params

  if (!isAddress(streamer)) {
    return (
      <main className="flex h-screen flex-col items-center justify-center gap-3 text-center">
        <h1 className="font-display text-3xl">That is not a wallet address</h1>
        <p className="max-w-md text-sm text-ink-soft">
          A room lives at the streamer&apos;s address: <code className="font-mono text-stamp">/r/0x…</code>
        </p>
        <Link href="/" className="text-sm underline underline-offset-4 hover:decoration-stamp">
          back home
        </Link>
      </main>
    )
  }

  return <RoomView streamer={streamer} />
}
