// Harvestia launch trailer — deterministic 45 s timeline rendered on a canvas from real
// game footage, real UI captures and the game's own sprite art, with a synthesized
// soundtrack. Encoded in the browser (WebCodecs H.264 + AAC) into MP4.
import HV from './sprites.js';
import { Muxer, ArrayBufferTarget } from './node_modules/mp4-muxer/build/mp4-muxer.mjs';

const params = new URLSearchParams(location.search);
const VERT = params.get('v') === '1';
const W = VERT ? 1080 : 1920, H = VERT ? 1920 : 1080, FPS = 30, DUR = 45;
const cv = document.getElementById('c'); cv.width = W; cv.height = H;
const g = cv.getContext('2d');
const status = t => (document.getElementById('status').textContent = t);
const S = Math.min(W, H) / 1080; // typography scale

// ------------------------------------------------------------------ helpers
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => (t = clamp(t), t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
const easeOutBack = t => { t = clamp(t); const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const win = (t, a, b, fi = .35, fo = .35) => clamp((t - a) / fi) * clamp((b - t) / fo); // in/out envelope
const rnd = (i, s = 0) => HV.hash(i, s, 777);
const GOLD = '#f2c94c', GOLD_D = '#c9922a', CREAM = '#fff4dc', INK = '#1b130c';

const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

// ------------------------------------------------------------------ clips (real gameplay)
class Clip {
  constructor(name) { this.v = document.createElement('video'); this.v.src = `clips/${name}.webm`; this.v.muted = true; this.v.preload = 'auto'; this.v.playsInline = true; this.name = name; }
  async ready() {
    if (this.v.readyState < 2) await new Promise((r, j) => { this.v.onloadeddata = r; this.v.onerror = j; });
    // MediaRecorder WebM has no duration until we seek to the end once
    if (!isFinite(this.v.duration)) { this.v.currentTime = 1e9; await new Promise(r => (this.v.ondurationchange = r, setTimeout(r, 1500))); }
    this.dur = this.v.duration; this.v.currentTime = 0; await this.seeked();
  }
  seeked() { return new Promise(r => { const f = () => { this.v.removeEventListener('seeked', f); r(); }; this.v.addEventListener('seeked', f); }); }
  async at(t) {
    t = clamp(t, 0, (this.dur ?? 5) - 0.05);
    if (Math.abs(this.v.currentTime - t) < 0.004) return this.v;
    this.v.currentTime = t; await this.seeked();
    return this.v;
  }
}
const clips = Object.fromEntries(['flyover', 'plant', 'livestock', 'harvest', 'expand', 'market', 'finale'].map(n => [n, new Clip(n)]));

// draws a clip frame covering the canvas; fx = horizontal focus (0..1) for vertical crops, zoom = extra scale
async function drawClip(name, srcT, { zoom = 1, fx = .5, fy = .5, alpha = 1 } = {}) {
  const v = await clips[name].at(srcT);
  const s = Math.max(W / 1920, H / 1080) * zoom, dw = 1920 * s, dh = 1080 * s;
  g.save(); g.globalAlpha = alpha; g.imageSmoothingEnabled = false;
  g.drawImage(v, (W - dw) * fx, (H - dh) * fy, dw, dh);
  g.restore();
}

// ------------------------------------------------------------------ text
function text(str, x, y, opts = {}) {
  if (str.includes('\n')) { const lines = str.split('\n'), lh = (opts.size ?? 64) * 1.18 * S; lines.forEach((l, i) => text1(l, x, y + (i - (lines.length - 1) / 2) * lh, opts)); return; }
  text1(str, x, y, opts);
}
function text1(str, x, y, { size = 64, weight = 800, font = 'Sora', color = CREAM, align = 'center', alpha = 1, track = 0.06, shadow = true, glow = 0, base = 'middle', maxW } = {}) {
  if (alpha <= 0) return;
  g.save(); g.globalAlpha = alpha;
  g.font = `${weight} ${size * S}px "${font}"`; g.textAlign = align; g.textBaseline = base;
  g.letterSpacing = `${track * size * S}px`;
  if (maxW) { let sz = size; while (g.measureText(str).width > maxW && sz > 10) { sz -= 2; g.font = `${weight} ${sz * S}px "${font}"`; g.letterSpacing = `${track * sz * S}px`; } }
  if (glow) { g.shadowColor = 'rgba(242,201,76,.75)'; g.shadowBlur = glow * S; g.fillStyle = color; g.fillText(str, x, y); }
  if (shadow) { g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 18 * S; g.shadowOffsetY = 4 * S; }
  g.fillStyle = color; g.fillText(str, x, y);
  g.restore();
}

// word that slams in on a beat: scale from big + fade, slight tracking settle
function beatWord(str, t, x, y, size) {
  if (t < 0 || t > 1.95) return;
  const a = clamp(t / .12) * clamp((1.95 - t) / .25);
  const k = 1 + .35 * (1 - easeOut(t / .35));
  g.save(); g.translate(x, y); g.scale(k, k);
  text(str, 0, 0, { size, alpha: a, track: .18 + .1 * (1 - easeOut(t / .5)), glow: 30 });
  g.restore();
}

// ------------------------------------------------------------------ effects
function vignette(strength = .55) {
  const r = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .25, W / 2, H / 2, Math.max(W, H) * .75);
  r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, `rgba(0,0,0,${strength})`);
  g.fillStyle = r; g.fillRect(0, 0, W, H);
}
function warm(a) { if (a <= 0) return; g.save(); g.globalCompositeOperation = 'soft-light'; g.globalAlpha = a; g.fillStyle = '#ffb347'; g.fillRect(0, 0, W, H); g.restore(); }
function shade(a, c = '0,0,0') { if (a <= 0) return; g.fillStyle = `rgba(${c},${a})`; g.fillRect(0, 0, W, H); }
// soft dark band behind a title so it reads on any footage
function band(y, h, a) { if (a <= 0) return; const gr = g.createLinearGradient(0, y - h, 0, y + h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.5, `rgba(0,0,0,${.55 * a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, y - h, W, h * 2); }
function letterbox(a) { if (VERT || a <= 0) return; const h = 64 * a; g.fillStyle = '#000'; g.fillRect(0, 0, W, h); g.fillRect(0, H - h, W, h); }

// golden particles: deterministic field drifting upward
function particles(t, n, { x0 = 0, x1 = W, y0 = 0, y1 = H, alpha = 1, size = 3, rise = 40, seed = 1 } = {}) {
  if (alpha <= 0) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const px = lerp(x0, x1, rnd(i, seed)) + Math.sin(t * (0.6 + rnd(i, seed + 1)) + i) * 14 * S;
    const py = (lerp(y0, y1, rnd(i, seed + 2)) - t * rise * S * (0.5 + rnd(i, seed + 3))) % (y1 - y0 + 1);
    const yy = py < y0 ? py + (y1 - y0) : py;
    const tw = .45 + .55 * Math.sin(t * 3 + i * 1.7) ** 2;
    const r = (size + rnd(i, seed + 4) * size * 1.6) * S;
    const grd = g.createRadialGradient(px, yy, 0, px, yy, r * 3);
    grd.addColorStop(0, `rgba(255,224,130,${.9 * alpha * tw})`); grd.addColorStop(1, 'rgba(255,190,60,0)');
    g.fillStyle = grd; g.fillRect(px - r * 3, yy - r * 3, r * 6, r * 6);
  }
  g.restore();
}

// burst from a point (seed impact)
function burst(t, cx, cy, n = 140) {
  if (t < 0 || t > 2.2) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const ang = rnd(i, 9) * Math.PI * 2, sp = (220 + rnd(i, 10) * 900) * S, life = .8 + rnd(i, 11) * 1.3;
    if (t > life) continue;
    const k = easeOut(t / life), x = cx + Math.cos(ang) * sp * k, y = cy + Math.sin(ang) * sp * k * .55 - 120 * S * t * t;
    const a = 1 - t / life, r = (2 + rnd(i, 12) * 4) * S;
    g.fillStyle = `rgba(255,${200 + rnd(i, 13) * 50 | 0},90,${a})`;
    g.fillRect(x - r / 2, y - r / 2, r, r);
  }
  g.restore();
}

// ------------------------------------------------------------------ the $HRV coin (pseudo-3D)
function coin(cx, cy, R, angle, { glow = 1, alpha = 1 } = {}) {
  const c = Math.cos(angle), sx = Math.max(.04, Math.abs(c)), edge = R * .14 * Math.sin(angle);
  g.save(); g.globalAlpha = alpha;
  // glow
  if (glow > 0) {
    const gl = g.createRadialGradient(cx, cy, R * .3, cx, cy, R * 2.4);
    gl.addColorStop(0, `rgba(255,205,90,${.42 * glow})`); gl.addColorStop(1, 'rgba(255,170,40,0)');
    g.fillStyle = gl; g.fillRect(cx - R * 2.5, cy - R * 2.5, R * 5, R * 5);
  }
  // rim (thickness)
  for (let i = 8; i >= 1; i--) {
    g.beginPath(); g.ellipse(cx + edge * i / 8, cy, R * sx, R, 0, 0, Math.PI * 2);
    g.fillStyle = i % 2 ? '#a8701f' : '#8e5c18'; g.fill();
  }
  // face
  const fg = g.createLinearGradient(cx - R * sx, cy - R, cx + R * sx, cy + R);
  fg.addColorStop(0, '#ffe58a'); fg.addColorStop(.45, '#f2c94c'); fg.addColorStop(1, '#c48a22');
  g.beginPath(); g.ellipse(cx, cy, R * sx, R, 0, 0, Math.PI * 2); g.fillStyle = fg; g.fill();
  g.lineWidth = R * .06; g.strokeStyle = '#fff1b0'; g.stroke();
  g.beginPath(); g.ellipse(cx, cy, R * sx * .8, R * .8, 0, 0, Math.PI * 2); g.lineWidth = R * .035; g.strokeStyle = 'rgba(140,90,20,.6)'; g.stroke();
  // emblem (only on the visible face side)
  if (sx > .12) {
    g.save(); g.translate(cx, cy); g.scale(c >= 0 ? sx : -sx, 1);
    g.font = `900 ${R * 1.05}px "Sora"`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(120,75,15,.55)'; g.fillText('H', R * .03, R * .07);
    g.fillStyle = '#fff6c8'; g.fillText('H', 0, 0);
    g.restore();
  }
  // specular sweep
  const sw = ((angle / (Math.PI * 2)) % 1 + 1) % 1;
  g.save(); g.beginPath(); g.ellipse(cx, cy, R * sx, R, 0, 0, Math.PI * 2); g.clip();
  const hx = cx + (sw * 2 - 1) * R * 1.4;
  const sp = g.createLinearGradient(hx - R * .5, cy - R, hx + R * .5, cy + R);
  sp.addColorStop(0, 'rgba(255,255,255,0)'); sp.addColorStop(.5, 'rgba(255,255,255,.45)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sp; g.fillRect(cx - R, cy - R, R * 2, R * 2);
  g.restore();
  g.restore();
}

// ------------------------------------------------------------------ pixel crop icons from the game's sprite art
const iconCache = {};
function cropIcon(key) {
  if (iconCache[key]) return iconCache[key];
  const c = document.createElement('canvas'); c.width = 16; c.height = 16;
  HV.use(c.getContext('2d')); HV.crop(key, 3, 8, 15);
  return (iconCache[key] = c);
}
function drawIcon(key, cx, cy, size, angle = 0, alpha = 1) {
  const ic = cropIcon(key), sx = Math.max(.08, Math.abs(Math.cos(angle)));
  g.save(); g.globalAlpha = alpha; g.imageSmoothingEnabled = false;
  // soft shadow plate
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(cx, cy + size * .52, size * .38 * sx + 4, size * .07, 0, 0, Math.PI * 2); g.fill();
  g.translate(cx, cy); g.scale(sx, 1);
  g.drawImage(ic, -size / 2, -size / 2, size, size);
  g.restore();
}

// ------------------------------------------------------------------ cards / UI images
function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function uiImage(img, cx, cy, w, { alpha = 1, rot = 0, shadow = true, crop } = {}) {
  if (alpha <= 0) return;
  const sw = crop ? crop[2] : img.width, sh = crop ? crop[3] : img.height, h = w * sh / sw;
  g.save(); g.globalAlpha = alpha; g.translate(cx, cy); g.rotate(rot); g.imageSmoothingEnabled = false;
  if (shadow) { g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 40 * S; g.shadowOffsetY = 16 * S; }
  if (crop) g.drawImage(img, crop[0], crop[1], crop[2], crop[3], -w / 2, -h / 2, w, h);
  else g.drawImage(img, -w / 2, -h / 2, w, h);
  g.restore();
}

// ------------------------------------------------------------------ assets
let IMG = {}, MARKET = null, HIST = {};
async function loadAll() {
  status('Loading fonts, clips and images…');
  await document.fonts.load(`800 40px "Sora"`); await document.fonts.load(`600 40px "Sora"`); await document.fonts.load(`400 40px "Sora"`); await document.fonts.load(`700 40px "Pixelify Sans"`);
  const names = ['ui-exchange', 'ui-board', 'ui-header', 'ui-toolbar', 'ui-wallet-connect', 'ui-wallet-connected'];
  const imgs = await Promise.all([loadImg('harvestia-logo.png'), ...names.map(n => loadImg(`stills/${n}.png`))]);
  IMG.logo = imgs[0]; names.forEach((n, i) => (IMG[n] = imgs[i + 1]));
  MARKET = await (await fetch('market.json')).json();
  for (const k of ['wheat', 'corn', 'soy', 'coffee', 'cocoa']) HIST[k] = await (await fetch(`hist-${k}.json`)).json();
  await Promise.all(Object.values(clips).map(c => c.ready()));
}

// ------------------------------------------------------------------ scenes
const LOGO = () => IMG.logo;
function logo(cx, cy, w, alpha = 1, glow = 0) {
  if (alpha <= 0) return;
  const h = w * LOGO().height / LOGO().width;
  g.save(); g.globalAlpha = alpha;
  if (glow) { g.shadowColor = `rgba(255,200,80,${.8 * glow})`; g.shadowBlur = 60 * S * glow; }
  g.drawImage(LOGO(), cx - w / 2, cy - h / 2, w, h);
  g.restore();
}

// Scene 1 — A New Farming Economy (0–6)
async function scene1(t) {
  const impact = 2.6, ix = W / 2, iy = H * (VERT ? .6 : .66);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  // reveal of the living farm from the impact point
  if (t >= impact) {
    const k = easeOut((t - impact) / 1.3), rad = k * Math.hypot(W, H) * 1.05;
    g.save(); g.beginPath(); g.arc(ix, iy, rad, 0, Math.PI * 2); g.clip();
    await drawClip('flyover', (t - impact) * 1.05, { zoom: 1.08 - .08 * k, fx: VERT ? .35 : .5 });
    warm(.35); vignette(.5);
    g.restore();
    // golden ring at the reveal edge
    if (k < 1) { g.save(); g.globalCompositeOperation = 'lighter'; g.lineWidth = 10 * S * (1 - k); g.strokeStyle = `rgba(255,214,110,${.8 * (1 - k)})`; g.beginPath(); g.arc(ix, iy, rad, 0, Math.PI * 2); g.stroke(); g.restore(); }
  }
  // spotlight cone + falling seed
  if (t < impact + .2) {
    const fall = easeOut(clamp(t / impact) ** 1.6), sy = lerp(-40 * S, iy, clamp(t / impact) ** 2.2), a = clamp(t / .5) * clamp((impact + .2 - t) / .2);
    const cone = g.createRadialGradient(ix, iy, 10, ix, iy, 520 * S);
    cone.addColorStop(0, `rgba(255,236,170,${.22 * a})`); cone.addColorStop(1, 'rgba(255,236,170,0)');
    g.fillStyle = cone; g.fillRect(0, 0, W, H);
    g.save(); g.globalAlpha = a; g.globalCompositeOperation = 'lighter';
    const gl = g.createRadialGradient(ix, sy, 0, ix, sy, 110 * S); gl.addColorStop(0, 'rgba(255,220,120,.9)'); gl.addColorStop(1, 'rgba(255,200,80,0)');
    g.fillStyle = gl; g.fillRect(ix - 110 * S, sy - 110 * S, 220 * S, 220 * S);
    g.restore();
    g.save(); g.globalAlpha = a; g.translate(ix, sy); g.rotate(Math.sin(t * 2.2) * .5);
    g.fillStyle = '#f7d774'; g.beginPath(); g.ellipse(0, 0, 16 * S, 25 * S, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c99a2e'; g.beginPath(); g.ellipse(3 * S, 6 * S, 9 * S, 15 * S, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff3c0'; g.beginPath(); g.ellipse(-5 * S, -7 * S, 5 * S, 9 * S, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    void fall;
  }
  burst(t - impact, ix, iy);
  particles(t, 40, { alpha: clamp((t - impact) / 1) * .8, rise: 30, seed: 3 });
  if (t > impact && t < impact + .25) shade(.9 * (1 - (t - impact) / .25), '255,230,170'); // flash
  // copy + logo
  band(H * (VERT ? .3 : .28), 120 * S, win(t, 3.25, 4.95, .4, .3));
  text(VERT ? 'THE FUTURE OF\nFARMING IS HERE.' : 'THE FUTURE OF FARMING IS HERE.', W / 2, H * (VERT ? .3 : .28), { size: VERT ? 84 : 66, alpha: win(t, 3.25, 4.95, .4, .3), track: .12, maxW: W * .9 });
  const la = win(t, 4.75, 6.4, .45, .4);
  logo(W / 2, H * (VERT ? .42 : .45), (VERT ? 760 : 640) * S * (0.94 + .06 * easeOut((t - 4.75) / .8)), la, 1);
  letterbox(1 - clamp((t - 4.8) / 1));
}

// Scene 2 — Build Your Farming Empire (6–14)
const S2 = [
  { word: 'GROW.', clip: 'plant', src: 1.0, fx: .5 },
  { word: 'BUILD.', clip: 'livestock', src: 1.2, fx: .3 },
  { word: 'HARVEST.', clip: 'harvest', src: .8, fx: .3 },
  { word: 'EXPAND.', clip: 'expand', src: .9, fx: .25 },
];
async function scene2(t) {
  const lt = t - 6, i = Math.min(3, Math.floor(lt / 2)), seg = S2[i], st = lt - i * 2;
  // subtle push-in per shot ("3D depth")
  await drawClip(seg.clip, seg.src + st, { zoom: 1.04 + .05 * ease(st / 2), fx: VERT ? seg.fx : .5 });
  warm(.18); vignette(.45);
  // flash cut on each beat
  if (st < .12) shade(.5 * (1 - st / .12), '255,240,200');
  // the real HUD top bar slides in (horizontal only; it is too wide for vertical)
  const hudA = win(t, 6.2, 13.9, .5, .3);
  if (hudA > 0) {
    const hb = IMG['ui-header'];
    if (!VERT) {
      const hw = W - 40 * S, hy = lerp(-60, 18, easeOut((t - 6.2) / .6)) * S;
      uiImage(hb, W / 2, hy + hw * hb.height / hb.width / 2, hw, { alpha: hudA, shadow: false });
    }
  }
  band(H * .3, 150 * S, clamp(st / .12) * clamp((1.95 - st) / .25) * .8);
  beatWord(seg.word, st, W / 2, H * .3, VERT ? 150 : 170);
  particles(t, 18, { alpha: .35, seed: 7 });
}

// Scene 3 — Real Markets, Virtual Farming (14–21)
const COMS = [
  { key: 'wheat', name: 'WHEAT', unit: '/t' }, { key: 'corn', name: 'CORN', unit: '/t' }, { key: 'soy', name: 'SOYBEANS', unit: '/t' },
  { key: 'coffee', name: 'COFFEE', unit: '¢/lb' }, { key: 'cocoa', name: 'COCOA', unit: '/t' },
];
const refLabel = k => { const r = MARKET.commodities.find(c => c.key === k).ref; return k === 'coffee' ? `${r.value.toFixed(0)}¢/lb` : `$${Math.round(r.value).toLocaleString('en-US')}/t`; };
const vsAvg = k => { const r = MARKET.commodities.find(c => c.key === k).ref; return (r.ratio - 1) * 100; };
function sparkline(k, x, y, w, h, prog, alpha) {
  const pts = HIST[k].reference.map(p => p.value), n = pts.length, mn = Math.min(...pts), mx = Math.max(...pts);
  const up = pts[n - 1] >= pts[0];
  g.save(); g.globalAlpha = alpha; g.lineWidth = 4 * S; g.strokeStyle = up ? '#7ee07a' : '#ff7b6b'; g.lineJoin = 'round';
  g.shadowColor = g.strokeStyle; g.shadowBlur = 14 * S;
  g.beginPath();
  const last = Math.max(1, Math.floor((n - 1) * prog));
  for (let i = 0; i <= last; i++) { const px = x + w * i / (n - 1), py = y + h - (pts[i] - mn) / (mx - mn || 1) * h; i ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.stroke(); g.restore();
}
async function scene3(t) {
  const lt = t - 14;
  if (lt < .8) {
    // zoom into the harvested field
    await drawClip('harvest', 3.0 + lt, { zoom: 1 + 1.6 * ease(lt / .8), fx: .36, fy: .45 });
    warm(.25); vignette(.5);
    if (lt > .6) shade((lt - .6) / .2, '255,236,170');
    return;
  }
  // background: the real market square, darkened
  await drawClip('market', 1.5 + (lt - .8) * .8, { zoom: 1.15, fx: VERT ? .62 : .5, alpha: 1 });
  shade(.72, '8,16,10'); vignette(.6);
  if (lt < 1.05) shade(1 - (lt - .8) / .25, '255,236,170');
  particles(t, 26, { alpha: .45, seed: 11, rise: 20 });

  // hero icon: wheat turning in 3D with its real 24-month reference line
  const heroA = win(lt, .8, 3.4, .3, .4);
  const hx = VERT ? W / 2 : W * .3, hy = VERT ? H * .3 : H * .44;
  if (heroA > 0) {
    drawIcon('wheat', hx, hy, 300 * S, (lt - .8) * 2.4, heroA);
    sparkline('wheat', hx - 300 * S, hy + 210 * S, 600 * S, 120 * S, easeOut((lt - 1.1) / 1.4), heroA);
    text(`WHEAT  ${refLabel('wheat')}`, hx, hy - 210 * S, { size: 40, weight: 800, color: GOLD, alpha: heroA, track: .06 });
    text(`+${vsAvg('wheat').toFixed(1)}% vs 24-month average`, hx, hy + 370 * S, { size: 26, weight: 600, alpha: heroA * .9, track: .02 });
  }
  // orbit of all five referenced commodities with real prices
  const orbA = win(lt, 3.0, 4.6, .4, .3);
  if (orbA > 0) {
    COMS.forEach((c, i) => {
      const cols = VERT ? 2 : 5, gx = VERT ? W * (.3 + .4 * (i % 2)) : W * (.12 + .19 * i), gy = VERT ? H * (.16 + .13 * Math.floor(i / 2)) + (i === 4 ? 0 : 0) : H * .36;
      const xx = VERT && i === 4 ? W / 2 : gx;
      const delay = i * .12, a = orbA * clamp((lt - 3.0 - delay) / .35);
      const bob = Math.sin(t * 2 + i) * 6 * S;
      drawIcon(c.key, xx, gy + bob, 130 * S, (lt - 3) * 1.6 + i, a);
      text(c.name, xx, gy + 100 * S, { size: 26, alpha: a, track: .14 });
      const d = vsAvg(c.key);
      text(refLabel(c.key), xx, gy + 136 * S, { size: 24, weight: 800, color: GOLD, alpha: a, track: .02 });
      text(`${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1)}%`, xx, gy + 168 * S, { size: 20, weight: 600, color: d >= 0 ? '#8ef08a' : '#ff8f80', alpha: a, track: 0 });
      void cols;
    });
  }
  // the real exchange window
  const exA = win(lt, 4.5, 7.0, .45, .3);
  if (exA > 0) {
    const k = easeOutBack((lt - 4.5) / .7), ew = (VERT ? 1000 : 960) * S;
    uiImage(IMG['ui-exchange'], W / 2, (VERT ? H * .5 : H * .555) + (1 - k) * 80 * S, ew * (.9 + .1 * k), { alpha: exA, rot: (1 - k) * -.03 });
  }
  // copy
  band(H * (VERT ? .07 : .12), 110 * S, 1);
  text(VERT ? 'REAL AGRICULTURAL\nMARKETS.' : 'REAL AGRICULTURAL MARKETS.', W / 2, H * (VERT ? .075 : .12), { size: VERT ? 70 : 64, alpha: win(lt, 1.2, 3.8, .35, .3), track: .1, maxW: W * .92 });
  text(VERT ? 'ONE DIGITAL\nFARMING ECONOMY.' : 'ONE DIGITAL FARMING ECONOMY.', W / 2, H * (VERT ? .075 : .12), { size: VERT ? 70 : 64, alpha: win(lt, 4.0, 7.0, .35, .3), track: .1, maxW: W * .92 });
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, H - (VERT ? 110 : 64) * S, W, (VERT ? 110 : 64) * S);
  text('Real monthly reference prices (IMF) influence in-game prices within set limits. Virtual crops are not claims on physical commodities.',
    W / 2, H - (VERT ? 70 : 40) * S, { size: 19, weight: 400, alpha: win(lt, 1.4, 7.0, .4, .3) * .85, track: 0, maxW: W * .94 });
}

// Scene 4 — The $HRV Ecosystem (21–30)
const NODES = [
  { title: 'PLAY & TRADE', body: '$HRV pays for in-game purchases' },
  { title: 'TOKEN BURNS', body: '50% of each in-game purchase is burned on-chain' },
  { title: 'BUYBACKS & REWARDS', body: 'Planned weekly buybacks fund the farmer reward treasury' },
];
function scene4(t) {
  const lt = t - 21;
  const bg = g.createRadialGradient(W / 2, H * .45, 0, W / 2, H * .45, Math.max(W, H) * .8);
  bg.addColorStop(0, '#1d2a18'); bg.addColorStop(.55, '#0e140c'); bg.addColorStop(1, '#050705');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  particles(t, 60, { alpha: .55 * clamp(lt / 1), seed: 21, rise: 18, size: 2.2 });
  const cx = W / 2, cy = H * (VERT ? .36 : .44), R = (VERT ? 190 : 170) * S;
  // node positions around the token
  const pos = VERT
    ? [[W / 2, H * .66], [W / 2, H * .77], [W / 2, H * .88]]
    : [[W * .18, H * .44], [W * .5, H * .83], [W * .82, H * .44]];
  // connections with flowing particles
  NODES.forEach((n, i) => {
    const a = clamp((lt - 1.0 - i * 1.25) / .5) * clamp((9 - lt) / .4);
    if (a <= 0) return;
    const [nx, ny] = pos[i], from = VERT ? [cx, cy + R * 1.1] : [cx + (nx - cx) * .22, cy + (ny - cy) * .22];
    const prog = easeOut((lt - 1.0 - i * 1.25) / .8);
    const ex = lerp(from[0], nx, prog), ey = lerp(from[1], ny - (VERT ? 60 * S : 0), prog);
    g.save(); g.globalAlpha = a * .7; g.strokeStyle = 'rgba(242,201,76,.55)'; g.lineWidth = 2.5 * S; g.setLineDash([10 * S, 10 * S]); g.lineDashOffset = -t * 60 * S;
    g.beginPath(); g.moveTo(from[0], from[1]); g.lineTo(ex, ey); g.stroke(); g.restore();
    for (let k = 0; k < 5; k++) {
      const f = ((t * .6 + k / 5 + i * .13) % 1) * prog;
      const px = lerp(from[0], nx, f), py = lerp(from[1], ny - (VERT ? 60 * S : 0), f);
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a;
      const gr = g.createRadialGradient(px, py, 0, px, py, 12 * S); gr.addColorStop(0, 'rgba(255,220,120,.95)'); gr.addColorStop(1, 'rgba(255,200,80,0)');
      g.fillStyle = gr; g.fillRect(px - 12 * S, py - 12 * S, 24 * S, 24 * S); g.restore();
    }
    // node card
    const cw = (VERT ? 860 : 540) * S, ch = (VERT ? 104 : 150) * S, k = easeOutBack((lt - 1.4 - i * 1.25) / .6);
    if (lt > 1.4 + i * 1.25) {
      g.save(); g.globalAlpha = a; g.translate(nx, ny); g.scale(.85 + .15 * k, .85 + .15 * k);
      rr(-cw / 2, -ch / 2, cw, ch, 18 * S); g.fillStyle = 'rgba(20,26,16,.86)'; g.fill();
      g.lineWidth = 2 * S; g.strokeStyle = 'rgba(242,201,76,.65)'; g.stroke();
      g.restore();
      text(n.title, nx, ny - (VERT ? 18 : 28) * S, { size: VERT ? 30 : 32, color: GOLD, alpha: a, track: .12, shadow: false, maxW: cw - 50 * S });
      text(n.body, nx, ny + (VERT ? 22 : 26) * S, { size: VERT ? 22 : 22, weight: 400, alpha: a * .92, track: 0, shadow: false, maxW: cw - 40 * S });
    }
  });
  // the token
  const ta = clamp(lt / .6) * clamp((9 - lt) / .4);
  coin(cx, cy, R * (0.85 + .15 * easeOutBack(lt / 1)), lt * 1.15, { alpha: ta, glow: 1 });
  text('POWERED BY $HRV.', W / 2, H * (VERT ? .12 : .11), { size: VERT ? 70 : 76, alpha: win(lt, 4.9, 9, .4, .4), track: .14, glow: 24 });
  text('Buybacks are planned and depend on available funds. No returns are promised.', W / 2, H - (VERT ? 44 : 30) * S,
    { size: 18, weight: 400, alpha: win(lt, 4.0, 9, .4, .4) * .8, track: 0, maxW: W * .94 });
  if (lt < .3) shade(1 - lt / .3);
}

// Scene 5 — The Official Launch (30–39)
function card(cx, cy, w, h, lines, a, k, accent) {
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.translate(cx, cy); g.scale(.9 + .1 * k, .9 + .1 * k);
  rr(-w / 2, -h / 2, w, h, 26 * S); g.fillStyle = 'rgba(14,18,11,.86)'; g.fill();
  g.lineWidth = 3 * S; g.strokeStyle = accent; g.shadowColor = accent; g.shadowBlur = 24 * S; g.stroke();
  g.restore();
  text(lines[0], cx, cy - h * .25, { size: VERT ? 52 : 58, color: GOLD, alpha: a, track: .1, glow: 18, maxW: w - 60 * S });
  text(lines[1], cx, cy + h * .02, { size: VERT ? 38 : 40, weight: 600, alpha: a, track: .12 });
  text(lines[2], cx, cy + h * .27, { size: VERT ? 62 : 66, alpha: a, track: .06 });
}
function timeline(lt, y) {
  const x0 = W * (VERT ? .14 : .22), x1 = W * (VERT ? .86 : .78), a = clamp((lt - .4) / .5);
  const p = clamp(ease((lt - .6) / 3)) * .5 + clamp(ease((lt - 4.6) / 2)) * .5;
  g.save(); g.globalAlpha = a;
  g.lineWidth = 6 * S; g.lineCap = 'round'; g.strokeStyle = 'rgba(255,244,220,.25)'; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
  g.strokeStyle = GOLD; g.shadowColor = GOLD; g.shadowBlur = 16 * S; g.beginPath(); g.moveTo(x0, y); g.lineTo(lerp(x0, x1, p), y); g.stroke();
  g.restore();
  [[x0, '3:00 PM UTC', '$HRV LAUNCH', lt > .6], [x1, '4:00 PM UTC', 'GAMEPLAY OPENS', lt > 4.6]].forEach(([x, time, label, on]) => {
    g.save(); g.globalAlpha = a; g.beginPath(); g.arc(x, y, 14 * S, 0, Math.PI * 2); g.fillStyle = on ? GOLD : '#3a3a2a'; g.fill();
    g.lineWidth = 3 * S; g.strokeStyle = CREAM; g.stroke(); g.restore();
    text(time, x, y - 40 * S, { size: 26, weight: 800, alpha: a * (on ? 1 : .55), track: .06 });
    text(label, x, y + 42 * S, { size: 20, weight: 600, alpha: a * (on ? 1 : .55), track: .12, color: on ? GOLD : CREAM });
  });
}
async function scene5(t) {
  const lt = t - 30;
  // background: farm world (darker during the token card)
  const second = lt > 4.3;
  await drawClip(second ? 'flyover' : 'market', second ? 4.2 + (lt - 4.3) * .9 : .6 + lt * .7, { zoom: 1.06, fx: VERT ? (second ? .35 : .62) : .5 });
  warm(.2);
  shade(second ? .38 + .2 * (1 - clamp((lt - 4.3) / .6)) : .62); vignette(.55);
  if (lt < .3) shade(1 - lt / .3);
  logo(W / 2, H * (VERT ? .1 : .13), (VERT ? 420 : 330) * S, win(lt, .1, 9, .5, .3), .6);
  // card 1 — token launch
  const cw = (VERT ? 900 : 860) * S, ch = (VERT ? 330 : 300) * S, cy = H * (VERT ? .37 : .47);
  const a1 = win(lt, .6, 4.4, .4, .35), k1 = easeOutBack((lt - .6) / .6);
  if (a1 > 0) {
    coin(W / 2 + (VERT ? 0 : -cw / 2 - 110 * S), VERT ? cy - ch / 2 - 110 * S : cy, 80 * S * (1 + .06 * Math.sin(lt * 6)), lt * 1.4, { alpha: a1, glow: .8 + .4 * Math.sin(lt * 6) });
    card(W / 2, cy, cw, ch, ['$HRV TOKEN LAUNCH', 'OCTOBER 26, 2026', '3:00 PM UTC'], a1, k1, 'rgba(242,201,76,.9)');
  }
  // card 2 — gameplay opens, with the real wallet window connecting
  const a2 = win(lt, 4.6, 9, .4, .35), k2 = easeOutBack((lt - 4.6) / .6);
  if (a2 > 0) {
    card(W / 2 + (VERT ? 0 : -330 * S), cy, VERT ? cw : 680 * S, ch, ['GAMEPLAY OPENS', 'OCTOBER 26, 2026', '4:00 PM UTC'], a2, k2, 'rgba(126,224,122,.9)');
    const wy = VERT ? H * .64 : cy, wx = VERT ? W / 2 : W * .74, ww = (VERT ? 900 : 700) * S;
    const conn = clamp((lt - 6.4) / .35);
    const src = IMG['ui-wallet-connect'], dst = IMG['ui-wallet-connected'];
    const crop = img => [0, 0, img.width, Math.round(img.height * (img === dst ? .37 : .33))];
    uiImage(src, wx, wy + (1 - easeOut((lt - 5)/.6)) * 60 * S, ww, { alpha: a2 * (1 - conn) * clamp((lt - 5) / .4), crop: crop(src) });
    uiImage(dst, wx, wy, ww, { alpha: a2 * conn, crop: crop(dst) });
    if (lt > 6.4 && lt < 7.2) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - (lt - 6.4) / .8; g.strokeStyle = '#7ee07a'; g.lineWidth = 6 * S; rr(wx - ww / 2 - 10 * S, wy - ww * .2, ww + 20 * S, ww * .4, 20 * S); g.stroke(); g.restore(); }
  }
  timeline(lt, H * (VERT ? .86 : .86));
  particles(t, 30, { alpha: .5, seed: 31 });
  letterbox(.6);
}

// Scene 6 — Final Call to Action (39–45)
async function scene6(t) {
  const lt = t - 39;
  await drawClip('finale', .4 + lt * 1.3, { zoom: 1.02, fx: VERT ? .5 : .5 });
  // golden sunlight sweeping across
  const sweep = clamp(lt / 3);
  g.save(); g.globalCompositeOperation = 'soft-light';
  const lg = g.createLinearGradient(0, 0, W, H); lg.addColorStop(0, `rgba(255,190,90,${.55 * sweep})`); lg.addColorStop(clamp(sweep), `rgba(255,210,120,${.35 * sweep})`); lg.addColorStop(1, 'rgba(255,170,60,0)');
  g.fillStyle = lg; g.fillRect(0, 0, W, H); g.restore();
  shade(.18 + .25 * clamp((lt - 1.2) / 1)); vignette(.6);
  if (lt < .25) shade(1 - lt / .25, '255,236,170');
  particles(t, 60, { alpha: .8, seed: 41, rise: 35, size: 3 });
  const la = clamp((lt - .9) / .6);
  logo(W / 2, H * (VERT ? .38 : .36), (VERT ? 820 : 700) * S * (0.96 + .04 * easeOut((lt - .9) / 1.5)), la, .8 + .2 * Math.sin(lt * 3));
  text(VERT ? 'YOUR FARM.\nYOUR ECONOMY.' : 'YOUR FARM. YOUR ECONOMY.', W / 2, H * (VERT ? .585 : .66), { size: VERT ? 80 : 60, maxW: W * .92, alpha: clamp((lt - 1.6) / .5), track: .14, glow: 16 });
  text('www.harvestia.xyz', W / 2, H * (VERT ? .67 : .76), { size: VERT ? 46 : 44, weight: 600, color: GOLD, alpha: clamp((lt - 2.1) / .5), track: .04 });
  text(VERT ? '$HRV — 3:00 PM UTC\nGAMEPLAY — 4:00 PM UTC' : '$HRV — 3:00 PM UTC  |  GAMEPLAY — 4:00 PM UTC', W / 2, H * (VERT ? .735 : .85), { size: VERT ? 40 : 30, weight: 600, alpha: clamp((lt - 2.5) / .5), track: .06, maxW: W * .92 });
  if (lt > 5.5) shade((lt - 5.5) / .5 * .0);
}

async function drawFrame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.shadowBlur = 0; g.filter = 'none';
  if (t < 6) await scene1(t);
  else if (t < 14) await scene2(t);
  else if (t < 21) await scene3(t);
  else if (t < 30) scene4(t);
  else if (t < 39) await scene5(t);
  else await scene6(t);
}

// ------------------------------------------------------------------ soundtrack (synthesized, original)
import { buildSoundtrack } from './audio.js';

// ------------------------------------------------------------------ encode
const up = (path, data) => fetch(`/upload?path=${path}`, { method: 'POST', body: data }).then(r => r.json());

async function encodeAll() {
  const tag = VERT ? '9x16' : '16x9';
  status('Rendering soundtrack…');
  const [mix, clean] = await Promise.all([buildSoundtrack(DUR, true), buildSoundtrack(DUR, false)]);
  const make = () => new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H, frameRate: FPS }, audio: { codec: 'aac', sampleRate: 48000, numberOfChannels: 2 }, fastStart: 'in-memory', firstTimestampBehavior: 'offset' });
  const muxers = { music: make(), clean: make() };
  const venc = new VideoEncoder({ output: (chunk, meta) => { muxers.music.addVideoChunk(chunk, meta); muxers.clean.addVideoChunk(chunk, meta); }, error: e => { throw e; } });
  venc.configure({ codec: 'avc1.640033', width: W, height: H, bitrate: 16e6, framerate: FPS, latencyMode: 'quality', avc: { format: 'avc' } });
  // audio
  for (const [name, buf] of [['music', mix], ['clean', clean]]) {
    const aenc = new AudioEncoder({ output: (chunk, meta) => muxers[name].addAudioChunk(chunk, meta), error: e => { throw e; } });
    aenc.configure({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 256000 });
    const L = buf.getChannelData(0), R = buf.getChannelData(1), N = 1024;
    for (let i = 0; i < L.length; i += N) {
      const n = Math.min(N, L.length - i), data = new Float32Array(n * 2);
      data.set(L.subarray(i, i + n), 0); data.set(R.subarray(i, i + n), n);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i / 48000 * 1e6), data });
      aenc.encode(ad); ad.close();
    }
    await aenc.flush(); aenc.close();
  }
  // video
  const frames = DUR * FPS, t0 = performance.now();
  for (let f = 0; f < frames; f++) {
    await drawFrame(f / FPS);
    const vf = new VideoFrame(cv, { timestamp: Math.round(f * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
    venc.encode(vf, { keyFrame: f % (FPS * 2) === 0 }); vf.close();
    while (venc.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 5));
    if (f % 15 === 0) { const el = (performance.now() - t0) / 1000; status(`${tag}: frame ${f}/${frames} · ${el.toFixed(0)}s elapsed · ~${(el / (f + 1) * (frames - f)).toFixed(0)}s left`); }
  }
  await venc.flush(); venc.close();
  const results = {};
  for (const [name, m] of Object.entries(muxers)) {
    m.finalize();
    results[name] = await up(`out/harvestia-trailer-${tag}${name === 'clean' ? '-no-music' : ''}.mp4`, new Blob([m.target.buffer], { type: 'video/mp4' }));
  }
  status(`${tag}: done ${JSON.stringify(results)}`);
  return results;
}

// preview single frames for review: renderAt(seconds) uploads stills/frame-<tag>-<t>.png
window.renderAt = async t => { await drawFrame(t); const b = await new Promise(r => cv.toBlob(r, 'image/png')); return up(`stills/frame-${VERT ? '9x16' : '16x9'}-${String(t).replace('.', '_')}.png`, b); };
window.encodeAll = encodeAll;
window.audioPreview = async (music = true) => { const b = await buildSoundtrack(DUR, music); return b; };

await loadAll();
status(`Ready ${W}×${H}. Use renderAt(t) or encodeAll().`);
window.__ready = true;
await drawFrame(0.0);
