// Ambient wildlife that follows the time of day, weather and season.
import * as Phaser from 'phaser';
import HV from '../art/sprites';
import { POND, WORLD_H, WORLD_W, riverC, riverHW } from '../world/geometry';
import { Ground, type TerrainResult } from '../world/terrain';
import type { EnvironmentSystem } from './EnvironmentSystem';
import { LIGHT_DEPTH } from './LightingSystem';

interface Butterfly { hx: number; hy: number; x: number; y: number; tx: number; ty: number; c: number; ph: number }
interface Firefly { x: number; y: number; hx: number; hy: number; ph: number }
const WING = [0xfff6e8, 0xf7d64a, 0xf2a33a, 0x8fc8f0, 0xf08ab0];

export class WildlifeSystem {
  private day: Phaser.GameObjects.Graphics;
  private glowG: Phaser.GameObjects.Graphics;
  private sky: Phaser.GameObjects.Graphics;
  private butterflies: Butterfly[] = [];
  private fireflies: Firefly[] = [];
  private bAlpha = 1;
  private fAlpha = 0;
  readonly objects: Phaser.GameObjects.GameObject[];

  constructor(scene: Phaser.Scene, terrain: TerrainResult) {
    this.day = scene.add.graphics().setDepth(60000);
    this.glowG = scene.add.graphics().setDepth(LIGHT_DEPTH + 30).setBlendMode(Phaser.BlendModes.ADD);
    this.sky = scene.add.graphics().setDepth(LIGHT_DEPTH - 400);
    this.objects = [this.day, this.glowG, this.sky];

    // butterflies settle over meadow near the farm, orchard and village
    const homes: [number, number][] = [[250, 160], [330, 190], [420, 520], [470, 470], [600, 380], [880, 300], [960, 520], [200, 600], [80, 450], [700, 330], [380, 70], [540, 560]];
    homes.forEach(([x, y], i) => {
      if (terrain.at(x, y) === Ground.Water) return;
      this.butterflies.push({ hx: x, hy: y, x, y, tx: x, ty: y, c: WING[i % WING.length], ph: i * 1.3 });
    });
    // fireflies gather by the pond, the river banks and the forest edge
    for (let i = 0; i < 46; i++) {
      let hx: number, hy: number;
      if (i < 14) { const a = HV.hash(i, 1, 90) * 6.283; hx = POND.x + Math.cos(a) * POND.rx * 1.2; hy = POND.y + Math.sin(a) * POND.ry * 1.25; }
      else if (i < 30) { hy = 30 + HV.hash(i, 2, 90) * (WORLD_H - 60); hx = riverC(hy) + (HV.hash(i, 3, 90) < .5 ? -1 : 1) * (riverHW(hy) + 6 + HV.hash(i, 4, 90) * 14); }
      else { hx = HV.hash(i, 5, 90) * WORLD_W; hy = HV.hash(i, 6, 90) < .5 ? 40 + HV.hash(i, 7, 90) * 20 : 590 + HV.hash(i, 7, 90) * 30; }
      this.fireflies.push({ x: hx, y: hy, hx, hy, ph: HV.hash(i, 8, 90) * 6.28 });
    }
  }

  update(t: number, dt: number, env: EnvironmentSystem) {
    const wet = env.rain > 60 || env.snowing;
    const k = 1 - Math.exp(-dt * 1.2);
    this.bAlpha += ((env.night < .3 && !wet && env.season !== 'winter' && env.wind < 1.6 ? 1 : 0) - this.bAlpha) * k;
    this.fAlpha += ((env.night > .55 && !wet && env.season !== 'winter' ? 1 : 0) - this.fAlpha) * k;

    const g = this.day; g.clear();
    if (this.bAlpha > .02) for (const b of this.butterflies) {
      if (Math.hypot(b.tx - b.x, b.ty - b.y) < 2) { b.tx = b.hx + (Math.random() - .5) * 50; b.ty = b.hy + (Math.random() - .5) * 30; }
      const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy) || 1;
      b.x += dx / d * 9 * dt + env.wind * 2 * dt; b.y += dy / d * 9 * dt + Math.sin(t * 7 + b.ph) * 8 * dt;
      const x = Math.round(b.x), y = Math.round(b.y), open = Math.sin(t * 18 + b.ph) > 0;
      g.fillStyle(0x3b2414, this.bAlpha).fillRect(x, y, 1, 1);
      g.fillStyle(b.c, this.bAlpha);
      if (open) g.fillRect(x - 1, y - 1, 1, 2).fillRect(x + 1, y - 1, 1, 2);
      else g.fillRect(x, y - 2, 1, 2);
    }

    const fg = this.glowG; fg.clear();
    if (this.fAlpha > .02) for (const f of this.fireflies) {
      f.x = f.hx + Math.sin(t * .5 + f.ph) * 10; f.y = f.hy + Math.sin(t * .37 + f.ph * 2) * 6;
      const blink = Math.max(0, Math.sin(t * 1.4 + f.ph * 3)) ** 3;
      if (blink < .05) continue;
      const x = Math.round(f.x), y = Math.round(f.y), a = blink * this.fAlpha;
      fg.fillStyle(0xd8ff7a, a).fillRect(x, y, 1, 1);
      fg.fillStyle(0xb8f070, a * .75).fillRect(x - 1, y, 1, 1).fillRect(x + 1, y, 1, 1).fillRect(x, y - 1, 1, 1).fillRect(x, y + 1, 1, 1);
    }

    // a flock crosses the sky in daytime fair weather
    const sg = this.sky; sg.clear();
    if (env.night < .5 && env.storm < .3 && !env.snowing) {
      const bf = Math.floor(t * 5);
      for (let flock = 0; flock < 2; flock++) {
        const dir = flock ? -1 : 1, speed = 22 + flock * 6;
        const lead = flock ? WORLD_W + 60 - ((t * speed + 400) % (WORLD_W + 160)) : ((t * speed) % (WORLD_W + 160)) - 60;
        const baseY = flock ? 300 : 96;
        for (let i = 0; i < 4 + flock; i++) {
          const x = Math.round(lead - dir * (i * 7)), y = Math.round(baseY + Math.abs(i - 1) * 4 + Math.sin(t + i) * 2), u = (bf + i) % 2 ? -1 : 0;
          sg.fillStyle(0x2a2a2a, .9).fillRect(x - 2, y + u, 1, 1).fillRect(x - 1, y + 1, 3, 1).fillRect(x + 2, y + u, 1, 1);
        }
      }
    }
  }
}
