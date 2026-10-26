// Wallet connection (wagmi + viem) on Robinhood Chain, and sign-in with a signed
// message (EIP-4361). The game never asks for a seed phrase or private key and
// signing in never sends a transaction.
import { createConfig, http, injected } from 'wagmi';
import { getAccount, signMessage, switchChain } from 'wagmi/actions';
import { defineChain, getAddress, isAddress, type Address } from 'viem';
import { createSiweMessage } from 'viem/siwe';
import { ROBINHOOD, ROBINHOOD_TESTNET, SIGN_IN_STATEMENT, type ChainInfo } from '../../shared/chains';
import { getWalletNonce, verifyWallet } from './api';
import { adoptSession, currentToken } from './sync';

const toChain = (c: ChainInfo) => defineChain({
  id: c.id, name: c.name, testnet: c.testnet,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [c.rpc] } },
  blockExplorers: { default: { name: 'Explorer', url: c.explorer } },
});
export const robinhood = toChain(ROBINHOOD);
export const robinhoodTestnet = toChain(ROBINHOOD_TESTNET);

/** The $HRV token, once launched. Until the address is configured the game shows that it hasn't launched. */
const hrvRaw = process.env.NEXT_PUBLIC_HRV_TOKEN_ADDRESS ?? '';
export const HRV_TOKEN: Address | null = isAddress(hrvRaw) ? getAddress(hrvRaw) : null;
export const HRV_CHAIN_ID = Number(process.env.NEXT_PUBLIC_HRV_CHAIN_ID ?? ROBINHOOD.id);
export const DEFAULT_CHAIN = HRV_CHAIN_ID === ROBINHOOD_TESTNET.id ? robinhoodTestnet : robinhood;

export const wagmiConfig = createConfig({
  chains: [DEFAULT_CHAIN, DEFAULT_CHAIN.id === robinhood.id ? robinhoodTestnet : robinhood],
  // browser-extension and in-app-browser wallets announce themselves (EIP-6963) and each gets its own button
  connectors: [injected({ shimDisconnect: true })],
  transports: { [robinhood.id]: http(ROBINHOOD.rpc), [robinhoodTestnet.id]: http(ROBINHOOD_TESTNET.rpc) },
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
  if (account.chainId !== robinhood.id && account.chainId !== robinhoodTestnet.id) {
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
