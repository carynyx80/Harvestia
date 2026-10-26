import { describe, expect, it } from 'vitest';
import { PLOTS } from '../world/geometry';
import {
  buy, cellsOf, claimTask, collect, feed, harvest, plant, refill, sell, stageOf, storageCapacity, storageUsed, tick, upgradeMachine, water,
  type Conditions,
} from './engine';
import { ANIMAL_RULES, CROP_RULES, canCapacity } from './rules';
import { initialState, type FarmState } from './state';

const T0 = 1_700_000_000_000;
const SUNNY: Conditions = { weather: 'sunny', season: 'spring' };
const EMPTY = PLOTS.findIndex(p => p.kind === 'soil' && !p.crop); // the empty field
const PADDY = PLOTS.findIndex(p => p.kind === 'paddy');
const LOCKED = PLOTS.findIndex(p => p.kind === 'expansion');

/** A farm with no tractor bonus so growth maths is easy to check. */
function farm(): FarmState {
  const s = initialState(T0);
  delete s.machines['mach-tractor'];
  return s;
}

describe('crops', () => {
  it('plants one cell, uses a seed and gives XP', () => {
    const s = farm(), seeds = s.inventory['seed-wheat'];
    const r = plant(s, EMPTY, 0, 'seed-wheat', T0);
    expect(r.error).toBeUndefined();
    expect(r.state.plots[EMPTY].cells[0].crop).toBe('wheat');
    expect(r.state.inventory['seed-wheat']).toBe(seeds - 1);
    expect(r.state.stats.planted).toBe(1);
    expect(s.plots[EMPTY].cells[0].crop).toBeNull(); // input is not mutated
  });

  it('refuses locked crops, wrong ground, missing seeds and locked land', () => {
    const s = farm();
    expect(plant(s, EMPTY, 0, 'seed-cocoa', T0).error).toMatch(/level 6/);
    expect(plant(s, PADDY, 0, 'seed-wheat', T0).error).toMatch(/only grows rice/);
    expect(plant(s, EMPTY, 0, 'seed-rice', T0).error).toMatch(/paddy/);
    expect(plant({ ...s, inventory: {} }, EMPTY, 0, 'seed-wheat', T0).error).toMatch(/No wheat seeds/);
    expect(plant(s, LOCKED, 0, 'seed-wheat', T0).error).toMatch(/locked/);
  });

  it('grows only while the soil is wet, then can be harvested', () => {
    let s = plant(farm(), EMPTY, 0, 'seed-wheat', T0).state;
    s.plots[EMPTY].cells[0].wetUntil = 0;
    const grow = CROP_RULES.wheat.grow * 1000;
    s = tick(s, T0 + grow, SUNNY);
    expect(s.plots[EMPTY].cells[0].growth).toBe(0); // dry: no growth
    s = water(s, EMPTY, 0, T0 + grow).state;
    s = tick(s, T0 + grow + grow * .5, SUNNY);
    expect(s.plots[EMPTY].cells[0].growth).toBeCloseTo(.5, 2);
    expect(harvest(s, EMPTY, 0, T0).error).toMatch(/Not ready/);
    // watering lasts 60% of grow time, so a second watering is needed to finish
    s = water(s, EMPTY, 0, T0 + grow * 1.5).state;
    s = tick(s, T0 + grow * 2.1, SUNNY);
    expect(stageOf(s.plots[EMPTY].cells[0].growth)).toBe(3);
    const before = s.inventory['crop-wheat'] ?? 0;
    const r = harvest(s, EMPTY, 0, T0);
    expect(r.state.plots[EMPTY].cells[0].crop).toBeNull();
    expect(r.state.inventory['crop-wheat']).toBeGreaterThan(before);
  });

  it('rain waters every field and weather/season scale growth', () => {
    let s = plant(farm(), EMPTY, 0, 'seed-wheat', T0).state;
    s.plots[EMPTY].cells[0].wetUntil = 0;
    s = tick(s, T0 + 10_000, { weather: 'rainy', season: 'winter' });
    expect(s.plots[EMPTY].cells[0].growth).toBeCloseTo(10 * .5 / CROP_RULES.wheat.grow, 5);
  });

  it('catches up on time spent away in one tick', () => {
    let s = plant(farm(), EMPTY, 0, 'seed-wheat', T0).state;
    s.plots[EMPTY].cells[0].wetUntil = T0 + 8 * 3600_000;
    s = tick(s, T0 + 3600_000, SUNNY);
    expect(s.plots[EMPTY].cells[0].growth).toBe(1);
  });

  it('waters a whole row and empties the can until refilled', () => {
    let s = farm();
    s.can = 1;
    const r = water(s, EMPTY, 0, T0);
    const row = cellsOf(EMPTY)[0].row;
    const rowCells = cellsOf(EMPTY).map((c, i) => [c, i] as const).filter(([c]) => c.row === row);
    expect(rowCells.every(([, i]) => r.state.plots[EMPTY].cells[i].wetUntil > T0)).toBe(true);
    expect(r.state.can).toBe(0);
    expect(water(r.state, EMPTY, 0, T0).error).toMatch(/empty/);
    s = refill(r.state).state;
    expect(s.can).toBe(canCapacity(1));
  });

  it('harvester takes the whole field; storage limits harvests', () => {
    const s = farm();
    const ready = PLOTS.findIndex((_, i) => s.plots[i].cells.some(c => c.crop && c.growth >= 1));
    const cell = s.plots[ready].cells.findIndex(c => c.crop && c.growth >= 1);
    const r = harvest(s, ready, cell, T0);
    expect(r.error).toBeUndefined();
    expect(r.state.plots[ready].cells.some(c => c.crop && c.growth >= 1)).toBe(false); // whole field
    expect(r.state.plots[ready].cells.some(c => c.crop && c.growth < 1)).toBe(s.plots[ready].cells.some(c => c.crop && c.growth < 1)); // unripe stay
    const full = { ...s, inventory: { ...s.inventory, 'crop-potato': (s.inventory['crop-potato'] ?? 0) + storageCapacity(s) - storageUsed(s) } };
    expect(harvest(full, ready, cell, T0).error).toMatch(/Storage is full/);
  });
});

