// Living water: flowing sparkles, lapping shoreline foam, ripples, jumping fish
// and wakes behind swimming ducks.
import type * as Phaser from 'phaser';
import HV from '../art/sprites';
import { POND, WORLD_H, WORLD_W, riverC, riverDepth, riverHW } from '../world/geometry';
import { Ground, type TerrainResult } from '../world/terrain';
import type { EnvironmentSystem } from './EnvironmentSystem';

interface Ripple { x: number; y: number; t: number; max: number }
interface Fish { x: number; y: number; t: number; dir: number }
export interface Swimmer { x: number; y: number; moving: boolean; flip: boolean }

export class WaterSystem {
  private g: Phaser.GameObjects.Graphics;
  private sparks: { x: number; y: number; ph: number; l: number; river: boolean }[] = [];
  private shore: { x: number; y: number; ph: number }[] = [];
  private ripples: Ripple[] = [];
  private fish: Fish[] = [];
  private nextRipple = 1;
  private nextFish = 4;
  readonly objects: Phaser.GameObjects.GameObject[];

  constructor(scene: Phaser.Scene, private terrain: TerrainResult, private swimmers: () => Swimmer[]) {
    this.g = scene.add.graphics().setDepth(-900);
    this.objects = [this.g];
    const at = terrain.at;
    for (let i = 0; i < 2600 && this.sparks.length < 260; i++) {
      const x = Math.floor(HV.hash(i, 3, 70) * WORLD_W), y = Math.floor(HV.hash(i, 4, 70) * WORLD_H);
      if (at(x, y) === Ground.Water && at(x + 4, y) === Ground.Water && at(x - 2, y) === Ground.Water)
        this.sparks.push({ x, y, ph: HV.hash(i, 5, 70) * 6.28, l: 2 + Math.floor(HV.hash(i, 6, 70) * 3), river: Math.abs(riverDepth(x, y)) < 30 && x > 400 });
    }
    for (let y = 1; y < WORLD_H - 1; y++) for (let x = 1; x < WORLD_W - 1; x++) {
      if (at(x, y) !== Ground.Water) continue;
      if (at(x - 1, y) === Ground.Sand || at(x + 1, y) === Ground.Sand || at(x, y - 1) === Ground.Sand || at(x, y + 1) === Ground.Sand)
        if (HV.hash(x, y, 77) < .55) this.shore.push({ x, y, ph: HV.hash(x, y, 78) * 6.28 });
    }
  }

  /** A ripple ring at a point on the water (rain drops, fish, ducks). */
  ripple(x: number, y: number, max = 5) { if (this.ripples.length < 120) this.ripples.push({ x, y, t: 0, max }); }

  private randomWater(): [number, number] {
    if (Math.random() < .5) {
      const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * .75;
      return [POND.x + Math.cos(a) * POND.rx * r, POND.y + Math.sin(a) * POND.ry * r];
    }
    const y = 10 + Math.random() * (WORLD_H - 20);
    return [riverC(y) + (Math.random() - .5) * riverHW(y) * 1.2, y];
  }

  update(t: number, dt: number, env: EnvironmentSystem) {
    const g = this.g; g.clear();
    const frozenEdge = env.season === 'winter';

    // sparkles drifting downstream
    for (const s of this.sparks) {
      const v = Math.sin(t * 1.8 + s.ph);
      if (v < .35) continue;
      let { x, y } = s;
      if (s.river) { y = (s.y + t * 6) % WORLD_H; const c = riverC(y); x = s.x - riverC(s.y) + c; if (Math.abs(x - c) > riverHW(y) - 2) continue; }
      g.fillStyle(v > .8 ? 0xe3f6ff : 0xa6dcf7, 1).fillRect(Math.round(x), Math.round(y), s.l, 1);
    }

    // lapping shoreline foam (a thin ice rim in winter)
    for (const p of this.shore) {
      const v = Math.sin(t * 1.6 + p.ph + (p.x + p.y) * .12);
      if (frozenEdge) { g.fillStyle(0xe8f4fb, .85).fillRect(p.x, p.y, 1, 1); continue; }
      if (v > .55) g.fillStyle(0xeef9ff, .55 + (v - .55)).fillRect(p.x, p.y, 1, 1);
    }

    // ambient ripples and fish
    if ((this.nextRipple -= dt) <= 0) { const [x, y] = this.randomWater(); this.ripple(x, y, 4 + Math.random() * 3); this.nextRipple = .5 + Math.random() * 1.2; }
    if (!frozenEdge && (this.nextFish -= dt) <= 0) { const [x, y] = this.randomWater(); this.fish.push({ x, y, t: 0, dir: Math.random() < .5 ? -1 : 1 }); this.ripple(x, y, 4); this.nextFish = 4 + Math.random() * 6; }
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i]; r.t += dt;
      const k = r.t / 1.1;
      if (k >= 1) { this.ripples.splice(i, 1); continue; }
      const rx = 1 + k * r.max, ry = rx * .45;
      g.fillStyle(0xd8f0ff, .6 * (1 - k));
      for (let a = 0; a < 6.283; a += 6.283 / Math.max(6, Math.round(rx * 3))) g.fillRect(Math.round(r.x + Math.cos(a) * rx), Math.round(r.y + Math.sin(a) * ry), 1, 1);
    }
    for (let i = this.fish.length - 1; i >= 0; i--) {
      const f = this.fish[i]; f.t += dt;
      const k = f.t / .7;
      if (k >= 1) { this.ripple(f.x + f.dir * 8, f.y, 5); this.fish.splice(i, 1); continue; }
      const x = Math.round(f.x + f.dir * 8 * k), y = Math.round(f.y - Math.sin(k * Math.PI) * 7);
      g.fillStyle(0xe8a33a, 1).fillRect(x - (f.dir > 0 ? 2 : 0), y, 3, 1);
      g.fillStyle(0xc87a2a, 1).fillRect(x + (f.dir > 0 ? -3 : 3), y - (k < .5 ? 1 : -1), 1, 1);
      if (k < .2 || k > .8) g.fillStyle(0xe3f6ff, .8).fillRect(Math.round(f.x + f.dir * 8 * k), Math.round(f.y) - 1, 1, 1);
    }

    // wakes behind moving ducks
    for (const d of this.swimmers()) {
      if (!d.moving) continue;
      const bx = Math.round(d.x + (d.flip ? 9 : 0)), by = Math.round(d.y + 5), dir = d.flip ? 1 : -1;
      for (let k = 1; k <= 4; k++) {
        const a = .55 * (1 - k / 5);
        g.fillStyle(0xe3f6ff, a).fillRect(bx + dir * k * 2, by - Math.ceil(k / 2), 1, 1).fillRect(bx + dir * k * 2, by + Math.ceil(k / 2) - 1, 1, 1);
      }
    }
  }
}
