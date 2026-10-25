// Precipitation, cloud shadows, drought dust and autumn leaves.
// Particles live only inside the camera view so density stays constant at any zoom.
import type * as Phaser from 'phaser';
import HV from '../art/sprites';
import { GraphicsContext } from '../render/atlas';
import { Ground, type TerrainResult } from '../world/terrain';
import { WORLD_H, WORLD_W } from '../world/geometry';
import type { EnvironmentSystem } from './EnvironmentSystem';
import { LIGHT_DEPTH } from './LightingSystem';

interface Drop { x: number; y: number; ty: number; v: number; len: number }
interface Flake { x: number; y: number; v: number; ph: number; s: number }
interface Splash { x: number; y: number; t: number; water: boolean }
interface Leaf { x: number; y: number; vy: number; ph: number; c: number }
type View = { x: number; y: number; width: number; height: number };

const LEAF_COLS = [0xe07a2a, 0xc8462f, 0xe8c446, 0xf09a3a];
const CLOUDS: [number, number, number][] = [[120, 120, 1.2], [520, 380, 1.5], [860, 80, 1], [300, 560, 1.3], [700, 260, 1.1], [60, 330, 1.4], [940, 470, 1.2], [420, 40, 1.6], [220, 240, 1], [780, 600, 1.3], [580, 150, 1.2], [10, 520, 1.1], [880, 330, 1.5], [360, 420, 1.2]];

export class WeatherSystem {
  private g: Phaser.GameObjects.Graphics;
  private cloudG: Phaser.GameObjects.Graphics;
  private cloudCtx: GraphicsContext;
  private drops: Drop[] = [];
  private flakes: Flake[] = [];
  private splashes: Splash[] = [];
  private dust: { x: number; y: number; ph: number }[] = [];
  private leaves: Leaf[] = [];
  readonly objects: Phaser.GameObjects.GameObject[];
  /** called when rain lands on water, so the water system can ripple */
  onWaterHit?: (x: number, y: number) => void;

  constructor(scene: Phaser.Scene, private terrain: TerrainResult) {
    this.g = scene.add.graphics().setDepth(LIGHT_DEPTH - 1000);
    this.cloudG = scene.add.graphics().setDepth(LIGHT_DEPTH - 500);
    this.cloudCtx = new GraphicsContext(this.cloudG);
    this.objects = [this.g, this.cloudG];
  }

  update(t: number, dt: number, env: EnvironmentSystem, v: View) {
    const g = this.g; g.clear();
    const area = (v.width * v.height) / (512 * 320);
    const slant = env.wind * .3;
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);

