// Commodity market model shared by the server (authoritative) and the browser
// (display and trade previews). The in-game price of each crop is a bounded
// blend of its base value, a real-world reference move, virtual supply and
// demand, season, grade and a balancing factor. Real prices nudge the game
// economy; they never set payouts directly.
import type { CropType } from './geometry';
import type { Season } from './environment';
import { CATALOG_BY_ID } from './catalog';
import { COINS_PER_USD } from './sim/rules';

export interface CommodityDef {
  key: CropType;
  item: string;
  name: string;
  /** reference market this crop follows, if any */
  reference: { label: string; unit: string; perTonne: number } | null;
  group: 'grain' | 'oilseed' | 'tree' | 'vegetable';
}

// perTonne converts the reference's own unit to USD per tonne (1 lb = 0.45359237 kg).
export const COMMODITIES: CommodityDef[] = [
  { key: 'wheat', item: 'crop-wheat', name: 'Wheat', group: 'grain', reference: { label: 'Wheat, US hard red winter', unit: 'USD/t', perTonne: 1 } },
  { key: 'corn', item: 'crop-corn', name: 'Corn', group: 'grain', reference: { label: 'Maize, US No. 2 yellow', unit: 'USD/t', perTonne: 1 } },
  { key: 'soy', item: 'crop-soy', name: 'Soybeans', group: 'oilseed', reference: { label: 'Soybeans, US No. 2 yellow', unit: 'USD/t', perTonne: 1 } },
  { key: 'coffee', item: 'crop-coffee', name: 'Coffee', group: 'tree', reference: { label: 'Coffee, other mild arabica', unit: 'US¢/lb', perTonne: 1000 / 0.45359237 / 100 } },
  { key: 'cocoa', item: 'crop-cocoa', name: 'Cocoa', group: 'tree', reference: { label: 'Cocoa beans', unit: 'USD/t', perTonne: 1 } },
  { key: 'tomato', item: 'crop-tomato', name: 'Tomatoes', group: 'vegetable', reference: null },
  { key: 'potato', item: 'crop-potato', name: 'Potatoes', group: 'vegetable', reference: null },
  { key: 'rice', item: 'crop-rice', name: 'Rice', group: 'grain', reference: null },
];
export const COMMODITY_BY_ITEM: Record<string, CommodityDef> = Object.fromEntries(COMMODITIES.map(c => [c.item, c]));
export const COMMODITY_BY_KEY: Record<string, CommodityDef> = Object.fromEntries(COMMODITIES.map(c => [c.key, c]));

/** Tunable market rules. */
export const MARKET = {
  /** a real-world move can push the game price at most this far from its base */
  refBounds: [0.75, 1.35] as const,
  /** net units sold to the exchange that move the price by 100% (bounded below) */
  depth: 4000,
  demandBounds: [0.85, 1.15] as const,
  /** supply/demand pressure halves every 6 hours */
  pressureHalfLifeMs: 6 * 3600_000,
  /** the published price is recomputed this often and may move at most `step` each time */
  publishEveryMs: 15 * 60_000,
  step: 0.03,
  /** and at most this far from its price 24 hours earlier */
  dayBand: 0.15,
  /** the exchange buys at mid − spread and sells at mid + spread */
  spread: 0.03,
  /** fee on every exchange trade, on top of the spread */
  fee: 0.01,
  /** per crop and side: largest single order and total per UTC day */
  perOrder: 200,
  perDay: 600,
  /** a monthly reference older than this is stale; the game keeps its last valid value */
  staleAfterMs: 75 * 86_400_000,
  balance: 1,
};

const SEASON_FACTOR: Record<CommodityDef['group'], Record<Season, number>> = {
  grain: { spring: 1.02, summer: 1, autumn: 0.95, winter: 1.04 },
  oilseed: { spring: 1.02, summer: 1.01, autumn: 0.96, winter: 1.03 },
  tree: { spring: 1, summer: 1, autumn: 1, winter: 1.02 },
  vegetable: { spring: 1.03, summer: 0.95, autumn: 0.98, winter: 1.06 },
};

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const round2 = (v: number) => Math.round(v * 100) / 100;
/** Base value of one unit of a crop in Farm Coins (its general-store reference). */
export const baseCoins = (item: string) => CATALOG_BY_ID[item].usd * COINS_PER_USD;

