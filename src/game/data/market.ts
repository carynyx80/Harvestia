// Commodity market model for the interface. Every number here is SIMULATED:
// licensed reference feeds with source attribution, timestamps and staleness
// checks replace this in Stage 7.
import HV from '../art/sprites';
import type { CropType } from '../world/geometry';

export interface Commodity {
  key: CropType; name: string; unit: string;
  /** simulated real-world reference price per unit (USD) */
  ref: number;
  /** true for crops priced against a real-world reference market */
  referenced: boolean;
}

export const COMMODITIES: Commodity[] = [
  { key: 'wheat', name: 'Wheat', unit: 'bu', ref: 5.48, referenced: true },
  { key: 'corn', name: 'Corn', unit: 'bu', ref: 4.27, referenced: true },
  { key: 'soy', name: 'Soybeans', unit: 'bu', ref: 10.36, referenced: true },
  { key: 'coffee', name: 'Coffee', unit: 'lb', ref: 2.61, referenced: true },
  { key: 'cocoa', name: 'Cocoa', unit: 't', ref: 6840, referenced: true },
  { key: 'tomato', name: 'Tomatoes', unit: 'crate', ref: 0, referenced: false },
  { key: 'potato', name: 'Potatoes', unit: 'sack', ref: 0, referenced: false },
  { key: 'rice', name: 'Rice', unit: 'sack', ref: 0, referenced: false },
];

/** Deterministic simulated history (index = day, oldest first), normalised to 100. */
export function series(i: number, days = 60) {
  let v = 100;
  return Array.from({ length: days }, (_, k) => (v += (HV.hash(k, i, 31) - .48) * 3.2));
}
export const change = (s: number[], back = 7) => (s[s.length - 1] - s[s.length - 1 - back]) / s[s.length - 1 - back] * 100;

/**
 * In-game price per harvested unit, in Farm Coins: a bounded blend of the
 * reference move, virtual supply/demand, quality, season and a balancing
 * factor. Bounds keep any single day's move within ±8% and stop real-world
 * prices from driving unlimited payouts.
 */
export function virtualPrice(i: number) {
  const s = series(i);
  const refMove = s[s.length - 1] / 100;
  const parts = [
    { label: 'Reference move (sim)', value: COMMODITIES[i].referenced ? refMove : 1 },
    { label: 'Supply & demand', value: .92 + HV.hash(i, 7, 41) * .16 },
    { label: 'Quality (★★)', value: 1.05 },
    { label: 'Season', value: .97 + HV.hash(i, 8, 41) * .06 },
    { label: 'Economy balancing', value: .9 },
  ];
  const base = 4 + i * 1.7;
  const raw = parts.reduce((p, c) => p * c.value, base);
  return { base, parts, price: Math.round(raw * 100) / 100, bound: .08 };
}

/** A simulated order book around a mid price. */
export function orderBook(mid: number, i: number) {
  const row = (k: number, side: 1 | -1) => ({ price: +(mid * (1 + side * (k + 1) * .006)).toFixed(2), qty: Math.round(20 + HV.hash(k, i, side > 0 ? 51 : 52) * 180) });
  return { asks: Array.from({ length: 6 }, (_, k) => row(k, 1)).reverse(), bids: Array.from({ length: 6 }, (_, k) => row(k, -1)) };
}

export function recentTrades(mid: number, i: number) {
  return Array.from({ length: 8 }, (_, k) => ({
    side: HV.hash(k, i, 61) < .5 ? 'buy' as const : 'sell' as const,
    price: +(mid * (1 + (HV.hash(k, i, 62) - .5) * .02)).toFixed(2),
    qty: Math.round(5 + HV.hash(k, i, 63) * 90),
    ago: `${k * 3 + 1}m`,
  }));
}
