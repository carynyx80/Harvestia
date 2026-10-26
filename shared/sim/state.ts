// Farm state: everything a player owns and every running timer, as plain JSON.
// Timestamps are epoch milliseconds so progress continues while the game is closed.
import { hash } from '../hash';
import { PLOTS, plotCells, type CropType } from '../geometry';
import { ANIMALS as DEMO_ANIMALS, INVENTORY as DEMO_INVENTORY } from '../starter';
import { CROP_RULES, STAGE_AT, TASKS, type AnimalType, type Facility } from './rules';

export interface CellState { crop: CropType | null; growth: number; wetUntil: number }
export interface PlotState { unlocked: boolean; fertile: boolean; irrigated: boolean; cells: CellState[] }
export interface AnimalState { id: string; kind: AnimalType; name: string; fedUntil: number; progress: number; ready: boolean; health: number }
export interface TaskState { id: string; base: number }
export interface JobState { recipe: string; batches: number; startedAt: number; endsAt: number }
/** A delivery contract; `availableAt` in the future means the slot is waiting for a new one. */
export interface ContractState { id: number; items: [string, number][]; coins: number; xp: number; expiresAt: number; availableAt: number }
export interface TradeDay { day: number; bought: Record<string, number>; sold: Record<string, number> }

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
  /** processing job running at each facility */
  jobs: Partial<Record<Facility, JobState>>;
  contracts: ContractState[];
  contractSeq: number;
  /** today's exchange volume per crop, for daily limits */
  trades: TradeDay;
  /** fractional units lost to spoilage, carried until they add up to whole units */
  spoil: Record<string, number>;
}

/** Fills in fields added after a farm was first saved. */
export function migrate(s: FarmState): FarmState {
  if (s.jobs && s.contracts && s.trades && s.spoil && s.contractSeq !== undefined) return s;
  return { ...s, jobs: s.jobs ?? {}, contracts: s.contracts ?? [], contractSeq: s.contractSeq ?? 0, trades: s.trades ?? { day: 0, bought: {}, sold: {} }, spoil: s.spoil ?? {} };
}

const STAGE_GROWTH = (stage: number, jitter: number) => stage >= 3 ? 1 : Math.min(.99, STAGE_AT[stage] + jitter * (STAGE_AT[stage + 1] - STAGE_AT[stage]) * .5);

/** The starter farm, matching the world as first designed. */
export function initialState(now: number): FarmState {
  const plots: PlotState[] = PLOTS.map(p => {
    const cells = plotCells(p).map((c, i): CellState => {
      if (!p.crop || p.kind === 'watered') return { crop: null, growth: 0, wetUntil: p.kind === 'watered' ? now + 90_000 : 0 };
      const stage = p.stage === 3 && hash(c.x, c.y, 2) < .08 ? 2 : p.stage;
      const grow = CROP_RULES[p.crop].grow;
      return { crop: p.crop, growth: STAGE_GROWTH(stage, hash(i, p.index, 5)), wetUntil: hash(p.index, 1, 7) < .55 ? now + grow * 300 : 0 };
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
    jobs: {}, contracts: [], contractSeq: 0, trades: { day: 0, bought: {}, sold: {} }, spoil: {},
  };
}
