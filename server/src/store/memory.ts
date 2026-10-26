// In-memory store for tests and local development without PostgreSQL.
import { randomUUID } from 'node:crypto';
import type { FarmRow, FarmTxResult, LeaderRow, PlayerRow, Store } from './types';
import type { FarmState } from '../../../shared/sim/state';

export class MemoryStore implements Store {
  readonly kind = 'memory' as const;
  private players = new Map<string, PlayerRow>();
  private sessions = new Map<string, { playerId: string; expiresAt: Date }>();
  private farms = new Map<string, FarmRow>(); // by playerId
  private locks = new Map<string, Promise<unknown>>();
  readonly logs: { farmId: string; at: Date; seq: number; type: string; ok: boolean; error?: string }[] = [];
  readonly flags: { playerId: string; reason: string; detail: unknown }[] = [];

  async createPlayerWithFarm(name: string, farmName: string, state: FarmState) {
    const player: PlayerRow = { id: randomUUID(), name, wallet: null, createdAt: new Date() };
    const farm: FarmRow = { id: randomUUID(), playerId: player.id, name: farmName, state, lastSeq: 0 };
    this.players.set(player.id, player); this.farms.set(player.id, farm);
    return { player, farm: structuredClone(farm) };
  }
  async createSession(playerId: string, tokenHash: string, expiresAt: Date) { this.sessions.set(tokenHash, { playerId, expiresAt }); }
  async sessionPlayer(tokenHash: string, now: Date) {
    const s = this.sessions.get(tokenHash);
    return s && s.expiresAt > now ? this.players.get(s.playerId) ?? null : null;
  }
  async touch() { /* nothing to record in memory */ }

  async withFarm<T>(playerId: string, fn: (farm: FarmRow) => FarmTxResult<T> | Promise<FarmTxResult<T>>): Promise<T> {
    // serialise work per player, like a row lock
    const prev = this.locks.get(playerId) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>(r => (release = r));
    this.locks.set(playerId, prev.then(() => mine));
    await prev;
    try {
      const row = this.farms.get(playerId);
      if (!row) throw Object.assign(new Error('Farm not found'), { statusCode: 404 });
      const r = await fn(structuredClone(row));
      if (r.next) this.farms.set(playerId, structuredClone(r.next));
      if (r.log) this.logs.push({ farmId: row.id, at: new Date(), seq: r.log.seq, type: r.log.type, ok: r.log.ok, error: r.log.error });
      return r.value;
    } finally { release(); }
  }

  async leaderboard(limit: number): Promise<LeaderRow[]> {
    return [...this.farms.values()]
      .map(f => ({ farmId: f.id, name: f.name, level: f.state.level, xp: f.state.xp, coins: f.state.coins }))
      .sort((a, b) => b.level - a.level || b.xp - a.xp || b.coins - a.coins).slice(0, limit);
  }
  async publicFarm(farmId: string) {
    const f = [...this.farms.values()].find(x => x.id === farmId);
    return f ? { ...structuredClone(f), playerName: this.players.get(f.playerId)?.name ?? '' } : null;
  }
  async flag(playerId: string, reason: string, detail: unknown) { this.flags.push({ playerId, reason, detail }); }
  async cleanup(now: Date) {
    let sessions = 0;
    for (const [k, s] of this.sessions) if (s.expiresAt <= now) { this.sessions.delete(k); sessions++; }
    return { sessions, logs: 0 };
  }
  async close() { /* nothing to close */ }
}
