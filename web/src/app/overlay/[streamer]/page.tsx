import { isAddress } from 'viem'
import { Overlay } from '@/components/Overlay'

export const metadata = { title: 'Оверлей — MonadChat' }

export default async function OverlayPage({ params }: PageProps<'/overlay/[streamer]'>) {
  const { streamer } = await params
  if (!isAddress(streamer)) {
    return <p className="p-6 text-sm text-red-400">Некорректный адрес стримера</p>
  }
  return <Overlay streamer={streamer} />
}
