# Отличия Monad от Ethereum (что реально влияет на наш код)

Источники: /developer-essentials/differences , /gas-pricing , /reserve-balance , /eip-7702 ,
/reference/rpc-differences , /monad-arch/consensus/block-states , /developer-essentials/wallet-developers

## 1. Газ списывается по gas_limit, а не по gas_used  ⚠️ самое важное

```
gas_paid = gas_limit * price_per_gas          (а не gas_used!)
total_deducted = value + gas_bid * gas_limit
price_per_gas = min(base_fee + priority_fee, max_fee)
```

- Это DoS-защита для асинхронного исполнения. **Refund за неиспользованный газ нет.**
- Следствие: не ставить лимит «с запасом» — переплата реальная. Рекомендация Category Labs: `eth_estimateGas` + **7.5 %** буфера.
- Для фиксированных операций хардкодить: перевод MON = ровно 21 000.
- В wagmi: `writeContract({ ..., gas: estimated * 10750n / 10000n })` или просто доверить `estimateGas` (viem сам не раздувает).

```ts
// margin в basis points, чтобы без float
const applyGasLimitMargin = (estimated: bigint) => (estimated * 10_750n + 9_999n) / 10_000n
```

- Min base fee **100 gwei**. Base fee controller растёт медленно, падает быстро (target 160M = 80 % блока). Priority fee — обычный аукцион (упорядочивание по убыванию total gas price).
- `eth_maxPriorityFeePerGas` → всегда **2 gwei** (заглушка). `eth_feeHistory` дублирует последний `baseFeePerGas` для `latest`.

## 2. Reserve Balance (10 MON)  ⚠️ влияет на демо

Механизм, который гарантирует оплату всех tx в блоке при асинхронном исполнении.

- **Reserve = 10 MON** на EOA. **k = 3 блока** (~1.2 с) — окно «inflight».
- **Consensus:** бюджет аккаунта = `min(10 MON, balance)`; сумма `gas_price × gas_limit` всех inflight-транзакций не может превысить бюджет → иначе tx **не включается** (код 0).
- **Execution:** tx **ревертится** (код 1), если конечный баланс (до refund) опустился ниже 10 MON, **кроме «emptying transaction»**:
  - отправитель не делегирован (EIP-7702),
  - от него **не было других tx в предыдущих k блоках**,
  - нет pending делегаций.
  Такая tx может потратить весь баланс. То есть аккаунт с < 10 MON может делать **1 tx на ~1.2 с**.
- Практика для нас: тестовые кошельки после крана имеют 1–5 MON < 10 → **не отправлять два сообщения подряд из одного кошелька быстрее ~1.5 с**. Ждать receipt перед следующей отправкой (UI: disable кнопку до receipt).
- Если аккаунт только что получил MON и хочет тратить — ждать, пока блок с receipt получения станет ≥ k блоков назад.
- Ревертнутые tx всё равно платят газ и попадают в чейн (как и в Ethereum).
- Precompile `0x1001` → `dippedIntoReserve()` (selector `0x3a61584e`, 100 gas, только `CALL`, не `STATICCALL`) — в контракте можно детектить, нам не нужно.

## 3. Состояния блока и теги RPC

| Tag | Monad state | Смысл |
|---|---|---|
| `latest` (= `pending`) | **Proposed** | Спекулятивно исполнён, голосования ещё нет. Самый быстрый. Может (очень редко) измениться. Для UI чата — ок. |
| `safe` | **Voted** | QC от супербольшинства; откат практически невозможен |
| `finalized` | **Finalized** | QC²; необратимо без хардфорка. Для зачисления денег/бриджей. |
| — | Verified | Finalized + согласован state root (`finalized − execution_delay`) |

Данные из нефинализированных блоков — provisional: `eth_getTransactionReceipt` может изменить `blockNumber`/logIndex или даже вернуть `null` при повторном запросе. Для демо не критично; для «заработано всего» можно фильтровать по `finalized`.

Полезный паттерн ожидания:
```ts
// receipt = исполнено локально; finalized = receipt.blockNumber <= block("finalized").number
const receipt = await publicClient.waitForTransactionReceipt({ hash })
```
Есть также `eth_sendRawTransactionSync` — отправить и дождаться receipt одним вызовом (если RPC поддерживает).

