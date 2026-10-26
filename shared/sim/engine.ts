// Farm engine: deterministic rules applied to FarmState. Each action takes the
// current state and returns a new state plus events for the interface, or an
// error explaining why it couldn't happen. In Stage 6 the server runs these same
// functions so clients can't fake growth timers or rewards.
import { CROP_NAMES, PLOTS, plotCells, type CropType } from '../geometry';
import { CATALOG_BY_ID as ITEM } from '../catalog';
import type { Season, Weather } from '../environment';
import {
  ANIMAL_RULES, BASE_CAPACITY, BASE_STORAGE, BUILDING_CAPACITY, COINS_PER_USD, CROP_RULES, DROUGHT_DRYING, LAND_ITEMS,
  MACHINE_RULES, SEASON_GROWTH, STAGE_AT, STORAGE_UPGRADE, TASKS, UNAVAILABLE, UNIQUE_BUILDINGS, WATER_SHARE, WEATHER_GROWTH, XP,
  canCapacity, pumpFields, tractorBonus, xpForLevel, type AnimalType,
} from './rules';
import type { AnimalState, FarmState } from './state';

export interface Conditions { weather: Weather; season: Season }
export type FarmEvent =
  | { kind: 'toast'; text: string; tone: 'good' | 'bad' | 'info' }
  | { kind: 'pop'; x: number; y: number; text: string; tone: 'good' | 'gold' | 'blue' }
  | { kind: 'levelup'; level: number };
export interface Result { state: FarmState; events: FarmEvent[]; error?: string }

const clone = (s: FarmState): FarmState => structuredClone(s);
const fail = (state: FarmState, error: string): Result => ({ state, events: [{ kind: 'toast', text: error, tone: 'bad' }], error });

export const stageOf = (growth: number) => growth >= 1 ? 3 : growth >= STAGE_AT[2] ? 2 : growth >= STAGE_AT[1] ? 1 : 0;
export const coinPrice = (itemId: string) => Math.round(ITEM[itemId].usd * COINS_PER_USD);
export const storageCapacity = (s: FarmState) => BASE_STORAGE + (s.machines['mach-storage'] ?? 0) * STORAGE_UPGRADE + (s.buildings['bld-silo'] ?? 0) * 200;
export const storageUsed = (s: FarmState) => Object.values(s.inventory).reduce((a, b) => a + b, 0);
export const animalCapacity = (s: FarmState, kind: AnimalType) =>
  BASE_CAPACITY[kind] + Object.entries(s.buildings).reduce((n, [id, count]) => { const c = BUILDING_CAPACITY[id]; return c && c[0] === kind ? n + c[1] * count : n; }, 0);
export const isPumped = (s: FarmState, plot: number) => (s.machines['mach-pump'] ?? 0) > 0 && pumpFields(s.machines['mach-pump']).includes(plot);
export const isRaining = (c: Conditions) => c.weather === 'rainy' || c.weather === 'stormy';
export const isWet = (s: FarmState, plot: number, cell: number, now: number, c: Conditions) =>
  isRaining(c) || s.plots[plot].irrigated || isPumped(s, plot) || s.plots[plot].cells[cell].wetUntil > now;
export const growthRate = (s: FarmState, c: Conditions) =>
  WEATHER_GROWTH[c.weather] * SEASON_GROWTH[c.season] * (1 + ((s.machines['mach-tractor'] ?? 0) ? tractorBonus(s.machines['mach-tractor']) : 0));

/** Seconds until a cell is ready at current conditions (Infinity while dry). */
export function secondsToReady(s: FarmState, plot: number, cell: number, now: number, c: Conditions) {
  const ce = s.plots[plot].cells[cell];
  if (!ce.crop || ce.growth >= 1) return 0;
  if (!isWet(s, plot, cell, now, c)) return Infinity;
  return (1 - ce.growth) * CROP_RULES[ce.crop].grow / growthRate(s, c);
}

