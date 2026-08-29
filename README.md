# MonadChat

Pay-per-message chat for streamers on Monad. Зритель платит MON за каждое сообщение, стример получает деньги мгновенно, чат и OBS-оверлей обновляются в реальном времени по WebSocket.

## Docs (читать в этом порядке)

| Файл | Что внутри |
|---|---|
| [docs/00-MVP-PLAN.md](docs/00-MVP-PLAN.md) | План на 5 часов, стек, архитектура, сценарий демо, гочи |
| [docs/01-monad-network.md](docs/01-monad-network.md) | Chain ID, RPC/WS, explorers, faucet (API), канонические адреса |
| [docs/02-monad-vs-ethereum.md](docs/02-monad-vs-ethereum.md) | Газ по gas_limit, Reserve Balance 10 MON, block tags, лимиты RPC, WebSocket |
| [docs/03-foundry-deploy-verify.md](docs/03-foundry-deploy-verify.md) | Установка Foundry, foundry.toml, деплой, верификация |
| [docs/04-frontend-realtime.md](docs/04-frontend-realtime.md) | wagmi/viem config, connect, sendMessage, live-события, оверлей |
| [docs/05-contract-design.md](docs/05-contract-design.md) | StreamChat.sol + тесты + экономика |
| [docs/06-resources-links.md](docs/06-resources-links.md) | Все ссылки Blitz + индекс docs.monad.xyz |
| [docs/07-extras-x402-indexers-aa.md](docs/07-extras-x402-indexers-aa.md) | x402, индексеры, AA/EIP-7702, real-time SDK |
| [docs/08-deploy-hosting-and-demo.md](docs/08-deploy-hosting-and-demo.md) | **Vercel пошагово (домен не нужен)**, интеграция с Twitch/YouTube/Kick, сценарии демо |

## Quick facts

- Monad Testnet: chainId **10143**, RPC `https://testnet-rpc.monad.xyz`, WS `wss://testnet-rpc.monad.xyz`, explorer https://testnet.monadvision.com
- Faucet: `curl -X POST https://agents.devnads.com/v1/faucet -H 'Content-Type: application/json' -d '{"chainId":10143,"address":"0x..."}'`
- Foundry ≥ 1.8 с `network = "monad"`; фронт — `import { monadTestnet } from "viem/chains"`
