// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title StreamChat — pay-per-message chat for streamers on Monad
/// @notice Каждое сообщение — транзакция. Деньги уходят стримеру сразу,
///         текст живёт только в событии (storage не тратим).
contract StreamChat {
    uint256 public constant MAX_TEXT = 280;
    uint256 public constant MAX_NICK = 24;

    struct Room {
        uint256 price;     // wei за сообщение; 0 = комната закрыта
        string streamUrl;  // "twitch:<channel>" | "youtube:<videoId>" | "kick:<channel>"
    }

    mapping(address => Room) public rooms;
    /// @notice суммарно заработано стримером (для дашборда)
    mapping(address => uint256) public earned;
    /// @notice счётчик сообщений — стабильный id для UI
    mapping(address => uint256) public messageCount;

    event RoomSet(address indexed streamer, uint256 price, string streamUrl);
    event MessageSent(
        address indexed streamer,
        address indexed sender,
        uint256 amount,
        string nickname,
        string text,
        uint256 timestamp,
        uint256 index
    );

    error RoomClosed();
    error Underpaid(uint256 required, uint256 sent);
    error TooLong();
    error EmptyText();
    error TransferFailed();

    /// @notice Стример открывает комнату: цена за сообщение и где он стримит.
    function setRoom(uint256 weiPerMessage, string calldata streamUrl) external {
        rooms[msg.sender] = Room(weiPerMessage, streamUrl);
        emit RoomSet(msg.sender, weiPerMessage, streamUrl);
    }

    /// @notice Написать в чат. msg.value >= цены комнаты, деньги сразу стримеру.
    function sendMessage(address streamer, string calldata nickname, string calldata text)
        external
        payable
    {
        uint256 price = rooms[streamer].price;
        if (price == 0) revert RoomClosed();
        if (msg.value < price) revert Underpaid(price, msg.value);

        uint256 len = bytes(text).length;
        if (len == 0) revert EmptyText();
        if (len > MAX_TEXT || bytes(nickname).length > MAX_NICK) revert TooLong();

        // state до внешнего вызова — reentrancy безвредна
        earned[streamer] += msg.value;
        uint256 idx = ++messageCount[streamer];

        (bool ok, ) = streamer.call{value: msg.value}("");
        if (!ok) revert TransferFailed();

        emit MessageSent(streamer, msg.sender, msg.value, nickname, text, block.timestamp, idx);
    }
}
