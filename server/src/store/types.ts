import type { FarmState } from '../../../shared/sim/state';

export interface PlayerRow { id: string; name: string; wallet: string | null; createdAt: Date }
export interface FarmRow { id: string; playerId: string; name: string; state: FarmState; lastSeq: number }
export interface LogEntry { seq: number; type: string; payload: unknown; ok: boolean; error?: string }
export interface LeaderRow { farmId: string; name: string; level: number; xp: number; coins: number }

export interface FarmTxResult<T> { next?: FarmRow; log?: LogEntry; value: T }

/** Persistence for players, sessions and farms. Prisma in production, memory in tests. */
export interface Store {
  readonly kind: 'postgres' | 'memory';
  createPlayerWithFarm(name: string, farmName: string, state: FarmState): Promise<{ player: PlayerRow; farm: FarmRow }>;
  createSession(playerId: string, tokenHash: string, expiresAt: Date, userAgent?: string): Promise<void>;
  sessionPlayer(tokenHash: string, now: Date): Promise<PlayerRow | null>;
  touch(playerId: string, now: Date): Promise<void>;
  /** Runs `fn` with the player's farm locked against concurrent writes, then saves `next` (and the log entry) atomically. */
  withFarm<T>(playerId: string, fn: (farm: FarmRow) => FarmTxResult<T> | Promise<FarmTxResult<T>>): Promise<T>;
  leaderboard(limit: number): Promise<LeaderRow[]>;
  publicFarm(farmId: string): Promise<(FarmRow & { playerName: string }) | null>;
  flag(playerId: string, reason: string, detail: unknown): Promise<void>;
  cleanup(now: Date, keepLogsDays: number): Promise<{ sessions: number; logs: number }>;
  close(): Promise<void>;
}
