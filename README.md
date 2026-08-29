# MonadChat

**Stream chat where words cost money.** Every message is a Monad transaction: to speak you pay,
and the money lands in the streamer's wallet immediately — no platform in between.

A Monad block takes about 300–400 ms, so a paid message shows up in chat in **well under a
second**. This is not a blockchain bolted onto a chat app: it is a product that only exists on a
chain fast enough for a transaction to be a line of conversation.

- **Live:** https://monadchat-rvfc1.vercel.app
- **Contract:** [`0xba3c36b0e9c739669e4f738cef507c72c88b4be8`](https://testnet.monadscan.com/address/0xba3c36b0e9c739669e4f738cef507c72c88b4be8#code) on Monad Testnet (chain 10143)
- **Measured latency:** 0.5–1.3 s from clicking send to the message appearing on chain

## What it does

| | |
|---|---|
| **Paid chat** | The streamer sets the price of a word. Pay, and you can post. 100% goes straight to them. |
| **Anti-spam from the network** | Monad's reserve balance rule stops any single wallet posting more than once per ~1.2 s. That is consensus, not our server, and a bot cannot get around it. |
| **No wallet required** | The app creates one in the browser and the built-in faucet tops it up with one click. A viewer is posting ten seconds after opening the link — no extension, no seed phrase. |
| **OBS overlay** | A transparent page that sits on top of the video, so paid messages appear on the stream itself. |
| **On top of Twitch, not instead of it** | The streamer keeps streaming wherever they already stream; we add the paid chat layer. |

## How it works

```
Viewer (wallet created in the browser)
   │  sendMessage{value}
   ▼
StreamChat.sol ──── MON ───▶ streamer's wallet (immediately, push)
   │
   └── emit MessageSent(streamer, sender, amount, nickname, text, ts, index)
              │
      ┌───────┴────────┐
      ▼                ▼
  /r/<address>    /overlay/<address>
  viewer chat     OBS overlay
```

No backend, no indexer, no database. Message text lives in contract events; the frontend reads
history with `eth_getLogs` and the live feed over a WebSocket subscription.

## Running it

```bash
npm install && npm --prefix web install
npm --prefix web run dev
```

Open `http://localhost:3000/dashboard`, click “+1 MON”, open your room, and share the
`/r/<your address>` link.

Rebuild and redeploy the contract (needs `DEPLOYER_PRIVATE_KEY` in `.env.local`):

```bash
npm run compile && npm run deploy && npm run test:live
```

`deploy` writes the new address and ABI into the frontend automatically.

## Layout

| Path | Contents |
|---|---|
| `contracts/StreamChat.sol` | The whole contract, 67 lines |
| `scripts/` | Compile (solc), deploy, and integration tests that run against live testnet |
| `web/src/lib/` | Chain clients, wallet, send queue, event reading |
| `web/src/components/` | Chat, room, streamer dashboard, overlay |
| `docs/09-measured-facts.md` | **Numbers measured on the live network** — gas, limits, reserve balance |

## Three things Monad does differently, and what they cost us

1. **Gas is charged on `gas_limit`, not on usage, with no refund.** A padded gas limit is money
   out of the viewer's pocket, so estimates get a 7.5% buffer rather than the usual 2x.
2. **A wallet holding less than 10 MON lands one spending transaction every ~1.2 s; the rest
   revert and still pay gas.** We measured it: of five sent back to back, one succeeded and four
   burned gas. Hence the serial send queue — and the anti-spam story above.
3. **The public RPC is shared by every builder on the network.** On hackathon day it rejected two
   thirds of our calls, which broke both history loading and the WebSocket handshake. The app now
   fails over across four independent endpoints, ordered by measured reliability.

Details and raw measurements: `docs/09-measured-facts.md`.
