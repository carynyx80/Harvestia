// Guest accounts and bearer-token sessions. Tokens are random 256-bit values;
// only their SHA-256 hash is stored. Signing in with a wallet links it to the player (see wallet.ts).
import { createHash, randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PlayerRow, Store } from './store/types';

export const newToken = () => randomBytes(32).toString('base64url');
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

const ADJ = ['Sunny', 'Maple', 'Clover', 'Willow', 'Golden', 'Misty', 'Honey', 'Copper', 'Bramble', 'Meadow', 'River', 'Acorn'];
const NOUN = ['Acres', 'Hollow', 'Fields', 'Meadow', 'Ridge', 'Orchard', 'Glen', 'Farm', 'Pastures', 'Brook'];
const pick = <T,>(a: T[]) => a[randomBytes(1)[0] % a.length];
export const randomFarmName = () => `${pick(ADJ)} ${pick(NOUN)}`;
export const randomPlayerName = () => `Farmer ${randomBytes(2).toString('hex').toUpperCase()}`;

/** Cleans a player-supplied display name. */
export function cleanName(v: unknown, fallback: string) {
  if (typeof v !== 'string') return fallback;
  const s = v.replace(/[^\p{L}\p{N} '_-]/gu, '').trim().slice(0, 24);
  return s.length >= 2 ? s : fallback;
}

declare module 'fastify' {
  interface FastifyRequest { player?: PlayerRow }
}

export function bearer(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return h.slice(7).trim();
  const q = (req.query as Record<string, unknown> | undefined)?.token; // WebSocket upgrade can't send headers
  return typeof q === 'string' ? q : null;
}

/** preHandler that requires a valid session. */
export const requirePlayer = (store: Store) => async (req: FastifyRequest, reply: FastifyReply) => {
  const token = bearer(req);
  const player = token && token.length >= 20 && token.length <= 100 ? await store.sessionPlayer(hashToken(token), new Date()) : null;
  if (!player) return reply.code(401).send({ error: 'Sign in again — your session is missing or expired' });
  req.player = player;
};
