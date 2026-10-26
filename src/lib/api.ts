// Client for the Harvestia backend API (Railway).
import type { FarmAction } from '../../shared/sim/actions';
import type { FarmEvent } from '../../shared/sim/engine';
import type { FarmState } from '../../shared/sim/state';
import type { WorldState } from '../../shared/world';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'https://harvestia-api.up.railway.app').replace(/\/$/, '');

export interface ApiStatus { service: string; stage: number; environment: string; commit: string; time: string; online?: number; database?: string }
export interface FarmResponse { farmId: string; name: string; state: FarmState; lastSeq: number; serverTime: number; world: WorldState }
export interface ActionResponse { ok: boolean; state?: FarmState; events?: FarmEvent[]; error?: string; lastSeq?: number; duplicate?: boolean; serverTime: number }
export interface Session { token: string; player: { id: string; name: string }; farm: { id: string; name: string } }
export interface LeaderRow { farmId: string; name: string; level: number; xp: number; coins: number }

const TOKEN_KEY = 'harvestia.session.v1';
export function loadSession(): Session | null {
  try { const raw = localStorage.getItem(TOKEN_KEY); return raw ? JSON.parse(raw) as Session : null; } catch { return null; }
}
export function saveSession(s: Session | null) {
  try { if (s) localStorage.setItem(TOKEN_KEY, JSON.stringify(s)); else localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ }
}

export class ApiError extends Error { constructor(public status: number, message: string, public body?: unknown) { super(message); } }

async function call<T>(path: string, init: RequestInit & { token?: string; timeoutMs?: number } = {}): Promise<T> {
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 8000);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init, signal: ctrl.signal, cache: 'no-store',
      headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...(init.token ? { authorization: `Bearer ${init.token}` } : {}), ...init.headers },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 409) throw new ApiError(res.status, (body as { error?: string }).error ?? `API responded ${res.status}`, body);
    return body as T;
  } finally { clearTimeout(timer); }
}

export const fetchStatus = (signal?: AbortSignal) => fetch(`${API_URL}/v1/status`, { signal, cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(`API responded ${r.status}`); return r.json() as Promise<ApiStatus>; });
export const signInGuest = () => call<Session & { serverTime: number }>('/v1/auth/guest', { method: 'POST', body: '{}' });
export const getFarm = (token: string) => call<FarmResponse>('/v1/farm', { token });
export const postAction = (token: string, seq: number, action: FarmAction) => call<ActionResponse>('/v1/farm/actions', { method: 'POST', token, body: JSON.stringify({ seq, action }) });
export const resetFarm = (token: string) => call<{ ok: boolean; state: FarmState; lastSeq: number; serverTime: number }>('/v1/farm/reset', { method: 'POST', token, body: '{}' });
export const getLeaderboard = () => call<{ updatedAt: number; rows: LeaderRow[] }>('/v1/leaderboard');

/** Opens the live channel; reconnects with backoff until `close()` is called. */
export function openLive(token: string, onMessage: (m: { type: string; online?: number; text?: string; at?: number; recent?: { text: string; at: number }[] }) => void) {
  let ws: WebSocket | null = null, closed = false, delay = 1000;
  const connect = () => {
    if (closed) return;
    ws = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/v1/live?token=${encodeURIComponent(token)}`);
    ws.onmessage = e => { try { onMessage(JSON.parse(e.data)); } catch { /* ignore */ } };
    ws.onopen = () => { delay = 1000; };
    ws.onclose = () => { if (!closed) setTimeout(connect, delay = Math.min(delay * 2, 30_000)); };
  };
  connect();
  return { close: () => { closed = true; ws?.close(); } };
}
