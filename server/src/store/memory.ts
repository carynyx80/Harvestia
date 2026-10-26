// In-memory store for tests and local development without PostgreSQL.
import { randomUUID } from 'node:crypto';
import type { BookRow, ChainRepo, FarmRow, FarmTxResult, FeedRow, LeaderRow, MarketRepo, PlayerRow, PriceRow, PurchaseRow, PurchaseStatus, RefRow, Store, TradeRow, VaultEventRow } from './types';
import type { FarmState } from '../../../shared/sim/state';

export class MemoryStore implements Store {
  readonly kind = 'memory' as const;
  readonly market = new MemoryMarket();
  readonly chain = new MemoryChain();
  private players = new Map<string, PlayerRow>();
  private sessions = new Map<string, { playerId: string; expiresAt: Date }>();
  private farms = new Map<string, FarmRow>(); // by playerId
  private locks = new Map<string, Promise<unknown>>();
  readonly logs: { farmId: string; at: Date; seq: number; type: string; ok: boolean; error?: string }[] = [];
  readonly flags: { playerId: string; reason: string; detail: unknown }[] = [];

  private nonces = new Map<string, { expiresAt: Date; usedAt?: Date }>();

  async createPlayerWithFarm(name: string, farmName: string, state: FarmState, wallet?: string) {
    const player: PlayerRow = { id: randomUUID(), name, wallet: wallet ?? null, createdAt: new Date() };
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
  async deleteSession(tokenHash: string) { this.sessions.delete(tokenHash); }
  async createNonce(nonce: string, expiresAt: Date) { this.nonces.set(nonce, { expiresAt }); }
  async consumeNonce(nonce: string, now: Date) {
    const n = this.nonces.get(nonce);
    if (!n || n.usedAt || n.expiresAt <= now) return false;
    n.usedAt = now; return true;
  }
  async playerByWallet(wallet: string) { return [...this.players.values()].find(p => p.wallet === wallet) ?? null; }
  async linkWallet(playerId: string, wallet: string) {
    const p = this.players.get(playerId);
    if (!p || p.wallet || [...this.players.values()].some(x => x.wallet === wallet)) return false;
    p.wallet = wallet; return true;
  }
  async farmOf(playerId: string) { const f = this.farms.get(playerId); return f ? { id: f.id, name: f.name } : null; }

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

/** In-memory market persistence (tests and local development). */
export class MemoryMarket implements MarketRepo {
  readonly refs = new Map<string, RefRow>();
  readonly feedRows = new Map<string, FeedRow>();
  readonly priceRows: PriceRow[] = [];
  readonly bookRows = new Map<string, BookRow>();
  readonly tradeRows: TradeRow[] = [];

  async saveReferences(rows: RefRow[]) { for (const r of rows) this.refs.set(`${r.commodity}|${r.period.toISOString()}`, { ...r }); }
  async references(commodity: string, since: Date) {
    return [...this.refs.values()].filter(r => r.commodity === commodity && r.period >= since).sort((a, b) => +a.period - +b.period);
  }
  async saveFeed(row: FeedRow) { this.feedRows.set(row.commodity, { ...row }); }
  async feeds() { return [...this.feedRows.values()]; }
  async savePrices(rows: PriceRow[]) { this.priceRows.push(...rows.map(r => ({ ...r }))); }
  async latestPrices() {
    const latest = new Map<string, PriceRow>();
    for (const r of this.priceRows) if (!latest.has(r.commodity) || latest.get(r.commodity)!.at <= r.at) latest.set(r.commodity, r);
    return [...latest.values()];
  }
  async priceBefore(commodity: string, at: Date) {
    return this.priceRows.filter(r => r.commodity === commodity && r.at <= at).sort((a, b) => +b.at - +a.at)[0] ?? null;
  }
  async prices(commodity: string, since: Date) {
    return this.priceRows.filter(r => r.commodity === commodity && r.at >= since).sort((a, b) => +a.at - +b.at);
  }
  async addPressure(commodity: string, delta: number, now: Date, decay: (p: number, ms: number) => number) {
    const b = this.bookRows.get(commodity);
    this.bookRows.set(commodity, { commodity, pressure: (b ? decay(b.pressure, +now - +b.updatedAt) : 0) + delta, updatedAt: now });
  }
  async books() { return [...this.bookRows.values()]; }
  async saveTrade(row: TradeRow) { this.tradeRows.push({ ...row }); }
  async trades(commodity: string, limit: number) { return this.tradeRows.filter(t => t.commodity === commodity).sort((a, b) => +b.at - +a.at).slice(0, limit); }
  async volumes(since: Date) {
    const v: Record<string, number> = {};
    for (const t of this.tradeRows) if (t.at >= since) v[t.commodity] = (v[t.commodity] ?? 0) + t.qty;
    return v;
  }
}

/** In-memory Game Vault persistence (tests and local development). */
export class MemoryChain implements ChainRepo {
  readonly cursors = new Map<string, bigint>();
  readonly eventRows: VaultEventRow[] = [];
  readonly purchaseRows = new Map<string, PurchaseRow>();
  readonly rewardRows: { wallet: string; playerId: string; amountWei: bigint; reason: string; at: Date }[] = [];

  async cursor(name: string) { return this.cursors.get(name) ?? null; }
  async setCursor(name: string, block: bigint) { this.cursors.set(name, block); }
  async saveEvents(rows: VaultEventRow[]) {
    let n = 0;
    for (const r of rows) if (!this.eventRows.some(e => e.txHash === r.txHash && e.logIndex === r.logIndex)) { this.eventRows.push(r); n++; }
    return n;
  }
  async events(f: { player?: string; kinds?: string[]; limit: number }) {
    return this.eventRows.filter(e => (!f.player || e.player === f.player) && (!f.kinds || f.kinds.includes(e.kind)))
      .sort((a, b) => Number(b.block - a.block) || b.logIndex - a.logIndex).slice(0, f.limit);
  }
  async createPurchase(row: PurchaseRow) { this.purchaseRows.set(row.id, { ...row }); }
  async purchase(id: string) { const p = this.purchaseRows.get(id); return p ? { ...p } : null; }
  async movePurchase(id: string, from: PurchaseStatus, patch: Partial<PurchaseRow> & { status: PurchaseStatus }) {
    const p = this.purchaseRows.get(id);
    if (!p || p.status !== from) return false;
    Object.assign(p, patch); return true;
  }
  async purchases(playerId: string, limit: number) { return [...this.purchaseRows.values()].filter(p => p.playerId === playerId).sort((a, b) => +b.createdAt - +a.createdAt).slice(0, limit); }
  async addReward(wallet: string, playerId: string, amountWei: bigint, reason: string) { this.rewardRows.push({ wallet, playerId, amountWei, reason, at: new Date() }); }
  async rewardTotal(wallet: string, since?: Date) { return this.rewardRows.filter(r => r.wallet === wallet && (!since || r.at >= since)).reduce((a, r) => a + r.amountWei, 0n); }
}
