// Market service: pulls real-world reference prices, validates and stores them,
// publishes bounded in-game prices on a schedule, and records exchange trades.
// The latest snapshot is kept in memory for quotes; the database is the record.
import {
  COMMODITIES, COMMODITY_BY_ITEM, COMMODITY_BY_KEY, MARKET, baseCoins, decayPressure, nextPrice, quoteFor, round2, targetPrice,
  type CommodityDef, type CommodityView, type MarketSnapshot, type Quote, type RefInfo,
} from '../../../shared/market';
import { worldAt } from '../../../shared/world';
import type { MarketRepo, RefRow } from '../store/types';
import type { ReferenceProvider } from './providers';

/** Plausible range per commodity in USD per tonne; anything outside is rejected as a bad print. */
export const REF_BOUNDS: Record<string, [number, number]> = {
  wheat: [60, 1500], corn: [50, 1200], soy: [100, 2500], coffee: [500, 40_000], cocoa: [300, 40_000],
};
/** A month-on-month move larger than this is rejected as an outlier. */
export const MAX_MONTHLY_MOVE = 0.5;
export const HISTORY_MONTHS = 24;
/** The feed counts as down when its last success is older than this. */
const OUTAGE_AFTER_MS = 3 * 86_400_000;

const month = (d: Date) => d.toISOString().slice(0, 7);

export class MarketService {
  snapshot: MarketSnapshot | null = null;
  private quoteMap: Record<string, Quote> = {};

  constructor(private repo: MarketRepo, private provider: ReferenceProvider | null, private log: (msg: string, extra?: unknown) => void = () => {}) {}

  /** Exchange quotes by crop item id, for the engine. */
  quotes(): Record<string, Quote> { return this.quoteMap; }

  /** Fetches, validates and stores the provider's reference prices for every referenced commodity. */
  async refreshReferences(now = Date.now()) {
    if (!this.provider) return { updated: 0 };
    let updated = 0;
    const feeds = new Map((await this.repo.feeds()).map(f => [f.commodity, f]));
    for (const def of COMMODITIES.filter(c => c.reference)) {
      const feed = feeds.get(def.key) ?? { commodity: def.key, source: this.provider.id, lastAttemptAt: null, lastOkAt: null, lastError: null, rejected: 0 };
      feed.lastAttemptAt = new Date(now);
      try {
        const points = await this.provider.fetch(def, AbortSignal.timeout(15_000));
        const { rows, rejected } = validate(def, points, this.provider.id, now);
        if (!rows.length) throw new Error('No valid prices in the response');
        await this.repo.saveReferences(rows);
        Object.assign(feed, { lastOkAt: new Date(now), lastError: null, rejected });
        updated += rows.length;
      } catch (e) {
        feed.lastError = (e as Error).message.slice(0, 200);
        this.log('market reference fetch failed', { commodity: def.key, error: feed.lastError });
      }
      await this.repo.saveFeed(feed);
    }
    return { updated };
  }

  /** Recomputes every commodity's price and publishes it, each moving at most one bounded step. */
  async publish(now = Date.now()) {
    const season = worldAt(now).season;
    const books = new Map((await this.repo.books()).map(b => [b.commodity, b]));
    const latest = new Map((await this.repo.latestPrices()).map(p => [p.commodity, p]));
    const rows = [];
    for (const def of COMMODITIES) {
      const ref = def.reference ? await this.refInfo(def, now) : null;
      const b = books.get(def.key), pressure = b ? decayPressure(b.pressure, now - +b.updatedAt) : 0;
      const t = targetPrice(def, { refRatio: ref && (ref.status === 'ok' || ref.status === 'outage') ? ref.ratio : null, pressure, season });
      const dayAgo = await this.repo.priceBefore(def.key, new Date(now - 86_400_000));
      const mid = nextPrice(latest.get(def.key)?.mid ?? null, dayAgo?.mid ?? null, t.target);
      rows.push({ commodity: def.key, at: new Date(now), mid, target: t.target, parts: t.parts });
    }
    await this.repo.savePrices(rows);
    await this.reload(now);
    return { published: rows.length };
  }

