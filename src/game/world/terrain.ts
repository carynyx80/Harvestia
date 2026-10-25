// Procedural terrain: produces the ground bitmap and a per-pixel terrain-type map.
import HV from '../art/sprites';
import { ARENA, PATHS, PLAZAS, PLOTS, POND, WORLD_H, WORLD_W, riverC, riverHW } from './geometry';

const { hash, noise } = HV;
type RGB = [number, number, number];

export const enum Ground { Grass = 0, Water = 1, Sand = 2, Path = 3, Plaza = 4, Soil = 5, Paddy = 6 }

const cache = new Map<string, RGB>();
const hex = (h: string): RGB => {
  let c = cache.get(h);
  if (!c) { c = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; cache.set(h, c); }
  return c;
};
const GRASS = ['#44943d', '#4ea243', '#59b049', '#66bd50', '#76c958'];

export const TERRAIN = {
  grass(x: number, y: number): RGB {
    const n = noise(x, y, 56, 1) * .55 + noise(x, y, 14, 2) * .3 + hash(x, y, 3) * .15;
    const h = hash(x, y, 6);
    if (h < .022) return hex('#86d466');
    if (h < .05) return hex('#3d8a3a');
    return hex(GRASS[Math.max(0, Math.min(4, Math.floor((n - .25) / .5 * 5)))]);
  },
  path(x: number, y: number, edge: boolean): RGB {
    if (edge) return hex(hash(x, y, 2) < .5 ? '#9c6c3c' : '#a87443');
    const h = hash(x, y, 7);
    if (h < .018) return hex('#8e7a62');
    if (h < .035) return hex('#e8cc96');
    const n = noise(x, y, 6, 4);
    return hex(n < .38 ? '#bb8b52' : n < .66 ? '#c99a60' : '#d4a86c');
  },
  stone(x: number, y: number, edge: boolean): RGB {
    if (edge) return hex('#8f7d62');
    const row = Math.floor(y / 6), off = row % 2 ? 4 : 0;
    if (y % 6 === 0 || (x + off) % 8 === 0) return hex('#a8957a');
    const id = Math.floor((x + off) / 8) * 31 + row * 17;
    const v = ['#dccca8', '#d1c09a', '#e4d6b6', '#cbb991'][Math.floor(hash(id, row, 5) * 4)];
    if ((x + off) % 8 === 1 && y % 6 === 1) return hex('#f0e6cb');
    return hex(hash(x, y, 8) < .06 ? '#bba886' : v);
  },
  soil(lx: number, ly: number, w: number, h: number, watered: boolean): RGB {
    if (lx === 0 || ly === 0 || lx === w - 1 || ly === h - 1) return hex('#4a2a16');
    const m = ly % 10, hh = hash(lx, ly, 9);
    if (watered) return hex(m === 1 ? '#3e2416' : m >= 8 || m === 0 ? '#5e3a24' : hh < .1 ? '#4a2c1a' : '#523220');
    if (m === 1) return hex('#5a3420');
    if (m === 2) return hex('#6b3f24');
    if (m >= 8 || m === 0) return hex(hh < .12 ? '#9c6a3e' : '#8f5a33');
    return hex(hh < .1 ? '#6b3f24' : hh > .93 ? '#94603a' : '#7a4a2a');
  },
  paddy(lx: number, ly: number, w: number, h: number): RGB {
    if (lx < 2 || ly < 2 || lx >= w - 2 || ly >= h - 2) return hex(lx === 0 || ly === 0 || lx === w - 1 || ly === h - 1 ? '#4a2a16' : '#6b4a2e');
    if (ly % 6 === 0) return hex('#7fb0bf');
    return hex(hash(lx, ly, 4) < .05 ? '#a8d8e6' : '#5f93a3');
  },
  water(depth: number, x: number, y: number): RGB {
    let c = depth < 1.5 ? '#86ccf2' : depth < 4 ? '#55a9e4' : depth < 9 ? '#3d8fd6' : '#3079c4';
    const wv = noise(x * .7, y * 2.4, 7, 8);
    if (depth > 3 && wv > .74) c = depth < 9 ? '#55a9e4' : '#3d8fd6';
    if (depth > 4 && wv < .2) c = '#2a6db6';
    return hex(c);
  },
  sand(x: number, y: number, wet: boolean): RGB { return hex(wet ? '#b8a46c' : hash(x, y, 4) < .12 ? '#cbb57a' : '#dcc78f'); },
};

