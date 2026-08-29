/**
 * Последовательная очередь отправки с паузой между транзакциями.
 *
 * Почему она нужна: на Monad действует reserve balance = 10 MON. У аккаунта с
 * балансом меньше 10 MON проходит только одна тратящая транзакция раз в k=3
 * блока — остальные РЕВЕРЗЯТСЯ, при этом всё равно платя газ. Проверено на
 * тестнете: из пяти отправленных подряд прошла одна, четыре сгорели впустую.
 *
 * Поэтому сообщения не летят параллельно, а ждут своей очереди. Для человека,
 * который печатает, это незаметно, зато ни одно сообщение не пропадает.
 */
const MIN_GAP_MS = 1700 // 4 блока по ~400 мс

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
