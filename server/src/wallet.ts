// Wallet sign-in (EIP-4361, "Sign-In with Ethereum"). The server issues a
// single-use nonce; the wallet signs a message naming this site, the chain, the
// nonce and an expiry; the server checks every field and the signature. Nothing
// is ever transacted and no key or seed phrase is involved.
import { randomBytes } from 'node:crypto';
import { createPublicClient, defineChain, getAddress, http, isAddress, recoverMessageAddress, type Hex } from 'viem';
import { parseSiweMessage } from 'viem/siwe';
import { CHAINS, NONCE_TTL_MS, SIGN_IN_STATEMENT, type ChainInfo } from '../../shared/chains';

const viemChain = (c: ChainInfo) => defineChain({ id: c.id, name: c.name, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [c.rpc] } } });
const clients = new Map(CHAINS.map(c => [c.id, createPublicClient({ chain: viemChain(c), transport: http(c.rpc, { timeout: 10_000 }) })]));

export const newNonce = () => randomBytes(16).toString('hex');

export type WalletCheck = { ok: true; address: string } | { ok: false; error: string };

/**
 * Validates a signed sign-in message. `allowedHost` decides which sites may ask
 * for signatures (stops a phishing site replaying a signature it collected).
 * The nonce is checked by the caller, which also marks it used.
 */
export async function verifySignIn(message: unknown, signature: unknown, allowedHost: (host: string) => boolean, now: number): Promise<WalletCheck & { nonce?: string }> {
  if (typeof message !== 'string' || message.length > 2000 || typeof signature !== 'string' || !/^0x[0-9a-fA-F]{130,}$/.test(signature) || signature.length > 4000) return { ok: false, error: 'Malformed sign-in request' };
  let m: ReturnType<typeof parseSiweMessage>;
  try { m = parseSiweMessage(message); } catch { return { ok: false, error: 'Malformed sign-in message' }; }
  if (!m.address || !isAddress(m.address) || !m.domain || !m.uri || !m.nonce || !m.issuedAt || !m.expirationTime || !m.chainId) return { ok: false, error: 'Sign-in message is missing fields' };
  if (!allowedHost(m.domain)) return { ok: false, error: 'This sign-in message was made for another site' };
  let uriHost = '';
  try { uriHost = new URL(m.uri).host; } catch { /* checked below */ }
  if (uriHost !== m.domain) return { ok: false, error: 'Sign-in message URI does not match its domain' };
  if (!clients.has(m.chainId)) return { ok: false, error: 'Switch your wallet to Robinhood Chain to sign in' };
  if (m.statement !== SIGN_IN_STATEMENT) return { ok: false, error: 'Unexpected sign-in statement' };
  const issued = +m.issuedAt, expires = +m.expirationTime;
  if (!(issued <= now + 60_000 && now - issued <= NONCE_TTL_MS && expires > now && expires - issued <= NONCE_TTL_MS)) return { ok: false, error: 'Sign-in message has expired — try again' };

  const address = getAddress(m.address);
  // ordinary wallets: recover the signer locally; smart-contract wallets (ERC-1271/6492): ask the chain
  let valid = false;
  try { valid = (await recoverMessageAddress({ message, signature: signature as Hex })) === address; } catch { /* not an EOA signature */ }
  if (!valid) {
    try { valid = await clients.get(m.chainId)!.verifyMessage({ address, message, signature: signature as Hex }); } catch { valid = false; }
  }
  if (!valid) return { ok: false, error: 'The signature does not match this wallet' };
  return { ok: true, address, nonce: m.nonce };
}
