# Harvestia contracts

`HarvestiaVault` holds the $HRV players deposit for in-game spending. `TestHRV` is a valueless test token with a daily faucet for local chains and Robinhood Chain testnet.

**Not audited.** The vault is deployed to local chains and testnet only. It does not go to Robinhood Chain mainnet before an independent audit; `hardhat.config.ts` deliberately has no mainnet network.

## How the vault works

- **Three separate buckets:** player balances (liabilities), the farmer reward treasury, and operations (fees). Admin functions can only touch operations and tokens sent by mistake (`recoverExcess` takes only what exceeds every bucket) — never player balances or rewards. `solvent()` checks the vault holds everything it owes.
- **Deposit:** 3% fee to operations; the rest is credited. Measures the tokens that actually arrived (safe with fee-on-transfer tokens).
- **Withdraw:** the player calls it directly; 5% fee to operations. It stays open even while the vault is paused, so players can always exit.
- **Purchases (`spend`):** the player signs an EIP-712 `Spend(player, amount, purchaseId, deadline)` in their wallet (gasless). The settler relays it. Each purchase id works once, the signature must match the player (ERC-1271 smart wallets supported), and the deadline must not have passed. 50% is burned (`burn()` if the token supports it, otherwise sent to `0x…dEaD`) and 50% goes to the reward treasury.
- **Rewards (`claimRewards`):** the reward signer attests a player's cumulative earnings. The vault pays only the unclaimed difference, never more than the treasury holds, and at most `dailyRewardCap` per day across all players. Anyone may relay a claim; the payout always goes to the player's vault balance.
- **Roles:** admin (pause, fees out, daily cap), settler (relays signed purchases), reward signer (attests earnings). Use a multisig as admin for any real deployment.

## Commands

```bash
npm install
npx hardhat test                         # 9 tests: fees, signatures, replays, caps, admin limits, burns
npx hardhat node                         # local chain on :8545 (chain 31337)
npx hardhat run scripts/deploy.ts --network localhost
```

The deploy script writes `deployments/<network>.json`.

### Robinhood Chain testnet

The contracts compile for the Cancun EVM (OpenZeppelin 5 uses `MCOPY`). Robinhood Chain is an Arbitrum Orbit chain, and its contracts already use Shanghai opcodes. The testnet deployment is the definitive check that `MCOPY` is supported.

Fund three addresses with testnet ETH: a deployer/admin, a settler and a reward signer. Then, from your own shell:

```bash
export DEPLOYER_PRIVATE_KEY=0x…     # stays on your machine
SETTLER_ADDRESS=0x… REWARD_SIGNER_ADDRESS=0x… npx hardhat run scripts/deploy.ts --network robinhoodTestnet
```

Then set these on the Railway API: `VAULT_CHAIN_ID=46630`, `VAULT_ADDRESS`, `VAULT_TOKEN_ADDRESS`, `VAULT_START_BLOCK`, `SETTLER_PRIVATE_KEY`, `REWARD_SIGNER_PRIVATE_KEY`, and `HRV_TEST_USD_PRICE` (the test price). The API refuses to run the vault on mainnet (chain 4663).
