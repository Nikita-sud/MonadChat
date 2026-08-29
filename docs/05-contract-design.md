# StreamChat.sol — дизайн контракта

Цель: минимальный контракт «платишь за сообщение». Текст только в event'е (дёшево), деньги — сразу стримеру.

## Код (черновик, ~40 строк)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title StreamChat — pay-per-message chat for streamers on Monad
contract StreamChat {
    uint256 public constant MAX_LEN = 280;

    struct Room {
        uint256 price;      // wei per message; 0 = room closed
        string streamUrl;   // "twitch:<channel>" | "youtube:<videoId>" | "kick:<channel>" — where the streamer actually streams
    }
    mapping(address => Room) public rooms;
    /// lifetime earnings per streamer (for dashboard; events are the source of truth)
    mapping(address => uint256) public earned;
    /// message counter per streamer (for ids / stats)
    mapping(address => uint256) public messageCount;

    event RoomSet(address indexed streamer, uint256 price, string streamUrl);
    event MessageSent(
        address indexed streamer,
        address indexed sender,
        uint256 amount,
        string text,
        uint256 timestamp,
        uint256 index
    );

    error RoomClosed();
    error Underpaid(uint256 required, uint256 sent);
    error TooLong();
    error TransferFailed();

    function setRoom(uint256 weiPerMessage, string calldata streamUrl) external {
        rooms[msg.sender] = Room(weiPerMessage, streamUrl);
        emit RoomSet(msg.sender, weiPerMessage, streamUrl);
    }

    function sendMessage(address streamer, string calldata text) external payable {
        uint256 p = rooms[streamer].price;
        if (p == 0) revert RoomClosed();
        if (msg.value < p) revert Underpaid(p, msg.value);
        if (bytes(text).length > MAX_LEN) revert TooLong();

        earned[streamer] += msg.value;
        uint256 idx = ++messageCount[streamer];

        (bool ok, ) = streamer.call{value: msg.value}("");
        if (!ok) revert TransferFailed();

        emit MessageSent(streamer, msg.sender, msg.value, text, block.timestamp, idx);
    }
}
```

Замечания:
- **Push-выплата** (деньги сразу стримеру) — лучший демо-эффект (баланс стримера растёт на глазах). Reentrancy тут безвредна: state обновлён до call, повторный вход только через новый `msg.value`. Если стример — контракт без `receive()`, tx ревертится — для MVP ок.
- Альтернатива — pull (`withdraw()`), если захочется комиссии платформы: `uint256 fee = msg.value * FEE_BPS / 10_000; earned[streamer] += msg.value - fee; protocolFees += fee;`. Добавлять только если есть время.
- `index` в событии — удобный стабильный id для UI (помимо `txHash:logIndex`).
- Платит за сообщение любой, включая самого стримера.
- Фильтр по `streamer` — `indexed`, поэтому WS-подписка `args: { streamer }` работает на уровне RPC-топиков.
- `streamUrl` on-chain (а не в localStorage), чтобы любой зритель, открыв `/r/<wallet>`, увидел тот же embed. Одна запись, ~50k gas — дёшево.

## Тесты (`test/StreamChat.t.sol`)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;
import "forge-std/Test.sol";
import "../src/StreamChat.sol";

contract StreamChatTest is Test {
    StreamChat chat;
    address streamer = makeAddr("streamer");
    address viewer = makeAddr("viewer");

    function setUp() public {
        chat = new StreamChat();
        vm.prank(streamer);
        chat.setRoom(0.01 ether, "twitch:teststream");
        vm.deal(viewer, 1 ether);
    }

    function test_sendMessage_paysStreamerAndEmits() public {
        vm.expectEmit(true, true, false, true);
        emit StreamChat.MessageSent(streamer, viewer, 0.01 ether, "gg", block.timestamp, 1);
        vm.prank(viewer);
        chat.sendMessage{value: 0.01 ether}(streamer, "gg");
        assertEq(streamer.balance, 0.01 ether);
        assertEq(chat.earned(streamer), 0.01 ether);
        assertEq(chat.messageCount(streamer), 1);
    }

    function test_revert_underpaid() public {
        vm.prank(viewer);
        vm.expectRevert(abi.encodeWithSelector(StreamChat.Underpaid.selector, 0.01 ether, 0.001 ether));
        chat.sendMessage{value: 0.001 ether}(streamer, "cheap");
    }

    function test_revert_roomClosed() public {
        vm.prank(viewer);
        vm.expectRevert(StreamChat.RoomClosed.selector);
        chat.sendMessage{value: 1 ether}(makeAddr("nobody"), "hi");
    }
}
```

`forge test --network monad -vvv`

## Экономика для демо

- Цена сообщения: **0.01 MON** (base fee ~100 gwei × ~70k gas ≈ 0.007 MON газа — сравнимо; для testnet неважно).
- Тиры на фронте: 1× обычное, ≥5× (0.05 MON) highlighted, ≥10× (0.1 MON) gold/pinned.
- Кран даёт ~1 MON → хватает на десятки сообщений.
- Газ `sendMessage`: ~45–80k в зависимости от длины текста (event с `string` — 8 gas/byte в data + storage writes: `earned` (5k/20k), `messageCount` (5k/20k)). На Monad оплачивается **gas_limit**, поэтому фронту либо не трогать `gas`, либо задать `estimate × 1.075`.

## Возможные расширения (после MVP)

- Комиссия платформы (bps) + `withdrawFees()`.
- `sendMessage` с `bytes32 roomId` вместо адреса — несколько комнат у одного стримера.
- Модерация: `banned[streamer][sender]`.
- Токен-платежи (ERC-20 / USDC `0x534b2f3A21130d7a60830c2Df862319e593943A3` на testnet) через `transferFrom`.
- Gasless для зрителей: EIP-7702 / Pimlico sponsored tx (шаблон `next-serwist-privy-smart-wallet`). Помнить: делегированный EOA не может опуститься ниже 10 MON.
- Leaderboard топ-донатеров — из событий, без изменений контракта.