export interface PricePart { key: 'reference' | 'demand' | 'season' | 'quality' | 'balance'; label: string; value: number }
export interface PriceInputs {
  /** latest valid reference ÷ its 24-month average; null when the crop has no reference or none is valid */
  refRatio: number | null;
  /** net units players sold to the exchange (negative = net bought), already decayed */
  pressure: number;
  season: Season;
}

/** Where the price is heading right now, before the per-step bounds. */
export function targetPrice(c: CommodityDef, x: PriceInputs) {
  const parts: PricePart[] = [
    { key: 'reference', label: c.reference ? 'Real-market reference move' : 'No reference market', value: x.refRatio === null ? 1 : clamp(x.refRatio, ...MARKET.refBounds) },
    { key: 'demand', label: 'Player supply & demand', value: clamp(1 - x.pressure / MARKET.depth, ...MARKET.demandBounds) },
    { key: 'season', label: 'Season', value: SEASON_FACTOR[c.group][x.season] },
    { key: 'quality', label: 'Grade (standard)', value: 1 },
    { key: 'balance', label: 'Economy balancing', value: MARKET.balance },
  ];
  const base = baseCoins(c.item);
  return { base, parts, target: round2(parts.reduce((p, q) => p * q.value, base)) };
}

/** Moves the published price toward its target, never more than one step, and never outside the 24-hour band. */
export function nextPrice(prev: number | null, dayAgo: number | null, target: number) {
  if (prev === null) return target;
  let v = clamp(target, prev * (1 - MARKET.step), prev * (1 + MARKET.step));
  if (dayAgo !== null) v = clamp(v, dayAgo * (1 - MARKET.dayBand), dayAgo * (1 + MARKET.dayBand));
  return round2(Math.max(0.01, v));
}

/** Pressure after decay. */
export const decayPressure = (pressure: number, elapsedMs: number) => pressure * 0.5 ** (Math.max(0, elapsedMs) / MARKET.pressureHalfLifeMs);

export interface Quote { mid: number; bid: number; ask: number; at: number }
export const quoteFor = (mid: number, at: number): Quote => ({ mid, bid: round2(mid * (1 - MARKET.spread)), ask: round2(mid * (1 + MARKET.spread)), at });

/** What a trade settles to, in whole coins (fees rounded in the exchange's favour). */
export function tradeTotal(side: 'buy' | 'sell', qty: number, price: number) {
  const gross = qty * price, fee = Math.ceil(gross * MARKET.fee);
  return side === 'buy' ? { gross, fee, total: Math.ceil(gross) + fee } : { gross, fee, total: Math.max(0, Math.floor(gross) - fee) };
}

/** UTC day number, used for daily trading limits. */
export const utcDay = (ms: number) => Math.floor(ms / 86_400_000);

// ------------------------------------------------------------------ API views (GET /v1/market)
export interface RefInfo {
  label: string; unit: string; source: string; attribution: string; license: string; url: string | null;
  /** month the latest valid value covers, as YYYY-MM */
  period: string | null;
  value: number | null; usdPerTonne: number | null;
  /** 24-month average, the baseline the game compares against */
  average: number | null;
  ratio: number | null;
  fetchedAt: number | null; lastOkAt: number | null; lastError: string | null; rejected: number;
  /** ok: used in pricing · stale: too old, not used · outage: provider unreachable, cached value still used · none: no data yet */
  status: 'ok' | 'stale' | 'outage' | 'none';
}
export interface CommodityView {
  key: string; item: string; name: string;
  ref: RefInfo | null;
  price: Quote & { target: number; base: number; parts: PricePart[] } | null;
  change24h: number | null;
  volume24h: number;
  pressure: number;
}
export interface MarketSnapshot {
  updatedAt: number;
  rules: { spread: number; fee: number; perOrder: number; perDay: number; step: number; dayBand: number; publishEveryMs: number; refBounds: readonly [number, number]; demandBounds: readonly [number, number] };
  commodities: CommodityView[];
}
