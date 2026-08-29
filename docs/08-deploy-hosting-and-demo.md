# Деплой (обязательно) + интеграция с реальными стримерами

## Что значит «задеплоено» для жюри

Два артефакта, оба публичные:
1. **Контракт** на Monad Testnet, верифицированный → ссылка вида `https://testnet.monadvision.com/address/0x…` (см. `03-foundry-deploy-verify.md`).
2. **Фронт** по публичному HTTPS-URL → `https://monadchat.vercel.app` (или похожее).

Домен покупать **не нужно**. `*.vercel.app` — бесплатный HTTPS-домен, этого достаточно для демо и для Twitch-embed. Если захочется красивый — Cloudflare Registrar / Namecheap ~$10, CNAME на Vercel, 10 минут; делать в самом конце, если останется время.

## Vercel vs Hetzner

| | Vercel | Hetzner (VPS) |
|---|---|---|
| Время до публичного URL | **5 минут** | 30–60 мин (nginx/Caddy, pm2, certbot) |
| HTTPS | автоматически | нужен домен (Let's Encrypt не выдаёт сертификаты на IP) |
| Twitch/YouTube embed | работает (нужен HTTPS parent) | без домена — не работает |
| Бэкенд | нам не нужен (всё в браузере + контракт) | — |
| Цена | Hobby — бесплатно | — |

**Берём Vercel.** Наш фронт — чистый Next.js без серверных секретов: браузер сам ходит в `testnet-rpc.monad.xyz` по HTTP/WSS, кошелёк — MetaMask. Vercel'у нечего ломать.

## Vercel — пошагово (первый раз)

### Вариант A — через CLI (быстрее всего, не нужен GitHub)

```bash
cd web
npx vercel login                 # откроет браузер, войти через GitHub/email
npx vercel                        # первый деплой: ответить Enter на всё (Next.js определится сам)
                                  # → даст preview URL вида https://web-xxxx.vercel.app
npx vercel env add NEXT_PUBLIC_CHAT_ADDRESS production   # вставить адрес контракта
npx vercel --prod                 # продовый деплой → https://<project>.vercel.app
```

Переименовать проект / выбрать имя `monadchat`: на dashboard → Settings → General → Project Name → URL станет `https://monadchat.vercel.app` (если свободно).

Каждый следующий деплой: `npx vercel --prod` из `web/`. ~40 секунд.

### Вариант B — через GitHub (авто-деплой на каждый push)

1. `git push` репо на GitHub.
2. https://vercel.com/new → Import Git Repository → выбрать репо.
3. **Root Directory → `web`** (важно, потому что у нас монорепо с `contracts/`).
4. Environment Variables → `NEXT_PUBLIC_CHAT_ADDRESS` = адрес контракта.
5. Deploy. Дальше каждый push в `main` = новый прод-деплой, каждая ветка = preview URL.

### Env-переменные, которые нужны фронту

| Переменная | Значение |
|---|---|
| `NEXT_PUBLIC_CHAT_ADDRESS` | адрес StreamChat на testnet |
| `NEXT_PUBLIC_RPC_HTTP` (опц.) | `https://testnet-rpc.monad.xyz` |
| `NEXT_PUBLIC_RPC_WS` (опц.) | `wss://testnet-rpc.monad.xyz` |

Секретов нет — приватный ключ деплоера **никогда** не попадает в `web/`. Всё, что `NEXT_PUBLIC_*`, видно в браузере — это нормально.

### Подводные камни

- `next build` падает на ESLint/TS-ошибках → на время хакатона в `next.config.ts`: `eslint: { ignoreDuringBuilds: true }, typescript: { ignoreBuildErrors: true }`.
- Хуки wagmi только в `"use client"` компонентах; `WagmiProvider` с `ssr: true`.
- `window`/`localStorage` — только внутри `useEffect`, иначе ошибка при SSR-сборке.
- Preview-URL Vercel меняется на каждый деплой (`web-git-main-…vercel.app`); ссылки на демо давать на **prod**-URL.
- Vercel Hobby — non-commercial, для хакатона ок.

### Если всё-таки Hetzner (уже есть сервер + домен)

```bash
# на сервере
git clone … && cd web && npm ci && npm run build
npm i -g pm2 && pm2 start npm --name monadchat -- start   # :3000
# Caddy (авто-HTTPS):  /etc/caddy/Caddyfile
#   chat.example.com { reverse_proxy localhost:3000 }
```
Только с доменом (HTTPS), иначе Twitch-embed не заработает.

---

## Демо с реальными стримерами: «мы — не стриминговая платформа, мы — платный чат-слой поверх любой»

Позиционирование: стример продолжает стримить на **Twitch / YouTube / Kick**, а MonadChat даёт ему:
1. **Ссылку на комнату** `monadchat.app/r/<wallet>` — постит в описании/чате/панели Twitch (`!pay`-команда бота).
2. **Оверлей для OBS** `monadchat.app/overlay/<wallet>` — Browser Source, платные сообщения всплывают прямо на стриме.
3. Деньги приходят на кошелёк мгновенно, без платформы, без 30–50 % комиссии (Twitch Bits / YouTube Superchat берут ~30 %, выплата через недели). Это питч.

Ничего стримить у нас не надо. Идентичность стримера = его кошелёк. Верификация «этот кошелёк = этот Twitch-канал» — через Twitch OAuth (`user:read:email`, 20 строк) — **после MVP**; на демо стример просто вводит свой канал.

### Что добавить в MVP (≈40 минут), чтобы это было видно на демо

**Контракт** — вместо `setPrice` делаем `setRoom` с URL стрима:
```solidity
struct Room { uint256 price; string streamUrl; }   // streamUrl: "twitch:xqc" | "youtube:VIDEO_ID" | "kick:channel"
mapping(address => Room) public rooms;
event RoomSet(address indexed streamer, uint256 price, string streamUrl);
function setRoom(uint256 price, string calldata streamUrl) external { rooms[msg.sender] = Room(price, streamUrl); emit RoomSet(msg.sender, price, streamUrl); }
```
(в `sendMessage` — `rooms[streamer].price` вместо `price[streamer]`.)

**Страница комнаты `/r/[streamer]`** — слева живой плеер, справа наш чат:

```tsx
// Twitch: parent обязан совпадать с доменом страницы — берём динамически, тогда работает и на localhost, и на vercel.app
const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
const src =
  kind === "twitch"  ? `https://player.twitch.tv/?channel=${id}&parent=${host}&muted=true` :
  kind === "youtube" ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1` :
  kind === "kick"    ? `https://player.kick.com/${id}?muted=true` : "";
<iframe src={src} allowFullScreen allow="autoplay; fullscreen" className="w-full aspect-video" />
```
Twitch-embed требует HTTPS на родительской странице (localhost — исключение) — ещё одна причина для Vercel. YouTube live по channel: `https://www.youtube.com/embed/live_stream?channel=UC…`.

**Оверлей** уже платформо-независим (Browser Source в OBS работает с любой платформой).

### Как показать на демо (варианты по возрастанию усилий)

1. **Чужой живой стрим + наш чат** (0 усилий): создаём комнату с `twitch:<любой топ-стример, кто сейчас в эфире>`, на странице — его реальный эфир и наш on-chain чат рядом. Честно говорим: «деньги в демо идут на наш кошелёк, в проде — стримеру после привязки канала через Twitch OAuth».
2. **Свой тестовый стрим** (10 минут): один из команды запускает OBS → Twitch/Kick на своём аккаунте с нашим оверлеем как Browser Source. На экране жюри видно: платят в браузере → сообщение всплывает **на реальном стриме** через ~1 с. Самый убедительный вариант.
3. **Запись** (страховка): 30-секундное видео экрана варианта 2, если интернет на площадке подведёт.

### Дальше (в питч, не в код)

- Twitch OAuth → привязка канала к кошельку, один клик «Claim my channel».
- Бот-мост (tmi.js): платные сообщения дублируются в обычный Twitch-чат с тегом `💎 0.1 MON` → зрители без кошелька тоже видят.
- Twitch Extension (панель под плеером) вместо внешней ссылки.
- Gasless для зрителей (спонсирует стример, EIP-7702/4337) + оплата картой через onramp.
- Kuru Flow: платить любым токеном, стример получает MON.
