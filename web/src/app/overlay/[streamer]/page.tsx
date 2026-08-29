import { isAddress } from 'viem'
import { Overlay } from '@/components/Overlay'

export const metadata = { title: 'Overlay — MonadChat' }

export default async function OverlayPage({ params }: PageProps<'/overlay/[streamer]'>) {
  const { streamer } = await params
  if (!isAddress(streamer)) {
    return <p className="p-6 text-sm text-red-400">Invalid streamer address</p>
  }
  return <Overlay streamer={streamer} />
}
