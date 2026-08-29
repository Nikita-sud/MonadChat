import { isAddress } from 'viem'
import Link from 'next/link'
import { RoomView } from '@/components/RoomView'

export default async function RoomPage({ params }: PageProps<'/r/[streamer]'>) {
  const { streamer } = await params

  if (!isAddress(streamer)) {
    return (
      <main className="flex h-screen flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-lg font-semibold">Это не адрес кошелька</h1>
        <p className="max-w-md text-sm text-muted">
          Комната открывается по адресу стримера: <code className="text-mon-soft">/r/0x…</code>
        </p>
        <Link href="/" className="text-sm text-mon-soft hover:underline">
          на главную
        </Link>
      </main>
    )
  }

  return <RoomView streamer={streamer} />
}
