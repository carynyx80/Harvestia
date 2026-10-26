// Player actions as plain data. The client sends these to the server, which
// validates them strictly and applies them with the same engine the client uses
// for instant feedback.
import {
  buy, claimTask, collect, collectAll, collectJob, deliverContract, feed, feedAll, harvest, improveField, plant, refill, sell, skipContract,
  startJob, trade, upgradeMachine, water, type Conditions, type Result,
} from './engine';
import { CATALOG_BY_ID } from '../catalog';
import { COMMODITY_BY_ITEM } from '../market';
import { CONTRACT_SLOTS, FACILITIES, MAX_BATCHES, RECIPE_BY_ID, type Facility } from './rules';
import { PLOTS } from '../geometry';
import type { FarmState } from './state';

export type FarmAction =
  | { type: 'plant'; plot: number; cell: number; seed: string }
  | { type: 'water'; plot: number; cell: number }
  | { type: 'harvest'; plot: number; cell: number }
  | { type: 'refill' }
  | { type: 'feed'; animal: string }
  | { type: 'feedAll' }
  | { type: 'collect'; animal: string }
  | { type: 'collectAll' }
  | { type: 'buy'; item: string; qty: number }
  | { type: 'sell'; item: string; qty: number }
  | { type: 'upgrade'; machine: string }
  | { type: 'improve'; item: string; plot: number }
  | { type: 'claimTask'; index: number }
  | { type: 'trade'; item: string; side: 'buy' | 'sell'; qty: number; limit: number }
  | { type: 'process'; recipe: string; batches: number }
  | { type: 'collectJob'; facility: Facility }
  | { type: 'deliver'; index: number }
  | { type: 'skipContract'; index: number };

export function applyAction(s: FarmState, a: FarmAction, now: number, c: Conditions): Result {
  switch (a.type) {
    case 'plant': return plant(s, a.plot, a.cell, a.seed, now);
    case 'water': return water(s, a.plot, a.cell, now);
    case 'harvest': return harvest(s, a.plot, a.cell, now);
    case 'refill': return refill(s);
    case 'feed': return feed(s, a.animal, now);
    case 'feedAll': return feedAll(s, now);
    case 'collect': return collect(s, a.animal);
    case 'collectAll': return collectAll(s);
    case 'buy': return buy(s, a.item, a.qty, now);
    case 'sell': return sell(s, a.item, a.qty);
    case 'upgrade': return upgradeMachine(s, a.machine);
    case 'improve': return improveField(s, a.item, a.plot);
    case 'claimTask': return claimTask(s, a.index);
    case 'trade': return trade(s, a.item, a.side, a.qty, a.limit, now, c);
    case 'process': return startJob(s, a.recipe, a.batches, now);
    case 'collectJob': return collectJob(s, a.facility, now);
    case 'deliver': return deliverContract(s, a.index, now);
    case 'skipContract': return skipContract(s, a.index, now);
  }
}

const int = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const item = (v: unknown): v is string => typeof v === 'string' && v.length <= 40 && Object.hasOwn(CATALOG_BY_ID, v);
const animalId = (v: unknown): v is string => typeof v === 'string' && /^a\d{1,6}$/.test(v);
const plotIdx = (v: unknown): v is number => int(v, 0, PLOTS.length - 1);

/** Parses an untrusted action. Returns null for anything malformed, unknown or out of range. */
export function parseAction(x: unknown): FarmAction | null {
  if (!x || typeof x !== 'object') return null;
  const a = x as Record<string, unknown>;
  const keys = Object.keys(a);
  const only = (...k: string[]) => keys.every(key => key === 'type' || k.includes(key));
  switch (a.type) {
    case 'plant': return only('plot', 'cell', 'seed') && plotIdx(a.plot) && int(a.cell, 0, 63) && item(a.seed) ? { type: 'plant', plot: a.plot, cell: a.cell, seed: a.seed } : null;
    case 'water': case 'harvest': return only('plot', 'cell') && plotIdx(a.plot) && int(a.cell, 0, 63) ? { type: a.type, plot: a.plot, cell: a.cell } : null;
    case 'refill': case 'feedAll': case 'collectAll': return only() ? { type: a.type } : null;
    case 'feed': case 'collect': return only('animal') && animalId(a.animal) ? { type: a.type, animal: a.animal } : null;
    case 'buy': case 'sell': return only('item', 'qty') && item(a.item) && int(a.qty, 1, 999) ? { type: a.type, item: a.item, qty: a.qty } : null;
    case 'upgrade': return only('machine') && item(a.machine) ? { type: 'upgrade', machine: a.machine } : null;
    case 'improve': return only('item', 'plot') && item(a.item) && plotIdx(a.plot) ? { type: 'improve', item: a.item, plot: a.plot } : null;
    case 'claimTask': return only('index') && int(a.index, 0, 9) ? { type: 'claimTask', index: a.index } : null;
    case 'trade': return only('item', 'side', 'qty', 'limit') && typeof a.item === 'string' && Object.hasOwn(COMMODITY_BY_ITEM, a.item) && (a.side === 'buy' || a.side === 'sell')
      && int(a.qty, 1, 999) && typeof a.limit === 'number' && Number.isFinite(a.limit) && a.limit > 0 && a.limit < 1e6
      ? { type: 'trade', item: a.item, side: a.side, qty: a.qty, limit: a.limit } : null;
    case 'process': return only('recipe', 'batches') && typeof a.recipe === 'string' && Object.hasOwn(RECIPE_BY_ID, a.recipe) && int(a.batches, 1, MAX_BATCHES) ? { type: 'process', recipe: a.recipe, batches: a.batches } : null;
    case 'collectJob': return only('facility') && typeof a.facility === 'string' && Object.hasOwn(FACILITIES, a.facility) ? { type: 'collectJob', facility: a.facility as Facility } : null;
    case 'deliver': case 'skipContract': return only('index') && int(a.index, 0, CONTRACT_SLOTS - 1) ? { type: a.type, index: a.index } : null;
    default: return null;
  }
}
