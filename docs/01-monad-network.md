# Monad — сеть, RPC, адреса, кран

Источник: https://docs.monad.xyz/developer-essentials/testnet , /network-information , /guides/add-monad-to-wallet/testnet

## Testnet (используем для MVP)

| Параметр | Значение |
|---|---|
| Network Name | Monad Testnet |
| Chain ID | **10143** (hex `0x279F`) |
| Currency | MON (18 decimals) |
| Версия клиента | v0.15.2 / MONAD_NINE (Foundry по умолчанию эмулирует MonadTen) |
| Explorer (MonadVision) | https://testnet.monadvision.com |
| Explorer (Monadscan) | https://testnet.monadscan.com |
| Explorer (Socialscan) | https://monad-testnet.socialscan.io |
| App hub | https://testnet.monad.xyz |
| **Faucet (официальный)** | https://faucet.monad.xyz |
| **Faucet (API для агентов, без браузера)** | `POST https://agents.devnads.com/v1/faucet` — см. ниже |
| Визуализация сети | https://www.gmonads.com/?network=testnet |

> Testnet был сброшен с генезиса **2025-12-16**. Всё, что задеплоено раньше, не существует.

### Public RPC (testnet)

| URL | Провайдер | Лимиты | Batch | Archive | Заметки |
|---|---|---|---|---|---|
| `https://testnet-rpc.monad.xyz` / `wss://testnet-rpc.monad.xyz` | QuickNode | 50 rps (25 rps на `eth_call`/`eth_estimateGas`) | 100 | ✅ | **основной**, есть WebSocket |
| `https://rpc.ankr.com/monad_testnet` | Ankr | 300 req/10s, 12000/10min | 100 | ❌ | `debug_*` отключены |
| `https://rpc-testnet.monadinfra.com` / `wss://rpc-testnet.monadinfra.com` | Monad Foundation | 20 rps | нет | ✅ | запасной WS |

Лимит `eth_getLogs`: **100 блоков** на запрос (QuickNode / MF), 1000 блоков (Ankr, Alchemy).

### Кран через API (быстро, без браузера)

```bash
curl -X POST https://agents.devnads.com/v1/faucet \
  -H "Content-Type: application/json" \
  -d '{"chainId": 10143, "address": "0xYOUR_ADDRESS"}'
# → {"txHash":"0x...","amount":"1000000000000000000","chain":"Monad Testnet"}   (1 MON)
```
Если API не отдаёт — https://faucet.monad.xyz вручную. Нужно пополнить **и деплоера, и 1–2 «зрительских» кошелька** для демо.

### Канонические контракты (testnet)

| Контракт | Адрес |
|---|---|
| Wrapped MON (WMON) | `0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| CreateX | `0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed` |
| Foundry Deterministic Deployer | `0x4e59b44847b379578588920ca78fbf26c0b4956c` |
| Permit2 | `0x000000000022d473030f116ddee9f6b43ac78ba3` |
| EntryPoint v0.6 / v0.7 / v0.8 | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` / `0x0000000071727De22E5E9d8BAf0edAc6f37da032` / `0x4337084d9e255fF0702461CF8895cE9E3b5Ff108` |
| ERC-6492 UniversalSigValidator | `0xdAcD51A54883eb67D95FAEb2BBfdC4a9a6BD2a3B` |
| SafeSingletonFactory | `0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7` |
| x402 ExactPermit2Proxy | `0x402085c248EeA27D92E8b30b2C58ed07f9E20001` |
| x402 UptoPermit2Proxy | `0x4020A4f3b7b90ccA423B9fabCc0CE57C6C240002` |
| USDC (testnet, x402) | `0x534b2f3A21130d7a60830c2Df862319e593943A3` |
| Safe v1.4.1 Safe / SafeL2 / ProxyFactory | `0x41675C099F32341bf84BFc5382aF534df5C7461a` / `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762` / `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67` |

Список токенов testnet: `tokenlist-testnet.json` в https://github.com/monad-crypto/token-list

---

## Mainnet (на будущее, для MVP не нужен)

| Параметр | Значение |
|---|---|
| Chain ID | **143** |
| Currency | MON |
| Explorers | https://monadvision.com , https://monadscan.com , https://monad.socialscan.io |
| UserOps explorer | https://jiffyscan.xyz/?network=monad |
| Mainnet launch | 24 ноября 2025 |

| RPC | Провайдер | Лимит | Batch | Заметки |
|---|---|---|---|---|
| `https://rpc.monad.xyz` / `wss://rpc.monad.xyz` | QuickNode | 25 rps | 100 | |
| `https://rpc1.monad.xyz` / `wss://rpc1.monad.xyz` | Alchemy | 15 rps | 100 | `debug_`/`trace_` off |
| `https://rpc2.monad.xyz` / `wss://rpc2.monad.xyz` | Goldsky Edge | 300/10s | 10 | исторический state |
| `https://rpc3.monad.xyz` / `wss://rpc3.monad.xyz` | Ankr | 300/10s | 10 | `debug_` off |
| `https://rpc-mainnet.monadinfra.com` / `wss://...` | Monad Foundation | 20 rps | 1 | исторический state |

Mainnet адреса: WMON `0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A`, Multicall3 `0xcA11bde05977b3631167028862bE2a173976CA11`, Create2Deployer `0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2`, Permit2 `0x000000000022d473030f116ddee9f6b43ac78ba3`, Safe `0x69f4D1788e39c87893C980c06EdF4b7f686e2938`, USDC `0x754704Bc059F8C67012fEd69BC8A327a5aafb603`.
Полные списки: https://github.com/monad-crypto/protocols , https://github.com/monad-crypto/token-list

---

## Добавить Monad Testnet в MetaMask

Вручную: Settings → Networks → Add: Name `Monad Testnet`, RPC `https://testnet-rpc.monad.xyz`, Chain ID `10143`, Symbol `MON`, Explorer `https://testnet.monadvision.com`.

Программно (EIP-3085) — wagmi делает это сам через `switchChain`, но если нужно вручную:

```ts
await window.ethereum.request({
  method: "wallet_addEthereumChain",
  params: [{
    chainId: "0x279F",
    chainName: "Monad Testnet",
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: ["https://testnet-rpc.monad.xyz"],
    blockExplorerUrls: ["https://testnet.monadvision.com"],
  }],
});
```

В viem/wagmi сеть уже есть: `import { monadTestnet } from "viem/chains"` (id 10143). **Не описывать chain вручную.**

---

## Ключевые цифры производительности

- ~10 000 TPS, блок каждые **300–400 мс**, финальность **~800 мс**
- Block gas limit **200M**, tx gas limit **30M**, до 5000 tx в блоке
- Min base fee **100 gwei** (100 × 10⁻⁹ MON); priority fee по умолчанию 2 gwei
- Contract size limit **128 KB** (initcode 256 KB), память до 8 MB на tx, линейная цена памяти
