// PostgreSQL store via Prisma. Farm writes take a row lock (SELECT … FOR UPDATE)
// inside a transaction, so concurrent requests for one farm apply in order.
import { Prisma, PrismaClient } from '@prisma/client';
import type { FarmRow, FarmTxResult, FeedRow, LeaderRow, MarketRepo, PlayerRow, PriceRow, RefRow, Store, TradeRow } from './types';
import type { FarmState } from '../../../shared/sim/state';

const json = (v: unknown) => v as Prisma.InputJsonValue;
const row = (f: { id: string; playerId: string; name: string; state: Prisma.JsonValue; lastSeq: number }): FarmRow =>
  ({ id: f.id, playerId: f.playerId, name: f.name, state: f.state as unknown as FarmState, lastSeq: f.lastSeq });
const headline = (s: FarmState) => ({ level: s.level, xp: s.xp, coins: s.coins });
const inventoryRows = (farmId: string, s: FarmState) =>
  Object.entries(s.inventory).filter(([, q]) => q > 0).map(([itemId, qty]) => ({ farmId, itemId, qty }));

export class PrismaStore implements Store {
  readonly kind = 'postgres' as const;
  readonly market: MarketRepo;
  constructor(private db = new PrismaClient()) { this.market = new PrismaMarket(db); }

  async createPlayerWithFarm(name: string, farmName: string, state: FarmState, wallet?: string) {
    return this.db.$transaction(async tx => {
      const p = await tx.player.create({ data: { name, wallet } });
      const f = await tx.farm.create({ data: { playerId: p.id, name: farmName, state: json(state), ...headline(state) } });
      await tx.inventoryItem.createMany({ data: inventoryRows(f.id, state) });
      return { player: { id: p.id, name: p.name, wallet: p.wallet, createdAt: p.createdAt } as PlayerRow, farm: row(f) };
    });
  }

  async createSession(playerId: string, tokenHash: string, expiresAt: Date, userAgent?: string) {
    await this.db.session.create({ data: { playerId, tokenHash, expiresAt, userAgent: userAgent?.slice(0, 200) } });
  }

  async sessionPlayer(tokenHash: string, now: Date) {
    const s = await this.db.session.findUnique({ where: { tokenHash }, include: { player: true } });
    if (!s || s.expiresAt <= now) return null;
    const p = s.player;
    return { id: p.id, name: p.name, wallet: p.wallet, createdAt: p.createdAt };
  }

  async deleteSession(tokenHash: string) { await this.db.session.deleteMany({ where: { tokenHash } }); }
  async createNonce(nonce: string, expiresAt: Date) { await this.db.walletNonce.create({ data: { nonce, expiresAt } }); }
  async consumeNonce(nonce: string, now: Date) {
    // one conditional update: only one request can ever use a nonce
    const r = await this.db.walletNonce.updateMany({ where: { nonce, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    return r.count === 1;
  }
  async playerByWallet(wallet: string) {
    const p = await this.db.player.findUnique({ where: { wallet } });
    return p ? { id: p.id, name: p.name, wallet: p.wallet, createdAt: p.createdAt } : null;
  }
  async linkWallet(playerId: string, wallet: string) {
    try {
      const r = await this.db.player.updateMany({ where: { id: playerId, wallet: null }, data: { wallet } });
      return r.count === 1;
    } catch { return false; } // unique constraint: wallet already linked elsewhere
  }
  async farmOf(playerId: string) { return this.db.farm.findUnique({ where: { playerId }, select: { id: true, name: true } }); }

  async touch(playerId: string, now: Date) {
    await this.db.player.update({ where: { id: playerId }, data: { lastSeenAt: now } });
  }

  async withFarm<T>(playerId: string, fn: (farm: FarmRow) => FarmTxResult<T> | Promise<FarmTxResult<T>>): Promise<T> {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Farm" WHERE "playerId" = ${playerId} FOR UPDATE`;
      const f = await tx.farm.findUnique({ where: { playerId } });
      if (!f) throw Object.assign(new Error('Farm not found'), { statusCode: 404 });
      const r = await fn(row(f));
      if (r.next) {
        const s = r.next.state;
        await tx.farm.update({ where: { id: f.id }, data: { state: json(s), lastSeq: r.next.lastSeq, version: { increment: 1 }, ...headline(s) } });
        // mirror inventory into its own table for queries and the future marketplace
        await tx.inventoryItem.deleteMany({ where: { farmId: f.id } });
        await tx.inventoryItem.createMany({ data: inventoryRows(f.id, s) });
      }
      if (r.log) await tx.actionLog.create({ data: { farmId: f.id, seq: r.log.seq, type: r.log.type, payload: json(r.log.payload), ok: r.log.ok, error: r.log.error } });
      return r.value;
    }, { timeout: 10_000 });
  }

  async leaderboard(limit: number): Promise<LeaderRow[]> {
    const rows = await this.db.farm.findMany({ orderBy: [{ level: 'desc' }, { xp: 'desc' }, { coins: 'desc' }], take: limit, select: { id: true, name: true, level: true, xp: true, coins: true } });
    return rows.map(r => ({ farmId: r.id, name: r.name, level: r.level, xp: r.xp, coins: r.coins }));
  }

  async publicFarm(farmId: string) {
    const f = await this.db.farm.findUnique({ where: { id: farmId }, include: { player: { select: { name: true } } } });
    return f ? { ...row(f), playerName: f.player.name } : null;
  }

  async flag(playerId: string, reason: string, detail: unknown) {
    await this.db.flag.create({ data: { playerId, reason, detail: json(detail) } });
  }

  async cleanup(now: Date, keepLogsDays: number) {
    const sessions = await this.db.session.deleteMany({ where: { expiresAt: { lte: now } } });
    await this.db.walletNonce.deleteMany({ where: { expiresAt: { lte: now } } });
    const logs = await this.db.actionLog.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - keepLogsDays * 86_400_000) } } });
    return { sessions: sessions.count, logs: logs.count };
  }

  async close() { await this.db.$disconnect(); }
}

