// Harvestia — original pixel-art sprite library (Stage 1 concept).
// Every sprite is drawn procedurally at 1 logical pixel = 1 art pixel, then
// scaled with nearest-neighbour. Coordinates: (x, y) = top-left unless noted.
(function () {
'use strict';
const HV = window.HV = {};
let G = null;
HV.use = g => { G = g; G.imageSmoothingEnabled = false; };

const R = HV.R = (x, y, w, h, c) => { if (w <= 0 || h <= 0) return; G.fillStyle = c; G.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const P = HV.P = (x, y, c) => { G.fillStyle = c; G.fillRect(Math.round(x), Math.round(y), 1, 1); };
const E = HV.E = (cx, cy, rx, ry, c) => {
  cx = Math.round(cx); cy = Math.round(cy); rx = Math.max(0, Math.round(rx)); ry = Math.max(0, Math.round(ry));
  G.fillStyle = c;
  for (let dy = -ry; dy <= ry; dy++) {
    const t = dy / (ry + 0.5);
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t)));
    G.fillRect(cx - w, cy + dy, 2 * w + 1, 1);
  }
};
const SH = HV.SH = 'rgba(22,46,18,0.30)';

HV.hash = (x, y, s) => {
  let h = (x * 374761393 + y * 668265263 + (s || 0) * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
HV.noise = (x, y, sc, s) => {
  const fx = x / sc, fy = y / sc, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
  const u = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty);
  const a = HV.hash(ix, iy, s), b = HV.hash(ix + 1, iy, s), c = HV.hash(ix, iy + 1, s), d = HV.hash(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const hash = HV.hash;
// mirrored rect: sprite authored facing right, flip draws it facing left
const M = (ox, oy, W, flip) => (dx, dy, w, h, c) => R(flip ? ox + W - dx - w : ox + dx, oy + dy, w, h, c);

// ---------------------------------------------------------------- shared parts
const win = HV.win = (x, y, w = 10, h = 9) => {
  R(x, y, w, h, '#fff4dc'); R(x + 1, y + 1, w - 2, h - 2, '#4f97c2'); R(x + 1, y + 1, w - 2, 2, '#86c8e8');
  P(x + 2, y + 3, '#d6f2ff'); P(x + 3, y + 2, '#d6f2ff');
  R(x + Math.floor(w / 2), y + 1, 1, h - 2, '#fff4dc'); R(x + 1, y + Math.floor(h / 2), w - 2, 1, '#fff4dc');
  R(x, y + h, w, 1, 'rgba(0,0,0,.22)');
};
HV.roof = (x, y, w, h, base, dark, light) => {
  const ins = r => Math.max(0, Math.round(4 * (1 - r / Math.max(1, h - 1))));
  for (let r = 0; r < h; r++) R(x + ins(r), y + r, w - 2 * ins(r), 1, base);
  for (let r = 0, row = 0; r < h - 1; r += 4, row++) {
    const i = ins(r), off = row % 2 ? 3 : 0;
    R(x + i, y + r + 3, w - 2 * i, 1, dark);
    for (let sx = x + i + off; sx < x + w - i; sx += 6) { R(sx, y + r, 1, 3, dark); P(sx + 1, y + r, light); P(sx + 2, y + r, light); }
  }
  R(x + 4, y, w - 8, 2, dark); R(x + 5, y, w - 10, 1, light);
  R(x, y + h - 2, w, 2, dark); R(x + 1, y + h, w - 2, 2, 'rgba(0,0,0,.28)');
  P(x, y + h - 3, dark); P(x + w - 1, y + h - 3, dark);
};

// ---------------------------------------------------------------- nature
HV.tree = (x, y, seed = 0, r = 9, fruit = null) => {
  E(x + 2, y, r + 1, Math.max(2, Math.round(r * 0.32)), SH);
  R(x - 2, y - 10, 4, 10, '#6e4527'); R(x + 1, y - 10, 1, 10, '#4e2f1a'); P(x - 3, y - 1, '#6e4527'); P(x + 2, y - 1, '#4e2f1a');
  const cy = y - 10 - r + 4;
  const cl = [[0, 0, 1], [-.6, .2, .62], [.6, .2, .62], [-.42, -.5, .6], [.42, -.5, .6], [0, .38, .7]];
  for (const c of cl) E(x + c[0] * r, cy + c[1] * r, r * c[2], r * c[2] * .88, '#2a6430');
  for (const c of cl) E(x + c[0] * r - 1, cy + c[1] * r - 1, r * c[2] - 1.3, r * c[2] * .88 - 1.3, '#3b893b');
  E(x - r * .25, cy - r * .32, r * .5, r * .38, '#52a645'); E(x - r * .58, cy + r * .02, r * .26, r * .24, '#52a645'); E(x + r * .25, cy - r * .58, r * .28, r * .18, '#52a645');
  for (let i = 0; i < r * 4; i++) {
    const a = hash(i, seed, 11) * 6.283, d = Math.sqrt(hash(i, seed, 12)) * (r - 1.5);
    const px = x + Math.cos(a) * d, py = cy + Math.sin(a) * d * .85;
    P(px, py, (py > cy + 1 || px > x + 2) ? '#2a6430' : '#6cbf52');
  }
  P(x - r * .35, cy - r * .52, '#8edb6c'); P(x - r * .35 - 1, cy - r * .45, '#8edb6c'); P(x - r * .7, cy - 1, '#8edb6c');
  if (fruit) for (let i = 0; i < 7; i++) {
    const a = hash(i, seed, 13) * 6.283, d = (0.25 + 0.6 * hash(i, seed, 14)) * (r - 2);
    const fx = x + Math.cos(a) * d, fy = cy + Math.sin(a) * d * .8;
    R(fx, fy, 2, 2, fruit); P(fx, fy, '#ffd6b8');
  }
};
HV.pine = (x, y, seed = 0, s = 1) => {
  E(x + 2, y, Math.round(8 * s), 2, SH); R(x - 1, y - 4, 3, 4, '#5a361f');
  const tiers = [[y - 3, 9 * s, 11], [y - 10 * s, 7 * s, 10], [y - 17 * s, 5 * s, 9]];
  for (const [by, hw, h] of tiers) {
    for (let r = 0; r < h; r++) {
      const w = Math.round(hw * (r + 1) / h), yy = by - h + r;
      R(x - w, yy, w + 1, 1, '#2d7046'); R(x + 1, yy, w, 1, '#1d4f35');
      if (r % 3 === 1) P(x - w, yy, '#4f9e5e');
      if (r % 4 === 2 && w > 2) P(x - Math.round(w / 2), yy, '#3f8a55');
    }
    for (let k = -Math.round(hw); k <= Math.round(hw); k += 2) P(x + k, by, '#1a4430');
  }
  P(x, y - 17 * s - 9, '#4f9e5e');
};
HV.bush = (x, y, seed = 0, flowers = null) => {
  E(x + 1, y, 7, 2, SH);
  E(x - 3, y - 3, 3, 3, '#2a6430'); E(x + 3, y - 3, 3, 3, '#2a6430'); E(x, y - 5, 4, 4, '#2a6430');
  E(x - 3, y - 4, 2, 2, '#3b893b'); E(x + 2, y - 4, 2, 2, '#3b893b'); E(x - 1, y - 6, 3, 2, '#3b893b');
  P(x - 2, y - 8, '#6cbf52'); P(x - 1, y - 8, '#6cbf52'); P(x - 4, y - 5, '#6cbf52');
  if (flowers) for (let i = 0; i < 5; i++) P(x - 4 + Math.floor(hash(i, seed, 5) * 9), y - 8 + Math.floor(hash(i, seed, 6) * 6), flowers);
};
HV.rock = (x, y, s = 1) => {
  E(x + 1, y, Math.round(5 * s), 2, SH);
  E(x, y - 2, Math.round(4 * s), Math.round(3 * s), '#6c6f78'); E(x - 1, y - 3, Math.round(3 * s), Math.round(2 * s), '#9a9ea8');
  P(x - 2, y - 4, '#c9ccd3'); P(x - 1, y - 2 - Math.round(2 * s), '#c9ccd3');
};
HV.tuft = (x, y, c = '#7fcf5c', d = '#357a34') => { P(x, y, d); P(x - 1, y - 1, c); P(x + 1, y - 1, c); P(x, y - 2, c); };
HV.flowers = (x, y, seed) => {
  const cols = ['#fff6e8', '#f7d64a', '#f08ab0', '#b48ef0', '#ff7a5a'];
  const col = cols[Math.floor(hash(seed, 7, 3) * cols.length)];
  for (let i = 0; i < 6; i++) {
    const fx = x + Math.floor(hash(i, seed, 1) * 11) - 5, fy = y + Math.floor(hash(i, seed, 2) * 7) - 3;
    P(fx, fy + 1, '#357a34'); P(fx, fy, i % 3 ? col : cols[(i + seed) % cols.length]);
  }
};
HV.lily = (x, y) => { E(x, y, 3, 2, '#3f8f3a'); P(x + 1, y - 1, '#5fae3f'); P(x, y, '#2f6f2e'); P(x - 1, y - 1, '#f6b3d0'); };

// ---------------------------------------------------------------- fences / props
HV.fenceH = (x1, x2, y) => {
  R(x1, y - 6, x2 - x1, 1, '#c48d52'); R(x1, y - 5, x2 - x1, 1, '#7a4a28');
  R(x1, y - 3, x2 - x1, 1, '#c48d52'); R(x1, y - 2, x2 - x1, 1, '#7a4a28');
  for (let x = x1; x <= x2; x += 8) { R(x - 1, y - 8, 3, 9, '#8a5a32'); P(x - 1, y - 8, '#c48d52'); R(x + 1, y - 8, 1, 9, '#5e3a20'); R(x - 1, y + 1, 4, 1, 'rgba(0,0,0,.22)'); }
};
HV.fenceV = (x, y1, y2) => {
  R(x, y1 - 7, 1, y2 - y1, '#c48d52'); R(x + 1, y1 - 7, 1, y2 - y1, '#7a4a28');
  for (let y = y1; y <= y2; y += 8) { R(x - 1, y - 8, 3, 9, '#8a5a32'); P(x - 1, y - 8, '#c48d52'); R(x + 1, y - 8, 1, 9, '#5e3a20'); }
};
HV.sack = (x, y) => { E(x + 1, y, 4, 1, SH); R(x - 3, y - 6, 7, 6, '#e9e0c8'); R(x - 2, y - 7, 5, 1, '#e9e0c8'); R(x - 1, y - 8, 3, 1, '#c9bea0'); R(x + 2, y - 6, 2, 6, '#cfc4a6'); P(x - 1, y - 4, '#c99a2e'); P(x, y - 3, '#c99a2e'); };
HV.crate = (x, y, fill) => {
  R(x + 1, y + 8, 9, 1, SH); R(x, y, 8, 8, '#c08a54'); R(x, y, 8, 1, '#d9a46a'); R(x, y + 7, 8, 1, '#7a4a28'); R(x, y, 1, 8, '#7a4a28'); R(x + 7, y, 1, 8, '#7a4a28');
  if (fill) { R(x + 1, y - 1, 6, 2, fill); P(x + 2, y - 2, fill); P(x + 5, y - 2, fill); P(x + 2, y - 1, '#ffffff55'); }
  else for (let i = 1; i < 7; i++) P(x + i, y + i, '#8f5f33');
};
HV.hay = (x, y) => { R(x + 2, y + 7, 11, 2, SH); R(x, y, 11, 7, '#e3bd55'); R(x, y, 11, 2, '#f2d77a'); R(x, y + 6, 11, 1, '#c49a35'); R(x + 3, y, 1, 7, '#c49a35'); R(x + 7, y, 1, 7, '#c49a35'); P(x + 5, y + 3, '#c49a35'); P(x + 1, y + 4, '#f2d77a'); };
HV.barrel = (x, y) => { R(x + 1, y + 9, 8, 1, SH); R(x, y, 7, 9, '#9a6a3c'); R(x, y, 7, 1, '#6b4226'); R(x, y + 2, 7, 1, '#5e6670'); R(x, y + 6, 7, 1, '#5e6670'); R(x + 1, y + 1, 1, 7, '#b98250'); R(x + 5, y + 1, 1, 7, '#7a4e2c'); };
HV.trough = (x, y) => { R(x + 1, y + 6, 18, 1, SH); R(x, y, 18, 6, '#8a5a32'); R(x + 1, y + 1, 16, 3, '#5ea9d1'); R(x + 2, y + 1, 5, 1, '#a8dcf2'); R(x, y + 5, 18, 1, '#5e3a20'); };
HV.lamp = (x, y) => { R(x + 1, y, 3, 1, SH); R(x, y - 16, 1, 16, '#3a3a3a'); R(x - 1, y - 20, 3, 4, '#2a2a2a'); P(x, y - 19, '#ffe69a'); P(x, y - 18, '#f7c94a'); R(x - 1, y - 21, 3, 1, '#2a2a2a'); };
HV.sign = (x, y, col = '#c48d52') => { R(x + 1, y, 4, 1, SH); R(x, y - 10, 2, 10, '#6e4527'); R(x - 6, y - 14, 14, 7, col); R(x - 6, y - 14, 14, 1, '#e0b07a'); R(x - 6, y - 8, 14, 1, '#6e4527'); R(x - 4, y - 12, 8, 1, '#5a3420'); R(x - 4, y - 10, 6, 1, '#5a3420'); };
HV.well = (x, y) => {
  E(x + 8, y + 20, 9, 2, SH);
  R(x, y + 10, 16, 10, '#9b9384'); for (let k = 0; k < 16; k += 4) R(x + k, y + 10 + (k % 8 ? 3 : 0), 1, 3, '#7d7669'); R(x, y + 14, 16, 1, '#7d7669'); R(x, y + 10, 16, 2, '#b8b0a0');
  R(x + 2, y + 10, 12, 2, '#2a4a6a');
  R(x + 1, y + 2, 1, 9, '#6e4527'); R(x + 14, y + 2, 1, 9, '#6e4527'); R(x + 1, y + 4, 14, 1, '#5a3420');
  for (let r = 0; r < 4; r++) R(x - 1 + r, y - 2 + r, 18 - 2 * r, 1, '#b8463a'); R(x - 1, y + 2, 18, 1, '#7a2c20');
  R(x + 7, y + 5, 3, 3, '#8a5a32'); P(x + 8, y + 5, '#c48d52');
};
HV.scarecrow = (x, y) => {
  R(x + 1, y, 5, 1, SH); R(x, y - 16, 1, 16, '#6e4527'); R(x - 6, y - 12, 13, 1, '#6e4527');
  R(x - 3, y - 13, 7, 7, '#4f7fb8'); R(x - 3, y - 7, 7, 1, '#3a5f8f'); P(x - 6, y - 13, '#e3bd55'); P(x + 6, y - 13, '#e3bd55');
  R(x - 2, y - 18, 5, 5, '#e9d6a8'); P(x - 1, y - 16, '#3a2414'); P(x + 1, y - 16, '#3a2414');
  R(x - 4, y - 19, 9, 1, '#b07a44'); R(x - 2, y - 22, 5, 3, '#b07a44');
};
HV.podium = (x, y) => {
  R(x + 2, y + 14, 30, 2, SH);
  R(x + 10, y, 12, 14, '#e3b341'); R(x + 10, y, 12, 2, '#f7d77a'); R(x + 15, y + 4, 2, 6, '#a8801f');
  R(x, y + 4, 10, 10, '#c9ced6'); R(x, y + 4, 10, 2, '#eef2f7'); R(x + 4, y + 7, 2, 4, '#7f8794');
  R(x + 22, y + 7, 10, 7, '#c87a3a'); R(x + 22, y + 7, 10, 2, '#e09a5a'); R(x + 26, y + 9, 2, 3, '#8a4f22');
};
HV.board = (x, y) => {
  R(x + 3, y + 22, 22, 2, SH); R(x + 2, y + 8, 2, 14, '#6e4527'); R(x + 20, y + 8, 2, 14, '#6e4527');
  R(x, y, 24, 15, '#9a6a3c'); R(x, y, 24, 1, '#c48d52'); R(x, y + 14, 24, 1, '#5a3420'); R(x, y, 1, 15, '#5a3420'); R(x + 23, y, 1, 15, '#5a3420');
  const papers = [[2, 2, '#fff6e6'], [9, 3, '#f4e4bc'], [16, 2, '#fff6e6']];
  for (const [px, py, c] of papers) { R(x + px, y + py, 6, 9, c); R(x + px + 1, y + py + 2, 4, 1, '#9a8a70'); R(x + px + 1, y + py + 4, 3, 1, '#9a8a70'); R(x + px + 1, y + py + 6, 4, 1, '#9a8a70'); P(x + px + 2, y + py, '#e0402f'); }
};

HV.fountain = (cx, cy) => {
  E(cx + 2, cy + 6, 17, 6, SH);
  E(cx, cy + 2, 16, 8, '#8f7d62'); E(cx, cy + 1, 16, 8, '#cbb991'); E(cx, cy, 14, 7, '#a8957a'); E(cx, cy + 1, 13, 6, '#3d8fd6'); E(cx - 2, cy, 8, 3, '#55a9e4');
  R(cx - 2, cy - 9, 5, 10, '#cbb991'); R(cx + 1, cy - 9, 2, 10, '#a8957a'); E(cx, cy - 9, 5, 2, '#a8957a'); E(cx, cy - 10, 4, 1, '#3d8fd6');
};
HV.fountainWater = (cx, cy, t) => {
  for (let k = 0; k < 16; k++) {
    const ph = (t * 1.2 + k / 16) % 1, a = k * 0.785 + (k % 2) * .3, d = ph * 9;
    P(cx + Math.cos(a) * d, cy - 11 + Math.sin(a) * d * .5 - Math.sin(ph * Math.PI) * 6 + ph * 8, ph < .6 ? '#e3f6ff' : '#86ccf2');
  }
  P(cx, cy - 13 - Math.round(Math.sin(t * 8)), '#e3f6ff'); P(cx, cy - 12, '#a6dcf7');
  const r = 4 + ((t * 6) % 8); for (let a = 0; a < 6.28; a += .5) P(cx + Math.cos(a) * r, cy + 1 + Math.sin(a) * r * .45, 'rgba(227,246,255,.7)');
};
HV.bench = (x, y) => { R(x + 1, y + 6, 16, 1, SH); R(x, y, 16, 2, '#a87443'); R(x, y + 2, 16, 1, '#6e4527'); R(x, y - 3, 16, 2, '#8a5a32'); R(x + 1, y + 3, 1, 3, '#3a3a3a'); R(x + 14, y + 3, 1, 3, '#3a3a3a'); };
HV.planter = (x, y, col) => {
  R(x + 1, y + 8, 26, 1, SH); R(x, y + 2, 26, 6, '#8a5a32'); R(x, y + 2, 26, 1, '#c48d52'); R(x, y + 7, 26, 1, '#5e3a20');
  R(x + 1, y, 24, 2, '#5a3420');
  for (let k = 0; k < 24; k += 2) { P(x + 1 + k, y - 1 + (k % 4 ? 0 : 1), '#3f8e3f'); P(x + 1 + k, y - 2 + (k % 4 ? 1 : 0), k % 6 === 0 ? '#ffffff' : col); P(x + 2 + k, y, '#5fae3f'); }
};
HV.reeds = (x, y) => { R(x, y - 6, 1, 6, '#4f8a3c'); R(x + 2, y - 8, 1, 8, '#5fae3f'); R(x - 2, y - 5, 1, 5, '#6cbf52'); R(x + 2, y - 10, 1, 3, '#8a5a32'); P(x, y - 7, '#8a5a32'); };
HV.dock = (x, y, len) => {
  R(x + 2, y + 2, 10, len, 'rgba(10,30,60,.3)');
  R(x, y, 10, len, '#b07a44'); for (let k = 0; k < len; k += 3) R(x, y + k, 10, 1, '#7f5530'); R(x, y, 1, len, '#d39a5c'); R(x + 9, y, 1, len, '#6e4527');
  for (const py of [y + 4, y + len - 2]) { R(x - 1, py, 2, 4, '#5e3a20'); R(x + 9, py, 2, 4, '#5e3a20'); }
  R(x + 6, y + len - 5, 3, 3, '#3f6fa8'); P(x + 7, y + len - 6, '#c48d52');
};

// ---------------------------------------------------------------- buildings
HV.farmhouse = (x, y) => {
  R(x + 4, y + 56, 56, 4, SH); R(x + 56, y + 26, 4, 30, SH);
  R(x + 2, y + 24, 52, 30, '#efdcb2');
  for (let k = 4; k < 30; k += 5) R(x + 2, y + 24 + k, 52, 1, '#dcc596');
  R(x + 2, y + 24, 3, 30, '#8a5a33'); R(x + 51, y + 24, 3, 30, '#8a5a33');
  R(x + 2, y + 51, 52, 3, '#8f8678'); for (let k = 0; k < 52; k += 6) P(x + 2 + k, y + 52, '#6f685d');
  R(x + 2, y + 24, 52, 2, '#bea377');
  // chimney behind roof ridge
  R(x + 42, y - 7, 7, 12, '#a24e36'); R(x + 41, y - 8, 9, 2, '#6b3123'); for (let k = 0; k < 12; k += 3) R(x + 42, y - 6 + k, 7, 1, '#7d3826');
  HV.roof(x - 2, y, 60, 25, '#c4553b', '#8b3324', '#e47b57');
  R(x + 22, y + 7, 12, 11, '#efdcb2'); R(x + 21, y + 5, 14, 2, '#8b3324'); R(x + 22, y + 5, 12, 1, '#e47b57'); win(x + 24, y + 9, 8, 7);
  R(x + 22, y + 34, 12, 20, '#5a3218'); R(x + 23, y + 35, 10, 19, '#8a5530'); R(x + 27, y + 35, 1, 19, '#6b4226'); R(x + 24, y + 38, 2, 3, '#a8dcf2'); R(x + 29, y + 38, 2, 3, '#a8dcf2'); P(x + 31, y + 45, '#f2c94c');
  R(x + 20, y + 31, 16, 3, '#8b3324'); R(x + 20, y + 31, 16, 1, '#e47b57');
  for (const wx of [x + 8, x + 38]) {
    R(wx - 3, y + 32, 3, 10, '#4e8a3c'); R(wx + 10, y + 32, 3, 10, '#4e8a3c'); P(wx - 2, y + 34, '#3a6a2c'); P(wx + 11, y + 34, '#3a6a2c');
    win(wx, y + 32, 10, 10);
    R(wx - 1, y + 43, 12, 3, '#8a5530'); for (let k = 0; k < 12; k += 2) { P(wx - 1 + k, y + 42, k % 4 ? '#f08ab0' : '#f7d64a'); P(wx + k, y + 42, '#4f9a3c'); }
  }
  R(x + 20, y + 54, 16, 2, '#b5ad9d'); R(x + 21, y + 56, 14, 2, '#9b9384');
};
HV.barn = (x, y) => {
  R(x + 4, y + 54, 60, 3, SH); R(x + 60, y + 24, 4, 30, SH);
  R(x + 2, y + 20, 56, 34, '#b5402f'); for (let k = 2; k < 56; k += 4) R(x + 2 + k, y + 20, 1, 34, '#943326');
  R(x + 2, y + 20, 2, 34, '#f5efe3'); R(x + 56, y + 20, 2, 34, '#f5efe3');
  R(x + 2, y + 51, 56, 3, '#6e665c');
  HV.roof(x - 1, y, 62, 21, '#5f6b78', '#3d4651', '#8492a1');
  R(x + 24, y + 5, 12, 11, '#f5efe3'); R(x + 26, y + 7, 8, 9, '#3a2414'); R(x + 26, y + 12, 8, 4, '#e3bd55'); P(x + 28, y + 11, '#e3bd55'); P(x + 31, y + 10, '#e3bd55');
  const dx = x + 18, dy = y + 30, dw = 24, dh = 21;
  R(dx - 1, dy - 1, dw + 2, dh + 1, '#f5efe3'); R(dx, dy, dw, dh, '#8e3022');
  for (let i = 0; i < dh; i++) {
    const t = i / (dh - 1);
    P(dx + Math.round(t * 10), dy + i, '#f5efe3'); P(dx + 10 - Math.round(t * 10), dy + i, '#f5efe3');
    P(dx + 13 + Math.round(t * 10), dy + i, '#f5efe3'); P(dx + 23 - Math.round(t * 10), dy + i, '#f5efe3');
  }
  R(dx + 11, dy, 2, dh, '#f5efe3');
  win(x + 6, y + 28, 8, 8); win(x + 46, y + 28, 8, 8);
};
HV.coop = (x, y) => {
  R(x + 3, y + 30, 30, 3, SH);
  R(x + 2, y + 14, 26, 16, '#b58350'); for (let k = 3; k < 16; k += 4) R(x + 2, y + 14 + k, 26, 1, '#8f6036');
  HV.roof(x, y + 2, 30, 13, '#d06a3a', '#97452a', '#ee8f5c');
  R(x + 12, y + 19, 7, 11, '#3a2414'); R(x + 12, y + 19, 7, 1, '#6b4226');
  R(x + 11, y + 30, 9, 3, '#9a6a3c'); P(x + 13, y + 31, '#6b4226'); P(x + 17, y + 31, '#6b4226');
  R(x + 4, y + 18, 5, 4, '#3a2414'); P(x + 5, y + 20, '#e3bd55'); P(x + 6, y + 21, '#e3bd55');
  R(x + 22, y + 18, 4, 4, '#3a2414'); P(x + 23, y + 19, '#f4efe2');
  R(x + 2, y + 28, 26, 2, '#6e665c');
};
HV.shelter = (x, y) => { // pig shelter / lean-to
  R(x + 3, y + 20, 26, 3, SH);
  R(x + 2, y + 10, 24, 10, '#3a2a1e'); R(x + 2, y + 10, 24, 3, '#2a1e14');
  HV.roof(x, y, 28, 11, '#9c6436', '#6e4527', '#c48d52');
  R(x + 2, y + 10, 2, 10, '#8a5a32'); R(x + 24, y + 10, 2, 10, '#8a5a32');
  R(x + 8, y + 15, 12, 4, '#e3bd55'); R(x + 8, y + 15, 12, 1, '#f2d77a');
};
HV.silo = (x, y, cap = '#b8463a') => {
  R(x + 3, y + 44, 18, 3, SH);
  const cols = ['#7f8794', '#8c93a0', '#aeb5c0', '#c9cfd8', '#dfe4ea', '#e8ecf1', '#d3d8e0', '#c4cad3', '#b6bcc6', '#a9b0bb', '#9ca3ae', '#8f96a2'];
  for (let i = 0; i < 18; i++) R(x + i, y + 6, 1, 36, cols[Math.floor(i * cols.length / 18)]);
  for (let k = 9; k < 42; k += 7) R(x, y + k, 18, 1, 'rgba(60,70,85,.35)');
  E(x + 9, y + 6, 9, 6, cap); E(x + 7, y + 4, 5, 3, '#d86a5a'); P(x + 5, y + 2, '#f09080'); R(x, y + 7, 18, 1, 'rgba(0,0,0,.25)');
  R(x + 13, y + 9, 1, 33, '#5e6670'); R(x + 16, y + 9, 1, 33, '#5e6670'); for (let k = 11; k < 42; k += 3) R(x + 13, y + k, 4, 1, '#5e6670');
  R(x - 1, y + 41, 20, 3, '#8f8678'); R(x - 1, y + 41, 20, 1, '#aaa293');
};
HV.windmillTower = (x, y) => {
  E(x + 4, y, 16, 3, SH);
  for (let r = 0; r < 46; r++) {
    const hw = Math.round(7 + r * 5 / 45), yy = y - 46 + r;
    R(x - hw, yy, hw * 2, 1, '#eadcbf'); R(x + hw - 4, yy, 4, 1, '#cdb98f'); P(x - hw, yy, '#f8f0de');
    if (r % 5 === 0) for (let k = -hw + 2; k < hw - 4; k += 6) R(x + k + (r % 10 ? 3 : 0), yy, 2, 1, '#d4c39d');
  }
  R(x - 12, y - 5, 24, 5, '#9b9384'); R(x - 12, y - 5, 24, 1, '#b8b0a0'); for (let k = -12; k < 12; k += 4) P(x + k, y - 3, '#7d7669');
  R(x - 4, y - 18, 8, 13, '#5a3420'); R(x - 3, y - 17, 6, 12, '#7a4a28'); R(x - 3, y - 19, 6, 1, '#5a3420'); P(x + 1, y - 11, '#f2c94c');
  R(x - 3, y - 34, 6, 7, '#5a3420'); R(x - 2, y - 33, 4, 5, '#3a5a7a'); P(x - 1, y - 32, '#a8dcf2');
  R(x - 10, y - 46, 20, 2, '#6e2a20');
  E(x, y - 50, 10, 5, '#a83e32'); E(x - 2, y - 52, 6, 3, '#c8584a'); P(x - 4, y - 53, '#e88a7a'); R(x - 1, y - 57, 2, 3, '#6e2a20');
};
HV.blades = (cx, cy, ang, L = 30) => {
  for (let k = 0; k < 4; k++) {
    const a = ang + k * Math.PI / 2, dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx;
    for (let t = 7; t <= L; t += 0.55) for (let s = 1.2; s <= 7.2; s += 0.55) {
      const lat = (Math.round(t) % 5 === 0) || s > 6.6;
      P(cx + dx * t + px * s, cy + dy * t + py * s, lat ? '#7a5030' : (k % 2 ? '#f3e4c4' : '#e2cfa8'));
    }
    for (let t = 2; t <= L + 1; t += 0.5) { P(cx + dx * t, cy + dy * t, '#5a3a22'); P(cx + dx * t + px * .7, cy + dy * t + py * .7, '#5a3a22'); }
  }
  E(cx, cy, 2, 2, '#4a2e17'); P(cx, cy, '#d9a441');
};
HV.greenhouse = (x, y) => {
  R(x + 4, y + 36, 44, 3, SH); R(x + 44, y + 18, 3, 18, SH);
  R(x, y + 16, 44, 20, '#9fd3e6');
  for (let i = 0; i < 6; i++) { E(x + 5 + i * 7, y + 29, 3, 3, '#3f8e3f'); E(x + 4 + i * 7, y + 28, 2, 2, '#5fae3f'); P(x + 6 + i * 7, y + 28, i % 2 ? '#e0402f' : '#f2c94c'); P(x + 3 + i * 7, y + 30, '#e0402f'); }
  R(x, y + 16, 44, 4, '#b9e3f0');
  for (let k = 0; k <= 44; k += 7) R(x + Math.min(k, 43), y + 16, 1, 20, '#f4f8f8');
  R(x, y + 25, 44, 1, '#f4f8f8');
  for (let r = 0; r < 16; r++) { const ins = Math.round(9 * (1 - r / 15)); R(x + ins, y + r, 44 - ins * 2, 1, r < 2 ? '#e8f9ff' : (r % 5 === 0 ? '#b2e0ef' : '#c6ebf6')); }
  for (let k = 1; k < 6; k++) for (let r = 0; r < 16; r++) { const ins = Math.round(9 * (1 - r / 15)); P(x + ins + Math.round((44 - 2 * ins) * k / 6), y + r, '#f4f8f8'); }
  for (let i = 0; i < 6; i++) P(x + 14 + i, y + 4 + i, '#ffffff');
  R(x, y + 15, 44, 1, '#e2eef0'); R(x, y + 34, 44, 2, '#8f8678');
};
HV.mill = (x, y) => {
  R(x + 4, y + 54, 50, 3, SH); R(x + 50, y + 24, 4, 30, SH);
  R(x + 2, y + 22, 46, 12, '#c08a54'); for (let k = 3; k < 46; k += 5) R(x + 2 + k, y + 22, 1, 12, '#a06e3e');
  R(x + 2, y + 34, 46, 20, '#aaa293');
  for (let r = 0; r < 20; r += 5) { R(x + 2, y + 34 + r, 46, 1, '#8f8678'); for (let k = (r % 10 ? 0 : 4); k < 46; k += 8) R(x + 2 + k, y + 34 + r, 1, 5, '#8f8678'); }
  HV.roof(x - 1, y, 52, 23, '#7a4a28', '#55311a', '#9c6436');
  R(x + 15, y + 24, 20, 8, '#ecd8a8'); R(x + 15, y + 24, 20, 1, '#7a4a28'); R(x + 15, y + 31, 20, 1, '#7a4a28');
  for (let k = 0; k < 3; k++) { R(x + 21 + k * 4, y + 27, 1, 4, '#b98d2b'); R(x + 21 + k * 4, y + 25, 1, 3, '#e8b93c'); P(x + 20 + k * 4, y + 26, '#e8b93c'); }
  R(x + 18, y + 38, 14, 16, '#4a2e17'); R(x + 19, y + 39, 12, 15, '#6e4527'); R(x + 24, y + 39, 1, 15, '#4a2e17');
  win(x + 6, y + 38, 8, 7); win(x + 36, y + 38, 8, 7);
};
HV.warehouse = (x, y, rc = ['#5b7a4a', '#3d5631', '#7a9c62']) => {
  R(x + 4, y + 54, 56, 3, SH); R(x + 56, y + 22, 4, 32, SH);
  R(x + 2, y + 20, 52, 34, '#a87443'); for (let k = 0; k < 52; k += 4) R(x + 2 + k, y + 20, 1, 34, '#8f6036');
  HV.roof(x - 1, y, 58, 22, ...rc);
  R(x + 12, y + 28, 32, 2, '#3e3e3e');
  R(x + 14, y + 30, 28, 24, '#5a3a22'); R(x + 15, y + 31, 26, 23, '#7a4e2c'); for (let k = 0; k < 26; k += 5) R(x + 15 + k, y + 31, 1, 23, '#5a3a22');
  for (let i = 0; i < 23; i++) { P(x + 15 + Math.round(i * 12 / 22), y + 31 + i, '#a87443'); P(x + 40 - Math.round(i * 12 / 22), y + 31 + i, '#a87443'); }
  R(x + 2, y + 52, 52, 2, '#6e665c');
  win(x + 4, y + 31, 8, 7); win(x + 44, y + 31, 8, 7);
};
HV.dairy = (x, y) => {
  R(x + 4, y + 50, 48, 3, SH); R(x + 48, y + 22, 4, 28, SH);
  R(x + 2, y + 20, 44, 30, '#f4f1ea'); for (let k = 5; k < 30; k += 5) R(x + 2, y + 20 + k, 44, 1, '#e0dbd0');
  R(x + 2, y + 20, 44, 2, '#c9c3b5');
  HV.roof(x - 1, y, 50, 21, '#3f6fa8', '#2a4e7c', '#6a98cf');
  R(x + 16, y + 31, 16, 19, '#2a4e7c'); R(x + 17, y + 32, 14, 18, '#3f6fa8'); R(x + 23, y + 32, 2, 18, '#2a4e7c');
  win(x + 5, y + 30, 8, 8); win(x + 35, y + 30, 8, 8);
  R(x + 18, y + 22, 12, 8, '#ffffff'); R(x + 18, y + 22, 12, 1, '#2a4e7c'); R(x + 22, y + 24, 4, 5, '#e8f2ff'); R(x + 23, y + 23, 2, 1, '#3f6fa8'); R(x + 22, y + 27, 4, 2, '#cfe2fa');
  R(x + 2, y + 48, 44, 2, '#8f8678');
};
HV.milkcan = (x, y) => { R(x + 1, y + 7, 6, 1, SH); R(x, y, 5, 7, '#c9ced6'); R(x + 1, y - 2, 3, 2, '#aeb5c0'); R(x, y + 3, 5, 1, '#8c93a0'); R(x + 3, y, 1, 7, '#eef2f7'); };
HV.shed = (x, y) => {
  R(x + 4, y + 44, 60, 3, SH);
  R(x + 2, y + 18, 56, 26, '#3a2a1e'); R(x + 2, y + 18, 56, 6, '#2a1e14');
  R(x + 10, y + 24, 1, 10, '#9a6a3c'); R(x + 8, y + 24, 5, 2, '#aeb5c0'); R(x + 16, y + 24, 1, 12, '#9a6a3c'); R(x + 15, y + 35, 3, 2, '#aeb5c0');
  R(x + 40, y + 26, 10, 6, '#5ea9d1'); R(x + 40, y + 26, 10, 1, '#8fd0ee'); // stored planter hopper
  HV.roof(x - 1, y, 62, 20, '#8a8f96', '#5e646c', '#b0b6bd');
  for (const px of [2, 30, 55]) { R(x + px, y + 18, 3, 26, '#8a5a32'); R(x + px + 2, y + 18, 1, 26, '#5e3a20'); }
  R(x + 2, y + 43, 56, 1, '#6e665c');
};
HV.factory = (x, y) => { // food processing facility
  R(x + 4, y + 52, 52, 3, SH); R(x + 52, y + 22, 4, 30, SH);
  R(x + 2, y + 20, 48, 32, '#c7a77e'); for (let r = 0; r < 32; r += 4) R(x + 2, y + 20 + r, 48, 1, '#b08e66');
  R(x + 38, y - 6, 7, 20, '#9a5a3c'); R(x + 37, y - 7, 9, 2, '#6b3123'); for (let k = 0; k < 18; k += 4) R(x + 38, y - 4 + k, 7, 1, '#7d4630');
  HV.roof(x - 1, y + 2, 54, 20, '#a24e36', '#6b3123', '#c86a50');
  R(x + 8, y + 7, 14, 6, '#5a3420'); R(x + 9, y + 8, 12, 4, '#f4e4bc'); R(x + 11, y + 9, 3, 2, '#d9822b'); R(x + 16, y + 9, 3, 2, '#c22f2f');
  R(x + 6, y + 32, 20, 20, '#5a4030'); R(x + 7, y + 33, 18, 19, '#7a5a40'); for (let k = 0; k < 19; k += 3) R(x + 7, y + 33 + k, 18, 1, '#5a4030');
  win(x + 32, y + 30, 12, 9);
  R(x + 2, y + 50, 48, 2, '#8f8678');
};
HV.exchange = (x, y) => {
  R(x + 6, y + 96, 92, 4, SH); R(x + 94, y + 44, 5, 52, SH);
  R(x + 18, y + 84, 60, 4, '#cfc8b8'); R(x + 14, y + 88, 68, 4, '#bdb5a4'); R(x + 10, y + 92, 76, 4, '#aaa293');
  R(x + 18, y + 84, 60, 1, '#e6e0d2'); R(x + 14, y + 88, 68, 1, '#d6cfbf'); R(x + 10, y + 92, 76, 1, '#c4bcac');
  R(x + 4, y + 40, 88, 44, '#e2dccd');
  for (let r = 0; r < 44; r += 6) { R(x + 4, y + 40 + r, 88, 1, '#cdc5b3'); for (let k = (r % 12 ? 0 : 6); k < 88; k += 12) R(x + 4 + k, y + 40 + r, 1, 6, '#cdc5b3'); }
  R(x + 40, y + 56, 16, 28, '#3b2a20'); R(x + 41, y + 58, 14, 26, '#5a3a26'); R(x + 47, y + 58, 2, 26, '#3b2a20'); R(x + 39, y + 55, 18, 2, '#d9a441'); P(x + 45, y + 70, '#f2c94c'); P(x + 50, y + 70, '#f2c94c');
  for (const wx of [x + 19, x + 68]) { R(wx, y + 58, 9, 18, '#2f4a5a'); R(wx + 1, y + 59, 7, 6, '#5e8fa8'); P(wx + 2, y + 60, '#a8dcf2'); R(wx, y + 56, 9, 2, '#d9a441'); }
  for (const cx of [10, 30, 59, 79]) {
    R(x + cx, y + 42, 7, 42, '#f4f0e6'); R(x + cx + 5, y + 42, 2, 42, '#cfc7b6'); R(x + cx + 2, y + 42, 1, 42, '#e2dccd');
    R(x + cx - 1, y + 40, 9, 3, '#d6cebc'); R(x + cx - 1, y + 82, 9, 3, '#cfc7b6');
  }
  R(x, y + 30, 96, 11, '#d6cebc'); R(x, y + 30, 96, 1, '#efe9dc'); R(x, y + 40, 96, 1, '#b5ad9b'); R(x, y + 31, 96, 1, '#d9a441');
  for (let r = 0; r < 22; r++) { const w = Math.round(50 * (r + 1) / 22); R(x + 48 - w, y + 8 + r, w * 2, 1, '#3f8a8c'); if (r % 4 === 1) R(x + 48 - w, y + 8 + r, 2, 1, '#6fb5b2'); }
  for (let r = 4; r < 21; r++) { const w = Math.round(50 * (r + 1) / 22) - 6; if (w > 0) R(x + 48 - w, y + 8 + r, w * 2, 1, '#ebe5d7'); }
  R(x - 2, y + 28, 100, 2, '#2a5f61');
  E(x + 48, y + 21, 5, 4, '#a8801f'); E(x + 48, y + 21, 4, 3, '#e3b341'); E(x + 47, y + 20, 1, 1, '#f7d77a');
  for (const sx of [41, 54]) { R(x + sx, y + 17, 1, 8, '#b98d2b'); P(x + sx, y + 16, '#e8b93c'); P(x + sx + (sx < 48 ? 1 : -1), y + 18, '#e8b93c'); }
  R(x + 42, y - 2, 12, 11, '#e2dccd'); R(x + 44, y + 1, 3, 5, '#2f4a5a'); R(x + 49, y + 1, 3, 5, '#2f4a5a');
  E(x + 48, y - 3, 7, 4, '#3f8a8c'); E(x + 46, y - 4, 3, 2, '#6fb5b2'); R(x + 47, y - 14, 1, 8, '#4a4a4a');
};
HV.ticker = (x, y, w, h, t) => {
  R(x - 1, y - 1, w + 2, h + 2, '#a8801f'); R(x, y, w, h, '#141a16');
  const off = Math.floor(t * 14);
  const cols = ['#4ce06a', '#4ce06a', '#ff5a4a', '#ffc83a'];
  for (let c = 0; c < w; c++) {
    const g = c + off, ch = Math.floor(g / 4), j = g % 4;
    if (j === 3 || (ch % 7) === 6) continue;
    const col = cols[Math.floor(ch / 7) % cols.length];
    for (let r = 1; r < h - 1; r++) if (hash(ch, j * 9 + r, 21) > .48) P(x + c, y + r, col);
  }
};
HV.vault = (x, y) => {
  R(x + 4, y + 66, 60, 3, SH); R(x + 60, y + 26, 4, 40, SH);
  R(x + 2, y + 24, 56, 42, '#c9c2b2');
  for (let r = 0; r < 42; r += 6) { R(x + 2, y + 24 + r, 56, 1, '#b2aa98'); for (let k = (r % 12 ? 0 : 5); k < 56; k += 10) R(x + 2 + k, y + 24 + r, 1, 6, '#b2aa98'); }
  R(x + 2, y + 24, 56, 2, '#9f9786');
  HV.roof(x - 1, y, 62, 26, '#34507e', '#22385c', '#5476ad');
  E(x + 30, y + 13, 7, 7, '#8d6a1e'); E(x + 30, y + 13, 6, 6, '#f2c94c'); E(x + 29, y + 12, 3, 3, '#f7e08a');
  R(x + 27, y + 10, 1, 7, '#8d6a1e'); R(x + 32, y + 10, 1, 7, '#8d6a1e'); R(x + 27, y + 13, 6, 1, '#8d6a1e');
  E(x + 30, y + 48, 11, 11, '#5e6670'); E(x + 30, y + 48, 9, 9, '#c9a24a'); E(x + 30, y + 48, 7, 7, '#e3b341'); E(x + 30, y + 48, 3, 3, '#a8801f');
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; for (let t = 3; t < 7; t++) P(x + 30 + Math.cos(a) * t, y + 48 + Math.sin(a) * t, '#a8801f'); }
  R(x + 6, y + 34, 8, 10, '#2f4a5a'); R(x + 46, y + 34, 8, 10, '#2f4a5a'); R(x + 6, y + 34, 8, 2, '#5e8fa8'); R(x + 46, y + 34, 8, 2, '#5e8fa8');
  for (let k = 0; k < 8; k += 2) { R(x + 6 + k, y + 34, 1, 10, '#8c93a0'); R(x + 46 + k, y + 34, 1, 10, '#8c93a0'); }
  R(x + 2, y + 63, 56, 3, '#8f8678'); R(x + 18, y + 66, 24, 2, '#b5ad9d');
};
HV.stall = (x, y, col, goods) => {
  R(x + 2, y + 24, 26, 2, SH);
  R(x + 1, y + 6, 2, 18, '#7a4a28'); R(x + 23, y + 6, 2, 18, '#7a4a28');
  R(x + 11, y + 9, 5, 2, '#e8c35a'); R(x + 10, y + 10, 7, 1, '#c99a2e'); R(x + 12, y + 11, 4, 3, '#f2c29b'); P(x + 13, y + 12, '#3a2414'); R(x + 11, y + 14, 6, 2, goods[goods.length - 1]);
  for (let k = 0; k < 26; k += 3) { const c = (k / 3) % 2 ? '#fff6e6' : col; R(x + k, y, Math.min(3, 26 - k), 8, c); P(x + k + 1, y + 8, c); }
  R(x, y, 26, 1, 'rgba(255,255,255,.45)'); R(x, y + 7, 26, 1, 'rgba(0,0,0,.15)');
  R(x, y + 15, 26, 8, '#b07a44'); R(x, y + 15, 26, 2, '#d09a5c'); for (let k = 4; k < 26; k += 5) R(x + k, y + 17, 1, 6, '#8f5f33'); R(x, y + 22, 26, 1, '#6e4527');
  for (let i = 0; i < 4; i++) { const gx = x + 1 + i * 6; R(gx, y + 13, 5, 2, '#8f5f33'); E(gx + 2, y + 12, 2, 1, goods[i % goods.length]); P(gx + 1, y + 11, 'rgba(255,255,255,.55)'); }
};
HV.hq = (x, y) => {
  R(x + 4, y + 64, 76, 3, SH); R(x + 76, y + 28, 4, 36, SH);
  R(x + 2, y + 26, 72, 38, '#ecdcb0');
  R(x + 2, y + 26, 72, 2, '#7a4a28'); R(x + 2, y + 44, 72, 2, '#7a4a28'); R(x + 2, y + 61, 72, 3, '#8f8678');
  for (const px of [2, 20, 37, 54, 71]) R(x + px, y + 26, 3, 36, '#7a4a28');
  for (const px of [5, 57]) for (let i = 0; i < 16; i++) P(x + px + i, y + 28 + i, '#9a6a3c');
  HV.roof(x - 2, y, 80, 28, '#4e8a3c', '#33612a', '#6fae52');
  R(x + 30, y + 46, 16, 16, '#5a3218'); R(x + 31, y + 47, 14, 15, '#8a5530'); R(x + 37, y + 47, 2, 15, '#5a3218'); R(x + 29, y + 45, 18, 1, '#33612a');
  win(x + 8, y + 31, 9, 9); win(x + 25, y + 31, 9, 9); win(x + 42, y + 31, 9, 9); win(x + 59, y + 31, 9, 9);
  win(x + 8, y + 48, 9, 9); win(x + 59, y + 48, 9, 9);
  R(x + 25, y + 5, 26, 15, '#5a3420'); R(x + 26, y + 6, 24, 13, '#f4e4bc');
  for (let k = 0; k < 5; k++) { R(x + 31 + k * 3, y + 10, 1, 7, '#b98d2b'); R(x + 31 + k * 3, y + 8, 1, 3, '#e8b93c'); }
  R(x + 30, y + 13, 16, 1, '#b8463a');
  R(x + 26, y + 19, 4, 3, '#b8463a'); R(x + 46, y + 19, 4, 3, '#b8463a');
};
HV.tower = (x, y) => {
  R(x + 4, y + 72, 30, 3, SH); R(x + 27, y + 22, 4, 50, SH);
  R(x + 3, y + 18, 24, 54, '#cfc8b8');
  for (let r = 0; r < 54; r += 6) { R(x + 3, y + 18 + r, 24, 1, '#b8b0a0'); for (let k = (r % 12 ? 0 : 4); k < 24; k += 8) R(x + 3 + k, y + 18 + r, 1, 6, '#b8b0a0'); }
  R(x + 23, y + 18, 4, 54, '#b5ad9d');
  R(x + 1, y + 12, 28, 7, '#bdb5a4'); R(x + 1, y + 12, 28, 1, '#d6cfbf'); R(x + 1, y + 18, 28, 1, '#8f8678');
  for (let k = 0; k < 28; k += 6) { R(x + 1 + k, y + 8, 4, 4, '#bdb5a4'); R(x + 1 + k, y + 8, 4, 1, '#d6cfbf'); }
  R(x + 11, y - 4, 8, 6, '#e3b341'); R(x + 12, y - 4, 2, 5, '#f7d77a'); P(x + 10, y - 3, '#a8801f'); P(x + 19, y - 3, '#a8801f'); P(x + 9, y - 2, '#a8801f'); P(x + 20, y - 2, '#a8801f');
  R(x + 14, y + 2, 2, 3, '#c9a24a'); R(x + 12, y + 5, 6, 3, '#a8801f');
  R(x + 5, y + 24, 20, 22, '#3a2a1e'); R(x + 5, y + 24, 20, 1, '#6e4527');
  const rows = [['#e3b341', 11], ['#c9ced6', 9], ['#c87a3a', 7]];
  rows.forEach(([c, l], i) => { R(x + 7, y + 27 + i * 6, 4, 4, c); R(x + 12, y + 28 + i * 6, l, 2, '#f4e4bc'); });
  R(x + 10, y + 56, 10, 16, '#5a3218'); R(x + 11, y + 57, 8, 15, '#8a5530'); R(x + 11, y + 55, 8, 1, '#5a3218');
};
HV.cottage = (x, y, rc) => {
  R(x + 3, y + 40, 36, 3, SH); R(x + 36, y + 20, 3, 20, SH);
  R(x + 2, y + 18, 32, 22, '#efdcb2'); for (let k = 4; k < 22; k += 5) R(x + 2, y + 18 + k, 32, 1, '#dcc596');
  R(x + 2, y + 18, 32, 2, '#bea377');
  HV.roof(x - 1, y, 38, 19, ...rc);
  R(x + 14, y + 26, 8, 14, '#5a3218'); R(x + 15, y + 27, 6, 13, '#8a5530'); P(x + 19, y + 33, '#f2c94c');
  win(x + 4, y + 25, 7, 7); win(x + 25, y + 25, 7, 7);
  R(x + 2, y + 38, 32, 2, '#8f8678');
};
HV.bridge = (x1, x2, yc) => {
  const L = x2 - x1;
  R(x1 + 2, yc + 11, L, 5, 'rgba(10,30,60,.35)');
  R(x1, yc - 11, L, 22, '#b07a44');
  for (let k = 0; k < L; k += 4) { R(x1 + k, yc - 11, 1, 22, '#7f5530'); if (hash(k, yc, 9) > .55) P(x1 + k + 2, yc - 8 + Math.floor(hash(k, 1, 9) * 16), '#8f6036'); }
  R(x1, yc - 11, L, 1, '#d39a5c'); R(x1, yc + 10, L, 1, '#6e4527');
  R(x1, yc - 15, L, 2, '#8a5a32'); R(x1, yc - 13, L, 1, '#5e3a20');
  for (let k = 0; k <= L; k += 10) { R(x1 + Math.min(k, L - 3), yc - 18, 3, 7, '#7a4a28'); P(x1 + Math.min(k, L - 3), yc - 18, '#a87443'); }
};
HV.bridgeFront = (x1, x2, yc) => {
  const L = x2 - x1;
  R(x1, yc + 8, L, 2, '#8a5a32'); R(x1, yc + 10, L, 1, '#5e3a20');
  for (let k = 0; k <= L; k += 10) { R(x1 + Math.min(k, L - 3), yc + 5, 3, 8, '#7a4a28'); P(x1 + Math.min(k, L - 3), yc + 5, '#a87443'); }
};
HV.pump = (x, y) => {
  R(x + 1, y + 12, 14, 2, SH);
  R(x, y + 2, 12, 10, '#3f6fa8'); R(x, y + 2, 12, 2, '#6a98cf'); R(x + 1, y + 6, 10, 1, '#2a4e7c');
  E(x + 6, y + 8, 3, 3, '#2a2a2a'); E(x + 6, y + 8, 1, 1, '#e8b93c');
  R(x + 12, y + 7, 6, 3, '#8c93a0'); R(x + 4, y - 3, 2, 5, '#8c93a0');
};
HV.sprinklerHead = (x, y) => { R(x, y - 4, 2, 4, '#8c93a0'); R(x - 1, y - 5, 4, 1, '#5e6670'); P(x, y - 6, '#3f6fa8'); };

// ---------------------------------------------------------------- crops (x, y = bottom-centre)
HV.CROPS = ['wheat', 'corn', 'soy', 'coffee', 'cocoa', 'tomato', 'potato', 'rice'];
HV.crop = (type, st, x, y) => {
  if (st === 0) { R(x - 2, y - 1, 5, 2, '#5a341e'); P(x - 1, y - 2, '#8f5a33'); P(x + 1, y - 2, '#8f5a33'); P(x, y - 2, '#c9a87a'); return; }
  if (st === 1 && type !== 'rice') { P(x, y, '#3f7a2f'); R(x, y - 3, 1, 3, '#5fae3f'); P(x - 1, y - 4, '#7fcf5c'); P(x + 1, y - 4, '#7fcf5c'); P(x - 2, y - 5, '#7fcf5c'); P(x + 2, y - 5, '#9be07a'); return; }
  E(x, y, 3, 1, 'rgba(40,20,10,.22)');
  switch (type) {
    case 'wheat': {
      const ripe = st === 3, stem = ripe ? '#b98d2b' : '#6aa83a', head = ripe ? '#f2cf5b' : '#a8c84e', side = ripe ? '#d9a83a' : '#86b040';
      for (const [dx, h] of [[-2, ripe ? 10 : 8], [0, ripe ? 12 : 9], [2, ripe ? 10 : 8]]) {
        R(x + dx, y - h + 3, 1, h - 3, stem); R(x + dx, y - h, 1, 4, head); P(x + dx - 1, y - h + 1, side); P(x + dx + 1, y - h + 2, side);
        if (ripe) P(x + dx, y - h - 1, '#f7e39a');
      }
      break;
    }
    case 'corn': {
      const h = st === 3 ? 17 : 12;
      R(x, y - h, 2, h, '#4a9a3a'); R(x + 1, y - h, 1, h, '#357a2c');
      for (let i = 0; i < 4; i++) { P(x - 1 - i, y - 5 - i, '#5fae3f'); P(x + 2 + i, y - 8 - i, '#4a9a3a'); }
      for (let i = 0; i < 3; i++) P(x - 1 - i, y - h + 5 - i, '#6cbf52');
      if (st === 3) { R(x + 2, y - 12, 2, 5, '#f2c94c'); P(x + 3, y - 12, '#9cc24a'); R(x + 3, y - 10, 1, 3, '#d9a83a'); R(x - 1, y - h - 2, 4, 2, '#e8d27a'); P(x, y - h - 3, '#e8d27a'); }
      break;
    }
    case 'tomato': {
      R(x, y - 13, 1, 13, '#9a6a3c'); E(x, y - 6, 4, 5, '#3a8a36'); E(x - 1, y - 7, 2, 3, '#5fae3f');
      const spots = [[-3, -4], [2, -8], [1, -3]];
      for (const [dx, dy] of spots.slice(0, st === 3 ? 3 : 1)) { R(x + dx, y + dy, 2, 2, st === 3 ? '#e0402f' : '#a8c84e'); P(x + dx, y + dy, st === 3 ? '#ff8a6a' : '#d0e88a'); }
      break;
    }
    case 'soy': {
      E(x, y - 3, 4, 3, '#4f9a32'); E(x - 1, y - 4, 2, 2, '#72c04a'); P(x + 2, y - 5, '#8fd45c');
      if (st === 3) for (const [dx, dy] of [[-3, -2], [2, -4], [0, -1], [3, -1]]) R(x + dx, y + dy, 1, 2, '#c9d26a');
      break;
    }
    case 'coffee': {
      R(x, y - 2, 1, 2, '#6b4226'); E(x, y - 7, 4, 6, '#2a6430'); E(x - 1, y - 8, 2, 3, '#3f8a40'); P(x - 2, y - 11, '#5fae3f');
      if (st === 3) for (const [dx, dy] of [[-2, -5], [2, -8], [1, -4], [-3, -9], [3, -5]]) { P(x + dx, y + dy, '#c22f2f'); P(x + dx + 1, y + dy, '#8a1f1f'); }
      else P(x + 1, y - 6, '#8fd45c');
      break;
    }
    case 'cocoa': {
      R(x, y - 9, 2, 9, '#6b4226'); R(x + 1, y - 9, 1, 9, '#4e2f1a'); E(x, y - 13, 6, 5, '#2f7a3a'); E(x - 2, y - 14, 3, 2, '#4a9a48'); P(x - 3, y - 16, '#6cbf52');
      if (st >= 2) { R(x - 3, y - 7, 2, 3, st === 3 ? '#d9822b' : '#a8c84e'); R(x + 3, y - 6, 2, 3, st === 3 ? '#b8601f' : '#a8c84e'); }
      break;
    }
    case 'potato': {
      E(x, y - 3, 4, 3, '#3f8a36'); E(x + 1, y - 4, 2, 2, '#5fae3f'); P(x - 3, y - 2, '#2f6f2e');
      if (st === 3) { P(x - 2, y - 6, '#f4f0ff'); P(x + 2, y - 6, '#c9a6e8'); P(x, y - 7, '#f4f0ff'); }
      break;
    }
    case 'rice': {
      const tip = st === 3 ? '#e3cf63' : '#8fd45c', sh = st === 1 ? .5 : 1;
      for (const [dx, h] of [[-2, 6], [0, 8], [2, 7], [-1, 5], [1, 6]]) { const hh = Math.round(h * sh); R(x + dx, y - hh, 1, hh, '#5aa83f'); P(x + dx, y - hh, tip); if (st === 3) P(x + dx + 1, y - hh + 1, tip); }
      break;
    }
  }
};

// ---------------------------------------------------------------- animals
HV.cow = (x, y, f = 0, flip = false, col = '#2a2624') => {
  const r = M(x, y, 18, flip); E(x + 9, y + 12, 8, 2, SH);
  const a = f % 2;
  r(3, 8, 2, a ? 4 : 3, '#3a2a22'); r(6, 8, 2, a ? 3 : 4, '#3a2a22'); r(10, 8, 2, a ? 4 : 3, '#3a2a22'); r(13, 8, 2, a ? 3 : 4, '#3a2a22');
  r(2, 3, 13, 6, '#f7f4ee'); r(2, 8, 13, 1, '#d6d0c4'); r(2, 3, 13, 1, '#ffffff');
  r(4, 3, 3, 3, col); r(9, 5, 3, 3, col); r(12, 3, 2, 2, col); r(7, 9, 3, 1, '#f2a9a9');
  r(14, 1, 4, 5, '#f7f4ee'); r(15, 4, 3, 2, '#f2a9a9'); r(16, 5, 1, 1, '#c87a7a'); r(16, 2, 1, 1, '#1a1a1a'); r(14, 0, 1, 1, '#e8dcc0'); r(17, 0, 1, 1, '#e8dcc0'); r(13, 1, 1, 2, col);
  r(1, 3, 1, 5, col); r(0, 7, 1, 2, col);
};
HV.sheep = (x, y, f = 0, flip = false) => {
  const r = M(x, y, 13, flip); E(x + 6, y + 11, 6, 2, SH);
  const a = f % 2;
  r(2, 8, 1, a ? 3 : 2, '#3a3330'); r(4, 8, 1, a ? 2 : 3, '#3a3330'); r(7, 8, 1, a ? 3 : 2, '#3a3330'); r(9, 8, 1, a ? 2 : 3, '#3a3330');
  r(1, 1, 10, 7, '#f4efe2'); r(2, 0, 3, 1, '#f4efe2'); r(6, 0, 3, 1, '#f4efe2'); r(0, 2, 1, 5, '#f4efe2'); r(1, 7, 10, 1, '#d9d0bd'); r(2, 1, 2, 1, '#ffffff'); r(6, 1, 2, 1, '#ffffff');
  P(flip ? x + 13 - 4 - 1 : x + 4, y + 4, '#e2dac8'); P(flip ? x + 13 - 7 - 1 : x + 7, y + 3, '#e2dac8');
  r(10, 2, 3, 4, '#3a3330'); r(11, 3, 1, 1, '#e8e0d0'); r(9, 2, 1, 1, '#2a2420');
};
HV.pig = (x, y, f = 0, flip = false) => {
  const r = M(x, y, 14, flip); E(x + 7, y + 10, 6, 2, SH);
  const a = f % 2;
  r(2, 8, 2, a ? 2 : 1, '#d47f8c'); r(8, 8, 2, a ? 1 : 2, '#d47f8c');
  r(1, 2, 10, 6, '#f2a3ae'); r(1, 7, 10, 1, '#d47f8c'); r(2, 2, 8, 1, '#f9c4cb');
  r(10, 2, 3, 5, '#f2a3ae'); r(12, 4, 2, 2, '#e07f8f'); r(13, 5, 1, 1, '#a8505f'); r(10, 1, 2, 1, '#d47f8c'); r(11, 3, 1, 1, '#2a1a1a');
  r(0, 2, 1, 1, '#d47f8c'); r(0, 1, 1, 1, '#d47f8c');
};
HV.chicken = (x, y, f = 0, flip = false) => {
  const r = M(x, y, 7, flip); E(x + 3, y + 7, 3, 1, SH);
  const peck = f % 4 === 3;
  r(1, 2, 5, 4, '#fbfbf5'); r(1, 5, 5, 1, '#d8d6cc'); r(0, 1, 1, 2, '#e8e6dc'); r(2, 3, 2, 1, '#e8e6dc');
  const hy = peck ? 2 : 0, hx = peck ? 1 : 0;
  r(4 + hx, 0 + hy, 2, 3, '#fbfbf5'); r(4 + hx, -1 + hy, 2, 1, '#e0402f'); r(6 + hx, 1 + hy, 1, 1, '#f2a33a'); r(5 + hx, 1 + hy, 1, 1, '#1a1a1a'); r(5 + hx, 3 + hy, 1, 1, '#e0402f');
  r(2, 6, 1, 1, '#f2a33a'); r(4, 6, 1, 1, '#f2a33a');
};
HV.duck = (x, y, f = 0, flip = false) => {
  const r = M(x, y, 9, flip);
  r(0, 5, 9, 1, 'rgba(255,255,255,.35)');
  r(0, 2, 7, 3, '#f4efe2'); r(1, 2, 4, 1, '#ffffff'); r(2, 3, 3, 1, '#c9c2b0');
  r(5, 0, 2, 3, '#3f8a4a'); r(7, 1, 2, 1, '#f2b33a'); r(6, 0, 1, 1, '#1a1a1a'); r(5, 3, 2, 1, '#ffffff');
  if (f % 2) r(0, 1, 1, 1, '#f4efe2');
};

// ---------------------------------------------------------------- people & machines
HV.farmer = (x, y, f = 0, flip = false, pal = {}, mode = 'walk') => {
  const hat = pal.hat || '#e8c35a', shirt = pal.shirt || '#c4553b', pants = pal.pants || '#3f6fa8', skin = pal.skin || '#f2c29b', hair = pal.hair || '#6b4226';
  E(x + 4, y + 14, 4, 1, SH);
  if (mode === 'front') {
    R(x, y + 2, 9, 1, '#c99a2e'); R(x + 2, y, 5, 2, hat); R(x + 2, y + 1, 5, 1, '#b8463a');
    R(x + 2, y + 3, 5, 3, skin); P(x + 3, y + 4, '#2a1a10'); P(x + 5, y + 4, '#2a1a10'); R(x + 1, y + 3, 1, 2, hair); R(x + 7, y + 3, 1, 2, hair);
    R(x + 1, y + 6, 7, 4, shirt); R(x, y + 6, 1, 4, shirt); R(x + 8, y + 6, 1, 4, shirt); P(x, y + 10, skin); P(x + 8, y + 10, skin);
    R(x + 2, y + 7, 5, 4, pants); P(x + 2, y + 6, pants); P(x + 6, y + 6, pants);
    R(x + 2, y + 11, 2, 2, pants); R(x + 5, y + 11, 2, 2, pants); R(x + 2, y + 13, 2, 1, '#4a2e17'); R(x + 5, y + 13, 2, 1, '#4a2e17');
    return;
  }
  const r = M(x, y, 9, flip), bob = f % 2;
  const yy = bob;
  r(0, 2 + yy, 8, 1, '#c99a2e'); r(2, 0 + yy, 4, 2, hat); r(2, 1 + yy, 4, 1, '#b8463a');
  r(3, 3 + yy, 4, 3, skin); r(2, 3 + yy, 1, 2, hair); r(5, 4 + yy, 1, 1, '#2a1a10'); r(7, 4 + yy, 1, 1, skin);
  r(2, 6 + yy, 5, 4, shirt); r(2, 8 + yy, 5, 3, pants); r(3, 6 + yy, 1, 2, pants);
  const sw = [0, 1, 0, -1][f % 4];
  r(4 + sw, 7 + yy, 1, 3, shirt); r(4 + sw, 10 + yy, 1, 1, skin);
  if (mode === 'water') { r(6, 8 + yy, 3, 3, '#8c93a0'); r(8, 7 + yy, 1, 1, '#8c93a0'); }
  const leg = f % 4;
  if (leg === 0 || leg === 2) { r(3, 11, 1, 3, pants); r(5, 11, 1, 3, pants); r(3, 13, 2, 1, '#4a2e17'); r(5, 13, 2, 1, '#4a2e17'); }
  else if (leg === 1) { r(2, 11, 1, 3, pants); r(6, 11, 1, 2, pants); r(2, 13, 2, 1, '#4a2e17'); r(6, 12, 2, 1, '#4a2e17'); }
  else { r(3, 11, 1, 2, pants); r(5, 11, 1, 3, pants); r(3, 12, 2, 1, '#4a2e17'); r(5, 13, 2, 1, '#4a2e17'); }
};
HV.tractor = (x, y, f = 0, flip = false) => {
  const body = '#3f9a3f', dark = '#2c6e2c', light = '#6cc35a';
  const r = M(x, y, 26, flip); E(x + 13, y + 18, 12, 2, SH);
  r(2, 0, 12, 2, dark); r(3, 2, 2, 8, dark); r(11, 2, 2, 8, dark); r(5, 2, 6, 5, '#9fd5e8'); r(5, 2, 6, 1, '#d6f2ff'); r(5, 7, 6, 3, body);
  r(12, 6, 11, 7, body); r(12, 6, 11, 1, light); r(13, 9, 9, 1, dark); r(22, 7, 2, 6, '#2a2a2a'); r(23, 8, 1, 1, '#ffe9a0');
  r(16, 1, 2, 5, '#555b60'); r(16, 0, 2, 1, '#2a2a2a');
  r(1, 9, 13, 3, dark); r(1, 9, 13, 1, body);
  const wx = flip ? x + 18 : x + 7, fx = flip ? x + 5 : x + 20;
  E(wx, y + 12, 6, 6, '#232323'); E(wx, y + 12, 4, 4, '#3a3a3a'); E(wx, y + 12, 2, 2, '#e8b93c'); P(wx, y + 12, '#a8801f');
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + f * 0.5 * (flip ? -1 : 1); P(wx + Math.round(Math.cos(a) * 6), y + 12 + Math.round(Math.sin(a) * 6), '#5a5a5a'); }
  E(fx, y + 15, 3, 3, '#232323'); E(fx, y + 15, 1, 1, '#e8b93c');
};
HV.harvester = (x, y, f = 0, flip = false) => {
  const r = M(x, y, 42, flip); E(x + 20, y + 26, 19, 3, SH);
  r(30, 12, 12, 10, '#e8b93c'); r(30, 12, 12, 1, '#f7e08a'); for (let k = 0; k < 5; k++) r(31 + k * 2 + (f % 2), 13, 1, 8, '#b88a20'); r(30, 21, 12, 1, '#8a6a1a');
  r(4, 10, 27, 11, '#c23b2f'); r(4, 10, 27, 2, '#e05a48'); r(6, 15, 23, 1, '#8a2a22');
  r(8, 1, 13, 10, '#a8322a'); r(9, 2, 11, 6, '#9fd5e8'); r(9, 2, 11, 1, '#d6f2ff'); r(7, 0, 15, 2, '#7a241e');
  r(23, 3, 6, 8, '#c23b2f'); r(23, 3, 6, 1, '#e05a48'); r(26, 0, 2, 4, '#555b60');
  const wx = flip ? x + 42 - 1 - 24 : x + 24, bx = flip ? x + 42 - 1 - 9 : x + 9;
  E(wx, y + 20, 6, 6, '#232323'); E(wx, y + 20, 3, 3, '#3a3a3a'); E(wx, y + 20, 1, 1, '#e8b93c');
  E(bx, y + 22, 4, 4, '#232323'); E(bx, y + 22, 1, 1, '#e8b93c');
};
HV.cloud = (x, y, s = 1) => {
  const c = 'rgba(16,40,24,0.10)';
  E(x, y, 26 * s, 10 * s, c); E(x - 18 * s, y + 3, 14 * s, 7 * s, c); E(x + 20 * s, y + 2, 16 * s, 8 * s, c);
};
HV.bird = (x, y, f) => { const u = f % 2 ? -1 : 0; P(x - 2, y + u, '#2a2a2a'); P(x - 1, y + 1 + u * 0, '#2a2a2a'); P(x, y + 1, '#2a2a2a'); P(x + 1, y + 1, '#2a2a2a'); P(x + 2, y + u, '#2a2a2a'); };
HV.flag = (x, y, t, col = '#c4553b', col2 = '#f2c94c') => {
  R(x, y, 1, 16, '#5a5a5a'); P(x, y - 1, '#f2c94c');
  for (let c = 0; c < 9; c++) { const off = Math.round(Math.sin(t * 6 - c * .8) * (c / 9) * 1.6); R(x + 1 + c, y + 1 + off, 1, 6, c % 4 === 3 ? col2 : col); P(x + 1 + c, y + 6 + off, 'rgba(0,0,0,.2)'); }
};
})();
