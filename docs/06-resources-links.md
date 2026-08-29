# Ссылки: Blitz resources + индекс документации Monad

Источники: https://blitz.devnads.com/resources , https://docs.monad.xyz/llms.txt

## Blitz (Devnads) — «что открыть перед стартом»

| | Ссылка |
|---|---|
| Blitz resources | https://blitz.devnads.com/resources |
| Blitz apps directory / showcase | https://blitz.devnads.com/testnet-directory , https://blitz.devnads.com/showcase |
| Полный список ресурсов (Notion) | https://monad-foundation.notion.site/Resources-3486367594f281baab46d498de3a9515 |
| Monskills (skills для агентов, наш `.claude/skills/monad-development` оттуда) | https://skills.devnads.com/ |
| **Agent APIs: faucet + verify** | `https://agents.devnads.com/v1/faucet` , `https://agents.devnads.com/v1/verify` |
| Discord dev | https://discord.gg/monaddev |
| X | https://x.com/monad_dev |
| Хакатон-программа evm/accathon | https://hackathon.monad.xyz/ |
| Другие программы | DeltaV https://deltav.monad.xyz , Momentum https://momentum.monad.xyz , Madness https://madness.monad.xyz , Mach https://mach.monad.xyz |

### Blitz essentials (страницы docs)
- Testnet info: https://docs.monad.xyz/developer-essentials/testnets
- Mainnet info: https://docs.monad.xyz/developer-essentials/network-information
- Add to wallet: https://docs.monad.xyz/guides/add-monad-to-wallet/
- Deploy (Foundry): https://docs.monad.xyz/guides/deploy-smart-contract/foundry
- Verify: https://docs.monad.xyz/guides/verify-smart-contract/
- Tokens & bridges: https://docs.monad.xyz/developer-essentials/network-information/tokens-and-bridges
- Differences vs Ethereum: https://docs.monad.xyz/developer-essentials/differences
- Tooling & infra: https://docs.monad.xyz/tooling-and-infra/
- Indexers: https://docs.monad.xyz/guides/indexers/
- x402: https://docs.monad.xyz/guides/x402-guide
- ERC-8004 agents: https://docs.monad.xyz/guides/erc-8004-guide
- Kuru Flow swaps: https://docs.monad.xyz/guides/kuru-flow
- Blinks: https://docs.monad.xyz/guides/blinks-guide
- Architecture: https://docs.monad.xyz/monad-arch/

### Templates
- Farcaster Mini App: https://docs.monad.xyz/templates/farcaster-miniapp/
- React Native + Privy: https://docs.monad.xyz/templates/react-native-privy-embedded-wallet
- Next.js PWA + Privy: https://docs.monad.xyz/templates/next-serwist-privy-embedded-wallet → https://github.com/monad-developers/next-serwist-privy-embedded-wallet
- Next.js PWA + Privy smart wallet (sponsored tx): https://docs.monad.xyz/templates/next-serwist-privy-smart-wallet
- RN + Privy + Pimlico sponsored: https://docs.monad.xyz/templates/react-native-privy-pimlico-sponsored-transactions
- Next.js + 0x + Privy: https://docs.monad.xyz/templates/next-serwist-0x-privy-embedded-wallet
- Next.js + thirdweb: https://docs.monad.xyz/templates/next-serwist-thirdweb
- Foundry template: https://github.com/monad-developers/foundry-monad
- Scaffold-ETH (Foundry): https://github.com/monad-developers/scaffold-monad-foundry (`yarn deploy --network monadTestnet`)

### Account abstraction
- EIP-7702: https://docs.monad.xyz/developer-essentials/eip-7702
- Reserve balance: https://docs.monad.xyz/developer-essentials/reserve-balance

### Community (из Blitz)
- Puddleswap: https://app.puddleswap.org/
- Nad.fun token launch (OpenClaw): https://destiny-alloy-6d2.notion.site/How-to-launch-a-token-on-Nad-fun-using-OpenClaw-2fc33a257d9b81c691affe628cc6ce6f
- OpenClaw AWS: https://www.notion.so/2fb33a257d9b812d9fe9e804c99d1130
- Moltbook: https://www.moltbook.com/skill.md