/** Market persistence in PostgreSQL. */
export class PrismaMarket implements MarketRepo {
  constructor(private db: PrismaClient) {}

  async saveReferences(rows: RefRow[]) {
    await this.db.$transaction(rows.map(r => this.db.referencePrice.upsert({
      where: { commodity_period: { commodity: r.commodity, period: r.period } },
      create: r, update: { value: r.value, unit: r.unit, usdPerTonne: r.usdPerTonne, source: r.source, fetchedAt: r.fetchedAt },
    })));
  }
  async references(commodity: string, since: Date) {
    return this.db.referencePrice.findMany({ where: { commodity, period: { gte: since } }, orderBy: { period: 'asc' } });
  }
  async saveFeed(row: FeedRow) {
    await this.db.marketFeed.upsert({ where: { commodity: row.commodity }, create: row, update: row });
  }
  async feeds() { return this.db.marketFeed.findMany(); }
  async savePrices(rows: PriceRow[]) {
    await this.db.commodityPrice.createMany({ data: rows.map(r => ({ ...r, parts: json(r.parts) })) });
  }
  async latestPrices() {
    const rows = await this.db.commodityPrice.findMany({ distinct: ['commodity'], orderBy: [{ commodity: 'asc' }, { at: 'desc' }] });
    return rows.map(priceRow);
  }
  async priceBefore(commodity: string, at: Date) {
    const r = await this.db.commodityPrice.findFirst({ where: { commodity, at: { lte: at } }, orderBy: { at: 'desc' } });
    return r ? priceRow(r) : null;
  }
  async prices(commodity: string, since: Date) {
    return (await this.db.commodityPrice.findMany({ where: { commodity, at: { gte: since } }, orderBy: { at: 'asc' } })).map(priceRow);
  }
  async addPressure(commodity: string, delta: number, now: Date, decay: (p: number, ms: number) => number) {
    await this.db.$transaction(async tx => {
      await tx.$executeRaw`INSERT INTO "CommodityBook" ("commodity", "pressure", "updatedAt") VALUES (${commodity}, 0, ${now}) ON CONFLICT ("commodity") DO NOTHING`;
      const [b] = await tx.$queryRaw<{ pressure: number; updatedAt: Date }[]>`SELECT "pressure", "updatedAt" FROM "CommodityBook" WHERE "commodity" = ${commodity} FOR UPDATE`;
      await tx.commodityBook.update({ where: { commodity }, data: { pressure: decay(b.pressure, +now - +b.updatedAt) + delta, updatedAt: now } });
    });
  }
  async books() { return this.db.commodityBook.findMany(); }
  async saveTrade(row: TradeRow) { await this.db.trade.create({ data: row }); }
  async trades(commodity: string, limit: number) {
    const rows = await this.db.trade.findMany({ where: { commodity }, orderBy: { at: 'desc' }, take: limit });
    return rows.map(t => ({ ...t, side: t.side as 'buy' | 'sell' }));
  }
  async volumes(since: Date) {
    const rows = await this.db.trade.groupBy({ by: ['commodity'], where: { at: { gte: since } }, _sum: { qty: true } });
    return Object.fromEntries(rows.map(r => [r.commodity, r._sum.qty ?? 0]));
  }
}
const priceRow = (r: { commodity: string; at: Date; mid: number; target: number; parts: Prisma.JsonValue }): PriceRow =>
  ({ commodity: r.commodity, at: r.at, mid: r.mid, target: r.target, parts: r.parts as unknown as PriceRow['parts'] });
