import { isAddress } from 'viem'
import Link from 'next/link'
import { RoomView } from '@/components/RoomView'

export default async function RoomPage({ params }: PageProps<'/r/[streamer]'>) {
  const { streamer } = await params

  if (!isAddress(streamer)) {
    return (
      <main className="flex h-screen flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-lg font-semibold">That is not a wallet address</h1>
        <p className="max-w-md text-sm text-muted">
          A room lives at the streamer&apos;s address: <code className="text-mon-soft">/r/0x…</code>
        </p>
        <Link href="/" className="text-sm text-mon-soft hover:underline">
          back home
        </Link>
      </main>
    )
  }

  return <RoomView streamer={streamer} />
}