function addXp(s: FarmState, xp: number, events: FarmEvent[]) {
  s.xp += xp;
  while (s.xp >= xpForLevel(s.level)) { s.xp -= xpForLevel(s.level); s.level++; events.push({ kind: 'levelup', level: s.level }); }
}
const bump = (s: FarmState, stat: string, n: number) => { s.stats[stat] = (s.stats[stat] ?? 0) + n; };

/** Advances every timer to `now`. Long gaps (the game was closed) are simulated in one step at the given conditions. */
export function tick(prev: FarmState, now: number, c: Conditions): FarmState {
  const dtMs = now - prev.updatedAt;
  if (dtMs <= 0) return prev;
  const s = clone(prev), dt = dtMs / 1000, rate = growthRate(s, c), raining = isRaining(c);
  s.plots.forEach((p, pi) => {
    if (!p.unlocked) return;
    const always = raining || p.irrigated || isPumped(s, pi);
    for (const ce of p.cells) {
      if (c.weather === 'drought' && ce.wetUntil > prev.updatedAt) ce.wetUntil -= dtMs * (DROUGHT_DRYING - 1);
      if (!ce.crop || ce.growth >= 1) continue;
      // only the part of the gap while the soil was wet counts
      const wetSecs = always ? dt : Math.max(0, Math.min(dt, (ce.wetUntil - prev.updatedAt) / 1000));
      ce.growth = Math.min(1, ce.growth + wetSecs * rate / CROP_RULES[ce.crop].grow);
    }
  });
  for (const a of s.animals) {
    const rule = ANIMAL_RULES[a.kind];
    const fedSecs = Math.max(0, Math.min(dt, (a.fedUntil - prev.updatedAt) / 1000));
    if (!a.ready) { a.progress += fedSecs; if (a.progress >= rule.cycle) { a.ready = true; a.progress = rule.cycle; } }
    const hungrySecs = dt - fedSecs;
    a.health = Math.max(.4, Math.min(1, a.health + fedSecs / (rule.cycle * 10) - hungrySecs / (rule.cycle * 30)));
  }
  s.updatedAt = now;
  return s;
}

// ------------------------------------------------------------------ crops
/** Planting cells of a plot; locked expansion plots get soil cells once bought. */
export const cellsOf = (plot: number) => { const p = PLOTS[plot]; return plotCells(p.kind === 'expansion' ? { ...p, kind: 'soil' } : p); };
/** Cells an action covers: one cell, its row, or the whole field. */
function scope(plot: number, cell: number, kind: 'cell' | 'row' | 'field') {
  const cells = cellsOf(plot);
  if (kind === 'field') return cells.map((_, i) => i);
  if (kind === 'cell') return [cell];
  return cells.map((c, i) => [c, i] as const).filter(([c]) => c.row === cells[cell].row).map(([, i]) => i);
}
const plotCenter = (plot: number) => { const p = PLOTS[plot]; return { x: p.x + p.w / 2, y: p.y + p.h / 2 }; };
/** What the plant/water/harvest tool would cover on this cell (for hover previews). */
export function actionScope(s: FarmState, tool: 'plant' | 'water' | 'harvest', plot: number, cell: number) {
  if (tool === 'plant') return scope(plot, cell, s.machines['mach-planter'] ? 'field' : 'cell');
  if (tool === 'harvest') return scope(plot, cell, s.machines['mach-harvester'] ? 'field' : 'row');
  return scope(plot, cell, 'row');
}

