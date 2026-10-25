// The playable world: terrain, every static object as a depth-sorted atlas
// image, animated actors from generated sprite sheets, the living environment
// (day/night, weather, seasons, water, wildlife, crop growth), camera controls
// and object selection. Game rules arrive in later stages; this scene owns
// rendering and input only.
import * as Phaser from 'phaser';
import HV from '../art/sprites';
import { AtlasBuilder, GraphicsContext, record, replay, splitAt, type Frame, type Recording } from '../render/atlas';
import { buildTerrain, type TerrainResult } from '../world/terrain';
import { buildLayout, type ActorSpec, type Hotspot, type WorldLayout } from '../world/layout';
import { PLOTS, TILE, WORLD_H, WORLD_W } from '../world/geometry';
import { seasonSwap } from '../env/palette';
import type { Season } from '../env/environment';
import { EnvironmentSystem } from '../systems/EnvironmentSystem';
import { LightingSystem } from '../systems/LightingSystem';
import { WeatherSystem } from '../systems/WeatherSystem';
import { WaterSystem } from '../systems/WaterSystem';
import { WildlifeSystem } from '../systems/WildlifeSystem';
import { CropSystem } from '../systems/CropSystem';
import { PixelParticles } from '../systems/PixelParticles';
import { useGame, type AnimalKind, type Selection } from '@/store/game';

const ANIMALS: AnimalKind[] = ['cow', 'sheep', 'pig', 'chicken', 'duck'];
const FOOT: Record<string, number> = { cow: 12, sheep: 11, pig: 10, chicken: 7, duck: 5, farmer: 14, tractor: 18 };
const SPEED: Record<AnimalKind, number> = { cow: 5, sheep: 6, pig: 7, chicken: 11, duck: 6 };
const ZONE_OF: Record<AnimalKind, string> = { cow: 'Cow Pasture', sheep: 'Sheep Pen', pig: 'Pig Enclosure', chicken: 'Chicken Coop', duck: 'Duck Pond' };
const TERRAIN_NAME = ['Meadow', 'Water', 'Riverbank', 'Dirt road', 'Cobblestone', 'Tilled soil', 'Rice paddy'];
const MINI = { w: 192, h: 120, pad: 16 };

interface Animal { id: number; kind: AnimalKind; sprite: Phaser.GameObjects.Sprite; x: number; y: number; tx: number; ty: number; moving: boolean; wait: number; flip: boolean; rect: [number, number, number, number]; peck: number; graze: boolean; grazeT: number }
interface Walker { id: number; key: string; sprite: Phaser.GameObjects.Sprite; path: [number, number][]; i: number; x: number; y: number; speed: number; flip: boolean }
interface Tractor { sprite: Phaser.GameObjects.Sprite; x: number; y: number; dir: 1 | -1; minX: number; maxX: number; exhaust: Phaser.GameObjects.Particles.ParticleEmitter }

export class WorldScene extends Phaser.Scene {
  private terrain!: TerrainResult;
  private layout!: WorldLayout;
  private frames = new Map<string, Frame>();
  private animals: Animal[] = [];
  private walkers: Walker[] = [];
  private tractor?: Tractor;
  private waterer?: { x: number; y: number };
  private fx: { g: Phaser.GameObjects.Graphics; ctx: GraphicsContext; draw: (t: number) => void }[] = [];
  private atlas!: AtlasBuilder;
  /** nature frames and flat ground decoration kept as recordings so seasons can recolour them */
  private natureFrames: { name: string; rec: Recording; variant: number }[] = [];
  private groundRecs: { rec: Recording; nature: boolean; variant: number }[] = [];
  private swayers: { img: Phaser.GameObjects.Image; x: number; ph: number }[] = [];
  private windows: [number, number, number, number][] = [];
  private lamps: [number, number][] = [];
  private env = new EnvironmentSystem();
  private lighting!: LightingSystem;
  private weather!: WeatherSystem;
  private water!: WaterSystem;
  private wildlife!: WildlifeSystem;
  private crops!: CropSystem;
  private particles!: PixelParticles;
  private season: Season = 'spring';
  private dry = false;
  private envSync = 0;
  private hoverG!: Phaser.GameObjects.Graphics;
  private gridG!: Phaser.GameObjects.Graphics;
  private viewG!: Phaser.GameObjects.Graphics;
  private mini!: Phaser.Cameras.Scene2D.Camera;
  private hovered: Selection | null = null;
  private drag: { x: number; y: number; sx: number; sy: number; moved: boolean } | null = null;
  private zooms: number[] = [2];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private unsub?: () => void;

