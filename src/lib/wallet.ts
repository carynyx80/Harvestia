// Wallet connection (wagmi + viem) on Robinhood Chain, and sign-in with a signed
// message (EIP-4361). The game never asks for a seed phrase or private key and
// signing in never sends a transaction.
import { createConfig, http, injected } from 'wagmi';
import { getAccount, readContract, signMessage, signTypedData, switchChain, waitForTransactionReceipt, writeContract } from 'wagmi/actions';
import { defineChain, erc20Abi, getAddress, isAddress, parseUnits, type Address, type Hex } from 'viem';
import { createSiweMessage } from 'viem/siwe';
import { LOCAL_CHAIN, ROBINHOOD, ROBINHOOD_TESTNET, SIGN_IN_STATEMENT, type ChainInfo } from '../../shared/chains';
import { SPEND_TYPES, TEST_TOKEN_ABI, VAULT_ABI, type VaultInfo } from '../../shared/vault';
import { getWalletNonce, purchaseHrv, quoteHrv, verifyWallet } from './api';
import { adoptSession, applyServerState, currentToken } from './sync';

const toChain = (c: ChainInfo) => defineChain({
  id: c.id, name: c.name, testnet: c.testnet,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [c.rpc] } },
  blockExplorers: { default: { name: 'Explorer', url: c.explorer } },
});
export const robinhood = toChain(ROBINHOOD);
export const robinhoodTestnet = toChain(ROBINHOOD_TESTNET);
/** local Hardhat chain, only when developing (NEXT_PUBLIC_LOCAL_CHAIN=1) */
export const localChain = toChain(LOCAL_CHAIN);
const LOCAL = process.env.NEXT_PUBLIC_LOCAL_CHAIN === '1';

/** The $HRV token, once launched. Until the address is configured the game shows that it hasn't launched. */
const hrvRaw = process.env.NEXT_PUBLIC_HRV_TOKEN_ADDRESS ?? '';
export const HRV_TOKEN: Address | null = isAddress(hrvRaw) ? getAddress(hrvRaw) : null;
export const HRV_CHAIN_ID = Number(process.env.NEXT_PUBLIC_HRV_CHAIN_ID ?? ROBINHOOD.id);
export const DEFAULT_CHAIN = HRV_CHAIN_ID === ROBINHOOD_TESTNET.id ? robinhoodTestnet : robinhood;

export const wagmiConfig = createConfig({
  chains: [DEFAULT_CHAIN, DEFAULT_CHAIN.id === robinhood.id ? robinhoodTestnet : robinhood, ...(LOCAL ? [localChain] : [])],
  // browser-extension and in-app-browser wallets announce themselves (EIP-6963) and each gets its own button
  connectors: [injected({ shimDisconnect: true })],
  transports: { [robinhood.id]: http(ROBINHOOD.rpc), [robinhoodTestnet.id]: http(ROBINHOOD_TESTNET.rpc), [localChain.id]: http(LOCAL_CHAIN.rpc) },
  ssr: true,
});

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** On phones without an extension: open Harvestia inside a wallet app's own browser (official deep links). */
export const walletAppLinks = (url: string) => [
  { name: 'MetaMask app', href: `https://metamask.app.link/dapp/${url.replace(/^https?:\/\//, '')}` },
  { name: 'Coinbase Wallet app', href: `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}` },
];

/**
 * Proves ownership of the connected wallet: asks the server for a one-time
 * nonce, has the wallet sign a message naming this site, chain and nonce, and
 * exchanges the signature for a session. Returns how the wallet was attached.
 */
export async function signInWithWallet() {
  const account = getAccount(wagmiConfig);
  if (!account.address) throw new Error('Connect a wallet first');
  if (account.chainId !== robinhood.id && account.chainId !== robinhoodTestnet.id && !(LOCAL && account.chainId === localChain.id)) {
    await switchChain(wagmiConfig, { chainId: DEFAULT_CHAIN.id });
  }
  const chainId = getAccount(wagmiConfig).chainId ?? DEFAULT_CHAIN.id;
  const { nonce, expiresAt } = await getWalletNonce();
  const message = createSiweMessage({
    address: account.address, chainId, domain: window.location.host, uri: window.location.origin, version: '1', nonce,
    statement: SIGN_IN_STATEMENT, issuedAt: new Date(), expirationTime: new Date(expiresAt),
  });
  const signature = await signMessage(wagmiConfig, { account: account.address, message });
  const session = await verifyWallet(message, signature, currentToken() ?? undefined);
  await adoptSession(session);
  return session.outcome;
}