    // ---- rain (or snow in winter)
    const snowing = env.snowing;
    const wantDrops = snowing ? 0 : Math.round(env.rain * Math.min(area, 2.5));
    while (this.drops.length < wantDrops) this.drops.push(this.newDrop(v, true));
    if (this.drops.length > wantDrops) this.drops.length = wantDrops;
    g.fillStyle(0xd6e8fa, .7);
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      d.y += d.v * dt; d.x += d.v * slant * dt;
      if (d.y >= d.ty) {
        const water = this.terrain.at(d.x, d.ty) === Ground.Water;
        if (Math.random() < .5) this.splashes.push({ x: d.x, y: d.ty, t: 0, water });
        if (water && Math.random() < .25) this.onWaterHit?.(d.x, d.ty);
        this.drops[i] = this.newDrop(v, false);
        continue;
      }
      const x = Math.round(d.x), y = Math.round(d.y);
      g.fillRect(x, y, 1, d.len);
      if (slant > .4) g.fillRect(x + 1, y + d.len - 1, 1, 1);
    }
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const s = this.splashes[i]; s.t += dt;
      if (s.t > .3) { this.splashes.splice(i, 1); continue; }
      const x = Math.round(s.x), y = Math.round(s.y), k = s.t / .3;
      g.fillStyle(s.water ? 0xe3f6ff : 0xd8e8f4, .7 * (1 - k));
      if (k < .35) g.fillRect(x, y - 1, 1, 1);
      else { const r = 1 + Math.round(k * 2); g.fillRect(x - r, y, 1, 1); g.fillRect(x + r, y, 1, 1); if (!s.water) { g.fillRect(x - r + 1, y - 1, 1, 1); g.fillRect(x + r - 1, y - 1, 1, 1); } }
    }

    // ---- snow
    const wantFlakes = snowing ? Math.round(Math.max(env.rain * .35, 110) * Math.min(area, 2.5)) : 0;
    while (this.flakes.length < wantFlakes) this.flakes.push({ x: rnd(v.x - 20, v.x + v.width + 20), y: rnd(v.y - 20, v.y + v.height), v: rnd(10, 22), ph: rnd(0, 6.28), s: Math.random() < .25 ? 2 : 1 });
    if (this.flakes.length > wantFlakes) this.flakes.length = wantFlakes;
    g.fillStyle(0xffffff, .9);
    for (const f of this.flakes) {
      f.y += f.v * dt; f.x += (Math.sin(t * 1.3 + f.ph) * 6 + env.wind * 8) * dt;
      if (f.y > v.y + v.height + 4 || f.x > v.x + v.width + 24 || f.x < v.x - 24) { f.y = v.y - 4; f.x = rnd(v.x - 20, v.x + v.width + 20); }
      g.fillRect(Math.round(f.x), Math.round(f.y), f.s, f.s);
    }

    // ---- drought dust
    const wantDust = Math.round(env.dust * Math.min(area, 2.5));
    while (this.dust.length < wantDust) this.dust.push({ x: rnd(v.x, v.x + v.width), y: rnd(v.y, v.y + v.height), ph: rnd(0, 6.28) });
    if (this.dust.length > wantDust) this.dust.length = wantDust;
    for (const d of this.dust) {
      d.x += (10 + Math.sin(t + d.ph) * 4) * dt; d.y += Math.sin(t * 2 + d.ph) * 3 * dt;
      if (d.x > v.x + v.width) { d.x = v.x; d.y = rnd(v.y, v.y + v.height); }
      g.fillStyle(0xd8b878, .35 + Math.sin(t * 3 + d.ph) * .15).fillRect(Math.round(d.x), Math.round(d.y), 1, 1);
    }

    // ---- autumn leaves
    const wantLeaves = env.season === 'autumn' ? Math.round(36 * Math.min(area, 2.5)) : 0;
    while (this.leaves.length < wantLeaves) this.leaves.push({ x: rnd(v.x - 20, v.x + v.width), y: rnd(v.y - 20, v.y + v.height), vy: rnd(6, 12), ph: rnd(0, 6.28), c: LEAF_COLS[Math.floor(Math.random() * LEAF_COLS.length)] });
    if (this.leaves.length > wantLeaves) this.leaves.length = wantLeaves;
    for (const l of this.leaves) {
      l.y += l.vy * dt; l.x += (Math.sin(t * 1.6 + l.ph) * 10 + env.wind * 14) * dt;
      if (l.y > v.y + v.height + 4 || l.x > v.x + v.width + 20) { l.y = v.y - 4; l.x = rnd(v.x - 30, v.x + v.width); }
      const x = Math.round(l.x), y = Math.round(l.y), flat = Math.sin(t * 4 + l.ph) > 0;
      g.fillStyle(l.c, .95).fillRect(x, y, flat ? 2 : 1, flat ? 1 : 2);
    }

    // ---- cloud shadows drifting with the wind
    const cg = this.cloudG; cg.clear();
    const n = Math.round(env.clouds);
    if (n > 0 && env.cloudAlpha > .005) {
      HV.use(this.cloudCtx);
      const col = `rgba(16,40,24,${Math.round(env.cloudAlpha * 100) / 100})`;
      for (let i = 0; i < Math.min(n, CLOUDS.length); i++) {
        const [cx, cy, s] = CLOUDS[i];
        const x = ((cx + t * (3 + env.wind * 5)) % (WORLD_W + 200)) - 100;
        HV.E(x, cy, 26 * s, 10 * s, col); HV.E(x - 18 * s, cy + 3, 14 * s, 7 * s, col); HV.E(x + 20 * s, cy + 2, 16 * s, 8 * s, col);
      }
    }
  }

  private newDrop(v: View, anywhere: boolean): Drop {
    const ty = v.y + Math.random() * v.height;
    const y = anywhere ? v.y - 20 + Math.random() * (v.height + 20) : v.y - 10 - Math.random() * 40;
    return { x: v.x - 30 + Math.random() * (v.width + 40), y: Math.min(y, ty - 1), ty: Math.min(ty, WORLD_H - 1), v: 170 + Math.random() * 70, len: 3 + Math.floor(Math.random() * 3) };
  }
}
