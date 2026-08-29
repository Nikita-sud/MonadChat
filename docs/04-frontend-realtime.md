# Фронтенд: wagmi/viem, кошелёк, отправка tx, реалтайм по WebSocket

Источники: skill `monad-development`, /guides/reown , /templates/next-serwist-privy-embedded-wallet ,
/tooling-and-infra/wallet-infra/embedded-wallets , /reference/rpc-differences (WebSocket),
/monad-arch/realtime-data/data-sources , /developer-essentials/best-practices

## Выбор: **wagmi + viem + injected (MetaMask)** — ноль API-ключей, 15 минут

Альтернативы (если останется время / нужен email-логин):
- **Reown AppKit** (WalletConnect): `npx @reown/appkit-cli` → Next.js + Wagmi; Project ID с https://dashboard.reown.com; `import { monadTestnet } from '@reown/appkit/networks'`.
- **Privy** (embedded wallet, субсидирован на testnet, `monad@privy.io`): шаблон https://github.com/monad-developers/next-serwist-privy-embedded-wallet — `NEXT_PUBLIC_PRIVY_APP_ID`, включить «Automatically create embedded wallets on login», EVM wallets.
- Другие embedded: Turnkey (free testnet), Para, Dynamic, thirdweb, Alchemy Account Kit, CDP, MetaMask Embedded, Mera (passkeys, open-source).

## Установка

```bash
npx create-next-app@latest web --ts --app --tailwind --eslint --src-dir --no-import-alias
cd web
npm i wagmi viem @tanstack/react-query
```

## wagmi config (`src/lib/wagmi.ts`)

```ts
import { createConfig, http, webSocket } from "wagmi";
import { monadTestnet } from "viem/chains";      // id 10143, RPC/explorer уже внутри — НЕ описывать chain руками
import { injected } from "wagmi/connectors";

export const config = createConfig({
  chains: [monadTestnet],
  connectors: [injected()],
  transports: {
    [monadTestnet.id]: http("https://testnet-rpc.monad.xyz"),
  },
  ssr: true,
});

// отдельный WS-клиент для подписок на события
import { createPublicClient } from "viem";
export const wsClient = createPublicClient({
  chain: monadTestnet,
  transport: webSocket("wss://testnet-rpc.monad.xyz", { reconnect: true }),
});
```

`src/app/providers.tsx`:
```tsx
"use client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "@/lib/wagmi";
const qc = new QueryClient();
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
```
Обернуть `children` в `layout.tsx`.

## Connect + переключение сети

```tsx
"use client";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { monadTestnet } from "viem/chains";

export function ConnectButton() {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  if (!isConnected) return <button onClick={() => connect({ connector: connectors[0] })}>Connect wallet</button>;
  if (chainId !== monadTestnet.id)
    return <button onClick={() => switchChain({ chainId: monadTestnet.id })}>Switch to Monad Testnet</button>;
  return <button onClick={() => disconnect()}>{address?.slice(0, 6)}…{address?.slice(-4)}</button>;
}
```
`switchChain` сам вызовет `wallet_addEthereumChain`, если сети нет в MetaMask.

## Отправка платного сообщения

```tsx
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { parseEther } from "viem";
import { chatAbi, CHAT_ADDRESS } from "@/lib/contract";

const { data: room } = useReadContract({
  abi: chatAbi, address: CHAT_ADDRESS, functionName: "rooms", args: [streamer],
}); // room = [price, streamUrl]
const price = room?.[0];
const { writeContract, data: hash, isPending } = useWriteContract();
const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

const send = (text: string, multiplier = 1n) =>
  writeContract({
    abi: chatAbi,
    address: CHAT_ADDRESS,
    functionName: "sendMessage",
    args: [streamer, text],
    value: (price ?? 0n) * multiplier,
    // gas: не раздувать! viem сделает estimateGas; на Monad платят за лимит.
    // при желании: gas: 90_000n (фиксированный, если сообщения короткие)
  });
```

UX-правила (из-за Monad-специфики):
- Кнопка disabled, пока `isPending || isConfirming` — иначе вторая tx из кошелька с < 10 MON внутри 3 блоков **ревертится** (reserve balance).
- Receipt приходит через ~0.5–1 с. Показывать «sending… → sent ✓» без промежуточного «pending in mempool» (его нет).
- Сообщение в списке появится через WS раньше/одновременно с receipt — не дублировать: ключ `txHash:logIndex`.