## 4. Транзакции / мемпул

- Типы tx: 0, 1, 2 (EIP-1559), 4 (EIP-7702). **Type 3 (blob) не поддерживается.**
- **Нет глобального мемпула.** tx форвардится следующим нескольким лидерам. `eth_getTransactionByHash` возвращает `null`, пока tx не включена. `newPendingTransactions` и `syncing` подписки — нет. `txpool_content` — не использовать; есть `txpool_statusByAddress` / `txpool_statusByHash`.
- `eth_sendRawTransaction` = «принято этим RPC-узлом», проверка nonce/balance отложенная. Успех ≠ включение.
- Много tx с одного кошелька: вести nonce локально и слать конкурентно (`Promise.all`), а не последовательно.
- Chain ID обязателен (кроме pre-EIP-155 для спец-деплоев).

## 5. Лимиты RPC

| Метод | Лимит |
|---|---|
| `eth_getLogs` | **100 блоков** на запрос (QuickNode `rpc.monad.xyz`, MF), 1000 блоков / 10 000 логов (Alchemy), 1000 (Ankr). Ошибка `-32602 Invalid block range`. |
| `eth_call` / `eth_estimateGas` | 200M gas (QuickNode/Alchemy/MF), 1B (Ankr). Два пула: ≤ 8.1M gas — быстрый; > 8.1M — ограниченная конкурентность. |
| `debug_trace*` | параметр tracer-options **обязателен**, дефолт `callTracer`, struct-logs нет. |
| Историческое состояние | Full-node не хранит произвольное старое state → `eth_call` на старом блоке может упасть. Нужен archive-RPC. |

Почему 100 блоков: блок каждые 300 мс × до 5000 tx — 100 блоков ≈ 30 секунд, это уже много данных.

## 6. WebSocket подписки (наш реалтайм)

`eth_subscribe` по `wss://testnet-rpc.monad.xyz`:

| Тип | Когда срабатывает |
|---|---|
| `newHeads` | блок Proposed + спекулятивно исполнён |
| `logs` | логи по фильтру, при Proposed |
| `monadNewHeads` | то же + последующие апдейты `commitState` |
| `monadLogs` | то же для логов + `commitState` |

`monad*` варианты добавляют поля `blockId` (уникальный id пропозала — на одну высоту их может быть несколько) и `commitState` ∈ {Proposed, Voted, Finalized, Verified}. Один блок присылает несколько апдейтов; может перескочить Voted → Finalized. Отменённый блок явного события не шлёт — просто финализируется другой на той же высоте.

Для чата достаточно стандартного `logs` (viem `watchContractEvent` с `webSocket()` транспортом). Дедуп по `txHash + logIndex`.

## 7. EVM

- Контракт до **128 KB** (initcode 256 KB) — можно не думать об оптимизации размера.
- Память линейная, ≤ 8 MB на tx. Часть опкодов/прекомпилов repriced (см. /developer-essentials/opcode-pricing). MonadTen/MIP-8: page-based storage gas accounting.
- Прекомпил P256 (secp256r1) на `0x0100` (EIP-7951) — passkeys on-chain.
- EIP-7702: делегированный EOA не может опустить баланс < 10 MON (revert), внутри делегированного кода запрещены `CREATE`/`CREATE2`. Делегация бессрочна до явного сброса (tx type 4 на нулевой адрес).

## 8. Foundry

Foundry **≥ 1.8.0** с `network = "monad"` в `foundry.toml` → локальные forge/anvil/cast используют газ-модель Monad, лимиты и прекомпилы. Hardfork по умолчанию `MonadTen` (`hardfork = "monad:MonadNine"` для старого). `anvil --network monad` или `anvil --fork-url https://testnet-rpc.monad.xyz`.

## Чеклист «что менять в привычном EVM-коде»

- [ ] gas limit: estimate × 1.075, не ×2–3
- [ ] не полагаться на pending/мемпул; ждать receipt
- [ ] одна tx на аккаунт за ~1.2 с, если баланс < 10 MON
- [ ] `getLogs` окнами ≤ 100 блоков
- [ ] WS `logs` для live-данных вместо поллинга
- [ ] `latest` — спекулятивный; для денег — `finalized`
- [ ] `evm_version`/`network = "monad"` в Foundry ≥ 1.8
