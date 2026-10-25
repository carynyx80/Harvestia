// Day/night lighting: a multiply overlay tinted by the sky, warm window and
// lamp light at night, and lightning flashes during storms.
import * as Phaser from 'phaser';
import { WORLD_H, WORLD_W } from '../world/geometry';
import type { EnvironmentSystem } from './EnvironmentSystem';

export const LIGHT_DEPTH = 80000;

/** A stepped (banded) radial glow so light stays pixel-art rather than airbrushed. */
function makeGlowTexture(scene: Phaser.Scene) {
  if (scene.textures.exists('glow')) return;
  const n = 32, c = document.createElement('canvas'); c.width = n; c.height = n;
  const g = c.getContext('2d')!;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const d = Math.hypot(x + .5 - n / 2, y + .5 - n / 2) / (n / 2);
    const a = Math.max(0, Math.ceil((1 - d) * 4) / 4) * .55;
    if (a > 0) { g.fillStyle = `rgba(255,214,140,${a})`; g.fillRect(x, y, 1, 1); }
  }
  scene.textures.addCanvas('glow', c);
}

export class LightingSystem {
  private overlay: Phaser.GameObjects.Rectangle;
  private windowsG: Phaser.GameObjects.Graphics;
  private glows: { img: Phaser.GameObjects.Image; base: number; ph: number }[] = [];
  private flash: Phaser.GameObjects.Rectangle;
  private flashT = 0;
  private nextBolt = 3;
  private reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  readonly objects: Phaser.GameObjects.GameObject[];

  constructor(scene: Phaser.Scene, private windows: [number, number, number, number][], private lamps: [number, number][]) {
    makeGlowTexture(scene);
    this.overlay = scene.add.rectangle(0, 0, WORLD_W, WORLD_H, 0xffffff, 1).setOrigin(0).setDepth(LIGHT_DEPTH).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.windowsG = scene.add.graphics().setDepth(LIGHT_DEPTH + 10);
    for (const [x, y, w, h] of windows) this.glows.push({ img: scene.add.image(x + w / 2, y + h / 2, 'glow').setScale(Math.max(w, h) / 14).setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT_DEPTH + 20), base: .55, ph: Math.random() * 6 });
    for (const [x, y] of lamps) this.glows.push({ img: scene.add.image(x, y + 1, 'glow').setScale(1.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT_DEPTH + 20), base: .9, ph: Math.random() * 6 });
    this.flash = scene.add.rectangle(0, 0, WORLD_W, WORLD_H, 0xeef4ff, 1).setOrigin(0).setDepth(LIGHT_DEPTH + 40).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.objects = [this.overlay, this.windowsG, this.flash, ...this.glows.map(g => g.img)];
  }

  update(t: number, dt: number, env: EnvironmentSystem) {
    const [r, g, b] = env.tint;
    this.overlay.setFillStyle((Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b), 1);

    // lights come on gradually; a gloomy storm switches some on in daytime too
    const lit = Math.max(env.night, env.storm * .55, env.rain > 300 ? .3 : 0);
    const wg = this.windowsG;
    wg.clear();
    if (lit > .02) {
      this.windows.forEach(([x, y, w, h], i) => {
        if (lit < .6 && (i * 7919) % 5 > lit * 8) return; // windows switch on one by one at dusk
        const flicker = .9 + Math.sin(t * 3 + i * 1.7) * .05 + Math.sin(t * 11 + i) * .03;
        wg.fillStyle(0xffd77a, lit * flicker).fillRect(x + 1, y + 1, w - 2, h - 2);
        wg.fillStyle(0xfff2c0, lit * flicker).fillRect(x + 1, y + 1, w - 2, 1);
        wg.fillStyle(0x8a6234, lit * .9).fillRect(x + Math.floor(w / 2), y + 1, 1, h - 2).fillRect(x + 1, y + Math.floor(h / 2), w - 2, 1);
      });
      for (const [x, y] of this.lamps) wg.fillStyle(0xfff2b0, lit).fillRect(x - 1, y, 3, 2);
    }
    for (const gl of this.glows) gl.img.setAlpha(lit * gl.base * (.92 + Math.sin(t * 2.3 + gl.ph) * .08)).setVisible(lit > .02);

    // lightning
    if (env.storm > .5) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) { this.flashT = .45; this.nextBolt = 4 + Math.random() * 9; }
    }
    if (this.flashT > 0) {
      this.flashT -= dt;
      const p = .45 - this.flashT; // two quick pulses
      const a = p < .07 ? .8 : p < .12 ? .1 : p < .2 ? .55 : Math.max(0, .55 - (p - .2) * 2.2);
      this.flash.setAlpha(a * (this.reducedMotion ? .3 : 1));
    } else this.flash.setAlpha(0);
  }
}
