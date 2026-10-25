// Harvestia — world composition, terrain generation, camera and ambient animation.
(function () {
'use strict';
const WW = 1024, WH = 640;
const { hash, noise } = HV;
HV.WORLD = { w: WW, h: WH };

// ------------------------------------------------------------------ layout
const riverC = y => 650 + 12 * Math.sin(y / 80) + 6 * Math.sin(y / 27 + 1);
const riverHW = y => 17 + 3 * Math.sin(y / 45);
const POND = { x: 112, y: 552, rx: 64, ry: 36 };
const ARENA = { x: 763, y: 525, rx: 52, ry: 46 };
const PATHS = [
  [0, 200, 1024, 200, 8], [304, 150, 304, 200, 5], [120, 186, 120, 200, 4],
  [330, 200, 330, 476, 5], [140, 476, 330, 476, 4], [840, 200, 840, 612, 6],
  [560, 430, 1012, 430, 5], [560, 346, 560, 430, 4],
];
const PLAZAS = [[694, 180, 1016, 278], [810, 404, 1016, 458]];
const COLS = [24, 96, 168, 240, 348, 420], ROWS = [232, 288, 344, 400];
const PLAN = [
  [['wheat', 3], ['wheat', 3], ['corn', 3], ['corn', 2], ['tomato', 3], ['soy', 2]],
  [['wheat', 2], ['wheat', 1], ['potato', 3], ['potato', 2], ['tomato', 2], ['soy', 3]],
  [['coffee', 3], ['coffee', 2], ['cocoa', 3], ['watered', 0], ['corn', 1], ['wheat', 0]],
  [['expansion'], ['expansion'], ['soy', 1], ['tomato', 1], ['cocoa', 2], ['potato', 1]],
];
const PLOTS = [];
ROWS.forEach((py, ri) => COLS.forEach((px, ci) => {
  const [crop, stage] = PLAN[ri][ci];
  PLOTS.push({ x: px, y: py, w: 60, h: 44, crop, stage, kind: crop === 'expansion' ? 'expansion' : crop === 'watered' ? 'watered' : 'soil' });
}));
const PADDY = { x: 176, y: 490, w: 104, h: 40, crop: 'rice', stage: 3, kind: 'paddy' };
PLOTS.push(PADDY);
HV.PLOTS = PLOTS;

// ------------------------------------------------------------------ terrain colours (shared with the style sheet)
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const GRASS = ['#44943d', '#4ea243', '#59b049', '#66bd50', '#76c958'].map(hex);
const T = {
  grass(x, y) {
    const n = noise(x, y, 56, 1) * .55 + noise(x, y, 14, 2) * .3 + hash(x, y, 3) * .15;
    const h = hash(x, y, 6);
    if (h < .022) return hex('#86d466');
    if (h < .05) return hex('#3d8a3a');
    return GRASS[Math.max(0, Math.min(4, Math.floor((n - .25) / .5 * 5)))];
  },
  path(x, y, edge) {
    if (edge) return hex(hash(x, y, 2) < .5 ? '#9c6c3c' : '#a87443');
    const h = hash(x, y, 7);
    if (h < .018) return hex('#8e7a62'); if (h < .035) return hex('#e8cc96');
    const n = noise(x, y, 6, 4);
    return hex(n < .38 ? '#bb8b52' : n < .66 ? '#c99a60' : '#d4a86c');
  },
  stone(x, y, edge) {
    if (edge) return hex('#8f7d62');
    const row = Math.floor(y / 6), off = row % 2 ? 4 : 0;
    if (y % 6 === 0 || (x + off) % 8 === 0) return hex('#a8957a');
    const id = Math.floor((x + off) / 8) * 31 + row * 17;
    const v = ['#dccca8', '#d1c09a', '#e4d6b6', '#cbb991'][Math.floor(hash(id, row, 5) * 4)];
    if ((x + off) % 8 === 1 && y % 6 === 1) return hex('#f0e6cb');
    return hex(hash(x, y, 8) < .06 ? '#bba886' : v);
  },
  soil(lx, ly, w, h, watered) {
    if (lx === 0 || ly === 0 || lx === w - 1 || ly === h - 1) return hex('#4a2a16');
    const m = ly % 10, hh = hash(lx, ly, 9);
    if (watered) return hex(m === 1 ? '#3e2416' : m >= 8 || m === 0 ? '#5e3a24' : hh < .1 ? '#4a2c1a' : '#523220');
    if (m === 1) return hex('#5a3420');
    if (m === 2) return hex('#6b3f24');
    if (m >= 8 || m === 0) return hex(hh < .12 ? '#9c6a3e' : '#8f5a33');
    return hex(hh < .1 ? '#6b3f24' : hh > .93 ? '#94603a' : '#7a4a2a');
  },
  paddy(lx, ly, w, h) {
    if (lx < 2 || ly < 2 || lx >= w - 2 || ly >= h - 2) return hex(lx === 0 || ly === 0 || lx === w - 1 || ly === h - 1 ? '#4a2a16' : '#6b4a2e');
    if (ly % 6 === 0) return hex('#7fb0bf');
    return hex(hash(lx, ly, 4) < .05 ? '#a8d8e6' : '#5f93a3');
  },
  water(depth, x, y) {
    let c = depth < 1.5 ? '#86ccf2' : depth < 4 ? '#55a9e4' : depth < 9 ? '#3d8fd6' : '#3079c4';
    const wv = noise(x * .7, y * 2.4, 7, 8);
    if (depth > 3 && wv > .74) c = depth < 9 ? '#55a9e4' : '#3d8fd6';
    if (depth > 4 && wv < .2) c = '#2a6db6';
    return hex(c);
  },
  sand(x, y, wet) { return hex(wet ? '#b8a46c' : hash(x, y, 4) < .12 ? '#cbb57a' : '#dcc78f'); },
};
HV.TERRAIN = T;

const type = new Uint8Array(WW * WH); // 0 grass 1 water 2 sand 3 path 4 plaza 5 soil 6 paddy
const tAt = (x, y) => (x < 0 || y < 0 || x >= WW || y >= WH) ? 255 : type[(y | 0) * WW + (x | 0)];
const riverDepth = (x, y) => { const c = riverC(y), hw = riverHW(y); return hw - Math.abs(x - c); };

function pathDist(x, y) {
  let m = 1e9;
  for (const [x1, y1, x2, y2, w] of PATHS) {
    const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy;
    let t = l ? ((x - x1) * dx + (y - y1) * dy) / l : 0; t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(x - x1 - t * dx, y - y1 - t * dy) - w;
    if (d < m) m = d;
  }
  return m;
}

function buildGround() {
  const cv = document.createElement('canvas'); cv.width = WW; cv.height = WH;
  const g = cv.getContext('2d'), img = g.createImageData(WW, WH), d = img.data;
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
    const n1 = noise(x, y, 7, 5);
    const c = riverC(y), hw = riverHW(y), dr = Math.abs(x - c) + (n1 - .5) * 2.5;
    const pd = Math.hypot((x - POND.x) / POND.rx, (y - POND.y) / POND.ry) + (n1 - .5) * .07;
    let col, ty;
    if (dr < hw || pd < 1) { ty = 1; col = T.water(dr < hw ? hw - dr : (1 - pd) * POND.ry, x, y); }
    else if (dr < hw + 2.6 || pd < 1.09) { ty = 2; col = T.sand(x, y, dr < hw + 1 || pd < 1.03); }
    else {
      const pz = PLAZAS.find(([a, b, c2, d2]) => x >= a && x < c2 && y >= b && y < d2);
      if (pz) { ty = 4; col = T.stone(x, y, x === pz[0] || y === pz[1] || x === pz[2] - 1 || y === pz[3] - 1); }
      else {
        const pdst = pathDist(x, y), edgeN = (noise(x, y, 5, 9) - .5) * 2.4;
        if (pdst < edgeN) { ty = 3; col = T.path(x, y, pdst > edgeN - 1.6); }
        else {
          const pl = PLOTS.find(p => p.kind !== 'expansion' && x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h);
          if (pl) { ty = pl.kind === 'paddy' ? 6 : 5; col = pl.kind === 'paddy' ? T.paddy(x - pl.x, y - pl.y, pl.w, pl.h) : T.soil(x - pl.x, y - pl.y, pl.w, pl.h, pl.kind === 'watered'); }
          else {
            const ar = Math.hypot((x - ARENA.x) / ARENA.rx, (y - ARENA.y) / ARENA.ry) + (n1 - .5) * .03;
            if (ar > .7 && ar < 1) { ty = 3; col = T.path(x, y, ar < .73 || ar > .97); }
            else { ty = 0; col = T.grass(x, y); }
          }
        }
      }
    }
    type[y * WW + x] = ty;
    const i = (y * WW + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
  }
  // soft grass shading next to soil/sand edges and plot lips
  for (let y = 1; y < WH - 1; y++) for (let x = 1; x < WW - 1; x++) {
    if (type[y * WW + x] !== 0) continue;
    const below = type[(y + 1) * WW + x], above = type[(y - 1) * WW + x];
    const i = (y * WW + x) * 4;
    if (above === 5 || above === 6) { d[i] = 0x35; d[i + 1] = 0x76; d[i + 2] = 0x33; }
    else if (below === 1 || below === 2) { d[i] *= .86; d[i + 1] *= .9; d[i + 2] *= .86; }
  }
  g.putImageData(img, 0, 0);
  return cv;
}

// ------------------------------------------------------------------ placements
const S = [], F = [], occ = [], hot = [], labels = [];
const add = (y, f) => S.push({ y, f });
const front = f => F.push(f);
const reserve = (x, y, w, h) => occ.push([x, y, w, h]);
function bld(id, x, y, w, h, fn, info) { add(y + h, fn); reserve(x - 4, y - 6, w + 10, h + 10); if (info) hot.push(Object.assign({ id, x, y, w, h }, info)); }
const pen = (x1, y1, x2, y2) => { add(y1, () => HV.fenceH(x1, x2, y1)); add(y1, () => { HV.fenceV(x1, y1, y2); HV.fenceV(x2, y1, y2); }); front(() => HV.fenceH(x1, x2, y2)); reserve(x1 - 4, y1 - 10, x2 - x1 + 8, y2 - y1 + 14); };

function place() {
  // ---- Zone B: livestock ranch
  bld('barn', 22, 40, 60, 54, () => HV.barn(22, 40), { name: 'Cow Barn', zone: 'Livestock Ranch', play: 'Houses cows; feed, milk and health timers run server-side.', stage: 5 });
  bld('feed', 86, 48, 18, 46, () => HV.silo(86, 48, '#c9a24a'), { name: 'Feed Storage', zone: 'Livestock Ranch', play: 'Holds animal feed. Capacity upgrades with $HRV.', stage: 5 });
  pen(108, 40, 170, 100);
  bld('coop', 120, 46, 30, 32, () => HV.coop(120, 46), { name: 'Chicken Coop', zone: 'Livestock Ranch', play: 'Chickens lay eggs on a production cycle. Collect, store or sell.', stage: 5 });
  pen(180, 40, 258, 100);
  bld('pigshed', 216, 46, 28, 22, () => HV.shelter(216, 46), { name: 'Pig Enclosure', zone: 'Livestock Ranch', play: 'Pigs need feed and water; productivity tracks health.', stage: 5 });
  add(84, () => { HV.E(200, 80, 10, 4, '#6e5038'); HV.E(199, 79, 7, 2, '#86634a'); });
  pen(18, 110, 150, 184);
  add(150, () => HV.trough(100, 144)); add(125, () => HV.hay(40, 118)); add(127, () => HV.hay(52, 120));
  pen(162, 112, 260, 184);
  add(170, () => HV.trough(226, 164));
  hot.push({ id: 'pasture', x: 18, y: 100, w: 132, h: 84, name: 'Cow Pasture', zone: 'Livestock Ranch', play: 'Animated cows graze here; tap a cow to feed or milk it.', stage: 5 });
  hot.push({ id: 'sheeppen', x: 162, y: 102, w: 98, h: 82, name: 'Sheep Pen', zone: 'Livestock Ranch', play: 'Sheep produce wool on a timed cycle.', stage: 5 });
  add(100, () => HV.sign(94, 100, '#c48d52'));

  // ---- Zone A: main farm
  bld('house', 276, 90, 56, 60, () => HV.farmhouse(276, 90), { name: 'Farmhouse', zone: 'Main Farm', play: 'Your home base: profile, storage chest, daily rewards and farm level.', stage: 2 });
  add(150, () => HV.well(240, 128)); reserve(236, 124, 24, 30);
  add(148, () => { HV.R(336, 140, 1, 8, '#6e4527'); HV.R(334, 136, 6, 4, '#3f6fa8'); HV.P(339, 137, '#c4553b'); });
  bld('greenhouse', 350, 118, 44, 38, () => HV.greenhouse(350, 118), { name: 'Greenhouse', zone: 'Industry', play: 'Weather-proof growing for tomatoes and coffee seedlings.', stage: 5 });
  for (let i = 0; i < 4; i++) add(178, () => HV.crate(244 + i * 9, 170, ['#e0402f', '#f2c94c', '#8fd45c', '#c22f2f'][i]));
  reserve(240, 166, 40, 14);
  PLOTS.forEach((p, i) => {
    if (p.kind === 'expansion') {
      add(p.y, () => { for (let k = 0; k < p.w; k += 6) { HV.R(p.x + k, p.y, 3, 1, '#f4e4bc'); HV.R(p.x + k, p.y + p.h - 1, 3, 1, '#f4e4bc'); } for (let k = 0; k < p.h; k += 6) { HV.R(p.x, p.y + k, 1, 3, '#f4e4bc'); HV.R(p.x + p.w - 1, p.y + k, 1, 3, '#f4e4bc'); } for (const [sx, sy] of [[0, 0], [p.w - 2, 0], [0, p.h - 2], [p.w - 2, p.h - 2]]) HV.R(p.x + sx, p.y + sy - 3, 2, 5, '#8a5a32'); });
      add(p.y + 30, () => HV.sign(p.x + 30, p.y + 30, '#e8c35a'));
      reserve(p.x, p.y, p.w, p.h);
      hot.push({ id: 'exp' + i, x: p.x, y: p.y, w: p.w, h: p.h, name: 'Expansion Plot', zone: 'Main Farm', play: 'Locked land. Unlock with a land upgrade (priced in $HRV, max $10 ref).', stage: 5 });
      return;
    }
    reserve(p.x - 2, p.y - 2, p.w + 4, p.h + 4);
    const cropName = { wheat: 'Wheat', corn: 'Corn', soy: 'Soybeans', coffee: 'Coffee', cocoa: 'Cocoa', tomato: 'Tomatoes', potato: 'Potatoes', rice: 'Rice', watered: 'Tilled soil' }[p.crop];
    const stg = ['Seeded', 'Sprouting', 'Growing', 'Ready to harvest'][p.stage];
    hot.push({ id: 'plot' + i, x: p.x, y: p.y, w: p.w, h: p.h, name: `${cropName} field`, zone: 'Main Farm', play: p.kind === 'watered' ? 'Watered, empty plot — ready for planting.' : `${stg}. Plant → water → grow → harvest, timers validated server-side.`, stage: 5, crop: p.crop });
    if (p.kind === 'watered') return;
    const big = p.crop === 'coffee' || p.crop === 'cocoa';
    const sx = big ? 14 : p.kind === 'paddy' ? 8 : 9, sy = big ? 14 : 10;
    for (let yy = p.y + (big ? 16 : 10); yy < p.y + p.h - 1; yy += sy)
      for (let xx = p.x + (big ? 10 : 6); xx < p.x + p.w - 4; xx += sx) {
        const st = p.stage === 3 && hash(xx, yy, 2) < .08 ? 2 : p.stage;
        add(yy, () => HV.crop(p.crop, st, xx, yy));
      }
  });
  add(250, () => HV.scarecrow(126, 250));
  hot.push({ id: 'paddy', x: PADDY.x, y: PADDY.y, w: PADDY.w, h: PADDY.h, name: 'Rice Paddy', zone: 'Main Farm', play: 'Flooded field; rice needs the irrigation pump running.', stage: 5, crop: 'rice' });
  add(520, () => HV.pump(286, 506)); reserve(282, 500, 26, 22);
  add(441, () => HV.sprinklerHead(377, 441)); add(385, () => HV.sprinklerHead(449, 385));
  hot.push({ id: 'pump', x: 282, y: 498, w: 22, h: 18, name: 'Irrigation Pump', zone: 'Main Farm', play: 'Machinery: waters connected plots automatically.', stage: 5 });

  // ---- Zone C: industry
  add(186, () => HV.windmillTower(430, 186)); reserve(412, 120, 36, 70);
  hot.push({ id: 'windmill', x: 412, y: 112, w: 38, h: 74, name: 'Windmill', zone: 'Industry', play: 'Grinds wheat into flour. Blades turn while a job is running.', stage: 3 });
  bld('mill', 462, 122, 50, 54, () => HV.mill(462, 122), { name: 'Grain Mill', zone: 'Industry', play: 'Processing: wheat → flour, corn → meal. Queued jobs (BullMQ).', stage: 7 });
  add(178, () => { HV.sack(458, 178); HV.sack(452, 176); });
  bld('silo1', 518, 128, 18, 46, () => HV.silo(518, 128), { name: 'Grain Silo', zone: 'Industry', play: 'Produce storage; capacity upgrades.', stage: 5 });
  bld('silo2', 540, 132, 18, 46, () => HV.silo(540, 132), null);
  bld('warehouse', 564, 120, 56, 54, () => HV.warehouse(564, 120), { name: 'Produce Warehouse', zone: 'Industry', play: 'Inventory capacity & produce storage for the exchange.', stage: 7 });
  bld('dairy', 500, 228, 48, 50, () => HV.dairy(500, 228), { name: 'Dairy', zone: 'Industry', play: 'Milk → cheese & butter processing.', stage: 7 });
  add(282, () => { HV.milkcan(490, 270); HV.milkcan(496, 272); });
  bld('factory', 558, 232, 52, 52, () => HV.factory(558, 232), { name: 'Food Processing', zone: 'Industry', play: 'Turns cocoa, coffee & tomatoes into higher-value goods.', stage: 7 });
  bld('shed', 494, 300, 60, 44, () => HV.shed(494, 300), { name: 'Equipment Shed', zone: 'Industry', play: 'Machinery storage: planters, tractors, harvesters.', stage: 5 });
  bld('harvester', 558, 318, 42, 26, () => HV.harvester(558, 318), { name: 'Combine Harvester', zone: 'Industry', play: 'Machinery: harvests a whole field in one action.', stage: 5 });

  // ---- Zone D: marketplace
  bld('exchange', 704, 84, 96, 96, () => HV.exchange(704, 84), { name: 'Commodity Exchange', zone: 'Marketplace', play: 'Trade crops at prices referenced to real markets (clearly labelled if simulated).', stage: 7 });
  bld('vault', 814, 108, 60, 68, () => HV.vault(814, 108), { name: 'HRV Game Vault', zone: 'Marketplace', play: 'Deposit / withdraw $HRV, view burns & treasury. Wallet-signed.', stage: 8 });
  bld('storage', 892, 112, 58, 54, () => HV.warehouse(892, 112, ['#9c6436', '#6e4527', '#c48d52']), { name: 'Market Storage', zone: 'Marketplace', play: 'Escrow storage for marketplace listings.', stage: 7 });
  bld('board', 962, 146, 24, 22, () => HV.board(962, 146), { name: 'Delivery Contracts', zone: 'Marketplace', play: 'Pick contracts (e.g. 200 wheat by Friday) for XP & eligible rewards.', stage: 7 });
  const stalls = [[706, '#c4553b', ['#e0402f', '#f2c94c', '#8fd45c', '#3f6fa8']], [738, '#3f6fa8', ['#f4efe2', '#f2c94c', '#e9e0c8', '#4f9a3c']], [770, '#e8a33a', ['#c22f2f', '#6b4226', '#d9822b', '#7b5cc4']], [802, '#4e8a3c', ['#f2c94c', '#e0402f', '#c9a6e8', '#c4553b']],
    [874, '#7b5cc4', ['#d9822b', '#6b4226', '#f2c94c', '#2f6f2e']], [906, '#c4553b', ['#8fd45c', '#e0402f', '#f4efe2', '#e8a33a']], [938, '#3f8a8c', ['#e9e0c8', '#f2c94c', '#c22f2f', '#3f6fa8']]];
  stalls.forEach(([sx, c, gds], i) => bld('stall' + i, sx, 232, 26, 24, () => HV.stall(sx, 232, c, gds), i ? null : null));
  hot.push({ id: 'market', x: 702, y: 228, w: 130, h: 30, name: 'Produce Market', zone: 'Marketplace', play: 'Player-to-player listings settled in $HRV, with transparent fees.', stage: 7 });
  hot.push({ id: 'trading', x: 870, y: 228, w: 96, h: 30, name: 'Trading Stalls', zone: 'Marketplace', play: 'Buy seeds, feed and tools. Every item ≤ $15 reference price.', stage: 4 });
  for (const lx of [700, 1004]) add(214, () => HV.lamp(lx, 214));
  for (const lx of [700, 868, 1004]) add(272, () => HV.lamp(lx, 272));
  bld('fountain', 834, 232, 34, 24, () => HV.fountain(851, 248), { name: 'Market Fountain', zone: 'Marketplace', play: 'Meeting point; seasonal events and festival decorations.', stage: 3 });
  add(270, () => { HV.bench(716, 262); HV.bench(780, 262); HV.bench(916, 262); });
  add(266, () => { HV.barrel(972, 258); HV.barrel(980, 260); HV.crate(990, 262, '#f2c94c'); HV.crate(744, 264, '#e0402f'); HV.crate(752, 266); });
  for (const [px, c] of [[700, '#f08ab0'], [760, '#f7d64a'], [820, '#fff6e8'], [882, '#b48ef0'], [946, '#ff7a5a']]) { add(296, () => HV.planter(px, 288, c)); reserve(px - 2, 280, 30, 18); }
  reserve(694, 176, 322, 104);

  // ---- Zone E: co-op village
  bld('hq', 856, 340, 76, 64, () => HV.hq(856, 340), { name: 'Cooperative HQ', zone: 'Co-op Village', play: 'Join a co-op, pool production, take group contracts.', stage: 10 });
  bld('tower', 952, 334, 30, 72, () => HV.tower(952, 334), { name: 'Leaderboard Tower', zone: 'Co-op Village', play: 'Season rankings: productivity, contracts, co-op score.', stage: 10 });
  bld('cmk1', 900, 410, 26, 24, () => HV.stall(900, 410, '#e8a33a', ['#f2c94c', '#8fd45c', '#e0402f', '#4e8a3c']), { name: 'Community Market', zone: 'Co-op Village', play: 'Co-op members share surplus here.', stage: 10 });
  bld('cmk2', 934, 410, 26, 24, () => HV.stall(934, 410, '#c4553b', ['#e9e0c8', '#c22f2f', '#f4efe2', '#3f6fa8']), null);
  pen(704, 470, 822, 580);
  add(520, () => HV.podium(747, 506));
  add(482, () => { for (let k = 0; k < 10; k++) for (let j = 0; j < 2; j++) HV.R(758 + j * 2, 479 + k * 1.0, 2, 1, (k + j) % 2 ? '#1a1a1a' : '#f4efe2'); HV.flag(756, 466, 0, '#c4553b', '#f2c94c'); });
  add(486, () => { HV.hay(708, 474); HV.hay(806, 474); }); add(572, () => { HV.hay(708, 566); HV.hay(806, 566); });
  add(560, () => { HV.scarecrow(736, 550); HV.R(778, 540, 10, 10, '#f4efe2'); HV.E(783, 545, 4, 4, '#c4553b'); HV.E(783, 545, 2, 2, '#f4efe2'); HV.P(783, 545, '#c4553b'); HV.R(782, 550, 2, 5, '#6e4527'); });
  const crowd = [{ shirt: '#c4553b', pants: '#3f6fa8' }, { shirt: '#e8a33a', pants: '#4a5a3a' }, { shirt: '#3f8a8c', pants: '#5a3a26', hat: '#c4553b' }, { shirt: '#7b5cc4', pants: '#3a4a5a' }, { shirt: '#4e8a3c', pants: '#6b4226', hat: '#d8c07a' }, { shirt: '#f2a3ae', pants: '#3f6fa8' }];
  add(600, () => { HV.R(708, 594, 110, 4, '#8a5a32'); HV.R(708, 594, 110, 1, '#c48d52'); HV.R(708, 598, 110, 1, '#5e3a20'); for (let k = 0; k < 6; k++) HV.farmer(714 + k * 17, 582, 0, false, crowd[k], 'front'); });
  reserve(700, 580, 124, 22);
  hot.push({ id: 'arena', x: 704, y: 460, w: 118, h: 120, name: 'Competition Grounds', zone: 'Co-op Village', play: 'Timed harvest races & seasonal tournaments (play credits only).', stage: 10 });
  bld('cot1', 868, 478, 36, 40, () => HV.cottage(868, 478, ['#c4553b', '#8b3324', '#e47b57']), null);
  bld('cot2', 930, 486, 36, 40, () => HV.cottage(930, 486, ['#3f6fa8', '#2a4e7c', '#6a98cf']), null);
  bld('cot3', 880, 548, 36, 40, () => HV.cottage(880, 548, ['#9c6436', '#6e4527', '#c48d52']), null);
  bld('sharedmill', 950, 556, 50, 54, () => HV.mill(950, 556), { name: 'Shared Production Mill', zone: 'Co-op Village', play: 'Co-op owned processing with split output.', stage: 10 });
  for (const ly of [440, 520, 600]) add(ly, () => HV.lamp(852, ly));

  // ---- Zone F: bridges, water, decoration
  const b1 = [Math.floor(riverC(200) - riverHW(200) - 6), Math.ceil(riverC(200) + riverHW(200) + 6)];
  add(190, () => HV.bridge(b1[0], b1[1], 200)); front(() => HV.bridgeFront(b1[0], b1[1], 200));
  const b2 = [Math.floor(riverC(430) - riverHW(430) - 6), Math.ceil(riverC(430) + riverHW(430) + 6)];
  add(420, () => HV.bridge(b2[0], b2[1], 430)); front(() => HV.bridgeFront(b2[0], b2[1], 430));
  hot.push({ id: 'bridge', x: b1[0], y: 186, w: b1[1] - b1[0], h: 28, name: 'Old Mill Bridge', zone: 'Riverside', play: 'Connects the farm to the market — players walk across.', stage: 2 });
  hot.push({ id: 'pond', x: POND.x - POND.rx, y: POND.y - POND.ry, w: POND.rx * 2, h: POND.ry * 2, name: 'Duck Pond', zone: 'Riverside', play: 'Water supply for watering cans; ducks & fish ambience.', stage: 3 });
  const inPond = (x, y, k = 1) => Math.hypot((x - POND.x) / POND.rx, (y - POND.y) / POND.ry) < k;
  for (let i = 0; i < 14; i++) { const lx = 60 + hash(i, 1, 40) * 110, ly = 524 + hash(i, 2, 40) * 56; if (inPond(lx, ly, .8) && !inPond(lx, ly, .35)) add(ly - 20, () => HV.lily(lx, ly)); }
  for (let a = 0; a < 6.283; a += .09) {
    const k = 1.1 + hash(Math.round(a * 100), 3, 41) * .12, rx = Math.round(POND.x + Math.cos(a) * POND.rx * k), ry = Math.round(POND.y + Math.sin(a) * POND.ry * k);
    if (Math.sin(a) < -.2 && Math.cos(a) > .2 && Math.cos(a) < .8) continue; // keep the dock side open
    const r = hash(Math.round(a * 100), 4, 41);
    if (r < .45) add(ry, () => HV.reeds(rx, ry)); else if (r < .55) add(ry, () => HV.rock(rx, ry)); else if (r < .62) add(ry, () => HV.bush(rx, ry + 2, Math.round(a * 10), '#fff6e8'));
  }
  add(538, () => HV.dock(148, 512, 24)); reserve(30, 500, 170, 110);

  // orchard
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { const tx = 372 + j * 30 + (i % 2) * 12, ty = 500 + i * 28; add(ty, () => HV.tree(tx, ty, i * 7 + j, 8, j % 2 ? '#e0402f' : '#f2a33a')); reserve(tx - 10, ty - 22, 20, 26); }
  hot.push({ id: 'orchard', x: 356, y: 470, w: 140, h: 90, name: 'Fruit Orchard', zone: 'Main Farm', play: 'Fruit trees with long growth cycles and seasonal yields.', stage: 5 });

  labels.push(['Livestock Ranch', 140, 22], ['Main Farm', 238, 214], ['Mill & Industry', 520, 96], ['Marketplace', 850, 68], ['Co-op Village', 900, 330], ['Riverside', 112, 600]);
}

// ------------------------------------------------------------------ scatter nature
function scatter() {
  const R0 = (s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)(7);
  const trees = [];
  const free = (x, y, pad, need = [0]) => {
    for (const [ox, oy] of [[0, 0], [-pad, 0], [pad, 0], [0, -pad], [-pad, -pad], [pad, -pad], [0, -pad * 2]]) if (!need.includes(tAt(x + ox, y + oy))) return false;
    for (const [a, b, w, h] of occ) if (x + pad > a && x - pad < a + w && y > b && y - pad * 2.2 < b + h) return false;
    return true;
  };
  const near = (x, y, d) => trees.some(t => Math.abs(t[0] - x) < d && Math.abs(t[1] - y) < d * .8);
  const put = (x, y, kind, s) => {
    trees.push([x, y]);
    if (kind === 'pine') add(y, () => HV.pine(x, y, s, .9 + (s % 3) * .15));
    else if (kind === 'tree') add(y, () => HV.tree(x, y, s, 8 + (s % 4), s % 9 === 0 ? '#e0402f' : null));
    else if (kind === 'bush') add(y, () => HV.bush(x, y, s, s % 3 ? null : ['#f08ab0', '#fff6e8', '#f7d64a'][s % 3 === 0 ? (s >> 2) % 3 : 0]));
  };
  // forest borders
  for (let x = -4; x < WW + 8; x += 11) {
    for (const y of [16 + R0() * 12, 32 + R0() * 6]) { const xx = x + R0() * 6; if (free(xx, y, 5) && !near(xx, y, 9)) put(xx, y, R0() < .45 ? 'pine' : 'tree', (x * 7 + y) | 0); }
    for (const y of [612 + R0() * 6, 630 + R0() * 10, 646]) { const xx = x + R0() * 6; if (free(xx, Math.min(y, 639), 5) && !near(xx, y, 9)) put(xx, y, R0() < .4 ? 'pine' : 'tree', (x * 5 + y) | 0); }
  }
  for (let y = 40; y < 640; y += 13) for (const x of [4 + R0() * 6, WW - 6 - R0() * 6]) if (free(x, y, 5) && !near(x, y, 10)) put(x, y, R0() < .5 ? 'pine' : 'tree', (x + y * 3) | 0);
  // riverbanks & meadows
  for (let i = 0; i < 5000 && trees.length < 520; i++) {
    const x = R0() * WW, y = 30 + R0() * (WH - 30);
    const nearRiver = Math.abs(riverDepth(x, y)) < 34;
    const k = R0();
    const kind = k < (nearRiver ? .5 : .28) ? 'tree' : k < .45 ? 'pine' : 'bush';
    const pad = kind === 'bush' ? 5 : 8;
    if (free(x, y, pad) && !near(x, y, kind === 'bush' ? 10 : 15)) put(x, y, kind, i);
  }
  // ground detail
  for (let i = 0; i < 2600; i++) {
    const x = Math.floor(R0() * WW), y = Math.floor(R0() * WH);
    if (tAt(x, y) !== 0 || tAt(x, y - 2) !== 0) continue;
    if (occ.some(([a, b, w, h]) => x > a && x < a + w && y > b && y < b + h)) continue;
    const r = R0();
    if (r < .55) add(y - 3, () => HV.tuft(x, y));
    else if (r < .8) add(y - 3, () => HV.flowers(x, y, i));
    else if (r < .88 && free(x, y, 4)) add(y, () => HV.rock(x, y, R0() < .3 ? 1.5 : 1));
  }
  // reeds and riverbank rocks
  for (let y = 10; y < WH; y += 7) for (const side of [-1, 1]) {
    const x = Math.round(riverC(y) + side * (riverHW(y) + 3 + R0() * 3));
    if (tAt(x, y) === 2 || tAt(x, y) === 0) { if (R0() < .4) add(y, () => { HV.R(x, y - 5, 1, 5, '#4f8a3c'); HV.R(x + 1, y - 6, 1, 6, '#5fae3f'); HV.P(x + 1, y - 7, '#8a5a32'); }); else if (R0() < .12) add(y, () => HV.rock(x, y)); }
  }
}

// ------------------------------------------------------------------ dynamic entities
const ents = [];
function wanderer(kind, rect, n, seed) {
  for (let i = 0; i < n; i++) ents.push({ kind, rect, x: rect[0] + hash(i, seed, 1) * (rect[2] - rect[0]), y: rect[1] + hash(i, seed, 2) * (rect[3] - rect[1]), tx: 0, ty: 0, wait: hash(i, seed, 3) * 3, flip: hash(i, seed, 4) < .5, ph: i, moving: false });
}
function walker(pts, pal, speed, mode) { ents.push({ kind: 'farmer', pts, i: 0, x: pts[0][0], y: pts[0][1], pal, speed, flip: false, ph: 0, mode }); }
function setupDynamic() {
  wanderer('cow', [24, 118, 128, 168], 3, 1);
  wanderer('sheep', [168, 120, 244, 170], 4, 2);
  wanderer('pig', [186, 70, 240, 88], 3, 3);
  wanderer('chicken', [112, 80, 162, 92], 5, 4);
  wanderer('chicken', [270, 186, 296, 194], 1, 9);
  wanderer('duck', [70, 532, 150, 566], 3, 5);
  walker([[20, 188], [640, 188], [1000, 188]], { shirt: '#c4553b', pants: '#3f6fa8' }, 13);
  walker([[323, 206], [323, 466], [200, 466]], { shirt: '#4e8a3c', pants: '#6b4226', hat: '#d8c07a' }, 11);
  walker([[833, 216], [833, 600]], { shirt: '#7b5cc4', pants: '#3a4a5a', hat: '#c4553b' }, 10);
  walker([[714, 266], [990, 266]], { shirt: '#e8a33a', pants: '#4a5a3a', hat: '#e8c35a' }, 9);
  walker([[560, 416], [1000, 416]], { shirt: '#3f8a8c', pants: '#5a3a26', hat: '#e8c35a' }, 12);
  ents.push({ kind: 'waterer', x: 186, y: 278, pal: { shirt: '#3f6fa8', pants: '#6b4226' } });
  ents.push({ kind: 'tractor', x: 352, y: 264, dir: 1 });
}
const SPEED = { cow: 5, sheep: 6, pig: 7, chicken: 11, duck: 6 };
function updateDynamic(dt, t) {
  for (const e of ents) {
    if (SPEED[e.kind]) {
      if (e.moving) {
        const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy), s = SPEED[e.kind] * dt;
        if (d < s) { e.moving = false; e.wait = 1.5 + Math.random() * 4; } else { e.x += dx / d * s; e.y += dy / d * s; if (Math.abs(dx) > .3) e.flip = dx < 0; }
      } else if ((e.wait -= dt) <= 0) {
        const [a, b, c, d] = e.rect; e.tx = a + Math.random() * (c - a); e.ty = b + Math.random() * (d - b); e.moving = true;
      }
    } else if (e.kind === 'farmer') {
      const nx = e.pts[(e.i + 1) % e.pts.length];
      const dx = nx[0] - e.x, dy = nx[1] - e.y, d = Math.hypot(dx, dy), s = e.speed * dt;
      if (d < s) { e.i = (e.i + 1) % e.pts.length; if (e.i === e.pts.length - 1) e.pts.reverse(), e.i = 0; }
      else { e.x += dx / d * s; e.y += dy / d * s; if (Math.abs(dx) > .1) e.flip = dx < 0; }
    } else if (e.kind === 'tractor') {
      e.x += e.dir * 7 * dt;
      if (e.x > 398) { e.dir = -1; } else if (e.x < 350) { e.dir = 1; }
    }
  }
}
const parts = [];
function puff(x, y, col, vy = -6, life = 2.6, vx = 2) { parts.push({ x, y, vx: vx + (Math.random() - .5) * 2, vy, life, max: life, col }); }

function drawDynamic(t) {
  const list = [];
  for (const e of ents) list.push(e);
  list.push({ y: 186, draw: () => HV.blades(430, 141, t * 0.9) });
  list.push({ y: 160, draw: () => HV.ticker(726, 115, 52, 8, t) });
  list.push({ y: 250, draw: () => HV.fountainWater(851, 248, t) });
  list.push({ y: 60, draw: () => HV.flag(752, 68, t, '#3f8a8c', '#f2c94c') });
  list.push({ y: 336, draw: () => HV.flag(893, 314, t + 1, '#4e8a3c', '#f2c94c') });
  list.push({ y: 470, draw: () => bunting(704, 822, 462, t) });
  list.sort((a, b) => (a.y + (a.kind ? 12 : 0)) - (b.y + (b.kind ? 12 : 0)));
  const fr = Math.floor(t * 6);
  for (const e of list) {
    if (e.draw) { e.draw(); continue; }
    const f = e.moving || e.kind === 'farmer' || e.kind === 'tractor' ? fr + e.ph : (e.kind === 'chicken' ? Math.floor(t * 2 + e.ph) : 0);
    switch (e.kind) {
      case 'cow': HV.cow(e.x, e.y, f, e.flip); break;
      case 'sheep': HV.sheep(e.x, e.y, f, e.flip); break;
      case 'pig': HV.pig(e.x, e.y, f, e.flip); break;
      case 'chicken': HV.chicken(e.x, e.y, e.moving ? f : (Math.floor(t * 3 + e.ph * 1.7) % 6 < 2 ? 3 : 0), e.flip); break;
      case 'duck': HV.duck(e.x, e.y, Math.floor(t * 2 + e.ph), e.flip); break;
      case 'farmer': HV.farmer(e.x, e.y, f, e.flip, e.pal); break;
      case 'waterer': {
        HV.farmer(e.x, e.y, 0, false, e.pal, 'water');
        const ph = (t * 3) % 1; for (let k = 0; k < 3; k++) HV.P(e.x + 10 + k, e.y + 10 + ((ph * 6 + k * 2) % 6), '#8fd0ee');
        break;
      }
      case 'tractor': HV.tractor(e.x, e.y, fr, e.dir < 0); break;
    }
  }
  // sprinklers
  for (const [sx, sy] of [[378, 435], [450, 379]]) for (let k = 0; k < 14; k++) {
    const a = t * 2.2 + k * 0.45, ph = ((t * 1.4 + k / 14) % 1);
    const rx = Math.cos(a) * ph * 18, ry = Math.sin(a) * ph * 9 - Math.sin(ph * Math.PI) * 8;
    HV.P(sx + rx, sy + ry, ph < .7 ? '#bfe8ff' : '#8fd0ee');
  }
}
function bunting(x1, x2, y, t) {
  const cols = ['#c4553b', '#f2c94c', '#3f6fa8', '#4e8a3c', '#f4efe2'];
  for (let x = x1; x < x2; x++) { const sag = Math.sin(((x - x1) % 30) / 30 * Math.PI) * 3; HV.P(x, y + sag, '#5a3a22'); }
  for (let x = x1 + 3, i = 0; x < x2 - 2; x += 5, i++) {
    const sag = Math.sin(((x - x1) % 30) / 30 * Math.PI) * 3, sw = Math.round(Math.sin(t * 4 + i) * .7);
    HV.R(x + sw, y + sag + 1, 3, 2, cols[i % 5]); HV.P(x + 1 + sw, y + sag + 3, cols[i % 5]);
  }
}

// ------------------------------------------------------------------ water sparkle
const sparks = [];
function setupSparks() {
  for (let i = 0; i < 2200 && sparks.length < 260; i++) {
    const x = Math.floor(hash(i, 3, 70) * WW), y = Math.floor(hash(i, 4, 70) * WH);
    if (tAt(x, y) === 1 && tAt(x + 4, y) === 1 && tAt(x - 2, y) === 1) sparks.push({ x, y, ph: hash(i, 5, 70) * 6.28, l: 2 + Math.floor(hash(i, 6, 70) * 3), river: Math.abs(riverDepth(x, y)) < 30 && y < 640 && x > 400 });
  }
}
function drawSparks(t) {
  for (const s of sparks) {
    const v = Math.sin(t * 1.8 + s.ph);
    if (v < .35) continue;
    let y = s.y;
    if (s.river) { y = (s.y + t * 6) % WH; const c = riverC(y), hw = riverHW(y); const x = s.x - riverC(s.y) + c; if (Math.abs(x - c) > hw - 2) continue; HV.R(x, y, s.l, 1, v > .8 ? '#e3f6ff' : '#a6dcf7'); continue; }
    HV.R(s.x, y, s.l, 1, v > .8 ? '#e3f6ff' : '#a6dcf7');
  }
}

// ------------------------------------------------------------------ bootstrap
let base, frontCv;
HV.buildWorld = function () {
  place(); const ground = buildGround(); scatter(); setupDynamic(); setupSparks();
  base = document.createElement('canvas'); base.width = WW; base.height = WH;
  const bg = base.getContext('2d'); bg.drawImage(ground, 0, 0); HV.use(bg);
  S.sort((a, b) => a.y - b.y).forEach(o => o.f());
  frontCv = document.createElement('canvas'); frontCv.width = WW; frontCv.height = WH;
  HV.use(frontCv.getContext('2d')); F.forEach(f => f());
  return { base, hot, labels };
};

let last = 0, smokeT = 0;
const clouds = [[120, 120, 1.2], [520, 380, 1.5], [860, 80, 1], [300, 560, 1.3]];
const birds = [[0, 90, 0], [-40, 104, 1], [-24, 96, 2]];
HV.drawWorld = function (ctx, t) {
  const dt = Math.min(.05, t - last); last = t;
  updateDynamic(dt, t);
  if ((smokeT -= dt) <= 0) {
    smokeT = .35;
    puff(321, 80, 'rgba(235,235,235,'); puff(599, 223, 'rgba(225,225,225,', -7, 3);
    const tr = ents.find(e => e.kind === 'tractor'); if (tr) puff(tr.dir > 0 ? tr.x + 17 : tr.x + 8, tr.y, 'rgba(110,110,110,', -5, 1.6, -tr.dir * 3);
  }
  ctx.drawImage(base, 0, 0);
  HV.use(ctx);
  drawSparks(t);
  drawDynamic(t);
  ctx.drawImage(frontCv, 0, 0);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; const k = p.life / p.max, r = Math.round(1 + (1 - k) * 3);
    HV.E(p.x, p.y, r, r, p.col + (k * .55).toFixed(2) + ')');
  }
  for (const c of clouds) { const x = ((c[0] + t * 5) % (WW + 200)) - 100; HV.cloud(x, c[1], c[2]); }
  const bf = Math.floor(t * 5);
  for (const b of birds) { const x = ((b[0] + t * 22) % (WW + 120)) - 60; HV.bird(x, b[1] + Math.sin(t + b[2]) * 3, bf + b[2]); }
};
})();
