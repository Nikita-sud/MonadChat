# MonadChat — chat where words cost money

**Superchat without the platform.** Every message in a stream chat is a real Monad
transaction: to speak you pay, and the streamer receives 100% of the price the same
second — no middleman, no payout day.

| | |
|---|---|
| **Live app** | https://monadchat-rvfc1.vercel.app |
| **Demo room** (live lofi stream, real messages) | https://monadchat-rvfc1.vercel.app/r/0xe9e2d6B9d3289B465c4ad761f9771Fabd0Dfe82A |
| **Contract** (verified) | [`0xba3c36b0e9c739669e4f738cef507c72c88b4be8`](https://testnet.monadscan.com/address/0xba3c36b0e9c739669e4f738cef507c72c88b4be8#code) on Monad Testnet (chain 10143) |
| **Pitch deck** | [`MonadChat-pitch.pptx`](MonadChat-pitch.pptx) |

## Why this is only possible on Monad

On older chains the idea dies on arrival: 12+ second confirmations kill the
conversation, ~15–30 TPS for the whole world means one busy stream outruns the
entire chain, and $1–5 of gas eats the word many times over. On Monad:

- **400 ms blocks** → a message lands on chain in **0.5–1.3 s** (measured live, and
  printed as a badge on every message in the UI);
- **near-zero, flat fees** → the rail costs ~0.013 MON per message — a fifth of the
  0.05 MON word price;
- **10k-TPS-class throughput** → an entire platform's chat is normal load;
- **consensus-level rate-limiting** (reserve balance) → built-in spam control, see below.

## How it works

```
Viewer (wallet created by the browser)
   │  sendMessage{value = price}
   ▼
StreamChat.sol ──── 100% of price ───▶ streamer's wallet (push, same tx)
   │
   └─ emit MessageSent(streamer, sender, amount, nickname, text, ts, index)
              │
      ┌───────┴────────┐
      ▼                ▼
  /r/<address>    /overlay/<address>
  viewer chat     OBS overlay (transparent, on the video)
```

There is **no backend, no database, no indexer**. Message text lives in contract
events; the frontend reads history with `eth_getLogs` (100-block windows, batched)
and the live feed over a WebSocket subscription, with a polling safety net and
automatic failover across four public RPCs.

### Viewer flow

1. Open a room link. The app generates a wallet in `localStorage` — no extension,
   no seed phrase.
2. Hit **+1 MON** — the built-in faucet funds the wallet. You are typing within
   ten seconds.
3. Every send is a signed transaction. It appears instantly (optimistic row), then
   confirms with a latency badge like `0.05 · 0.62s` linking to the explorer.

### Session wallet + MetaMask (optional)

MetaMask is a **fuel pump**, not a per-message signer:

- **↑ top up 0.5 MON · MetaMask** — one confirmation moves MON into the session
  wallet; after that every message flies popup-free.
- **↓ return balance** — sends the remaining session balance back to the wallet
  that funded it. No popup needed: the session wallet signs for itself.

MetaMask is discovered via **EIP-6963**, so it works even with several wallet
extensions installed. The Monad Testnet network is added/switched automatically.

### Streamer flow

1. Open `/dashboard`. Your room is keyed to your wallet — the browser one by
   default, or **connect MetaMask** so earnings land in your own wallet.
2. Set a price per word and where you stream (paste any link — Twitch / YouTube /
   Kick URLs are normalized automatically). **Open room** = one transaction.
3. Share `/r/<your address>` with viewers and drop `/overlay/<your address>` into
   OBS as a Browser Source — paid messages appear on the video itself.

### Spam control (three layers)

1. **Words cost money.** Flooding a room pays the streamer per line — an "attack"
   is literally revenue, and the streamer can raise the price at any time.
2. **Consensus rate-limit.** Monad's reserve balance rule lets a wallet holding
   < 10 MON land only **one spending tx per ~1.2 s**; the rest revert *and still
   pay gas*. Verified empirically: 5 txs fired at once → 1 landed, 4 burned.
   Bot farms are throttled by the chain itself, not by our server.
3. **A client-side send queue** spaces transactions so honest users never hit
   rule 2 by accident (synchronized across tabs via `localStorage`).

## Monad-specific engineering

Everything below was measured against the live network — details and raw numbers
in [docs/09-measured-facts.md](docs/09-measured-facts.md):

1. **Gas is charged on `gas_limit`, not usage, with no refund** → estimates ship
   with a 7.5% buffer instead of the usual ×2 (padding would double the viewer's
   cost). Fees are pinned (`maxFee` 300 gwei over a ~100 gwei base) to skip
   per-send fee queries.
2. **Local nonce + local signing** → `eth_sendRawTransaction` with a pre-computed
   hash cuts three RPC round-trips per message.
3. **Public RPC throttles hard on busy days** (measured: 2/6 calls served) → viem
   `fallback` transport across four endpoints, ordered by measured reliability;
   JSON-RPC batching keeps the app under the 25 req/s cap.
4. **Only the official endpoint serves WebSocket subscriptions** → a 3 s `getLogs`
   poll backs up the socket so the live feed survives disconnects.

## Repository layout

| Path | Contents |
|---|---|
| [`contracts/StreamChat.sol`](contracts/StreamChat.sol) | The whole contract — 67 lines, verified |
| [`scripts/`](scripts) | solc compile, deploy, live-network integration tests, demo seeding |
| [`web/src/lib/`](web/src/lib) | chain clients, wallets, send queue, event reading |
| [`web/src/components/`](web/src/components) | chat, room, dashboard, OBS overlay |
| [`docs/`](docs) | measured facts (09), demo script (10), identity model (11) |

## Running locally

```bash
npm install && npm --prefix web install
npm --prefix web run dev          # http://localhost:3000
```

Contract lifecycle (needs `DEPLOYER_PRIVATE_KEY` in `.env.local`):

```bash
npm run compile     # solc via Node — no Foundry required
npm run deploy      # deploys + regenerates web/src/lib/deployment.ts
npm run test:live   # 14 integration checks against the live testnet
npm run deploy:web  # Vercel production deploy
node scripts/setup-demo.mjs   # (re)seed the demo room with fresh messages
```

---

Built at **Monad Blitz · Amsterdam · 2026**. Every number in this README was
measured on hackathon day, not quoted from docs.