  constructor() { super('world'); }

  create() {
    const pg = this.make.graphics({ x: 0, y: 0 }, false);
    pg.fillStyle(0xffffff, 1).fillRect(1, 0, 2, 4).fillRect(0, 1, 4, 2);
    pg.generateTexture('puff', 4, 4); pg.destroy();
    this.terrain = buildTerrain();
    this.layout = buildLayout(this.terrain);
    this.buildStatic();
    this.buildActors();
    this.buildFx();
    this.buildEnvironment();
    this.setupCamera();
    this.setupInput();
    this.unsub = useGame.subscribe((s, p) => {
      if (s.focus && s.focus !== p.focus) this.focusOn(s.focus.key);
      if (s.zoomStep && s.zoomStep !== p.zoomStep) this.zoomAt(this.scale.width / 2, this.scale.height / 2, s.zoomStep.dir);
      if (s.grid !== p.grid) this.gridG.setVisible(s.grid);
      if (s.selected !== p.selected && !s.selected) this.drawOverlay(0);
      if (s.envCommand && s.envCommand !== p.envCommand) {
        const c = s.envCommand, e = this.env;
        if (c.hour !== undefined) e.hour = c.hour;
        if (c.speed !== undefined) e.speed = c.speed;
        if (c.weather) e.weather = c.weather;
        if (c.season && c.season !== this.season) this.applySeason(c.season);
        this.envSync = 0;
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsub?.());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.unsub?.());
    useGame.getState().setReady();
  }

  // ------------------------------------------------------------------ textures & static world
  private registerAtlas(atlas: AtlasBuilder) {
    atlas.pages.forEach((page, i) => {
      const tex = this.textures.addCanvas(`atlas${i}`, page)!;
      for (const f of atlas.frames.values()) if (f.page === i) tex.add(f.name, 0, f.fx, f.fy, f.w, f.h);
    });
    for (const [k, f] of atlas.frames) this.frames.set(k, f);
  }
  private tex(name: string) { const f = this.frames.get(name)!; return { key: `atlas${f.page}`, frame: name, f }; }

  private buildStatic() {
    const { layout, terrain } = this;
    // flat decoration is baked into the ground bitmap; recordings are kept for seasonal repaints
    for (const it of layout.items) if (it.ground) this.groundRecs.push({ rec: record(it.draw), nature: !!it.nature, variant: it.variant ?? 0 });
    this.paintGroundDecor();
    this.textures.addCanvas('ground', terrain.canvas);
    this.add.image(0, 0, 'ground').setOrigin(0).setDepth(-1000);

    // windows and street lamps report where they are while their buildings are recorded
    HV.onWindow = (x, y, w, h) => this.windows.push([x, y, w, h]);
    HV.onLamp = (x, y) => this.lamps.push([x, y]);
    const atlas = this.atlas = new AtlasBuilder();
    const placed: { name: string; depth: number; sway?: number }[] = [];
    let n = 0;
    const put = (rec: Recording, depth: number, nature: boolean, variant: number, sway?: number) => {
      const name = `s${n++}`;
      if (!atlas.add(name, rec)) return;
      placed.push({ name, depth, sway });
      if (nature) this.natureFrames.push({ name, rec, variant });
    };
    for (const it of [...layout.items.filter(i => !i.ground), ...layout.front]) {
      const rec = record(it.draw);
      if (it.sway) {
        // trunk stays planted; the canopy above the cut line sways with the wind
        const { top, bottom } = splitAt(rec, it.y - it.sway);
        put(bottom, it.y, !!it.nature, it.variant ?? 0);
        put(top, it.y + .5, !!it.nature, it.variant ?? 0, 1);
      } else put(rec, it.y, !!it.nature, it.variant ?? 0);
    }
    HV.onWindow = undefined; HV.onLamp = undefined;
    this.buildActorFrames(atlas);
    this.registerAtlas(atlas);
    for (const p of placed) {
      const { key, frame, f } = this.tex(p.name);
      const img = this.add.image(f.ox, f.oy, key, frame).setOrigin(0).setDepth(p.depth);
      if (p.sway !== undefined) this.swayers.push({ img, x: f.ox, ph: HV.hash(f.ox, f.oy, 3) * 6.28 });
    }
  }

  /** Replays flat ground decoration onto the terrain bitmap in the current season's colours. */
  private paintGroundDecor() {
    const g = this.terrain.canvas.getContext('2d')!;
    for (const d of this.groundRecs) replay(g, d.rec, 0, 0, d.nature ? seasonSwap(this.season, d.variant, this.dry) : undefined);
  }

  /** Repaints terrain and every nature sprite for a new season (or drought), masked by a quick fade. */
  private applySeason(season: Season, dry = this.dry) {
    const cam = this.cameras.main;
    this.season = season; this.dry = dry;
    this.env.season = season;
    cam.fadeOut(160, 255, 255, 255);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      buildTerrain(seasonSwap(season, 0, dry), this.terrain.canvas);
      this.paintGroundDecor();
      this.textures.get('ground').source[0].update();
      for (const f of this.natureFrames) this.atlas.redraw(f.name, f.rec, seasonSwap(season, f.variant, dry));
      this.atlas.pages.forEach((_, i) => this.textures.get(`atlas${i}`).source[0].update());
      cam.fadeIn(260, 255, 255, 255);
    });
  }

  private buildActorFrames(atlas: AtlasBuilder) {
    const two = (fn: (f: number, flip: boolean) => void, frames: number[]) => (flip: boolean) => frames.map(f => () => fn(f, flip));
    const sets: Record<string, (flip: boolean) => (() => void)[]> = {
      cow: fl => [() => HV.cow(0, 0, 0, fl), () => HV.cow(0, 0, 1, fl), () => HV.cow(0, 0, 0, fl, '#2a2624', true)],
      sheep: fl => [() => HV.sheep(0, 0, 0, fl), () => HV.sheep(0, 0, 1, fl), () => HV.sheep(0, 0, 0, fl, true)],
      pig: two((f, fl) => HV.pig(0, 0, f, fl), [0, 1]),
      chicken: two((f, fl) => HV.chicken(0, 0, f, fl), [0, 3]),
      duck: two((f, fl) => HV.duck(0, 0, f, fl), [0, 1]),
      tractor: two((f, fl) => HV.tractor(0, 0, f, fl), [0, 1, 2, 3]),
    };
    for (const [k, mk] of Object.entries(sets)) { atlas.addSet(`${k}-r`, mk(false)); atlas.addSet(`${k}-l`, mk(true)); }
    this.layout.actors.forEach((a, i) => {
      if (a.kind === 'farmer') {
        for (const [d, fl] of [['r', false], ['l', true]] as const)
          atlas.addSet(`farmer${i}-${d}`, [0, 1, 2, 3].map(f => () => HV.farmer(0, 0, f, fl, a.pal)));
      } else if (a.kind === 'waterer') atlas.addSet('waterer', [() => HV.farmer(0, 0, 0, false, a.pal, 'water')]);
    });
    atlas.addSet('blades', Array.from({ length: 24 }, (_, k) => () => HV.blades(0, 0, k * (Math.PI / 2) / 24)));
    for (const crop of HV.CROPS as string[]) atlas.addSet(`crop-${crop}`, [0, 1, 2, 3].map(st => () => HV.crop(crop, st, 0, 0)));
  }

  private anim(key: string, prefix: string, count: number, rate: number) {
    if (this.anims.exists(key)) return;
    this.anims.create({ key, frameRate: rate, repeat: -1, frames: Array.from({ length: count }, (_, i) => { const t = this.tex(`${prefix}-${i}`); return { key: t.key, frame: t.frame }; }) });
  }
  private sprite(prefix: string, x: number, y: number) {
    const t = this.tex(`${prefix}-0`);
    return this.add.sprite(x + t.f.ox, y + t.f.oy, t.key, t.frame).setOrigin(0);
  }
  private place(s: Phaser.GameObjects.Sprite, prefix: string, x: number, y: number, foot: number) {
    const f = this.frames.get(`${prefix}-0`)!;
    s.setPosition(Math.round(x + f.ox), Math.round(y + f.oy)).setDepth(y + foot);
  }

  // ------------------------------------------------------------------ actors
  private buildActors() {
    for (const k of [...ANIMALS, 'tractor']) for (const d of ['r', 'l']) this.anim(`${k}-${d}`, `${k}-${d}`, k === 'tractor' ? 4 : 2, k === 'chicken' ? 3 : 6);
    const blades = this.sprite('blades', this.layout.windmill.x, this.layout.windmill.y).setDepth(187);
    this.anim('blades', 'blades', 24, 14); blades.play('blades');

    let id = 0;
    this.layout.actors.forEach((a: ActorSpec, i) => {
      if (a.kind === 'farmer') {
        const key = `farmer${i}`;
        for (const d of ['r', 'l']) this.anim(`${key}-${d}`, `${key}-${d}`, 4, 6);
        const [x, y] = a.path[0];
        const sprite = this.sprite(`${key}-r`, x, y); sprite.play(`${key}-r`);
        this.walkers.push({ id: id++, key, sprite, path: a.path.map(p => [...p] as [number, number]), i: 0, x, y, speed: a.speed, flip: false });
      } else if (a.kind === 'waterer') {
        this.waterer = { x: a.x, y: a.y };
        this.place(this.sprite('waterer', a.x, a.y), 'waterer', a.x, a.y, FOOT.farmer);
      } else if (a.kind === 'tractor') {
        const sprite = this.sprite('tractor-r', a.x, a.y); sprite.play('tractor-r');
        const exhaust = this.add.particles(0, 0, 'puff', { lifespan: 1600, speedX: { min: -6, max: 6 }, speedY: { min: -9, max: -5 }, scale: { start: .35, end: 1 }, alpha: { start: .5, end: 0 }, tint: 0x8a8a8a, frequency: 300 }).setDepth(40000);
        this.tractor = { sprite, x: a.x, y: a.y, dir: 1, minX: a.minX, maxX: a.maxX, exhaust: exhaust as unknown as Phaser.GameObjects.Particles.ParticleEmitter };
      } else {
        const [x0, y0, x1, y1] = a.rect;
        for (let k = 0; k < a.count; k++) {
          const x = x0 + HV.hash(k, a.seed, 1) * (x1 - x0), y = y0 + HV.hash(k, a.seed, 2) * (y1 - y0);
          const sprite = this.sprite(`${a.kind}-r`, x, y);
          this.animals.push({ id: id++, kind: a.kind, sprite, x, y, tx: x, ty: y, moving: false, wait: HV.hash(k, a.seed, 3) * 3, flip: HV.hash(k, a.seed, 4) < .5, rect: a.rect, peck: HV.hash(k, a.seed, 5) * 6, graze: false, grazeT: HV.hash(k, a.seed, 6) * 3 });
        }
      }
    });
  }

  private updateActors(dt: number, t: number) {
    for (const a of this.animals) {
      if (a.moving) {
        const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy), s = SPEED[a.kind] * dt;
        if (d < s) { a.moving = false; a.wait = 1.5 + Math.random() * 4; }
        else { a.x += dx / d * s; a.y += dy / d * s; if (Math.abs(dx) > .3) a.flip = dx < 0; }
      } else if ((a.wait -= dt) <= 0) {
        const [x0, y0, x1, y1] = a.rect;
        a.tx = x0 + Math.random() * (x1 - x0); a.ty = y0 + Math.random() * (y1 - y0); a.moving = true;
      }
      const dir = a.flip ? 'l' : 'r', key = `${a.kind}-${dir}`;
      if (a.moving || a.kind === 'duck') { if (a.sprite.anims.currentAnim?.key !== key || !a.sprite.anims.isPlaying) a.sprite.play(key); }
      else {
        a.sprite.stop();
        // idle cows and sheep alternate grazing (head down) and looking up
        if ((a.kind === 'cow' || a.kind === 'sheep') && (a.grazeT -= dt) <= 0) { a.graze = !a.graze; a.grazeT = a.graze ? 2 + Math.random() * 3 : 1 + Math.random() * 2; }
        const idle = a.kind === 'chicken' ? (Math.floor(t * 3 + a.peck) % 6 < 2 ? 1 : 0) : (a.graze && (a.kind === 'cow' || a.kind === 'sheep') ? 2 : 0);
        const tt = this.tex(`${key}-${idle}`); a.sprite.setTexture(tt.key, tt.frame);
      }
      this.place(a.sprite, key, a.x, a.y, FOOT[a.kind]);
    }
    for (const w of this.walkers) {
      const nx = w.path[(w.i + 1) % w.path.length];
      const dx = nx[0] - w.x, dy = nx[1] - w.y, d = Math.hypot(dx, dy), s = w.speed * dt;
      if (d < s) { w.i++; if (w.i === w.path.length - 1) { w.path.reverse(); w.i = 0; } }
      else { w.x += dx / d * s; w.y += dy / d * s; if (Math.abs(dx) > .1) w.flip = dx < 0; }
      const key = `${w.key}-${w.flip ? 'l' : 'r'}`;
      if (w.sprite.anims.currentAnim?.key !== key) w.sprite.play(key);
      this.place(w.sprite, key, w.x, w.y, FOOT.farmer);
    }
    const tr = this.tractor;
    if (tr) {
      tr.x += tr.dir * 7 * dt;
      if (tr.x > tr.maxX) tr.dir = -1; else if (tr.x < tr.minX) tr.dir = 1;
      const key = `tractor-${tr.dir < 0 ? 'l' : 'r'}`;
      if (tr.sprite.anims.currentAnim?.key !== key) tr.sprite.play(key);
      this.place(tr.sprite, key, tr.x, tr.y, FOOT.tractor);
      tr.exhaust.setPosition(tr.x + (tr.dir > 0 ? 17 : 8), tr.y);
    }
  }

  // ------------------------------------------------------------------ ambient effects
  private gfx(depth: number, draw: (t: number) => void) {
    const g = this.add.graphics().setDepth(depth);
    this.fx.push({ g, ctx: new GraphicsContext(g), draw });
    return g;
  }

  private buildFx() {
    const L = this.layout;
    for (const [x, y] of L.chimneys)
      this.add.particles(x, y, 'puff', { lifespan: 2800, speedX: { min: 0, max: 4 }, speedY: { min: -8, max: -5 }, scale: { start: .6, end: 1.6 }, alpha: { start: .55, end: 0 }, tint: 0xeeeeee, frequency: 380 }).setDepth(40000);

    this.gfx(181, t => HV.ticker(L.ticker.x, L.ticker.y, 52, 8, t));
    this.gfx(257, t => HV.fountainWater(L.fountain.x, L.fountain.y, t));
    L.flags.forEach((f, i) => this.gfx(i === 0 ? 181 : i === 1 ? 405 : 482, t => HV.flag(f.x, f.y, t + i, f.col, f.col2)));
    const [bx1, bx2, by] = L.bunting;
    this.gfx(by + 9, t => {
      const cols = ['#c4553b', '#f2c94c', '#3f6fa8', '#4e8a3c', '#f4efe2'];
      for (let x = bx1; x < bx2; x++) HV.P(x, by + Math.sin(((x - bx1) % 30) / 30 * Math.PI) * 3, '#5a3a22');
      for (let x = bx1 + 3, i = 0; x < bx2 - 2; x += 5, i++) {
        const sag = Math.sin(((x - bx1) % 30) / 30 * Math.PI) * 3, sw = Math.round(Math.sin(t * 4 + i) * .7);
        HV.R(x + sw, by + sag + 1, 3, 2, cols[i % 5]); HV.P(x + 1 + sw, by + sag + 3, cols[i % 5]);
      }
    });
    for (const [sx, sy] of L.sprinklers) this.gfx(sy + 8, t => {
      for (let k = 0; k < 14; k++) {
        const a = t * 2.2 + k * .45, ph = (t * 1.4 + k / 14) % 1;
        HV.P(sx + Math.cos(a) * ph * 18, sy + Math.sin(a) * ph * 9 - Math.sin(ph * Math.PI) * 8, ph < .7 ? '#bfe8ff' : '#8fd0ee');
      }
    });
    if (this.waterer) { const w = this.waterer; this.gfx(w.y + 15, t => { const ph = (t * 3) % 1; for (let k = 0; k < 3; k++) HV.P(w.x + 10 + k, w.y + 10 + ((ph * 6 + k * 2) % 6), '#8fd0ee'); }); }
    this.gridG = this.add.graphics().setDepth(150000).setVisible(useGame.getState().grid);
    this.gridG.lineStyle(1, 0xfff3b0, .28);
    for (let x = 0; x <= WORLD_W; x += TILE) this.gridG.lineBetween(x + .5, 0, x + .5, WORLD_H);
    for (let y = 0; y <= WORLD_H; y += TILE) this.gridG.lineBetween(0, y + .5, WORLD_W, y + .5);
    this.hoverG = this.add.graphics().setDepth(200000);
  }

  // ------------------------------------------------------------------ living environment
  private buildEnvironment() {
    this.particles = new PixelParticles(this.add.graphics().setDepth(60000));
    this.lighting = new LightingSystem(this, this.windows, this.lamps);
    this.weather = new WeatherSystem(this, this.terrain);
    this.water = new WaterSystem(this, this.terrain, () => this.animals.filter(a => a.kind === 'duck'));
    this.weather.onWaterHit = (x, y) => this.water.ripple(x, y, 3);
    this.wildlife = new WildlifeSystem(this, this.terrain);
    this.crops = new CropSystem(this.layout.crops, {
      sprite: (prefix, x, y) => this.sprite(prefix, x, y),
      setFrame: (sp, name) => { const t = this.tex(name); sp.setTexture(t.key, t.frame); },
      offset: prefix => { const f = this.frames.get(`${prefix}-0`)!; return { ox: f.ox, oy: f.oy }; },
    }, this.particles);
  }

  // ------------------------------------------------------------------ camera
  private setupCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H).setRoundPixels(true).setBackgroundColor('#1d3a1f');
    this.computeZooms();
    cam.setZoom(this.zooms.find(z => z >= 2) ?? this.zooms[this.zooms.length - 1]);
    cam.centerOn(300, 230);

    this.mini = this.cameras.add(0, 0, MINI.w, MINI.h).setZoom(MINI.w / WORLD_W).setName('minimap');
    this.mini.centerOn(WORLD_W / 2, WORLD_H / 2).setBackgroundColor('#1d3a1f').setRoundPixels(false);
    this.viewG = this.add.graphics().setDepth(300000);
    cam.ignore(this.viewG);
    this.mini.ignore([this.hoverG, this.gridG, ...this.fx.map(f => f.g), ...this.weather.objects, ...this.water.objects, ...this.wildlife.objects]);
    this.positionMinimap();
    this.scale.on(Phaser.Scale.Events.RESIZE, (size: Phaser.Structs.Size) => {
      cam.setSize(size.width, size.height);
      this.computeZooms();
      if (cam.zoom < this.zooms[0]) cam.setZoom(this.zooms[0]);
      this.positionMinimap();
    });
  }
  private positionMinimap() {
    // sits inside the HUD's minimap frame; the frame is hidden below the md breakpoint
    this.mini.setPosition(MINI.pad + 6, this.scale.height - MINI.pad - 6 - MINI.h).setVisible(this.scale.width >= 768);
  }
  private computeZooms() {
    const min = Math.max(this.scale.width / WORLD_W, this.scale.height / WORLD_H);
    this.zooms = [Math.ceil(min * 100) / 100, 2, 3, 4, 5, 6].filter((z, i) => i === 0 || z > min + .05);
  }
  private zoomAt(px: number, py: number, dir: 1 | -1) {
    const cam = this.cameras.main;
    const i = this.zooms.findIndex(z => z >= cam.zoom - .001);
    const next = this.zooms[Math.max(0, Math.min(this.zooms.length - 1, (i < 0 ? 0 : i) + dir))];
    if (next === cam.zoom) return;
    const w = cam.getWorldPoint(px, py), cx = cam.width / 2, cy = cam.height / 2;
    cam.setZoom(next);
    cam.setScroll(w.x - cx - (px - cx) / next, w.y - cy - (py - cy) / next);
  }
  private focusOn(key: string) {
    const f = this.layout.focus[key];
    if (!f) return;
    this.cameras.main.pan(f.x, f.y, 700, 'Sine.easeInOut');
    const hot = this.layout.hot.find(h => h.id === f.id);
    if (hot) useGame.getState().select({ type: 'hotspot', hot });
  }

  // ------------------------------------------------------------------ input & selection
  private setupInput() {
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-PLUS', () => this.zoomAt(this.scale.width / 2, this.scale.height / 2, 1));
    kb.on('keydown-NUMPAD_ADD', () => this.zoomAt(this.scale.width / 2, this.scale.height / 2, 1));
    kb.on('keydown-MINUS', () => this.zoomAt(this.scale.width / 2, this.scale.height / 2, -1));
    kb.on('keydown-NUMPAD_SUBTRACT', () => this.zoomAt(this.scale.width / 2, this.scale.height / 2, -1));
    kb.on('keydown-G', () => useGame.getState().toggleGrid());
    kb.on('keydown-ESC', () => useGame.getState().select(null));
    this.input.mouse?.disableContextMenu();

    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => { if (!this.inMini(p)) this.zoomAt(p.x, p.y, dy < 0 ? 1 : -1); });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.onCanvas(p)) return;
      if (this.inMini(p)) { this.miniJump(p); return; }
      const cam = this.cameras.main;
      this.drag = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY, moved: false };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const cam = this.cameras.main;
      if (this.drag && p.isDown) {
        const dx = p.x - this.drag.x, dy = p.y - this.drag.y;
        if (!this.drag.moved && Math.abs(dx) + Math.abs(dy) > 4) this.drag.moved = true;
        if (this.drag.moved) { cam.setScroll(this.drag.sx - dx / cam.zoom, this.drag.sy - dy / cam.zoom); this.game.canvas.style.cursor = 'grabbing'; }
      } else if (this.inMini(p) && p.isDown) this.miniJump(p);
      if (this.drag?.moved || this.inMini(p)) { this.setHover(null, p); return; }
      const w = cam.getWorldPoint(p.x, p.y);
      this.setHover(this.pick(w.x, w.y, false), p);
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.game.canvas.style.cursor = '';
      if (this.drag && !this.drag.moved) {
        const w = this.cameras.main.getWorldPoint(p.x, p.y);
        useGame.getState().select(this.pick(w.x, w.y, true));
      }
      this.drag = null;
    });
    this.input.on('gameout', () => this.setHover(null));
  }
  /** HUD clicks also reach Phaser's window listeners; only react to presses that hit the canvas. */
  private onCanvas(p: Phaser.Input.Pointer) { return !p.event || p.event.target === this.game.canvas; }
  private inMini(p: Phaser.Input.Pointer) { const m = this.mini; return m.visible && p.x >= m.x && p.x < m.x + m.width && p.y >= m.y && p.y < m.y + m.height; }
  private miniJump(p: Phaser.Input.Pointer) {
    const m = this.mini;
    this.cameras.main.centerOn((p.x - m.x) / m.width * WORLD_W, (p.y - m.y) / m.height * WORLD_H);
  }

  private setHover(sel: Selection | null, p?: Phaser.Input.Pointer) {
    this.hovered = sel;
    const st = useGame.getState();
    if (!sel || !p || sel.type === 'tile') { if (st.hover) st.setHover(null); this.game.canvas.style.cursor = this.drag?.moved ? 'grabbing' : ''; return; }
    this.game.canvas.style.cursor = 'pointer';
    st.setHover({ ...describe(sel), sx: p.x, sy: p.y });
  }

  /** What is under a world point: actors first, then crop cells, then the smallest hotspot. */
  private pick(wx: number, wy: number, allowTile: boolean): Selection | null {
    const hit = (s: Phaser.GameObjects.Sprite) => wx >= s.x && wx < s.x + s.width && wy >= s.y && wy < s.y + s.height;
    for (const a of this.animals) if (hit(a.sprite)) return { type: 'animal', kind: a.kind, id: a.id, zone: ZONE_OF[a.kind] };
    for (const w of this.walkers) if (hit(w.sprite)) return { type: 'farmer', id: w.id };
    let best: Hotspot | null = null;
    for (const h of this.layout.hot)
      if (wx >= h.x && wx < h.x + h.w && wy >= h.y - 4 && wy < h.y + h.h && (!best || h.w * h.h < best.w * best.h)) best = h;
    if (best?.kind === 'plot' && best.plot !== undefined && PLOTS[best.plot].kind !== 'expansion') {
      const cell = this.layout.cells.find(c => c.plot === best!.plot && wx >= c.box[0] && wx < c.box[0] + c.box[2] && wy >= c.box[1] && wy < c.box[1] + c.box[3]);
      if (cell) return { type: 'cell', hot: best, col: cell.col, row: cell.row, crop: best.crop ?? null, cropStage: best.cropStage ?? 0, tile: [Math.floor(wx / TILE), Math.floor(wy / TILE)] };
    }
    if (best) return { type: 'hotspot', hot: best };
    if (!allowTile) return null;
    const tile: [number, number] = [Math.floor(wx / TILE), Math.floor(wy / TILE)];
    return { type: 'tile', tile, terrain: TERRAIN_NAME[this.terrain.at(wx, wy)] ?? 'Meadow' };
  }

  private boxOf(sel: Selection): [number, number, number, number] | null {
    if (sel.type === 'hotspot') return [sel.hot.x, sel.hot.y, sel.hot.w, sel.hot.h];
    if (sel.type === 'cell') { const c = this.layout.cells.find(c => c.plot === sel.hot.plot && c.col === sel.col && c.row === sel.row); return c ? c.box : null; }
    if (sel.type === 'animal') { const a = this.animals.find(a => a.id === sel.id); return a ? [a.sprite.x, a.sprite.y, a.sprite.width, a.sprite.height] : null; }
    if (sel.type === 'farmer') { const w = this.walkers.find(w => w.id === sel.id); return w ? [w.sprite.x, w.sprite.y, w.sprite.width, w.sprite.height] : null; }
    return [sel.tile[0] * TILE, sel.tile[1] * TILE, TILE, TILE];
  }

  private drawOverlay(t: number) {
    const g = this.hoverG; g.clear();
    const dash = (x: number, y: number, w: number, h: number, color: number, phase: number) => {
      g.fillStyle(color, 1);
      for (let k = -phase; k < w; k += 4) { if (k + 2 > 0) { g.fillRect(x + Math.max(0, k), y, Math.min(2, k + 2), 1); g.fillRect(x + w - Math.max(0, k) - 2, y + h - 1, Math.min(2, k + 2), 1); } }
      for (let k = -phase; k < h; k += 4) { if (k + 2 > 0) { g.fillRect(x, y + h - Math.max(0, k) - 2, 1, Math.min(2, k + 2)); g.fillRect(x + w - 1, y + Math.max(0, k), 1, Math.min(2, k + 2)); } }
    };
    // gold corner brackets with a dark drop shadow
    const brackets = (x: number, y: number, w: number, h: number) => {
      const corners = [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]];
      for (const [col, off] of [[0x3b2414, 1], [0xf2c94c, 0]] as const) {
        g.fillStyle(col, 1);
        for (const [cx, cy, sx, sy] of corners) {
          g.fillRect((sx > 0 ? cx : cx - 6) + off, (sy > 0 ? cy : cy - 2) + off, 6, 2);
          g.fillRect((sx > 0 ? cx : cx - 2) + off, (sy > 0 ? cy : cy - 6) + off, 2, 6);
        }
      }
    };
    const phase = Math.floor(t * 8) % 4;
    const sel = useGame.getState().selected;
    if (this.hovered && this.hovered !== sel) {
      const b = this.boxOf(this.hovered);
      if (b) {
        if (this.hovered.type === 'cell') { const h = this.hovered.hot; dash(h.x - 2, h.y - 2, h.w + 4, h.h + 4, 0xfff3b0, phase); g.fillStyle(0xfff3b0, .35).fillRect(b[0], b[1], b[2], b[3]); }
        else dash(b[0] - 2, b[1] - 2, b[2] + 4, b[3] + 4, 0xfff3b0, phase);
      }
    }
    if (sel) {
      const b = this.boxOf(sel);
      if (b) {
        if (sel.type === 'cell') { const h = sel.hot; dash(h.x - 2, h.y - 2, h.w + 4, h.h + 4, 0xf2c94c, phase); g.fillStyle(0xf2c94c, .45).fillRect(b[0], b[1], b[2], b[3]); }
        if (sel.type === 'tile') g.fillStyle(0xfff3b0, .18).fillRect(b[0], b[1], b[2], b[3]);
        brackets(b[0] - 2, b[1] - 2, b[2] + 4, b[3] + 4);
      }
    }
  }

  // ------------------------------------------------------------------ frame loop
  update(time: number, delta: number) {
    const t = time / 1000, dt = Math.min(.05, delta / 1000);
    const cam = this.cameras.main, k = this.keys, pan = 260 * dt / cam.zoom * 2;
    if (k.A.isDown || k.LEFT.isDown) cam.scrollX -= pan;
    if (k.D.isDown || k.RIGHT.isDown) cam.scrollX += pan;
    if (k.W.isDown || k.UP.isDown) cam.scrollY -= pan;
    if (k.S.isDown || k.DOWN.isDown) cam.scrollY += pan;

    const env = this.env;
    env.update(dt);
    if ((env.weather === 'drought') !== this.dry && !cam.fadeEffect.isRunning) this.applySeason(this.season, env.weather === 'drought');
    this.updateActors(dt, t);
    for (const f of this.fx) { f.g.clear(); HV.use(f.ctx); f.draw(t); }
    // tree canopies sway: gentle in fair weather, hard in storms
    const amp = .55 + env.wind * .45, freq = .6 + env.wind * .5;
    for (const s of this.swayers) s.img.x = s.x + Math.round(Math.sin(t * freq + s.ph) * amp);
    this.crops.update(t, dt, env);
    this.water.update(t, dt, env);
    this.weather.update(t, dt, env, cam.worldView);
    this.wildlife.update(t, dt, env);
    this.lighting.update(t, dt, env);
    this.particles.update(dt);
    this.drawOverlay(t);
    if ((this.envSync -= dt) <= 0) { useGame.getState().setEnv(env.snapshot()); this.envSync = .25; }

    const v = cam.worldView;
    this.viewG.clear().lineStyle(8, 0xfff3b0, 1).strokeRect(v.x, v.y, v.width, v.height);
    useGame.getState().setCamera({ x: Math.round(v.x * 10) / 10, y: Math.round(v.y * 10) / 10, zoom: cam.zoom, w: cam.width, h: cam.height });
  }
}

function describe(sel: Selection): { label: string; sub: string } {
  switch (sel.type) {
    case 'hotspot': return { label: sel.hot.name, sub: sel.hot.zone };
    case 'cell': return { label: sel.hot.name, sub: `Row ${sel.row + 1} · Col ${sel.col + 1}` };
    case 'animal': return { label: sel.kind[0].toUpperCase() + sel.kind.slice(1), sub: sel.zone };
    case 'farmer': return { label: 'Villager', sub: 'Neighbour farmer' };
    case 'tile': return { label: sel.terrain, sub: `Tile ${sel.tile[0]}, ${sel.tile[1]}` };
  }
}
