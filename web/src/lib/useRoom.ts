'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Address } from 'viem'
import { CONTRACT_ADDRESS, STREAM_CHAT_ABI, publicClient } from './chain'

export type Room = { price: bigint; streamUrl: string; earned: bigint }

/** Reads a streamer's room: price per message, where they stream, lifetime earnings. */
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

  // Until the first successful read we retry quickly: a single throttled RPC
  // call must not leave the room stuck on "loading" for ten seconds.
  const loaded = room !== null
  useEffect(() => {
    refresh()
    const t = setInterval(refresh, loaded ? pollMs : 2000)
    return () => clearInterval(t)
  }, [refresh, pollMs, loaded])

  return { room, loading, refresh }
}

/**
 * People paste full links, not channel names. Accepts anything —
 * "lofigirl", "twitch.tv/lofigirl", "https://youtube.com/watch?v=ID",
 * "youtu.be/ID", "kick.com/channel" — and boils it down to the bare id.
 */
export function normalizeChannelInput(kind: string, raw: string): string {
  const v = raw.trim().replace(/^@/, '')
  if (!v) return ''
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`)
    const host = u.hostname.replace(/^www\./i, '').toLowerCase()
    const parts = u.pathname.split('/').filter(Boolean)
    if (host.endsWith('twitch.tv')) return parts[0] ?? ''
    if (host === 'youtu.be') return parts[0] ?? ''
    if (host.endsWith('youtube.com')) {
      const vid = u.searchParams.get('v')
      if (vid) return vid
      if (['live', 'embed', 'shorts'].includes(parts[0]) && parts[1]) return parts[1]
      return parts[0] ?? ''
    }
    if (host.endsWith('kick.com')) return parts[0] ?? ''
  } catch {
    /* not a URL — treat as a bare name */
  }
  return v
}

/** On-chain "kind:whatever the streamer typed" → human label "kind:bare-id". */
export function displaySource(streamUrl: string): string {
  const [kind, ...rest] = streamUrl.split(':')
  const id = normalizeChannelInput(kind, rest.join(':'))
  return id ? `${kind}:${id}` : streamUrl
}

/** "twitch:xqc" | "youtube:VIDEO_ID" | "kick:channel" → iframe URL.
 *  Normalizes the id first, so rooms saved with a full pasted link still play. */
export function embedUrl(streamUrl: string, host: string): string | null {
  const [kind, ...rest] = streamUrl.split(':')
  const id = normalizeChannelInput(kind, rest.join(':'))
  if (!id) return null
  const parent = host.split(':')[0]
  if (kind === 'twitch') return `https://player.twitch.tv/?channel=${encodeURIComponent(id)}&parent=${parent}&muted=true`
  if (kind === 'youtube') return `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&mute=1`
  if (kind === 'kick') return `https://player.kick.com/${encodeURIComponent(id)}`
  return null
}