## Реалтайм: подписка на события

viem `watchContractEvent` поверх WS = `eth_subscribe("logs")`. Срабатывает при **Proposed** (спекулятивно, ~300 мс после отправки).

```ts
"use client";
import { useEffect, useState } from "react";
import { wsClient } from "@/lib/wagmi";
import { chatAbi, CHAT_ADDRESS } from "@/lib/contract";

export type ChatMsg = { id: string; sender: `0x${string}`; amount: bigint; text: string; ts: bigint; block: bigint };

export function useLiveMessages(streamer: `0x${string}`) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);

  useEffect(() => {
    let cancelled = false;
    const seen = new Set<string>();
    const push = (logs: any[]) => {
      const fresh: ChatMsg[] = [];
      for (const l of logs) {
        const id = `${l.transactionHash}:${l.logIndex}`;
        if (seen.has(id)) continue;
        seen.add(id);
        fresh.push({ id, sender: l.args.sender, amount: l.args.amount, text: l.args.text, ts: l.args.timestamp, block: l.blockNumber });
      }
      if (fresh.length && !cancelled) setMsgs((m) => [...m, ...fresh].slice(-200));
    };

    // 1) начальная история: getLogs окнами <= 100 блоков (лимит публичного RPC)
    (async () => {
      const latest = await wsClient.getBlockNumber();
      const WINDOW = 100n, WINDOWS = 5;            // ~2.5 минуты истории
      for (let i = WINDOWS; i >= 1; i--) {
        const from = latest - WINDOW * BigInt(i) + 1n, to = latest - WINDOW * BigInt(i - 1);
        const logs = await wsClient.getContractEvents({
          abi: chatAbi, address: CHAT_ADDRESS, eventName: "MessageSent",
          args: { streamer }, fromBlock: from < 0n ? 0n : from, toBlock: to,
        });
        push(logs);
      }
    })();

    // 2) live
    const unwatch = wsClient.watchContractEvent({
      abi: chatAbi, address: CHAT_ADDRESS, eventName: "MessageSent",
      args: { streamer },
      onLogs: push,
      onError: (e) => console.error("ws", e),
    });
    return () => { cancelled = true; unwatch(); };
  }, [streamer]);

  return msgs;
}
```

Если WS капризничает — `watchContractEvent` с `http()` транспортом делает polling `eth_getLogs` (`pollingInterval: 1000`); держать окно маленьким (viem сам запрашивает от последнего блока).

Продвинутый вариант — `monadLogs` (с `commitState`), если хочется показывать «✓ finalized» у сообщения:
```ts
// сырой eth_subscribe через viem transport
const ws = wsClient.transport; // либо свой WebSocket
// {"jsonrpc":"2.0","id":1,"method":"eth_subscribe","params":["monadLogs",{"address":CHAT_ADDRESS,"topics":[topic0]}]}
// апдейты содержат blockId и commitState: Proposed | Voted | Finalized | Verified
```

## Оверлей для OBS (`/overlay/[streamer]`)

- Прозрачный фон: `body { background: transparent }` (в OBS Browser Source галочка «Shutdown source when not visible» off, CSS можно переопределить).
- Использует тот же `useLiveMessages`, без кошелька.
- Тир по `amount / price`: ≥10× → gold + pinned на 30 с, ≥5× → highlighted, иначе обычное. Анимация появления (`@keyframes slideIn`), автоскрытие через 15–20 с.
- Опционально: звук `new Audio("/ding.mp3").play()` при новом сообщении (OBS с «Control audio via OBS»).

## Отображение

- `formatEther(amount)` + «MON»; адрес → `0x1234…abcd`; explorer-ссылка на tx: `https://testnet.monadvision.com/tx/${hash}`.
- Баланс стримера: `useBalance({ address: streamer })` или сумма `amount` из событий.

## Performance best practices (из docs)

- Multicall3 `0xcA11bde05977b3631167028862bE2a173976CA11` для батча чтений (wagmi `useReadContracts` использует его автоматически).
- Много tx с одного кошелька — локальный nonce + конкурентная отправка.
- Для read-heavy приложений — индексер вместо polling `eth_getLogs` (нам не нужно).
- Хостинг: Vercel — самое быстрое для демо; в Privy-шаблоне описано, что после деплоя добавить домен в allowed origins.