// ------------------------------------------------------------------ Game Vault

export const chainName = (id: number) => wagmiConfig.chains.find(c => c.id === id)?.name ?? `chain ${id}`;
export const explorerTx = (id: number, hash: string) => { const u = wagmiConfig.chains.find(c => c.id === id)?.blockExplorers?.default.url; return u ? `${u}/tx/${hash}` : null; };

async function onChain(chainId: number) {
  if (getAccount(wagmiConfig).chainId !== chainId) await switchChain(wagmiConfig, { chainId: chainId as typeof DEFAULT_CHAIN.id });
}
async function send(chainId: number, request: Parameters<typeof writeContract>[1]) {
  const hash = await writeContract(wagmiConfig, request);
  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId: chainId as typeof DEFAULT_CHAIN.id });
  if (receipt.status !== 'success') throw new Error('The transaction failed on-chain');
  return hash;
}

/** Deposits `amount` HRV into the Game Vault (approving first if needed). Two wallet confirmations the first time. */
export async function vaultDeposit(v: VaultInfo, amount: string, onStep: (s: string) => void) {
  const account = getAccount(wagmiConfig).address!, chainId = v.chainId!, wei = parseUnits(amount, 18);
  await onChain(chainId);
  const allowance = await readContract(wagmiConfig, { address: v.token!, abi: erc20Abi, functionName: 'allowance', args: [account, v.vault!], chainId: chainId as typeof DEFAULT_CHAIN.id });
  if (allowance < wei) {
    onStep('Approve the vault to take this amount in your wallet…');
    await send(chainId, { address: v.token!, abi: erc20Abi, functionName: 'approve', args: [v.vault!, wei], chainId: chainId as typeof DEFAULT_CHAIN.id });
  }
  onStep('Confirm the deposit in your wallet…');
  return send(chainId, { address: v.vault!, abi: VAULT_ABI, functionName: 'deposit', args: [wei], chainId: chainId as typeof DEFAULT_CHAIN.id });
}

export async function vaultWithdraw(v: VaultInfo, amount: string) {
  await onChain(v.chainId!);
  return send(v.chainId!, { address: v.vault!, abi: VAULT_ABI, functionName: 'withdraw', args: [parseUnits(amount, 18)], chainId: v.chainId as typeof DEFAULT_CHAIN.id });
}

/** Test networks only: claims free test HRV from the test token's daily faucet. */
export async function testFaucet(v: VaultInfo) {
  await onChain(v.chainId!);
  return send(v.chainId!, { address: v.token!, abi: TEST_TOKEN_ABI, functionName: 'faucet', chainId: v.chainId as typeof DEFAULT_CHAIN.id });
}

/**
 * Buys a shop item with $HRV from the Game Vault: the server quotes the price, the wallet signs
 * exactly that amount for this purchase (no gas), the server settles it on-chain and then grants the item.
 */
export async function buyWithHrv(v: VaultInfo, item: string, qty: number, onStep: (s: string) => void) {
  const token = currentToken();
  if (!token) throw new Error('Not connected to the farm server');
  onStep('Getting a price…');
  const q = await quoteHrv(token, item, qty);
  await onChain(q.typedData.domain.chainId);
  onStep(`Sign to pay ${q.hrv} HRV in your wallet…`);
  const m = q.typedData.message;
  const signature = await signTypedData(wagmiConfig, {
    domain: q.typedData.domain, types: SPEND_TYPES, primaryType: 'Spend',
    message: { player: m.player, amount: BigInt(m.amount), purchaseId: m.purchaseId as Hex, deadline: BigInt(m.deadline) },
  });
  onStep('Settling on-chain…');
  const r = await purchaseHrv(token, q.purchaseId, signature);
  applyServerState(r.state, r.events);
  return { ...r, hrv: q.hrv };
}