export function plant(prev: FarmState, plot: number, cell: number, seedId: string, now: number): Result {
  const crop = seedId.replace('seed-', '') as CropType, rule = CROP_RULES[crop];
  if (!rule) return fail(prev, 'Choose a seed first');
  const p = prev.plots[plot];
  if (!p?.unlocked) return fail(prev, 'This land is locked — buy it in the Land shop');
  if (rule.level > prev.level) return fail(prev, `${CROP_NAMES[crop]} unlocks at level ${rule.level}`);
  const paddy = PLOTS[plot].kind === 'paddy';
  if (rule.paddy !== paddy) return fail(prev, rule.paddy ? 'Rice only grows in the flooded paddy' : 'The paddy only grows rice');
  const have = prev.inventory[seedId] ?? 0;
  if (have <= 0) return fail(prev, `No ${CROP_NAMES[crop].toLowerCase()} seeds left — buy more in the shop`);
  const targets = actionScope(prev, 'plant', plot, cell).filter(i => !p.cells[i].crop);
  if (!targets.length) return fail(prev, 'Nothing to plant here — the soil is already planted');
  const s = clone(prev), events: FarmEvent[] = [];
  const n = Math.min(targets.length, have);
  for (const i of targets.slice(0, n)) { s.plots[plot].cells[i].crop = crop; s.plots[plot].cells[i].growth = 0; }
  s.inventory[seedId] = have - n;
  if (!s.inventory[seedId]) delete s.inventory[seedId];
  bump(s, 'planted', n); addXp(s, n * XP.plant, events);
  const at = cellsOf(plot)[targets[0]];
  events.push({ kind: 'pop', x: at.x, y: at.y - 8, text: `Planted ${n} ${CROP_NAMES[crop].toLowerCase()}`, tone: 'good' });
  if (n < targets.length) events.push({ kind: 'toast', text: 'Ran out of seeds', tone: 'info' });
  return { state: s, events };
}

export function water(prev: FarmState, plot: number, cell: number, now: number): Result {
  if (!prev.plots[plot]?.unlocked) return fail(prev, 'This land is locked');
  if (prev.can <= 0) return fail(prev, 'Watering can is empty — refill it at the well or pond');
  const s = clone(prev), events: FarmEvent[] = [];
  for (const i of actionScope(s, 'water', plot, cell)) {
    const ce = s.plots[plot].cells[i];
    const secs = ce.crop ? CROP_RULES[ce.crop].grow * WATER_SHARE : 60;
    ce.wetUntil = Math.max(ce.wetUntil, now) + secs * 1000;
  }
  s.can--; bump(s, 'watered', 1);
  const at = cellsOf(plot)[cell];
  events.push({ kind: 'pop', x: at.x, y: at.y - 8, text: 'Watered', tone: 'blue' });
  return { state: s, events };
}

export function refill(prev: FarmState): Result {
  const cap = canCapacity(prev.machines['mach-can'] ?? 1);
  if (prev.can >= cap) return fail(prev, 'The watering can is already full');
  const s = clone(prev); s.can = cap;
  return { state: s, events: [{ kind: 'toast', text: `Watering can refilled (${cap})`, tone: 'info' }] };
}

export function harvest(prev: FarmState, plot: number, cell: number, now: number): Result {
  const p = prev.plots[plot];
  if (!p?.unlocked) return fail(prev, 'This land is locked');
  const targets = actionScope(prev, 'harvest', plot, cell).filter(i => p.cells[i].crop && p.cells[i].growth >= 1);
  if (!targets.length) return fail(prev, p.cells[cell]?.crop ? 'Not ready yet' : 'Nothing to harvest here');
  const s = clone(prev), events: FarmEvent[] = [];
  const cap = storageCapacity(s);
  const got: Partial<Record<CropType, number>> = {};
  let harvested = 0, full = false;
  for (const i of targets) {
    const ce = s.plots[plot].cells[i], crop = ce.crop!;
    const amount = CROP_RULES[crop].yield + (p.fertile ? 1 : 0);
    if (storageUsed(s) + amount > cap) { full = true; break; }
    s.inventory[`crop-${crop}`] = (s.inventory[`crop-${crop}`] ?? 0) + amount;
    got[crop] = (got[crop] ?? 0) + amount;
    ce.crop = null; ce.growth = 0; harvested++;
  }
  if (harvested && s.machines['mach-harvester'] && targets.length > 1) {
    const bonus = s.machines['mach-harvester'] - 1, crop = Object.keys(got)[0] as CropType | undefined;
    if (bonus > 0 && crop && storageUsed(s) + bonus <= cap) { s.inventory[`crop-${crop}`] += bonus; got[crop]! += bonus; }
  }
  if (!harvested) return fail(prev, 'Storage is full — sell produce or upgrade storage');
  bump(s, 'harvested', harvested); addXp(s, harvested * XP.harvest, events);
  const { x, y } = plotCenter(plot);
  for (const [crop, n] of Object.entries(got)) events.push({ kind: 'pop', x, y: y - 10, text: `+${n} ${CROP_NAMES[crop as CropType]}`, tone: 'gold' });
  if (full) events.push({ kind: 'toast', text: 'Storage is full — some crops were left in the field', tone: 'bad' });
  return { state: s, events };
}

