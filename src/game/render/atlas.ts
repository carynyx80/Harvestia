// Turns sprite-library draw calls into packed texture-atlas frames.
//
// The sprite library only ever calls `ctx.fillStyle = c; ctx.fillRect(...)`, so a
// recording context captures a sprite's exact pixels and bounds without knowing
// its size up front. Recorded sprites are shelf-packed into 2048² canvas pages.
import HV from '../art/sprites';

export interface Recording { ops: (string | number)[]; x0: number; y0: number; x1: number; y1: number }

class RecordingContext {
  imageSmoothingEnabled = false;
  private style = '#000';
  rec: Recording = { ops: [], x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  set fillStyle(c: string) { this.style = c; }
  get fillStyle() { return this.style; }
  fillRect(x: number, y: number, w: number, h: number) {
    if (w <= 0 || h <= 0) return;
    const r = this.rec;
    r.ops.push(this.style, x, y, w, h);
    if (x < r.x0) r.x0 = x; if (y < r.y0) r.y0 = y;
    if (x + w > r.x1) r.x1 = x + w; if (y + h > r.y1) r.y1 = y + h;
  }
}

export function record(draw: () => void): Recording {
  const ctx = new RecordingContext();
  HV.use(ctx);
  draw();
  return ctx.rec;
}

/** Replays a recording onto a real 2D context, translated by (dx, dy). */
export function replay(g: CanvasRenderingContext2D, rec: Recording, dx: number, dy: number) {
  const o = rec.ops;
  for (let i = 0; i < o.length; i += 5) {
    g.fillStyle = o[i] as string;
    g.fillRect((o[i + 1] as number) + dx, (o[i + 2] as number) + dy, o[i + 3] as number, o[i + 4] as number);
  }
}

export interface Frame { page: number; name: string; fx: number; fy: number; w: number; h: number; ox: number; oy: number }

const PAGE = 2048, GAP = 1;

export class AtlasBuilder {
  pages: HTMLCanvasElement[] = [];
  frames = new Map<string, Frame>();
  private ctx!: CanvasRenderingContext2D;
  private cx = PAGE; private cy = 0; private shelf = 0;

  private slot(w: number, h: number) {
    if (this.cx + w > PAGE) { this.cx = 0; this.cy += this.shelf + GAP; this.shelf = 0; }
    if (!this.ctx || this.cy + h > PAGE) {
      const c = document.createElement('canvas'); c.width = PAGE; c.height = PAGE;
      this.ctx = c.getContext('2d')!; this.ctx.imageSmoothingEnabled = false;
      this.pages.push(c); this.cx = 0; this.cy = 0; this.shelf = 0;
    }
    const at = { page: this.pages.length - 1, fx: this.cx, fy: this.cy };
    this.cx += w + GAP; this.shelf = Math.max(this.shelf, h);
    return at;
  }

  /** Adds one recording; bounds default to the recording's own pixel bounds. */
  add(name: string, rec: Recording, bounds?: [number, number, number, number]): Frame | null {
    const [x0, y0, x1, y1] = bounds ?? [Math.floor(rec.x0), Math.floor(rec.y0), Math.ceil(rec.x1), Math.ceil(rec.y1)];
    const w = x1 - x0, h = y1 - y0;
    if (!(w > 0 && h > 0)) return null;
    const s = this.slot(w, h);
    this.ctx.save();
    this.ctx.beginPath(); this.ctx.rect(s.fx, s.fy, w, h); this.ctx.clip();
    replay(this.ctx, rec, s.fx - x0, s.fy - y0);
    this.ctx.restore();
    const f: Frame = { ...s, name, w, h, ox: x0, oy: y0 };
    this.frames.set(name, f);
    return f;
  }

  /** Adds frames that share one bounding box so an animation never jitters. */
  addSet(prefix: string, draws: (() => void)[]): Frame[] {
    const recs = draws.map(record);
    const b: [number, number, number, number] = [
      Math.floor(Math.min(...recs.map(r => r.x0))), Math.floor(Math.min(...recs.map(r => r.y0))),
      Math.ceil(Math.max(...recs.map(r => r.x1))), Math.ceil(Math.max(...recs.map(r => r.y1))),
    ];
    return recs.map((r, i) => this.add(`${prefix}-${i}`, r, b)!);
  }
}

/** A 2D-context look-alike that draws sprite-library calls into a Phaser Graphics object. */
export class GraphicsContext {
  imageSmoothingEnabled = false;
  private color = 0; private alpha = 1;
  private static cache = new Map<string, [number, number]>();
  constructor(private g: { fillStyle(c: number, a: number): unknown; fillRect(x: number, y: number, w: number, h: number): unknown }) {}
  set fillStyle(c: string) {
    let v = GraphicsContext.cache.get(c);
    if (!v) { v = parseColor(c); GraphicsContext.cache.set(c, v); }
    [this.color, this.alpha] = v;
  }
  fillRect(x: number, y: number, w: number, h: number) {
    if (w <= 0 || h <= 0) return;
    this.g.fillStyle(this.color, this.alpha);
    this.g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
}

function parseColor(c: string): [number, number] {
  if (c.startsWith('#')) {
    const rgb = parseInt(c.slice(1, 7), 16);
    return [rgb, c.length === 9 ? parseInt(c.slice(7, 9), 16) / 255 : 1];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return [0, 1];
  const [r, g, b, a = '1'] = m[1].split(',').map(s => s.trim());
  return [(+r << 16) | (+g << 8) | +b, +a];
}