## Официальные Monad
- Сайт https://www.monad.xyz/ · Ecosystem https://app.monad.xyz/ · Blog https://blog.monad.xyz/ · Forum https://forum.monad.xyz/
- Infra directory https://www.monad.xyz/infra · Brand kit https://www.monad.xyz/brand-and-media-kit
- Explorers: https://monadvision.com · https://monadscan.com · https://gmonads.com
- GitHub: https://github.com/category-labs/monad-bft , https://github.com/category-labs/monad , https://github.com/monad-crypto/protocols , https://github.com/monad-crypto/token-list
- Категория Labs gas-limit analysis: https://www.category.xyz/blogs/setting-your-gas-limit-on-monad

## Индекс docs.monad.xyz (полезное для нас; полный — llms.txt)

**Developer essentials**
- https://docs.monad.xyz/developer-essentials/summary — Deployment summary
- https://docs.monad.xyz/developer-essentials/transactions
- https://docs.monad.xyz/developer-essentials/wallet-developers — tx lifecycle, gas margin рецепты
- https://docs.monad.xyz/developer-essentials/gas-pricing
- https://docs.monad.xyz/developer-essentials/opcode-pricing
- https://docs.monad.xyz/developer-essentials/precompiles
- https://docs.monad.xyz/developer-essentials/historical-data
- https://docs.monad.xyz/developer-essentials/best-practices

**Reference**
- https://docs.monad.xyz/reference/json-rpc/overview
- https://docs.monad.xyz/reference/json-rpc/api
- https://docs.monad.xyz/reference/rpc-differences — block tags, лимиты, websocket
- https://docs.monad.xyz/reference/json-rpc/playground

**Tooling**
- https://docs.monad.xyz/tooling-and-infra/rpc-providers — 16 провайдеров (Alchemy, Ankr, QuickNode, dRPC, Envio, thirdweb, …)
- https://docs.monad.xyz/tooling-and-infra/toolkits/foundry · /hardhat · /monad-solonet
- https://docs.monad.xyz/tooling-and-infra/wallet-infra/embedded-wallets
- https://docs.monad.xyz/tooling-and-infra/wallet-infra/account-abstraction
- https://docs.monad.xyz/tooling-and-infra/indexers/indexing-frameworks
- https://docs.monad.xyz/tooling-and-infra/block-explorers
- https://docs.monad.xyz/tooling-and-infra/agentic-payments

**Guides**
- https://docs.monad.xyz/guides/deploy-smart-contract/{foundry,hardhat,remix}
- https://docs.monad.xyz/guides/verify-smart-contract/{foundry,hardhat}
- https://docs.monad.xyz/guides/indexers/{ghost,tg-bot-using-envio,token-snapshot-hypersync,quicknode-streams}
- https://docs.monad.xyz/guides/reown — wallet connect через Reown AppKit
- https://docs.monad.xyz/guides/scaffold-eth
- https://docs.monad.xyz/guides/mera — passkey accounts
- https://docs.monad.xyz/guides/monad-mcp — MCP-сервер для testnet
- https://docs.monad.xyz/guides/x402 · /erc-8004 · /erc-6551 · /clear-signing · /moralis-api · /kuru-flow · /deeplinks-using-expo
- https://docs.monad.xyz/guides/execution-events/ — realtime SDK (нужна своя нода)

**Architecture (для питча)**
- https://docs.monad.xyz/monad-arch/consensus/monad-bft · /raptorcast · /asynchronous-execution · /block-states · /local-mempool
- https://docs.monad.xyz/monad-arch/execution/parallel-execution · /monaddb · /native-compilation
- https://docs.monad.xyz/monad-arch/realtime-data/data-sources · /spec-realtime

**Прочее**: https://docs.monad.xyz/faq · https://docs.monad.xyz/official-links