// ------------------------------------------------------------------ livestock
const animal = (s: FarmState, id: string) => s.animals.find(a => a.id === id);

export function feed(prev: FarmState, id: string, now: number): Result {
  const a0 = animal(prev, id);
  if (!a0) return fail(prev, 'Animal not found');
  const rule = ANIMAL_RULES[a0.kind];
  if ((prev.inventory[rule.feed] ?? 0) <= 0) return fail(prev, `No ${ITEM[rule.feed].name.toLowerCase()} — buy some in the shop`);
  if (a0.fedUntil - now > rule.cycle * 1000) return fail(prev, `${a0.name} isn't hungry yet`);
  const s = clone(prev), a = animal(s, id)!, events: FarmEvent[] = [];
  a.fedUntil = Math.max(a.fedUntil, now) + rule.cycle * rule.feedCycles * 1000;
  s.inventory[rule.feed]--; if (!s.inventory[rule.feed]) delete s.inventory[rule.feed];
  bump(s, 'fed', 1); addXp(s, XP.feed, events);
  events.push({ kind: 'toast', text: `Fed ${a.name}`, tone: 'good' });
  return { state: s, events };
}

export function collect(prev: FarmState, id: string): Result {
  const a0 = animal(prev, id);
  if (!a0) return fail(prev, 'Animal not found');
  if (!a0.ready) return fail(prev, `${a0.name} has nothing to collect yet`);
  if (storageUsed(prev) + 1 > storageCapacity(prev)) return fail(prev, 'Storage is full');
  const s = clone(prev), a = animal(s, id)!, events: FarmEvent[] = [], product = ANIMAL_RULES[a.kind].product;
  s.inventory[product] = (s.inventory[product] ?? 0) + 1;
  a.ready = false; a.progress = 0;
  bump(s, 'collected', 1); addXp(s, XP.collect, events);
  events.push({ kind: 'toast', text: `+1 ${ITEM[product].name} from ${a.name}`, tone: 'good' });
  return { state: s, events };
}

/** Applies an action to every animal it can, merging the events into one summary. */
function forAll(prev: FarmState, fn: (s: FarmState, id: string) => Result, verb: string): Result {
  let s = prev, done = 0, lastError = '';
  for (const a of prev.animals) { const r = fn(s, a.id); if (r.error) lastError = r.error; else { s = r.state; done++; } }
  if (!done) return fail(prev, lastError || `Nothing to ${verb}`);
  const events: FarmEvent[] = [{ kind: 'toast', text: `${verb[0].toUpperCase() + verb.slice(1)}: ${done} animal${done > 1 ? 's' : ''}`, tone: 'good' }];
  const lvl = s.level - prev.level; if (lvl > 0) events.push({ kind: 'levelup', level: s.level });
  return { state: s, events };
}
export const feedAll = (s: FarmState, now: number) => forAll(s, (st, id) => feed(st, id, now), 'feed');
export const collectAll = (s: FarmState) => forAll(s, (st, id) => collect(st, id), 'collect');

