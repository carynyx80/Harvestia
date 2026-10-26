// Farm state: everything a player owns and every running timer, as plain JSON.
// Timestamps are epoch milliseconds so progress continues while the game is closed.
import HV from '../art/sprites';
import { PLOTS, plotCells, type CropType } from '../world/geometry';
import { ANIMALS as DEMO_ANIMALS, INVENTORY as DEMO_INVENTORY } from '../data/demo';
import { CROP_RULES, STAGE_AT, TASKS, type AnimalType } from './rules';

export interface CellState { crop: CropType | null; growth: number; wetUntil: number }
export interface PlotState { unlocked: boolean; fertile: boolean; irrigated: boolean; cells: CellState[] }
export interface AnimalState { id: string; kind: AnimalType; name: string; fedUntil: number; progress: number; ready: boolean; health: number }
export interface TaskState { id: string; base: number }

export interface FarmState {
  v: 1;
  updatedAt: number;
  coins: number;
  xp: number;
  level: number;
  inventory: Record<string, number>;
  plots: PlotState[];
  animals: AnimalState[];
  /** machine item id → level (absent = not owned); storage upgrades count as levels */
  machines: Record<string, number>;
  buildings: Record<string, number>;
  can: number;
  stats: Record<string, number>;
  tasks: TaskState[];
  taskCursor: number;
  nextId: number;
}

const STAGE_GROWTH = (stage: number, jitter: number) => stage >= 3 ? 1 : Math.min(.99, STAGE_AT[stage] + jitter * (STAGE_AT[stage + 1] - STAGE_AT[stage]) * .5);

/** The starter farm, matching the world as first designed. */
export function initialState(now: number): FarmState {
  const plots: PlotState[] = PLOTS.map(p => {
    const cells = plotCells(p).map((c, i): CellState => {
      if (!p.crop || p.kind === 'watered') return { crop: null, growth: 0, wetUntil: p.kind === 'watered' ? now + 90_000 : 0 };
      const stage = p.stage === 3 && HV.hash(c.x, c.y, 2) < .08 ? 2 : p.stage;
      const grow = CROP_RULES[p.crop].grow;
      return { crop: p.crop, growth: STAGE_GROWTH(stage, HV.hash(i, p.index, 5)), wetUntil: HV.hash(p.index, 1, 7) < .55 ? now + grow * 300 : 0 };
    });
    return { unlocked: p.kind !== 'expansion', fertile: false, irrigated: false, cells };
  });
  const animals: AnimalState[] = DEMO_ANIMALS.map((a, i) => ({
    id: `a${i + 1}`, kind: a.kind, name: a.name, health: a.health,
    fedUntil: a.fed > .5 ? now + a.fed * 120_000 : 0, progress: 0, ready: a.readyIn === 'Ready',
  }));
  return {
    v: 1, updatedAt: now, coins: 1250, xp: 0, level: 3,
    inventory: Object.fromEntries(DEMO_INVENTORY.map(r => [r.id, r.qty])),
    plots, animals,
    machines: { 'mach-tractor': 2, 'mach-harvester': 1, 'mach-pump': 1, 'mach-can': 1 },
    buildings: { 'bld-greenhouse': 1, 'bld-dairy': 1 },
    can: 8, stats: {},
    tasks: TASKS.slice(0, 3).map(t => ({ id: t.id, base: 0 })), taskCursor: 3,
    nextId: DEMO_ANIMALS.length + 1,
  };
}

const KEY = 'harvestia.save.v1';

/** Local save until accounts and server persistence arrive in Stage 6. */
export function loadState(now: number): FarmState {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (raw) {
      const s = JSON.parse(raw) as FarmState;
      if (s && s.v === 1 && Array.isArray(s.plots) && s.plots.length === PLOTS.length) return s;
    }
  } catch { /* corrupt or blocked storage: start fresh */ }
  return initialState(now);
}
export function saveState(s: FarmState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full or blocked */ }
}
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
