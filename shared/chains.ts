// Robinhood Chain networks (verified against the public RPC endpoints:
// eth_chainId 0x1237 mainnet, 0xb626 testnet). Plain data so client and server
// can each build their own viem chain objects.
export interface ChainInfo { id: number; name: string; rpc: string; explorer: string; testnet: boolean }

export const ROBINHOOD: ChainInfo = { id: 4663, name: 'Robinhood Chain', rpc: 'https://rpc.mainnet.chain.robinhood.com', explorer: 'https://robinhoodchain.blockscout.com', testnet: false };
export const ROBINHOOD_TESTNET: ChainInfo = { id: 46630, name: 'Robinhood Chain Testnet', rpc: 'https://rpc.testnet.chain.robinhood.com', explorer: 'https://explorer.testnet.chain.robinhood.com', testnet: true };
export const CHAINS: ChainInfo[] = [ROBINHOOD, ROBINHOOD_TESTNET];
/** Local Hardhat chain for development and end-to-end tests (never accepted in production). */
export const LOCAL_CHAIN: ChainInfo = { id: 31337, name: 'Local test chain', rpc: 'http://127.0.0.1:8545', explorer: '', testnet: true };

/** The sign-in statement the wallet shows. Signing it costs nothing and authorises no transaction. */
export const SIGN_IN_STATEMENT = 'Sign in to Harvestia with this wallet. This only proves you own it: it costs nothing and does not allow any transaction or token transfer.';
/** How long a sign-in nonce stays valid. */
export const NONCE_TTL_MS = 10 * 60_000;