const NAMES: Record<AnimalType, string[]> = {
  chicken: ['Poppy', 'Sunny', 'Biscuit', 'Clucky', 'Maple', 'Pebble', 'Honey', 'Tilly'],
  sheep: ['Snowy', 'Puff', 'Dolly', 'Cloud', 'Lamb Chop', 'Mabel'],
  pig: ['Wilbur', 'Peppa', 'Rosie', 'Bacon Bit', 'Hazel'],
  cow: ['Buttercup', 'Molly', 'Dot', 'Caramel', 'Bessie', 'Hazel'],
};

// ------------------------------------------------------------------ shop & economy
export function buy(prev: FarmState, itemId: string, qty: number, now: number): Result {
  const item = ITEM[itemId];
  if (!item) return fail(prev, 'Unknown item');
  if (UNAVAILABLE[itemId]) return fail(prev, UNAVAILABLE[itemId]);
  qty = Math.max(1, Math.floor(qty));
  const cost = coinPrice(itemId) * qty;
  const s = clone(prev), events: FarmEvent[] = [];
  switch (item.category) {
    case 'seeds': case 'feed': {
      if (storageUsed(s) + qty > storageCapacity(s)) return fail(prev, 'Not enough storage space');
      s.inventory[itemId] = (s.inventory[itemId] ?? 0) + qty; break;
    }
    case 'livestock': {
      const kind = itemId.replace('animal-', '') as AnimalType;
      const have = s.animals.filter(a => a.kind === kind).length, cap = animalCapacity(s, kind);
      if (have + qty > cap) return fail(prev, `The ${ANIMAL_RULES[kind].pen.toLowerCase()} is full (${have}/${cap}) — build more space`);
      for (let k = 0; k < qty; k++) {
        const names = NAMES[kind];
        s.animals.push({ id: `a${s.nextId++}`, kind, name: names[(have + k) % names.length], fedUntil: now + ANIMAL_RULES[kind].cycle * 1000, progress: 0, ready: false, health: 1 });
      }
      break;
    }
    case 'buildings': {
      if (UNIQUE_BUILDINGS.includes(itemId) && s.buildings[itemId]) return fail(prev, `You already have a ${item.name.toLowerCase()}`);
      s.buildings[itemId] = (s.buildings[itemId] ?? 0) + qty; break;
    }
    case 'land': {
      if (itemId === 'land-plot' || itemId === 'land-large') {
        const locked = s.plots.map((p, i) => [p, i] as const).filter(([p]) => !p.unlocked).map(([, i]) => i);
        if (!locked.length) return fail(prev, 'All available land is already unlocked');
        for (const i of locked.slice(0, itemId === 'land-large' ? 2 : 1)) { s.plots[i].unlocked = true; s.plots[i].cells = cellsOf(i).map(() => ({ crop: null, growth: 0, wetUntil: 0 })); }
        events.push({ kind: 'toast', text: 'New land unlocked — it is ready to plant', tone: 'good' });
      } else s.inventory[itemId] = (s.inventory[itemId] ?? 0) + qty; // applied to a field later
      break;
    }
    case 'machinery': {
      if (itemId === 'mach-storage') { s.machines[itemId] = (s.machines[itemId] ?? 0) + qty; break; }
      if (s.machines[itemId]) return fail(prev, `You already own the ${item.name.toLowerCase()} — upgrade it in Equipment`);
      s.machines[itemId] = 1; break;
    }
    default: return fail(prev, 'This item is not sold in the store');
  }
  // checked after the item-specific rules so the player sees the most useful reason
  if (prev.coins < cost) return fail(prev, `Not enough coins — you need ${cost.toLocaleString('en-US')}`);
  s.coins -= cost; bump(s, 'spent', cost);
  events.unshift({ kind: 'toast', text: `Bought ${qty > 1 ? `${qty} × ` : ''}${item.name} for ${cost.toLocaleString('en-US')} coins`, tone: 'good' });
  return { state: s, events };
}

