// Tiny pixel particles (sparkles, splashes, dust puffs) drawn into one Graphics.
import type * as Phaser from 'phaser';

export interface Particle {
  x: number; y: number; vx: number; vy: number; ay: number;
  life: number; max: number; color: number; shape: 'dot' | 'plus' | 'star';
}

export class PixelParticles {
  private list: Particle[] = [];
  constructor(private g: Phaser.GameObjects.Graphics) {}

  emit(p: Partial<Particle> & { x: number; y: number }) {
    const life = p.life ?? .6;
    this.list.push({ vx: 0, vy: 0, ay: 0, color: 0xffffff, shape: 'dot', ...p, life, max: life });
  }

  burst(x: number, y: number, n: number, color: number, o: { speed?: number; up?: number; ay?: number; life?: number; shape?: Particle['shape'] } = {}) {
    const sp = o.speed ?? 14;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.emit({ x, y, vx: Math.cos(a) * sp * (.4 + Math.random() * .6), vy: Math.sin(a) * sp * .6 - (o.up ?? 10), ay: o.ay ?? 30, life: (o.life ?? .6) * (.7 + Math.random() * .5), color, shape: o.shape ?? 'dot' });
    }
  }

  update(dt: number) {
    const g = this.g;
    g.clear();
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.vy += p.ay * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const a = Math.min(1, p.life / p.max * 1.6), x = Math.round(p.x), y = Math.round(p.y);
      g.fillStyle(p.color, a);
      if (p.shape === 'dot') g.fillRect(x, y, 1, 1);
      else if (p.shape === 'plus') { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); }
      else { // star: a plus that shrinks to a dot as it fades
        g.fillRect(x, y, 1, 1);
        if (p.life / p.max > .35) { g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1); g.fillRect(x, y - 1, 1, 1); g.fillRect(x, y + 1, 1, 1); }
        if (p.life / p.max > .7) { g.fillStyle(p.color, a * .6); g.fillRect(x - 2, y, 1, 1); g.fillRect(x + 2, y, 1, 1); g.fillRect(x, y - 2, 1, 1); g.fillRect(x, y + 2, 1, 1); }
      }
    }
  }
}
