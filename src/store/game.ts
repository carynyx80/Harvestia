// Shared state between the Phaser world and the React HUD.
import { create } from 'zustand';
import type { CropType } from '@/game/world/geometry';
import type { Hotspot } from '@/game/world/layout';
import type { EnvSnapshot, Season, Weather } from '@/game/env/environment';

export type Tool = 'plant' | 'water' | 'harvest' | 'build' | 'upgrade' | 'inventory';
export type AnimalKind = 'cow' | 'sheep' | 'pig' | 'chicken' | 'duck';

export type Selection =
  | { type: 'hotspot'; hot: Hotspot }
  | { type: 'cell'; hot: Hotspot; col: number; row: number; crop: CropType | null; cropStage: number; tile: [number, number] }
  | { type: 'animal'; kind: AnimalKind; id: number; zone: string }
  | { type: 'farmer'; id: number }
  | { type: 'tile'; tile: [number, number]; terrain: string };

/** HUD → world environment request (any subset); `n` makes repeats distinct. */
export interface EnvCommand { n: number; hour?: number; season?: Season; weather?: Weather; speed?: number }

export interface Hover { label: string; sub: string; sx: number; sy: number }
export interface CameraView { x: number; y: number; zoom: number; w: number; h: number }

interface GameState {
  ready: boolean;
  tool: Tool;
  selected: Selection | null;
  hover: Hover | null;
  camera: CameraView;
  grid: boolean;
  /** HUD → world requests; `n` makes repeated requests distinct */
  focus: { key: string; n: number } | null;
  zoomStep: { dir: 1 | -1; n: number } | null;
  env: EnvSnapshot;
  envCommand: EnvCommand | null;
  setReady(): void;
  setEnv(e: EnvSnapshot): void;
  commandEnv(c: Omit<EnvCommand, 'n'>): void;
  setTool(t: Tool): void;
  select(s: Selection | null): void;
  setHover(h: Hover | null): void;
  setCamera(c: CameraView): void;
  toggleGrid(): void;
  requestFocus(key: string): void;
  requestZoom(dir: 1 | -1): void;
}

export const useGame = create<GameState>((set, get) => ({
  ready: false,
  tool: 'plant',
  selected: null,
  hover: null,
  camera: { x: 0, y: 0, zoom: 2, w: 0, h: 0 },
  grid: false,
  focus: null,
  zoomStep: null,
  env: { hour: 7.5, day: 12, season: 'spring', weather: 'sunny', speed: 1, temp: 16, night: 0 },
  envCommand: null,
  setReady: () => set({ ready: true }),
  setEnv: env => {
    const p = get().env;
    if (p.hour !== env.hour || p.day !== env.day || p.season !== env.season || p.weather !== env.weather || p.speed !== env.speed || p.temp !== env.temp) set({ env });
  },
  commandEnv: c => set({ envCommand: { ...c, n: (get().envCommand?.n ?? 0) + 1 } }),
  setTool: tool => set({ tool }),
  select: selected => set({ selected }),
  setHover: hover => set({ hover }),
  setCamera: c => {
    const p = get().camera;
    if (p.x !== c.x || p.y !== c.y || p.zoom !== c.zoom || p.w !== c.w || p.h !== c.h) set({ camera: c });
  },
  toggleGrid: () => set({ grid: !get().grid }),
  requestFocus: key => set({ focus: { key, n: (get().focus?.n ?? 0) + 1 } }),
  requestZoom: dir => set({ zoomStep: { dir, n: (get().zoomStep?.n ?? 0) + 1 } }),
}));
