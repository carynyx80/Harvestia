// Crop sprites: four growth-stage frames per crop, a wind ripple that rolls
// across the fields, sparkle glints on ripe crops, and the growth-demo plot that
// loops seed → sprout → grow → ready → harvest with pop and sparkle effects.
import type * as Phaser from 'phaser';
import type { CropSpec } from '../world/layout';
import type { EnvironmentSystem } from './EnvironmentSystem';
import type { PixelParticles } from './PixelParticles';

export interface CropFrames {
  sprite(prefix: string, x: number, y: number): Phaser.GameObjects.Sprite;
  setFrame(s: Phaser.GameObjects.Sprite, name: string): void;
  offset(prefix: string): { ox: number; oy: number };
}

interface CropItem { spec: CropSpec; sprite: Phaser.GameObjects.Sprite; bx: number; by: number; stage: number; hop: number; demoPhase: string }

// growth-demo timeline (seconds)
const CYCLE = 26;
const PHASES: [number, string, number][] = [[0, 'seed', 0], [3, 'sprout', 1], [8, 'grow', 2], [14, 'ready', 3], [22, 'harvest', 3], [23.2, 'empty', -1]];
const GREEN = 0x9be07a, GOLD = 0xf7e08a, SOIL = 0x8f5a33;

export class CropSystem {
  private items: CropItem[] = [];
  private ripe: CropItem[] = [];
  private glintT = 0;

  constructor(specs: CropSpec[], private frames: CropFrames, private fx: PixelParticles) {
    for (const spec of specs) {
      const prefix = `crop-${spec.crop}`, { ox, oy } = frames.offset(prefix);
      const sprite = frames.sprite(prefix, spec.x, spec.y).setDepth(spec.y);
      frames.setFrame(sprite, `${prefix}-${spec.stage}`);
      const item = { spec, sprite, bx: spec.x + ox, by: spec.y + oy, stage: spec.stage, hop: 0, demoPhase: '' };
      this.items.push(item);
      if (spec.stage === 3 && !spec.demo) this.ripe.push(item);
    }
  }

  private setStage(it: CropItem, stage: number, pop: boolean) {
    if (stage === it.stage) return;
    it.stage = stage;
    if (stage >= 0) this.frames.setFrame(it.sprite, `crop-${it.spec.crop}-${stage}`);
    if (pop && stage > 0) { it.hop = .14; this.fx.burst(it.spec.x, it.spec.y - 3 - stage * 2, 3 + stage, stage === 3 ? GOLD : GREEN, { speed: 10, up: 8, life: .5, shape: stage === 3 ? 'star' : 'dot' }); }
  }

  update(t: number, dt: number, env: EnvironmentSystem) {
    const amp = .4 + env.wind * .45, freq = 1.1 + env.wind * .7;
    for (const it of this.items) {
      const { spec, sprite } = it;
      let dy = 0, alpha = 1;
      if (spec.demo) {
        const local = ((t - spec.col * .45 - spec.row * .9) % CYCLE + CYCLE) % CYCLE;
        let ph = PHASES[0];
        for (const p of PHASES) if (local >= p[0]) ph = p;
        const [start, name, stage] = ph;
        if (name !== it.demoPhase) {
          const first = it.demoPhase === '';
          if (name === 'seed') { this.setStage(it, 0, false); if (!first) this.fx.burst(spec.x, spec.y - 1, 4, SOIL, { speed: 8, up: 4, life: .35 }); }
          else if (name === 'harvest' && !first) this.fx.burst(spec.x, spec.y - 8, 6, GOLD, { speed: 16, up: 18, life: .7, shape: 'star' });
          else if (stage >= 0) this.setStage(it, stage, !first);
          it.demoPhase = name;
        }
        if (name === 'harvest') { const k = (local - start) / 1.2; dy = -Math.round(k * 9); alpha = 1 - k; }
        sprite.setVisible(name !== 'empty');
      }
      if (it.hop > 0) { it.hop -= dt; dy -= 1; }
      // wind ripple rolling across the rows; seedlings stay put
      const sway = it.stage >= 2 ? Math.round(Math.sin(t * freq - spec.x * .07 + spec.y * .02) * amp) : 0;
      sprite.setPosition(it.bx + sway, it.by + dy).setAlpha(alpha);
    }
    // ripe crops twinkle now and then
    this.glintT -= dt;
    if (this.glintT <= 0 && this.ripe.length) {
      const it = this.ripe[Math.floor(Math.random() * this.ripe.length)];
      this.fx.emit({ x: it.spec.x + Math.round((Math.random() - .5) * 4), y: it.sprite.y + 1, color: GOLD, shape: 'star', life: .55 });
      this.glintT = .12 + Math.random() * .2;
    }
  }
}