  /** Rebuilds the in-memory snapshot from the database (every instance does this on a timer). */
  async reload(now = Date.now()) {
    const latest = new Map((await this.repo.latestPrices()).map(p => [p.commodity, p]));
    const books = new Map((await this.repo.books()).map(b => [b.commodity, b]));
    const volumes = await this.repo.volumes(new Date(now - 86_400_000));
    const commodities: CommodityView[] = [];
    for (const def of COMMODITIES) {
      const p = latest.get(def.key), dayAgo = await this.repo.priceBefore(def.key, new Date(now - 86_400_000));
      const b = books.get(def.key);
      commodities.push({
        key: def.key, item: def.item, name: def.name,
        ref: def.reference ? await this.refInfo(def, now) : null,
        price: p ? { ...quoteFor(p.mid, +p.at), target: p.target, base: baseCoins(def.item), parts: p.parts } : null,
        change24h: p && dayAgo ? round2((p.mid / dayAgo.mid - 1) * 100) : null,
        volume24h: volumes[def.key] ?? 0,
        pressure: b ? Math.round(decayPressure(b.pressure, now - +b.updatedAt)) : 0,
      });
    }
    this.snapshot = {
      updatedAt: now,
      rules: { spread: MARKET.spread, fee: MARKET.fee, perOrder: MARKET.perOrder, perDay: MARKET.perDay, step: MARKET.step, dayBand: MARKET.dayBand, publishEveryMs: MARKET.publishEveryMs, refBounds: MARKET.refBounds, demandBounds: MARKET.demandBounds },
      commodities,
    };
    this.quoteMap = Object.fromEntries(commodities.filter(c => c.price).map(c => [c.item, quoteFor(c.price!.mid, c.price!.at)]));
    return this.snapshot;
  }

  /** Latest valid reference for a commodity, its 24-month average and the feed's health. */
  async refInfo(def: CommodityDef, now: number): Promise<RefInfo> {
    const since = new Date(now); since.setUTCMonth(since.getUTCMonth() - HISTORY_MONTHS);
    const refs = await this.repo.references(def.key, since);
    const feed = (await this.repo.feeds()).find(f => f.commodity === def.key);
    const last = refs[refs.length - 1];
    const average = refs.length ? refs.reduce((a, r) => a + r.usdPerTonne, 0) / refs.length : null;
    const stale = !last || now - +last.period > MARKET.staleAfterMs;
    const down = !feed?.lastOkAt || !!feed.lastError || now - +feed.lastOkAt > OUTAGE_AFTER_MS;
    return {
      label: def.reference!.label, unit: def.reference!.unit,
      source: this.provider?.name ?? 'No provider configured', attribution: this.provider?.attribution ?? '', license: this.provider?.license ?? '', url: this.provider?.sourceUrl(def) ?? null,
      period: last ? month(last.period) : null, value: last?.value ?? null, usdPerTonne: last ? round2(last.usdPerTonne) : null,
      average: average === null ? null : round2(average), ratio: last && average ? last.usdPerTonne / average : null,
      fetchedAt: last ? +last.fetchedAt : null, lastOkAt: feed?.lastOkAt ? +feed.lastOkAt : null, lastError: feed?.lastError ?? null, rejected: feed?.rejected ?? 0,
      status: !last ? 'none' : stale ? 'stale' : down ? 'outage' : 'ok',
    };
  }

  /** Records a filled trade and moves virtual supply/demand: selling adds pressure (price down), buying removes it. */
  async recordTrade(farmId: string, item: string, side: 'buy' | 'sell', qty: number, price: number, total: number, fee: number, now = Date.now()) {
    const def = COMMODITY_BY_ITEM[item];
    if (!def) return;
    await this.repo.saveTrade({ farmId, commodity: def.key, side, qty, price, total, fee, at: new Date(now) });
    await this.repo.addPressure(def.key, side === 'sell' ? qty : -qty, new Date(now), decayPressure);
  }

  async history(key: string, days: number, now = Date.now()) {
    const def = COMMODITY_BY_KEY[key];
    if (!def) return null;
    const since = new Date(now); since.setUTCMonth(since.getUTCMonth() - HISTORY_MONTHS);
    const [prices, refs, trades] = await Promise.all([
      this.repo.prices(key, new Date(now - days * 86_400_000)),
      def.reference ? this.repo.references(key, since) : Promise.resolve([]),
      this.repo.trades(key, 20),
    ]);
    return {
      key,
      prices: prices.map(p => ({ at: +p.at, mid: p.mid })),
      reference: refs.map(r => ({ period: month(r.period), value: r.value, usdPerTonne: round2(r.usdPerTonne) })),
      trades: trades.map(t => ({ side: t.side, qty: t.qty, price: t.price, at: +t.at })),
    };
  }
}

/** Keeps points that are in range, not in the future and not an outlier against the previous valid point. */
export function validate(def: CommodityDef, points: { period: Date; value: number }[], source: string, now: number) {
  const [lo, hi] = REF_BOUNDS[def.key] ?? [0, Infinity];
  const cutoff = new Date(now); cutoff.setUTCMonth(cutoff.getUTCMonth() - HISTORY_MONTHS - 2);
  const rows: RefRow[] = [];
  let rejected = 0, prev: number | null = null;
  for (const p of points) {
    if (p.period < cutoff) continue;
    const usd = p.value * def.reference!.perTonne;
    const bad = !Number.isFinite(usd) || usd < lo || usd > hi || +p.period > now || (prev !== null && Math.abs(usd / prev - 1) > MAX_MONTHLY_MOVE);
    if (bad) { rejected++; continue; }
    rows.push({ commodity: def.key, period: p.period, value: p.value, unit: def.reference!.unit, usdPerTonne: usd, source, fetchedAt: new Date(now) });
    prev = usd;
  }
  return { rows, rejected };
}
