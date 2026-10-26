// Shared state between the Phaser world and the React HUD.
import { create } from 'zustand';
import type { Hotspot } from '@/game/world/layout';
import type { EnvSnapshot, Season, Weather } from '@/game/env/environment';
import type { FarmState } from '@/game/sim/state';
import type { Conditions, FarmEvent, Result } from '@/game/sim/engine';

export type Tool = 'plant' | 'water' | 'harvest' | 'build' | 'upgrade' | 'inventory';
export type AnimalKind = 'cow' | 'sheep' | 'pig' | 'chicken' | 'duck';

export type Selection =
  | { type: 'hotspot'; hot: Hotspot }
  | { type: 'cell'; hot: Hotspot; plot: number; cell: number; tile: [number, number] }
  | { type: 'animal'; kind: AnimalKind; id: string; zone: string }
  | { type: 'farmer'; id: number }
  | { type: 'tile'; tile: [number, number]; terrain: string };

/** HUD → world environment request (any subset); `n` makes repeats distinct. */
export interface EnvCommand { n: number; hour?: number; season?: Season; weather?: Weather; speed?: number }

export type PanelId = 'inventory' | 'shop' | 'profile' | 'farm' | 'equipment' | 'livestock' | 'exchange' | 'wallet' | 'coop' | 'competitions';
export interface OpenPanel { id: PanelId; tab?: string }

export interface Toast { id: number; text: string; tone: 'good' | 'bad' | 'info' | 'level' }
export interface Popup { id: number; x: number; y: number; text: string; tone: 'good' | 'gold' | 'blue' }

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
  panel: OpenPanel | null;
  /** seed chosen in the Plant tool's picker (an item id) */
  seed: string;
  /** the player's farm; null until loaded on the client */
  farm: FarmState | null;
  toasts: Toast[];
  popups: Popup[];
  setFarm(f: FarmState): void;
  /** Applies an engine action to the farm; returns false (and shows why) when it was refused. */
  act(fn: (s: FarmState, now: number, c: Conditions) => Result): boolean;
  conditions(): Conditions;
  toast(text: string, tone?: Toast['tone']): void;
  setReady(): void;
  openPanel(id: PanelId, tab?: string): void;
  togglePanel(id: PanelId, tab?: string): void;
  closePanel(): void;
  setSeed(id: string): void;
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

let nextId = 1;
function pushEvents(events: FarmEvent[]) {
  if (!events.length) return;
  const st = useGame.getState();
  const toasts = [...st.toasts], popups = [...st.popups];
  for (const e of events) {
    const id = nextId++;
    if (e.kind === 'toast') toasts.push({ id, text: e.text, tone: e.tone });
    else if (e.kind === 'levelup') toasts.push({ id, text: `Level up! You reached level ${e.level}`, tone: 'level' });
    else popups.push({ id, x: e.x, y: e.y, text: e.text, tone: e.tone });
    setTimeout(() => useGame.setState(s => ({ toasts: s.toasts.filter(t => t.id !== id), popups: s.popups.filter(p => p.id !== id) })), e.kind === 'pop' ? 1600 : 3200);
  }
  useGame.setState({ toasts: toasts.slice(-4), popups: popups.slice(-12) });
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
  panel: null,
  seed: 'seed-wheat',
  farm: null,
  toasts: [],
  popups: [],
  setFarm: farm => set({ farm }),
  conditions: () => ({ weather: get().env.weather, season: get().env.season }),
  act: fn => {
    const farm = get().farm;
    if (!farm) return false;
    const r = fn(farm, Date.now(), get().conditions());
    if (r.state !== farm) set({ farm: r.state });
    pushEvents(r.events);
    return !r.error;
  },
  toast: (text, tone = 'info') => pushEvents([{ kind: 'toast', text, tone: tone === 'level' ? 'good' : tone }]),
  setReady: () => set({ ready: true }),
  openPanel: (id, tab) => set({ panel: { id, tab } }),
  togglePanel: (id, tab) => set({ panel: get().panel?.id === id && (!tab || get().panel?.tab === tab) ? null : { id, tab } }),
  closePanel: () => set({ panel: null }),
  setSeed: seed => set({ seed }),
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
