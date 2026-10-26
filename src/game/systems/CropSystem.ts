// Crop sprites driven by the farm state: one sprite per planting cell, growth
// stage frames with a pop when a stage changes, harvest fly-outs, darker soil
// where it is wet, a water-drop hint on dry crops, a wind ripple across the
// rows, and sparkle glints on ripe crops.
import type * as Phaser from 'phaser';
import { PLOTS, type CropType } from '../world/geometry';
import { cellsOf, isWet, stageOf, type Conditions } from '../sim/engine';
import type { FarmState } from '../sim/state';
import type { EnvironmentSystem } from './EnvironmentSystem';
import type { PixelParticles } from './PixelParticles';

export interface CropFrames {
  sprite(prefix: string, x: number, y: number): Phaser.GameObjects.Sprite;
  setFrame(s: Phaser.GameObjects.Sprite, name: string): void;
  offset(prefix: string): { ox: number; oy: number };
}

interface CropItem {
  plot: number; cell: number; x: number; y: number; box: [number, number, number, number];
  sprite: Phaser.GameObjects.Sprite; crop: CropType | null; stage: number; hop: number; flyT: number;
}
const GREEN = 0x9be07a, GOLD = 0xf7e08a, SOIL = 0x8f5a33;

export class CropSystem {
  private items: CropItem[] = [];
  private byPlot = new Map<number, CropItem[]>();
  private soilG: Phaser.GameObjects.Graphics;
  private hintG: Phaser.GameObjects.Graphics;
  private glintT = 0;
  private synced = false;
  readonly objects: Phaser.GameObjects.GameObject[];

  constructor(scene: Phaser.Scene, private frames: CropFrames, private fx: PixelParticles) {
    this.soilG = scene.add.graphics().setDepth(-950);
    this.hintG = scene.add.graphics().setDepth(60010);
    this.objects = [this.soilG, this.hintG];
    PLOTS.forEach((_, plot) => {
      const list: CropItem[] = cellsOf(plot).map((c, cell) => {
        const sprite = frames.sprite('crop-wheat', c.x, c.y).setDepth(c.y).setVisible(false);
        return { plot, cell, x: c.x, y: c.y, box: c.box, sprite, crop: null, stage: -1, hop: 0, flyT: 0 };
      });
      this.byPlot.set(plot, list);
      this.items.push(...list);
    });
  }

  /** Brings sprites in line with the farm state, animating anything that changed. */
  sync(farm: FarmState) {
    const animate = this.synced;
    for (const it of this.items) {
      const ps = farm.plots[it.plot];
      const ce = ps?.unlocked ? ps.cells[it.cell] : undefined;
      const crop = ce?.crop ?? null, stage = ce?.crop ? stageOf(ce.growth) : -1;
      if (crop === it.crop && stage === it.stage) continue;
      if (it.crop && !crop) {
        // harvested: the plant hops out and fades
        if (animate && it.stage === 3) { it.flyT = .5; this.fx.burst(it.x, it.y - 6, 3, GOLD, { speed: 12, up: 14, life: .6, shape: 'star' }); }
        else it.sprite.setVisible(false);
      } else if (crop) {
        const prefix = `crop-${crop}`;
        this.frames.setFrame(it.sprite, `${prefix}-${stage}`);
        it.sprite.setVisible(true).setAlpha(1);
        it.flyT = 0;
        if (animate) {
          if (!it.crop) this.fx.burst(it.x, it.y - 1, 3, SOIL, { speed: 8, up: 4, life: .35 });
          else if (stage > it.stage && stage > 0) { it.hop = .14; this.fx.burst(it.x, it.y - 3 - stage * 2, 2 + stage, stage === 3 ? GOLD : GREEN, { speed: 10, up: 8, life: .5, shape: stage === 3 ? 'star' : 'dot' }); }
        }
      }
      it.crop = crop; it.stage = stage;
    }
    this.synced = true;
  }

  update(t: number, dt: number, env: EnvironmentSystem, farm: FarmState | null) {
    const amp = .4 + env.wind * .45, freq = 1.1 + env.wind * .7;
    for (const it of this.items) {
      if (!it.sprite.visible) continue;
      const { ox, oy } = this.frames.offset(`crop-${it.crop ?? 'wheat'}`);
      let dy = 0;
      if (it.flyT > 0) {
        it.flyT -= dt;
        const k = 1 - Math.max(0, it.flyT) / .5;
        dy = -Math.round(k * 9); it.sprite.setAlpha(1 - k);
        if (it.flyT <= 0) it.sprite.setVisible(false);
      }
      if (it.hop > 0) { it.hop -= dt; dy -= 1; }
      const sway = it.stage >= 2 ? Math.round(Math.sin(t * freq - it.x * .07 + it.y * .02) * amp) : 0;
      it.sprite.setPosition(it.x + ox + sway, it.y + oy + dy);
    }
    if (!farm) return;

    // wet soil darkens; dry growing crops show a blinking water drop
    const c: Conditions = { weather: env.weather, season: env.season }, now = Date.now();
    const sg = this.soilG, hg = this.hintG;
    sg.clear(); hg.clear();
    const blink = Math.sin(t * 4) > 0;
    for (const it of this.items) {
      const ps = farm.plots[it.plot];
      if (!ps?.unlocked || PLOTS[it.plot].kind === 'paddy') continue;
      const wet = isWet(farm, it.plot, it.cell, now, c);
      const [bx, by, bw, bh] = it.box;
      if (wet) sg.fillStyle(0x24120a, .34).fillRect(bx, by, bw, bh);
      if (!wet && it.crop && it.stage < 3 && blink) {
        const x = it.x, y = it.sprite.y - 3;
        hg.fillStyle(0x3b2414, .9).fillRect(x - 1, y - 1, 3, 4);
        hg.fillStyle(0x55a9e4, 1).fillRect(x, y - 1, 1, 1).fillRect(x - 1 + 1, y, 1, 2);
        hg.fillStyle(0xa6dcf7, 1).fillRect(x, y, 1, 1);
      }
    }

    this.glintT -= dt;
    if (this.glintT <= 0) {
      const ripe = this.items.filter(i => i.stage === 3 && i.sprite.visible && i.flyT <= 0);
      if (ripe.length) { const it = ripe[Math.floor(Math.random() * ripe.length)]; this.fx.emit({ x: it.x + Math.round((Math.random() - .5) * 4), y: it.sprite.y + 1, color: GOLD, shape: 'star', life: .55 }); }
      this.glintT = .12 + Math.random() * .2;
    }
  }

  /** Cells (with boxes) an action would touch, for hover previews. */
  cellBoxes(plot: number, cells: number[]) {
    const list = this.byPlot.get(plot) ?? [];
    return cells.map(i => list[i]?.box).filter(Boolean) as [number, number, number, number][];
  }
}