describe('livestock', () => {
  it('produces only while fed, then collects', () => {
    let s = farm();
    const a = s.animals.find(x => x.kind === 'chicken')!;
    a.fedUntil = 0; a.ready = false; a.progress = 0;
    s = tick(s, T0 + 60_000, SUNNY);
    expect(s.animals.find(x => x.id === a.id)!.progress).toBe(0);
    s = feed(s, a.id, T0 + 60_000).state;
    s = tick(s, T0 + 60_000 + ANIMAL_RULES.chicken.cycle * 1000, SUNNY);
    expect(s.animals.find(x => x.id === a.id)!.ready).toBe(true);
    const eggs = s.inventory['prod-egg'] ?? 0;
    const r = collect(s, a.id);
    expect(r.state.inventory['prod-egg']).toBe(eggs + 1);
    expect(collect(r.state, a.id).error).toMatch(/nothing to collect/);
  });
});

describe('economy', () => {
  it('buys seeds with coins and refuses when short', () => {
    const s = farm();
    const r = buy(s, 'seed-corn', 5, T0);
    expect(r.state.coins).toBe(s.coins - 5 * 8);
    expect(r.state.inventory['seed-corn']).toBe((s.inventory['seed-corn'] ?? 0) + 5);
    expect(buy({ ...s, coins: 0 }, 'seed-corn', 1, T0).error).toMatch(/Not enough coins/);
  });

  it('respects pen space, unique buildings and owned machines', () => {
    const s = farm();
    expect(buy({ ...s, coins: 1e6 }, 'animal-cow', 2, T0).error).toMatch(/full/);
    expect(buy(s, 'animal-cow', 1, T0).state.animals.length).toBe(s.animals.length + 1);
    expect(buy(s, 'bld-greenhouse', 1, T0).error).toMatch(/already have/);
    expect(buy(s, 'mach-harvester', 1, T0).error).toMatch(/already own/);
    expect(buy(s, 'land-river', 1, T0).error).toBeTruthy();
  });

  it('unlocks expansion land with soil cells', () => {
    const r = buy(farm(), 'land-plot', 1, T0);
    expect(r.state.plots[LOCKED].unlocked).toBe(true);
    expect(r.state.plots[LOCKED].cells.length).toBeGreaterThan(0);
    expect(plant(r.state, LOCKED, 0, 'seed-wheat', T0).error).toBeUndefined();
  });

  it('sells produce for coins', () => {
    const s = farm(), have = s.inventory['crop-wheat'];
    const r = sell(s, 'crop-wheat', 10);
    expect(r.state.coins).toBe(s.coins + 10 * 8);
    expect(r.state.inventory['crop-wheat']).toBe(have - 10);
    expect(sell(s, 'seed-wheat', 1).error).toBeTruthy();
  });

  it('upgrades machines for coins', () => {
    const s = farm();
    const r = upgradeMachine(s, 'mach-can');
    expect(r.state.machines['mach-can']).toBe(2);
    expect(r.state.can).toBe(canCapacity(2));
    expect(upgradeMachine(s, 'mach-planter').error).toBeTruthy();
  });

  it('pays out finished tasks and rotates in the next one', () => {
    let s = farm();
    expect(claimTask(s, 0).error).toBeTruthy();
    s = { ...s, stats: { planted: 12 } };
    const r = claimTask(s, 0);
    expect(r.state.coins).toBeGreaterThan(s.coins);
    expect(r.state.tasks[0].id).not.toBe('t-plant');
  });
});
