'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Address } from 'viem'
import { CONTRACT_ADDRESS, STREAM_CHAT_ABI, publicClient } from './chain'

export type Room = { price: bigint; streamUrl: string; earned: bigint }

/** Читает комнату стримера: цену за сообщение, где он стримит и сколько заработал. */
export function useRoom(streamer: Address | undefined, pollMs = 10_000) {
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!streamer) return
    try {
      const [info, earned] = await Promise.all([
        publicClient.readContract({
          address: CONTRACT_ADDRESS, abi: STREAM_CHAT_ABI, functionName: 'rooms', args: [streamer],
        }),
        publicClient.readContract({
          address: CONTRACT_ADDRESS, abi: STREAM_CHAT_ABI, functionName: 'earned', args: [streamer],
        }),
      ])
      const [price, streamUrl] = info as unknown as [bigint, string]
      setRoom({ price, streamUrl, earned: earned as bigint })
    } catch (e) {
      console.error('useRoom', e)
    } finally {
      setLoading(false)
    }
  }, [streamer])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, pollMs)
    return () => clearInterval(t)
  }, [refresh, pollMs])

  return { room, loading, refresh }
}

/** "twitch:xqc" | "youtube:VIDEO_ID" | "kick:channel" → URL для iframe */
export function embedUrl(streamUrl: string, host: string): string | null {
  const [kind, ...rest] = streamUrl.split(':')
  const id = rest.join(':').trim()
  if (!id) return null
  const parent = host.split(':')[0]
  if (kind === 'twitch') return `https://player.twitch.tv/?channel=${encodeURIComponent(id)}&parent=${parent}&muted=true`
  if (kind === 'youtube') return `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&mute=1`
  if (kind === 'kick') return `https://player.kick.com/${encodeURIComponent(id)}`
  return null
}
