import { NextResponse } from 'next/server'
import { isAddress } from 'viem'

/**
 * Прокси к крану Monad. Ходим с сервера, а не из браузера:
 * у крана нет CORS-заголовков для наших origin.
 */
export async function POST(req: Request) {
  let address: unknown
  try {
    ;({ address } = await req.json())
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
  }

  if (typeof address !== 'string' || !isAddress(address)) {
    return NextResponse.json({ error: 'Некорректный адрес' }, { status: 400 })
  }

  try {
    const res = await fetch('https://agents.devnads.com/v1/faucet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chainId: 10143, address }),
    })
    const text = await res.text()
    if (!res.ok) {
      return NextResponse.json({ error: `Кран ответил ${res.status}: ${text.slice(0, 200)}` }, { status: 502 })
    }
    return NextResponse.json(JSON.parse(text))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Кран недоступен' },
      { status: 502 },
    )
  }
}