export const SELLABLE = ['crops', 'products', 'goods'];
export function sell(prev: FarmState, itemId: string, qty: number): Result {
  const item = ITEM[itemId], have = prev.inventory[itemId] ?? 0;
  if (!item || !SELLABLE.includes(item.category)) return fail(prev, 'This item cannot be sold here');
  qty = Math.min(have, Math.max(1, Math.floor(qty)));
  if (qty <= 0) return fail(prev, 'Nothing to sell');
  const s = clone(prev), events: FarmEvent[] = [], earned = coinPrice(itemId) * qty;
  s.inventory[itemId] = have - qty; if (!s.inventory[itemId]) delete s.inventory[itemId];
  s.coins += earned; bump(s, 'earned', earned);
  events.push({ kind: 'toast', text: `Sold ${qty} ${item.name.toLowerCase()} for ${earned.toLocaleString('en-US')} coins`, tone: 'good' });
  return { state: s, events };
}

export function upgradeMachine(prev: FarmState, itemId: string): Result {
  const level = prev.machines[itemId] ?? 0, rule = MACHINE_RULES[itemId];
  if (!level || !rule) return fail(prev, "You don't own this machine yet");
  if (level >= rule.maxLevel) return fail(prev, 'Already at maximum level');
  const cost = rule.upgrade(level);
  if (prev.coins < cost) return fail(prev, `Not enough coins — you need ${cost.toLocaleString('en-US')}`);
  const s = clone(prev);
  s.machines[itemId] = level + 1; s.coins -= cost; bump(s, 'spent', cost);
  if (itemId === 'mach-can') s.can = canCapacity(level + 1);
  return { state: s, events: [{ kind: 'toast', text: `${ITEM[itemId].name} upgraded to level ${level + 1}`, tone: 'good' }] };
}

/** Uses a fertile-soil or irrigation item from storage on a field. */
export function improveField(prev: FarmState, itemId: string, plot: number): Result {
  if (!LAND_ITEMS.includes(itemId) || (prev.inventory[itemId] ?? 0) <= 0) return fail(prev, `You have no ${ITEM[itemId]?.name.toLowerCase() ?? 'item'}`);
  const p = prev.plots[plot];
  if (!p?.unlocked) return fail(prev, 'Unlock this land first');
  const field = itemId === 'land-fertile' ? 'fertile' : 'irrigated';
  if (p[field]) return fail(prev, `This field is already ${field}`);
  const s = clone(prev);
  s.plots[plot][field] = true; s.inventory[itemId]--; if (!s.inventory[itemId]) delete s.inventory[itemId];
  return { state: s, events: [{ kind: 'toast', text: itemId === 'land-fertile' ? 'Field enriched: +1 crop per cell' : 'Irrigation channel dug: this field stays watered', tone: 'good' }] };
}

// ------------------------------------------------------------------ tasks
export const taskProgress = (s: FarmState, i: number) => {
  const t = s.tasks[i], rule = TASKS.find(r => r.id === t.id)!;
  return { rule, value: Math.min(rule.target, (s.stats[rule.stat] ?? 0) - t.base) };
};
export function claimTask(prev: FarmState, i: number): Result {
  if (!prev.tasks[i]) return fail(prev, 'No such task');
  const { rule, value } = taskProgress(prev, i);
  if (value < rule.target) return fail(prev, 'Task not finished yet');
  const s = clone(prev), events: FarmEvent[] = [];
  s.coins += rule.coins; addXp(s, rule.xp, events);
  const next = TASKS[s.taskCursor % TASKS.length];
  s.taskCursor++;
  s.tasks[i] = { id: next.id, base: s.stats[next.stat] ?? 0 };
  events.unshift({ kind: 'toast', text: `Task complete: +${rule.coins} coins, +${rule.xp} XP`, tone: 'good' });
  return { state: s, events };
}

export type { AnimalState };
