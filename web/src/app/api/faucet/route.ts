import { NextResponse } from 'next/server'
import { isAddress } from 'viem'

/**
 * Proxy to the Monad faucet. Called server-side rather than from the browser:
 * the faucet sends no CORS headers for our origins.
 */
export async function POST(req: Request) {
  let address: unknown
  try {
    ;({ address } = await req.json())
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 })
  }

  if (typeof address !== 'string' || !isAddress(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
  }

  try {
    const res = await fetch('https://agents.devnads.com/v1/faucet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chainId: 10143, address }),
    })
    const text = await res.text()
    if (!res.ok) {
      return NextResponse.json({ error: `Faucet responded ${res.status}: ${text.slice(0, 200)}` }, { status: 502 })
    }
    return NextResponse.json(JSON.parse(text))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Faucet unavailable' },
      { status: 502 },
    )
  }
}