function pathDist(x: number, y: number) {
  let m = 1e9;
  for (const [x1, y1, x2, y2, w] of PATHS) {
    const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy;
    let t = l ? ((x - x1) * dx + (y - y1) * dy) / l : 0;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(x - x1 - t * dx, y - y1 - t * dy) - w;
    if (d < m) m = d;
  }
  return m;
}

export interface TerrainResult { canvas: HTMLCanvasElement; type: Uint8Array; at: (x: number, y: number) => number }

export function buildTerrain(): TerrainResult {
  const canvas = document.createElement('canvas');
  canvas.width = WORLD_W; canvas.height = WORLD_H;
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(WORLD_W, WORLD_H), d = img.data;
  const type = new Uint8Array(WORLD_W * WORLD_H);
  const plots = PLOTS.filter(p => p.kind !== 'expansion');

  for (let y = 0; y < WORLD_H; y++) for (let x = 0; x < WORLD_W; x++) {
    const n1 = noise(x, y, 7, 5);
    const c = riverC(y), hw = riverHW(y), dr = Math.abs(x - c) + (n1 - .5) * 2.5;
    const pd = Math.hypot((x - POND.x) / POND.rx, (y - POND.y) / POND.ry) + (n1 - .5) * .07;
    let col: RGB, ty: Ground;
    if (dr < hw || pd < 1) { ty = Ground.Water; col = TERRAIN.water(dr < hw ? hw - dr : (1 - pd) * POND.ry, x, y); }
    else if (dr < hw + 2.6 || pd < 1.09) { ty = Ground.Sand; col = TERRAIN.sand(x, y, dr < hw + 1 || pd < 1.03); }
    else {
      const pz = PLAZAS.find(([a, b, c2, d2]) => x >= a && x < c2 && y >= b && y < d2);
      if (pz) { ty = Ground.Plaza; col = TERRAIN.stone(x, y, x === pz[0] || y === pz[1] || x === pz[2] - 1 || y === pz[3] - 1); }
      else {
        const pdst = pathDist(x, y), edgeN = (noise(x, y, 5, 9) - .5) * 2.4;
        if (pdst < edgeN) { ty = Ground.Path; col = TERRAIN.path(x, y, pdst > edgeN - 1.6); }
        else {
          const pl = plots.find(p => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h);
          if (pl) {
            ty = pl.kind === 'paddy' ? Ground.Paddy : Ground.Soil;
            col = pl.kind === 'paddy' ? TERRAIN.paddy(x - pl.x, y - pl.y, pl.w, pl.h) : TERRAIN.soil(x - pl.x, y - pl.y, pl.w, pl.h, pl.kind === 'watered');
          } else {
            const ar = Math.hypot((x - ARENA.x) / ARENA.rx, (y - ARENA.y) / ARENA.ry) + (n1 - .5) * .03;
            if (ar > .7 && ar < 1) { ty = Ground.Path; col = TERRAIN.path(x, y, ar < .73 || ar > .97); }
            else { ty = Ground.Grass; col = TERRAIN.grass(x, y); }
          }
        }
      }
    }
    type[y * WORLD_W + x] = ty;
    const i = (y * WORLD_W + x) * 4;
    d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
  }
  // grass lip under soil plots, slightly darker grass next to water
  for (let y = 1; y < WORLD_H - 1; y++) for (let x = 1; x < WORLD_W - 1; x++) {
    if (type[y * WORLD_W + x] !== Ground.Grass) continue;
    const below = type[(y + 1) * WORLD_W + x], above = type[(y - 1) * WORLD_W + x];
    const i = (y * WORLD_W + x) * 4;
    if (above === Ground.Soil || above === Ground.Paddy) { d[i] = 0x35; d[i + 1] = 0x76; d[i + 2] = 0x33; }
    else if (below === Ground.Water || below === Ground.Sand) { d[i] *= .86; d[i + 1] *= .9; d[i + 2] *= .86; }
  }
  g.putImageData(img, 0, 0);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) ? 255 : type[(y | 0) * WORLD_W + (x | 0)];
  return { canvas, type, at };
}
