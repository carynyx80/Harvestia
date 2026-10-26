// World geometry shared by terrain generation, layout and gameplay.
// Units are art pixels; the logical terrain grid is TILE × TILE.
export const WORLD_W = 1024;
export const WORLD_H = 640;
export const TILE = 32;

export const riverC = (y: number) => 650 + 12 * Math.sin(y / 80) + 6 * Math.sin(y / 27 + 1);
export const riverHW = (y: number) => 17 + 3 * Math.sin(y / 45);
export const riverDepth = (x: number, y: number) => riverHW(y) - Math.abs(x - riverC(y));

export const POND = { x: 112, y: 552, rx: 64, ry: 36 };
export const ARENA = { x: 763, y: 525, rx: 52, ry: 46 };

/** [x1, y1, x2, y2, halfWidth] */
export const PATHS: [number, number, number, number, number][] = [
  [0, 200, 1024, 200, 8], [304, 150, 304, 200, 5], [120, 186, 120, 200, 4],
  [330, 200, 330, 476, 5], [140, 476, 330, 476, 4], [840, 200, 840, 612, 6],
  [560, 430, 1012, 430, 5], [560, 346, 560, 430, 4],
];
/** [x1, y1, x2, y2] */
export const PLAZAS: [number, number, number, number][] = [[694, 180, 1016, 278], [810, 404, 1016, 458]];

export type CropType = 'wheat' | 'corn' | 'soy' | 'coffee' | 'cocoa' | 'tomato' | 'potato' | 'rice';
export type PlotKind = 'soil' | 'watered' | 'expansion' | 'paddy';
export interface Plot { index: number; x: number; y: number; w: number; h: number; kind: PlotKind; crop: CropType | null; stage: number }

export const CROP_NAMES: Record<CropType, string> = {
  wheat: 'Wheat', corn: 'Corn', soy: 'Soybeans', coffee: 'Coffee', cocoa: 'Cocoa', tomato: 'Tomatoes', potato: 'Potatoes', rice: 'Rice',
};
export const STAGE_NAMES = ['Seeded', 'Sprouting', 'Growing', 'Ready to harvest'];

const COLS = [24, 96, 168, 240, 348, 420], ROWS = [232, 288, 344, 400];
type PlanCell = [CropType, number] | ['watered'] | ['expansion'];
const PLAN: PlanCell[][] = [
  [['wheat', 3], ['wheat', 3], ['corn', 3], ['corn', 2], ['tomato', 3], ['soy', 2]],
  [['wheat', 2], ['wheat', 1], ['potato', 3], ['potato', 2], ['tomato', 2], ['soy', 3]],
  [['coffee', 3], ['coffee', 2], ['cocoa', 3], ['watered'], ['corn', 1], ['wheat', 0]],
  [['expansion'], ['expansion'], ['soy', 1], ['tomato', 1], ['cocoa', 2], ['potato', 1]],
];

export const PLOTS: Plot[] = [];
ROWS.forEach((py, ri) => COLS.forEach((px, ci) => {
  const cell = PLAN[ri][ci];
  const base = { index: PLOTS.length, x: px, y: py, w: 60, h: 44 };
  if (cell[0] === 'expansion') PLOTS.push({ ...base, kind: 'expansion', crop: null, stage: 0 });
  else if (cell[0] === 'watered') PLOTS.push({ ...base, kind: 'soil', crop: null, stage: 0 });
  else PLOTS.push({ ...base, kind: 'soil', crop: cell[0], stage: cell[1] as number });
}));
PLOTS.push({ index: PLOTS.length, x: 176, y: 490, w: 104, h: 40, kind: 'paddy', crop: 'rice', stage: 3 });

/** Planting cells inside a plot: where each crop sits (bottom-centre) and its clickable box. */
export interface CropCell { plot: number; col: number; row: number; x: number; y: number; box: [number, number, number, number] }
export function plotCells(p: Plot): CropCell[] {
  if (p.kind === 'expansion') return [];
  const crop = p.crop ?? 'wheat';
  const big = crop === 'coffee' || crop === 'cocoa';
  const sx = big ? 14 : p.kind === 'paddy' ? 8 : 9, sy = big ? 14 : 10;
  const cells: CropCell[] = [];
  let row = 0;
  for (let yy = p.y + (big ? 16 : 10); yy < p.y + p.h - 1; yy += sy, row++) {
    let col = 0;
    for (let xx = p.x + (big ? 10 : 6); xx < p.x + p.w - 4; xx += sx, col++)
      cells.push({ plot: p.index, col, row, x: xx, y: yy, box: [xx - Math.floor(sx / 2), yy - sy + 1, sx, sy] });
  }
  return cells;
}
