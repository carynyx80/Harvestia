import type { FarmState } from '../../../shared/sim/state';
import type { PricePart } from '../../../shared/market';

export interface PlayerRow { id: string; name: string; wallet: string | null; createdAt: Date }
export interface FarmRow { id: string; playerId: string; name: string; state: FarmState; lastSeq: number }
export interface LogEntry { seq: number; type: string; payload: unknown; ok: boolean; error?: string }
export interface LeaderRow { farmId: string; name: string; level: number; xp: number; coins: number }

export interface FarmTxResult<T> { next?: FarmRow; log?: LogEntry; value: T }

/** A monthly reference price in the provider's own unit, with its USD-per-tonne equivalent. */
export interface RefRow { commodity: string; period: Date; value: number; unit: string; usdPerTonne: number; source: string; fetchedAt: Date }
/** Health of one reference feed. */
export interface FeedRow { commodity: string; source: string; lastAttemptAt: Date | null; lastOkAt: Date | null; lastError: string | null; rejected: number }
/** One published in-game price. */
export interface PriceRow { commodity: string; at: Date; mid: number; target: number; parts: PricePart[] }
export interface BookRow { commodity: string; pressure: number; updatedAt: Date }
export interface TradeRow { farmId: string; commodity: string; side: 'buy' | 'sell'; qty: number; price: number; total: number; fee: number; at: Date }

/** Persistence for reference prices, published prices, supply/demand and trades. */
export interface MarketRepo {
  saveReferences(rows: RefRow[]): Promise<void>;
  /** oldest first */
  references(commodity: string, since: Date): Promise<RefRow[]>;
  saveFeed(row: FeedRow): Promise<void>;
  feeds(): Promise<FeedRow[]>;
  savePrices(rows: PriceRow[]): Promise<void>;
  /** the newest price of each commodity */
  latestPrices(): Promise<PriceRow[]>;
  /** the newest price at or before `at` */
  priceBefore(commodity: string, at: Date): Promise<PriceRow | null>;
  /** oldest first */
  prices(commodity: string, since: Date): Promise<PriceRow[]>;
  /** decays the stored pressure to `now`, adds `delta`, and saves — atomically */
  addPressure(commodity: string, delta: number, now: Date, decay: (pressure: number, elapsedMs: number) => number): Promise<void>;
  books(): Promise<BookRow[]>;
  saveTrade(row: TradeRow): Promise<void>;
  /** newest first */
  trades(commodity: string, limit: number): Promise<TradeRow[]>;
  /** units traded per commodity since `since` */
  volumes(since: Date): Promise<Record<string, number>>;
}

/** Persistence for players, sessions and farms. Prisma in production, memory in tests. */
export interface Store {
  readonly kind: 'postgres' | 'memory';
  readonly market: MarketRepo;
  createPlayerWithFarm(name: string, farmName: string, state: FarmState, wallet?: string): Promise<{ player: PlayerRow; farm: FarmRow }>;
  deleteSession(tokenHash: string): Promise<void>;
  /** wallet sign-in */
  createNonce(nonce: string, expiresAt: Date): Promise<void>;
  /** marks the nonce used if it exists, is unused and unexpired; false otherwise (atomic) */
  consumeNonce(nonce: string, now: Date): Promise<boolean>;
  playerByWallet(wallet: string): Promise<PlayerRow | null>;
  /** links a wallet to a player with none; false if the player already has one or the wallet is taken */
  linkWallet(playerId: string, wallet: string): Promise<boolean>;
  farmOf(playerId: string): Promise<{ id: string; name: string } | null>;
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
