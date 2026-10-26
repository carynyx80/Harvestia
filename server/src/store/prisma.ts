// PostgreSQL store via Prisma. Farm writes take a row lock (SELECT … FOR UPDATE)
// inside a transaction, so concurrent requests for one farm apply in order.
import { Prisma, PrismaClient } from '@prisma/client';
import type { FarmRow, FarmTxResult, LeaderRow, PlayerRow, Store } from './types';
import type { FarmState } from '../../../shared/sim/state';

const json = (v: unknown) => v as Prisma.InputJsonValue;
const row = (f: { id: string; playerId: string; name: string; state: Prisma.JsonValue; lastSeq: number }): FarmRow =>
  ({ id: f.id, playerId: f.playerId, name: f.name, state: f.state as unknown as FarmState, lastSeq: f.lastSeq });
const headline = (s: FarmState) => ({ level: s.level, xp: s.xp, coins: s.coins });
const inventoryRows = (farmId: string, s: FarmState) =>
  Object.entries(s.inventory).filter(([, q]) => q > 0).map(([itemId, qty]) => ({ farmId, itemId, qty }));

export class PrismaStore implements Store {
  readonly kind = 'postgres' as const;
  constructor(private db = new PrismaClient()) {}

  async createPlayerWithFarm(name: string, farmName: string, state: FarmState) {
    return this.db.$transaction(async tx => {
      const p = await tx.player.create({ data: { name } });
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
    const logs = await this.db.actionLog.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - keepLogsDays * 86_400_000) } } });
    return { sessions: sessions.count, logs: logs.count };
  }

  async close() { await this.db.$disconnect(); }
}
