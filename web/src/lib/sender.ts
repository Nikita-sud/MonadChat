/**
 * Serial send queue with a gap between transactions.
 *
 * Why it exists: Monad enforces a reserve balance of 10 MON. An account holding
 * less than that lands only one spending transaction every k=3 blocks — the rest
 * REVERT while still paying gas. Measured on testnet: of five sent back to back,
 * one succeeded and four burned gas for nothing.
 *
 * So messages queue instead of racing. A human typing never notices the delay,
 * and no message is ever lost.
 */
const MIN_GAP_MS = 1700 // 4 blocks at ~400 ms

let tail: Promise<unknown> = Promise.resolve()
let lastFinishedAt = 0

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function queueGapMs(): number {
  return Math.max(0, lastFinishedAt + MIN_GAP_MS - Date.now())
}

export function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(async () => {
    const wait = queueGapMs()
    if (wait > 0) await sleep(wait)
    try {
      return await task()
    } finally {
      lastFinishedAt = Date.now()
    }
  })
  tail = run.catch(() => undefined)
  return run as Promise<T>
}

/**
 * Local nonce tracking.
 *
 * viem's writeContract asks the RPC for the nonce, the fees and the chain id on
 * every call — three extra round trips that added ~1.5 s before the transaction
 * was even broadcast. Sends are serialised by the queue above, so we can hold
 * the nonce ourselves and only ask the network once.
 */
let nextNonce: number | null = null
let nonceOwner: string | null = null

export async function takeNonce(
  fetchNonce: () => Promise<number>,
  address: string,
): Promise<number> {
  if (nextNonce === null || nonceOwner !== address) {
    nextNonce = await fetchNonce()
    nonceOwner = address
  }
  return nextNonce++
}

/** Call after a failed send: the chain may not have consumed our nonce. */
export function resetNonce() {
  nextNonce = null
  nonceOwner = null
}
