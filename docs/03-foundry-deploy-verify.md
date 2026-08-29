# Foundry: установка, деплой, верификация на Monad Testnet

Источники: /guides/deploy-smart-contract/foundry , /guides/verify-smart-contract/foundry ,
/tooling-and-infra/toolkits/foundry , github.com/monad-developers/foundry-monad , skill `monad-development`

> На этой машине **Foundry не установлен** (`forge`/`cast`/`anvil` not found). Node v20.14 есть. Первый шаг — установить.

## 0. Установка (2 минуты)

```bash
curl -L https://foundry.paradigm.xyz | bash
# перезапустить shell или: source ~/.zshenv
foundryup
forge --version   # должно быть >= 1.8.0 (без этого нет Monad execution)
```

## 1. Проект

Вариант А — шаблон Monad (уже настроен на testnet):
```bash
forge init --template monad-developers/foundry-monad contracts
cd contracts
```

Вариант Б — обычный `forge init contracts` и свой `foundry.toml`:

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.28"
evm_version = "prague"
network = "monad"              # газ-модель / лимиты / прекомпилы Monad локально (Foundry >= 1.8)

# для верификации (обязательно!)
metadata = true
metadata_hash = "none"         # без ipfs
use_literal_content = true     # исходники в метаданных

# Monad Testnet
eth-rpc-url = "https://testnet-rpc.monad.xyz"
chain_id = 10143
```

OpenZeppelin (если нужен, для нашего контракта не обязателен):
```bash
forge install OpenZeppelin/openzeppelin-contracts
```
(флага `--no-commit` в новых версиях нет.)

## 2. Кошелёк деплоера

```bash
# сгенерировать и сохранить в keystore (рекомендуется)
cast wallet import monad-deployer --private-key $(cast wallet new | grep 'Private key:' | awk '{print $3}')
cast wallet address --account monad-deployer
```
Или просто `cast wallet new` → сохранить приватный ключ в `contracts/.env` (`PRIVATE_KEY=0x...`, добавить `.env` в `.gitignore`).

Пополнить:
```bash
curl -X POST https://agents.devnads.com/v1/faucet -H "Content-Type: application/json" \
  -d '{"chainId":10143,"address":"0xDEPLOYER"}'
cast balance 0xDEPLOYER --rpc-url https://testnet-rpc.monad.xyz --ether
```
Fallback: https://faucet.monad.xyz

## 3. Тесты

```bash
forge test --network monad -vvv
```

## 4. Деплой — через `forge script` (не `forge create`)

`forge create --broadcast` местами глючит; используем скрипт.

`script/Deploy.s.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;
import "forge-std/Script.sol";
import "../src/StreamChat.sol";

contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();               // НЕ передавать адрес аргументом — иначе "No associated wallet"
        StreamChat c = new StreamChat();
        console.log("StreamChat deployed at:", address(c));
        vm.stopBroadcast();
    }
}
```

```bash
# с keystore
forge script script/Deploy.s.sol:DeployScript --rpc-url https://testnet-rpc.monad.xyz \
  --account monad-deployer --broadcast

# или с приватным ключом
source .env
forge script script/Deploy.s.sol:DeployScript --rpc-url https://testnet-rpc.monad.xyz \
  --private-key $PRIVATE_KEY --broadcast
```

Адрес → в `web/.env.local` как `NEXT_PUBLIC_CHAT_ADDRESS`, ABI → `out/StreamChat.sol/StreamChat.json` (`.abi`).

Если очень надо `forge create`:
```bash
forge create src/StreamChat.sol:StreamChat --account monad-deployer --broadcast
```

## 5. Верификация

### Вариант 1 — API devnads (одним вызовом на все 3 explorer'а) — предпочтительно

```bash
ADDR=0xCONTRACT
forge verify-contract $ADDR src/StreamChat.sol:StreamChat --chain 10143 \
  --show-standard-json-input > /tmp/standard-input.json
jq '.metadata' out/StreamChat.sol/StreamChat.json > /tmp/metadata.json
COMPILER_VERSION=$(jq -r '.metadata | fromjson | .compiler.version' out/StreamChat.sol/StreamChat.json)

cat > /tmp/verify.json <<JSON
{
  "chainId": 10143,
  "contractAddress": "$ADDR",
  "contractName": "src/StreamChat.sol:StreamChat",
  "compilerVersion": "v${COMPILER_VERSION}",
  "standardJsonInput": $(cat /tmp/standard-input.json),
  "foundryMetadata": $(cat /tmp/metadata.json)
}
JSON
curl -X POST https://agents.devnads.com/v1/verify -H "Content-Type: application/json" -d @/tmp/verify.json
```
С аргументами конструктора — добавить `"constructorArgs": "<abi-encoded без 0x>"`:
`cast abi-encode "constructor(uint256)" 123 | sed 's/0x//'`.

### Вариант 2 — Sourcify → MonadVision

```bash
forge verify-contract 0xCONTRACT src/StreamChat.sol:StreamChat \
  --chain 10143 --verifier sourcify \
  --verifier-url https://sourcify-api-monad.blockvision.org/
```
Проверить: https://testnet.monadvision.com/address/0xCONTRACT . Есть и веб-форма: https://testnet.monadvision.com/verify-contract

### Вариант 3 — Monadscan (etherscan-style, нужен API key с monadscan.com)

```bash
forge verify-contract 0xCONTRACT src/StreamChat.sol:StreamChat \
  --chain 10143 --verifier etherscan --etherscan-api-key $MONADSCAN_KEY --watch
```

## 6. Полезные cast-команды

```bash
RPC=https://testnet-rpc.monad.xyz
cast chain-id --rpc-url $RPC                       # 10143
cast block latest --rpc-url $RPC                   # посмотреть baseFee, gasLimit
cast call 0xCONTRACT "price(address)(uint256)" 0xSTREAMER --rpc-url $RPC
cast send 0xCONTRACT "sendMessage(address,string)" 0xSTREAMER "gg" --value 0.01ether \
  --account monad-deployer --rpc-url $RPC
cast logs --address 0xCONTRACT --from-block latest --rpc-url $RPC
cast estimate 0xCONTRACT "sendMessage(address,string)" 0xSTREAMER "hello" --value 0.01ether --rpc-url $RPC
```

## 7. Локально (опционально)

```bash
anvil --network monad                               # локальная сеть с правилами Monad
anvil --fork-url https://testnet-rpc.monad.xyz      # форк testnet
```

## Частые проблемы

| Симптом | Причина / решение |
|---|---|
| `No associated wallet` | В скрипте `vm.startBroadcast(0x...)` с адресом. Убрать аргумент. |
| `insufficient funds` | Кран. Помнить: списывается `gas_limit × price`, не `gas_used`. |
| tx included но reverted, баланс < 10 MON | Reserve balance: вторая tx в пределах 3 блоков. Подождать 1.5 с. |
| `Invalid block range` в getLogs | Окно > 100 блоков. |
| Верификация не совпадает | `metadata_hash = "none"`, `use_literal_content = true`, одинаковая `solc_version`/`evm_version`. |
| `forge` не находит `--network` | Foundry < 1.8 → `foundryup`. |
