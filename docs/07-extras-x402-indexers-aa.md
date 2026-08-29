# Extras: x402, индексеры, Account Abstraction, real-time SDK

Не нужно для MVP, но полезно для питча «что дальше» и на случай, если что-то из основного плана не взлетит.

## x402 — HTTP 402 микроплатежи (USDC)

Источник: https://docs.monad.xyz/guides/x402

- Клиент запрашивает ресурс → сервер отвечает `402 Payment Required` с требованиями → клиент подписывает EIP-3009 `transferWithAuthorization` (USDC) → facilitator верифицирует и селлит on-chain, покрывая газ → сервер отдаёт контент.
- **Facilitator (Monad):** `https://x402-facilitator.molandak.org` — endpoints `GET /supported`, `POST /verify`, `POST /settle`. Схемы `v2-eip155-exact` (фикс. цена) и `v2-eip155-upto` (метеринг).
- USDC: testnet `0x534b2f3A21130d7a60830c2Df862319e593943A3` (`eip155:10143`), mainnet `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` (`eip155:143`).
- Пакеты: `npm i @x402/core @x402/evm @x402/fetch @x402/next` (`@x402/evm >= 2.22.0`).
- Сервер (Next.js route): `withX402(handler, { accepts: { scheme: "exact", network: "eip155:10143", payTo, price: "$0.001" }, resource }, server)` где `server = new x402ResourceServer(new HTTPFacilitatorClient({ url }))` + `ExactEvmScheme` с `registerMoneyParser` (USDC 6 decimals, `extra: { name: "USDC", version: "2" }`).
- Клиент: `wrapFetchWithPayment(fetch, new x402Client().register("eip155:10143", new ExactEvmScheme(signer)))`, где `signer.signTypedData` → `walletClient.signTypedData`.
- Где это применимо в нашем продукте: «платный доступ к приватному чату/архиву» или API для агентов, которые пишут в чат. Для самого чата — не подходит: там нужен on-chain event, а не HTTP-пейволл.

## Индексеры (если понадобится история > 100 блоков)

Источник: /developer-essentials/best-practices , /guides/indexers

| Индексер | Как подключить Monad |
|---|---|
| **Envio HyperIndex** | `config.yaml`: `networks: - id: 10143` (или 143), контракт + events, `src/EventHandlers.ts` с `Contract.Event.handler(async ({event, context}) => …)`. Есть HyperSync для быстрых выборок и бесплатный RPC с историей 10 000 блоков. |
| **Goldsky** | subgraph network `monad-testnet` / `monad-mainnet`; Mirror pipelines (`pipeline.yaml`, `dataset_name: monad_testnet.erc20_transfers`). |
| **The Graph** | `subgraph.yaml`: `network: monad-testnet`, `apiVersion: 0.0.9`. |
| **GhostGraph** | гайд /guides/indexers/ghost |
| **QuickNode Streams** | `monad-testnet`; webhook / S3 / Postgres. |
| **thirdweb Insight** | REST, chain id 10143/143. |
| **Allium** | SQL Explorer, Kafka/PubSub datastreams. |

Для нашего чата самое простое без индексера: крутить `getLogs` окнами по 100 блоков назад до нужной глубины (300 мс/блок → 100 блоков = 30 с; 1 час = 12 000 блоков = 120 запросов — ок при 50 rps).

## Account Abstraction / gasless для зрителей

- **EIP-7702** поддерживается (tx type 4). viem: `signAuthorization()` + `sendTransaction({ authorizationList })`. Ограничения Monad: делегированный EOA не может опустить баланс < 10 MON; внутри делегированного кода нет `CREATE/CREATE2`; делегация бессрочна.
- **ERC-4337**: EntryPoint v0.6/0.7/0.8 задеплоены (адреса в `01-monad-network.md`). Бандлеры/пеймастеры: Pimlico (есть шаблон с Privy), Alchemy Account Kit, thirdweb, ZeroDev и др. — см. /tooling-and-infra/wallet-infra/account-abstraction.
- Reserve balance для delegated-аккаунтов: sponsored-gas сценарии обычно не задеваются (баланс не уменьшается), но если зритель шлёт `value`, баланс должен остаться ≥ 10 MON.
- Идея для v2: стример спонсирует газ зрителям, зритель платит только цену сообщения.

## Real-time уровни (для питча «почему Monad»)

| Источник | Задержка | Как |
|---|---|---|
| `eth_subscribe` `newHeads`/`logs` | при Proposed (~300 мс) | WS у любого провайдера — **наш выбор** |
| `monadNewHeads`/`monadLogs` | то же + апдейты `commitState` | WS, показать «finalized ✓» |
| Execution Events SDK (C/C++/Rust) | на уровне tx, сразу при получении пропозала, включая call frames и state r/w | Только рядом со своей нодой |

Блок-статусы: Proposed → Voted (~QC) → Finalized (QC², ~800 мс) → Verified (state root согласован, `finalized − execution_delay`).

## Другие гайды, которые могут пригодиться
- **Blinks** (интерактивные ссылки, шаринг «отправь сообщение стримеру» в X/Farcaster): /guides/blinks-guide
- **Farcaster Mini App** (чат внутри Warpcast): /templates/farcaster-miniapp/
- **Kuru Flow** (свап любых токенов в MON внутри приложения): /guides/kuru-flow
- **ERC-8004** (идентичность агентов — «AI-модератор чата с on-chain identity»): /guides/erc-8004
- **Mera** (passkey-кошельки без seed, open-source): /guides/mera
- **Monad MCP** (агент, который пишет в чат): /guides/monad-mcp
