// World composition: every static object, its depth key, selectable hotspots,
// zone labels and the ambient actors. Drawing closures call the sprite library
// in world coordinates; the scene records them into a texture atlas.
import HV from '../art/sprites';
import { PLOTS, POND, WORLD_H, WORLD_W, riverC, riverDepth, riverHW, type CropType } from './geometry';
import { Ground, type TerrainResult } from './terrain';

const { hash } = HV;

export type Zone = 'Livestock Ranch' | 'Main Farm' | 'Industry' | 'Marketplace' | 'Co-op Village' | 'Riverside';
export type HotKind = 'building' | 'plot' | 'area' | 'machine' | 'nature';
export interface Hotspot {
  id: string; kind: HotKind; x: number; y: number; w: number; h: number;
  name: string; zone: Zone; play: string; stage: number;
  plot?: number; crop?: CropType | null; cropStage?: number;
}
/**
 * depth = y (the object's ground line); ground = baked flat into the terrain bitmap;
 * nature = recoloured by season (variant picks autumn leaf colour);
 * sway = canopy rows above y - sway move with the wind.
 */
export interface StaticItem { y: number; draw: () => void; ground?: boolean; nature?: boolean; variant?: number; sway?: number; tag?: string }
export interface Label { text: string; x: number; y: number }
export interface Focus { id: string; x: number; y: number }

type Palette = { shirt: string; pants: string; hat?: string };
export type ActorSpec =
  | { kind: 'cow' | 'sheep' | 'pig' | 'chicken' | 'duck'; rect: [number, number, number, number]; count: number; seed: number }
  | { kind: 'farmer'; path: [number, number][]; pal: Palette; speed: number }
  | { kind: 'waterer'; x: number; y: number; pal: Palette }
  | { kind: 'tractor'; x: number; y: number; minX: number; maxX: number };

export interface WorldLayout {
  items: StaticItem[]; front: StaticItem[]; hot: Hotspot[]; labels: Label[]; actors: ActorSpec[];
  /** named camera targets for the HUD navigation */
  focus: Record<string, Focus>;
  windmill: { x: number; y: number }; ticker: { x: number; y: number }; fountain: { x: number; y: number };
  flags: { x: number; y: number; col: string; col2: string }[]; sprinklers: [number, number][]; bunting: [number, number, number];
  chimneys: [number, number][];
}

export function buildLayout(terrain: TerrainResult): WorldLayout {
  const items: StaticItem[] = [], front: StaticItem[] = [], hot: Hotspot[] = [], occ: [number, number, number, number][] = [];
  const add = (y: number, draw: () => void) => items.push({ y, draw });
  const flat = (draw: () => void) => items.push({ y: -1, draw, ground: true });
  const reserve = (x: number, y: number, w: number, h: number) => occ.push([x, y, w, h]);
  const spot = (h: Omit<Hotspot, 'kind'> & { kind?: HotKind }) => hot.push({ kind: 'building', ...h });
  const bld = (id: string, x: number, y: number, w: number, h: number, draw: () => void, info?: Pick<Hotspot, 'name' | 'zone' | 'play' | 'stage'> & { kind?: HotKind }) => {
    add(y + h, draw); reserve(x - 4, y - 6, w + 10, h + 10);
    if (info) spot({ id, x, y, w, h, ...info });
  };
  const pen = (x1: number, y1: number, x2: number, y2: number) => {
    add(y1, () => HV.fenceH(x1, x2, y1));
    add(y1, () => { HV.fenceV(x1, y1, y2); HV.fenceV(x2, y1, y2); });
    front.push({ y: y2, draw: () => HV.fenceH(x1, x2, y2) });
    reserve(x1 - 4, y1 - 10, x2 - x1 + 8, y2 - y1 + 14);
  };

  // ---- Livestock ranch
  bld('barn', 22, 40, 60, 54, () => HV.barn(22, 40), { name: 'Cow Barn', zone: 'Livestock Ranch', play: 'Houses cows; feed, milk and health timers run server-side.', stage: 5 });
  bld('feed', 86, 48, 18, 46, () => HV.silo(86, 48, '#c9a24a'), { name: 'Feed Storage', zone: 'Livestock Ranch', play: 'Holds animal feed. Capacity upgrades with $HRV.', stage: 5 });
  pen(108, 40, 170, 100);
  bld('coop', 120, 46, 30, 32, () => HV.coop(120, 46), { name: 'Chicken Coop', zone: 'Livestock Ranch', play: 'Chickens lay eggs on a production cycle. Collect, store or sell.', stage: 5 });
  pen(180, 40, 258, 100);
  bld('pigshed', 216, 46, 28, 22, () => HV.shelter(216, 46), { name: 'Pig Enclosure', zone: 'Livestock Ranch', play: 'Pigs need feed and water; productivity tracks health.', stage: 5 });
  flat(() => { HV.E(200, 80, 10, 4, '#6e5038'); HV.E(199, 79, 7, 2, '#86634a'); });
  pen(18, 110, 150, 184);
  add(150, () => HV.trough(100, 144)); add(125, () => HV.hay(40, 118)); add(127, () => HV.hay(52, 120));
  pen(162, 112, 260, 184);
  add(170, () => HV.trough(226, 164));
  spot({ id: 'pasture', kind: 'area', x: 18, y: 100, w: 132, h: 84, name: 'Cow Pasture', zone: 'Livestock Ranch', play: 'Cows graze here. Feeding and milking arrive with core gameplay.', stage: 5 });
  spot({ id: 'sheeppen', kind: 'area', x: 162, y: 102, w: 98, h: 82, name: 'Sheep Pen', zone: 'Livestock Ranch', play: 'Sheep produce wool on a timed cycle.', stage: 5 });
  add(100, () => HV.sign(94, 100, '#c48d52'));

  // ---- Main farm
  bld('house', 276, 90, 56, 60, () => HV.farmhouse(276, 90), { name: 'Farmhouse', zone: 'Main Farm', play: 'Your home base: profile, storage chest, daily rewards and farm level.', stage: 5 });
  add(150, () => HV.well(240, 128)); reserve(236, 124, 24, 30);
  spot({ id: 'well', x: 238, y: 126, w: 20, h: 24, name: 'Well', zone: 'Main Farm', play: 'Refills the watering can.', stage: 5 });
  add(148, () => { HV.R(336, 140, 1, 8, '#6e4527'); HV.R(334, 136, 6, 4, '#3f6fa8'); HV.P(339, 137, '#c4553b'); });
  bld('greenhouse', 350, 118, 44, 38, () => HV.greenhouse(350, 118), { name: 'Greenhouse', zone: 'Industry', play: 'Weather-proof growing for tomatoes and coffee seedlings.', stage: 5 });
  for (let i = 0; i < 4; i++) add(178, () => HV.crate(244 + i * 9, 170, ['#e0402f', '#f2c94c', '#8fd45c', '#c22f2f'][i]));
  reserve(240, 166, 40, 14);
  spot({ id: 'seedcrates', kind: 'machine', x: 242, y: 166, w: 38, h: 14, name: 'Seed Storage', zone: 'Main Farm', play: 'Seed crates — your planting inventory.', stage: 4 });

  for (const p of PLOTS) {
    if (p.kind === 'expansion') {
      // tagged so the stakes, sign and outline disappear when the land is bought
      const tag = `exp:${p.index}`;
      items.push({ y: -1, ground: true, tag, draw: () => {
        for (let k = 0; k < p.w; k += 6) { HV.R(p.x + k, p.y, 3, 1, '#f4e4bc'); HV.R(p.x + k, p.y + p.h - 1, 3, 1, '#f4e4bc'); }
        for (let k = 0; k < p.h; k += 6) { HV.R(p.x, p.y + k, 1, 3, '#f4e4bc'); HV.R(p.x + p.w - 1, p.y + k, 1, 3, '#f4e4bc'); }
      } });
      for (const [sx, sy] of [[0, 0], [p.w - 2, 0], [0, p.h - 2], [p.w - 2, p.h - 2]]) items.push({ y: p.y + sy + 2, tag, draw: () => HV.R(p.x + sx, p.y + sy - 3, 2, 5, '#8a5a32') });
      items.push({ y: p.y + 30, tag, draw: () => HV.sign(p.x + 30, p.y + 30, '#e8c35a') });
      reserve(p.x, p.y, p.w, p.h);
      spot({ id: 'plot' + p.index, kind: 'plot', plot: p.index, x: p.x, y: p.y, w: p.w, h: p.h, name: 'Expansion plot', zone: 'Main Farm', play: 'Locked land — buy it in the Land shop to farm it.', stage: 5 });
      continue;
    }
    reserve(p.x - 2, p.y - 2, p.w + 4, p.h + 4);
    const name = p.kind === 'paddy' ? 'Rice Paddy' : `Field ${p.index + 1}`;
    const play = p.kind === 'paddy' ? 'Flooded field for rice; the irrigation pump keeps it wet.' : 'Plant seeds, keep the soil watered and harvest when ripe.';
    spot({ id: 'plot' + p.index, kind: 'plot', plot: p.index, x: p.x, y: p.y, w: p.w, h: p.h, name, zone: 'Main Farm', play, stage: 5 });
  }
  add(250, () => HV.scarecrow(126, 250));
  add(520, () => HV.pump(286, 506)); reserve(282, 500, 26, 22);
  spot({ id: 'pump', kind: 'machine', x: 282, y: 498, w: 22, h: 18, name: 'Irrigation Pump', zone: 'Main Farm', play: 'Machinery: waters connected plots automatically.', stage: 5 });
  add(441, () => HV.sprinklerHead(377, 441)); add(385, () => HV.sprinklerHead(449, 385));

  // ---- Industry
  add(186, () => HV.windmillTower(430, 186)); reserve(412, 120, 36, 70);
  spot({ id: 'windmill', x: 412, y: 112, w: 38, h: 74, name: 'Windmill', zone: 'Industry', play: 'Powers the grain mill next door: wheat → flour, corn → cornmeal.', stage: 7 });
  bld('mill', 462, 122, 50, 54, () => HV.mill(462, 122), { name: 'Grain Mill', zone: 'Industry', play: 'Wheat → flour and corn → cornmeal on a timer. Millstones double its speed.', stage: 7 });
  add(178, () => { HV.sack(458, 178); HV.sack(452, 176); });
  bld('silo1', 518, 128, 18, 46, () => HV.silo(518, 128), { name: 'Grain Silo', zone: 'Industry', play: 'Produce storage; capacity upgrades.', stage: 5 });
  bld('silo2', 540, 132, 18, 46, () => HV.silo(540, 132), { name: 'Grain Silo', zone: 'Industry', play: 'Produce storage; capacity upgrades.', stage: 5 });
  bld('warehouse', 564, 120, 56, 54, () => HV.warehouse(564, 120), { name: 'Produce Warehouse', zone: 'Industry', play: 'Storage capacity and perishables. Cold storage keeps eggs, milk and tomatoes fresh.', stage: 7 });
  bld('dairy', 500, 228, 48, 50, () => HV.dairy(500, 228), { name: 'Dairy', zone: 'Industry', play: 'Milk → cheese and butter on a timer.', stage: 7 });
  add(282, () => { HV.milkcan(490, 270); HV.milkcan(496, 272); });
  bld('factory', 558, 232, 52, 52, () => HV.factory(558, 232), { name: 'Food Processing', zone: 'Industry', play: 'Tomato sauce, soybean oil, roasted coffee and chocolate — worth more than the raw crops.', stage: 7 });
  bld('shed', 494, 300, 60, 44, () => HV.shed(494, 300), { name: 'Equipment Shed', zone: 'Industry', play: 'Machinery storage: planters, tractors, harvesters.', stage: 5 });
  bld('harvester', 558, 318, 42, 26, () => HV.harvester(558, 318), { kind: 'machine', name: 'Combine Harvester', zone: 'Industry', play: 'Machinery: harvests a whole field in one action.', stage: 5 });

  // ---- Marketplace
  bld('exchange', 704, 84, 96, 96, () => HV.exchange(704, 84), { name: 'Commodity Exchange', zone: 'Marketplace', play: 'Buy and sell crops at server prices that follow real monthly market references, within bounds.', stage: 7 });
  bld('vault', 814, 108, 60, 68, () => HV.vault(814, 108), { name: 'HRV Game Vault', zone: 'Marketplace', play: 'Deposit and withdraw $HRV, view burns and treasury. Wallet-signed.', stage: 8 });
  bld('storage', 892, 112, 58, 54, () => HV.warehouse(892, 112, ['#9c6436', '#6e4527', '#c48d52']), { name: 'Market Storage', zone: 'Marketplace', play: 'Escrow storage for player marketplace listings.', stage: 10 });
  bld('board', 962, 146, 24, 22, () => HV.board(962, 146), { name: 'Delivery Contracts', zone: 'Marketplace', play: 'Deliver produce and goods within 2 hours for a fixed coin premium and XP.', stage: 7 });
  const stalls: [number, string, string[]][] = [[706, '#c4553b', ['#e0402f', '#f2c94c', '#8fd45c', '#3f6fa8']], [738, '#3f6fa8', ['#f4efe2', '#f2c94c', '#e9e0c8', '#4f9a3c']], [770, '#e8a33a', ['#c22f2f', '#6b4226', '#d9822b', '#7b5cc4']], [802, '#4e8a3c', ['#f2c94c', '#e0402f', '#c9a6e8', '#c4553b']],
    [874, '#7b5cc4', ['#d9822b', '#6b4226', '#f2c94c', '#2f6f2e']], [906, '#c4553b', ['#8fd45c', '#e0402f', '#f4efe2', '#e8a33a']], [938, '#3f8a8c', ['#e9e0c8', '#f2c94c', '#c22f2f', '#3f6fa8']]];
  stalls.forEach(([sx, c, gds]) => bld('stall' + sx, sx, 232, 26, 24, () => HV.stall(sx, 232, c, gds)));
  spot({ id: 'market', x: 702, y: 228, w: 130, h: 30, name: 'Produce Market', zone: 'Marketplace', play: 'Player-to-player listings settled in $HRV, with transparent fees.', stage: 10 });
  spot({ id: 'trading', x: 870, y: 228, w: 96, h: 30, name: 'Trading Stalls', zone: 'Marketplace', play: 'Buy seeds, feed and tools. Every item ≤ $15 reference price.', stage: 4 });
  for (const lx of [700, 1004]) add(214, () => HV.lamp(lx, 214));
  for (const lx of [700, 868, 1004]) add(272, () => HV.lamp(lx, 272));
  bld('fountain', 834, 232, 34, 24, () => HV.fountain(851, 248), { name: 'Market Fountain', zone: 'Marketplace', play: 'Meeting point for seasonal events and festivals.', stage: 10 });
  add(270, () => { HV.bench(716, 262); HV.bench(780, 262); HV.bench(916, 262); });
  add(266, () => { HV.barrel(972, 258); HV.barrel(980, 260); HV.crate(990, 262, '#f2c94c'); HV.crate(744, 264, '#e0402f'); HV.crate(752, 266); });
  for (const [px, c] of [[700, '#f08ab0'], [760, '#f7d64a'], [820, '#fff6e8'], [882, '#b48ef0'], [946, '#ff7a5a']] as [number, string][]) { add(296, () => HV.planter(px, 288, c)); reserve(px - 2, 280, 30, 18); }
  reserve(694, 176, 322, 104);

  // ---- Co-op village
  bld('hq', 856, 340, 76, 64, () => HV.hq(856, 340), { name: 'Cooperative HQ', zone: 'Co-op Village', play: 'Join a co-op, pool production, take group contracts.', stage: 10 });
  bld('tower', 952, 334, 30, 72, () => HV.tower(952, 334), { name: 'Leaderboard Tower', zone: 'Co-op Village', play: 'Season rankings: productivity, contracts, co-op score.', stage: 10 });
  bld('cmk1', 900, 410, 26, 24, () => HV.stall(900, 410, '#e8a33a', ['#f2c94c', '#8fd45c', '#e0402f', '#4e8a3c']), { name: 'Community Market', zone: 'Co-op Village', play: 'Co-op members share surplus here.', stage: 10 });
  bld('cmk2', 934, 410, 26, 24, () => HV.stall(934, 410, '#c4553b', ['#e9e0c8', '#c22f2f', '#f4efe2', '#3f6fa8']), { name: 'Community Market', zone: 'Co-op Village', play: 'Co-op members share surplus here.', stage: 10 });
  pen(704, 470, 822, 580);
  add(520, () => HV.podium(747, 506));
  flat(() => { for (let k = 0; k < 10; k++) for (let j = 0; j < 2; j++) HV.R(758 + j * 2, 479 + k, 2, 1, (k + j) % 2 ? '#1a1a1a' : '#f4efe2'); });
  add(486, () => { HV.hay(708, 474); HV.hay(806, 474); }); add(572, () => { HV.hay(708, 566); HV.hay(806, 566); });
  add(555, () => HV.scarecrow(736, 550));
  add(555, () => { HV.R(778, 540, 10, 10, '#f4efe2'); HV.E(783, 545, 4, 4, '#c4553b'); HV.E(783, 545, 2, 2, '#f4efe2'); HV.P(783, 545, '#c4553b'); HV.R(782, 550, 2, 5, '#6e4527'); });
  const crowd: Palette[] = [{ shirt: '#c4553b', pants: '#3f6fa8' }, { shirt: '#e8a33a', pants: '#4a5a3a' }, { shirt: '#3f8a8c', pants: '#5a3a26', hat: '#c4553b' }, { shirt: '#7b5cc4', pants: '#3a4a5a' }, { shirt: '#4e8a3c', pants: '#6b4226', hat: '#d8c07a' }, { shirt: '#f2a3ae', pants: '#3f6fa8' }];
  add(600, () => { HV.R(708, 594, 110, 4, '#8a5a32'); HV.R(708, 594, 110, 1, '#c48d52'); HV.R(708, 598, 110, 1, '#5e3a20'); crowd.forEach((p, k) => HV.farmer(714 + k * 17, 582, 0, false, p, 'front')); });
  reserve(700, 580, 124, 22);
  spot({ id: 'arena', kind: 'area', x: 704, y: 460, w: 118, h: 120, name: 'Competition Grounds', zone: 'Co-op Village', play: 'Timed harvest races and seasonal tournaments (play credits only).', stage: 10 });
  bld('cot1', 868, 478, 36, 40, () => HV.cottage(868, 478, ['#c4553b', '#8b3324', '#e47b57']), { name: 'Cottage', zone: 'Co-op Village', play: 'Neighbour farm — visit other players here.', stage: 10 });
  bld('cot2', 930, 486, 36, 40, () => HV.cottage(930, 486, ['#3f6fa8', '#2a4e7c', '#6a98cf']), { name: 'Cottage', zone: 'Co-op Village', play: 'Neighbour farm — visit other players here.', stage: 10 });
  bld('cot3', 880, 548, 36, 40, () => HV.cottage(880, 548, ['#9c6436', '#6e4527', '#c48d52']), { name: 'Cottage', zone: 'Co-op Village', play: 'Neighbour farm — visit other players here.', stage: 10 });
  bld('sharedmill', 950, 556, 50, 54, () => HV.mill(950, 556), { name: 'Shared Production Mill', zone: 'Co-op Village', play: 'Co-op owned processing with split output.', stage: 10 });
  for (const ly of [440, 520, 600]) add(ly, () => HV.lamp(852, ly));

  // ---- Riverside: bridges, pond, orchard
  const bridge = (yc: number) => {
    const b = [Math.floor(riverC(yc) - riverHW(yc) - 6), Math.ceil(riverC(yc) + riverHW(yc) + 6)];
    add(yc - 10, () => HV.bridge(b[0], b[1], yc)); front.push({ y: yc + 12, draw: () => HV.bridgeFront(b[0], b[1], yc) });
    return b;
  };
  const b1 = bridge(200); bridge(430);
  spot({ id: 'bridge', x: b1[0], y: 186, w: b1[1] - b1[0], h: 28, name: 'Old Mill Bridge', zone: 'Riverside', play: 'Connects the farm to the market.', stage: 2 });
  spot({ id: 'pond', kind: 'nature', x: POND.x - POND.rx, y: POND.y - POND.ry, w: POND.rx * 2, h: POND.ry * 2, name: 'Duck Pond', zone: 'Riverside', play: 'Water supply for watering cans; ducks and fish.', stage: 5 });
  const inPond = (x: number, y: number, k = 1) => Math.hypot((x - POND.x) / POND.rx, (y - POND.y) / POND.ry) < k;
  for (let i = 0; i < 14; i++) { const lx = 60 + hash(i, 1, 40) * 110, ly = 524 + hash(i, 2, 40) * 56; if (inPond(lx, ly, .8) && !inPond(lx, ly, .35)) flat(() => HV.lily(lx, ly)); }
  for (let a = 0; a < 6.283; a += .09) {
    const k = 1.1 + hash(Math.round(a * 100), 3, 41) * .12, rx = Math.round(POND.x + Math.cos(a) * POND.rx * k), ry = Math.round(POND.y + Math.sin(a) * POND.ry * k);
    if (Math.sin(a) < -.2 && Math.cos(a) > .2 && Math.cos(a) < .8) continue; // dock side stays open
    const r = hash(Math.round(a * 100), 4, 41);
    if (r < .45) items.push({ y: ry, nature: true, draw: () => HV.reeds(rx, ry) });
    else if (r < .55) add(ry, () => HV.rock(rx, ry));
    else if (r < .62) items.push({ y: ry + 2, nature: true, variant: Math.round(a * 10), draw: () => HV.bush(rx, ry + 2, Math.round(a * 10), '#fff6e8') });
  }
  add(536, () => HV.dock(148, 512, 24)); reserve(30, 500, 170, 110);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) {
    const tx = 372 + j * 30 + (i % 2) * 12, ty = 500 + i * 28;
    items.push({ y: ty, nature: true, sway: 9, variant: i + j, draw: () => HV.tree(tx, ty, i * 7 + j, 8, j % 2 ? '#e0402f' : '#f2a33a') }); reserve(tx - 10, ty - 22, 20, 26);
  }
  spot({ id: 'orchard', kind: 'nature', x: 356, y: 470, w: 140, h: 90, name: 'Fruit Orchard', zone: 'Main Farm', play: 'Fruit trees with long growth cycles and seasonal yields.', stage: 5 });

  scatter(terrain, items, occ);

  const labels: Label[] = [
    { text: 'Livestock Ranch', x: 140, y: 22 }, { text: 'Main Farm', x: 238, y: 214 }, { text: 'Mill & Industry', x: 520, y: 96 },
    { text: 'Marketplace', x: 850, y: 68 }, { text: 'Co-op Village', x: 900, y: 330 }, { text: 'Riverside', x: 112, y: 600 },
  ];
  const focus: Record<string, Focus> = {
    farm: { id: 'house', x: 300, y: 260 }, livestock: { id: 'pasture', x: 140, y: 110 }, machinery: { id: 'shed', x: 540, y: 300 },
    marketplace: { id: 'market', x: 850, y: 230 }, exchange: { id: 'exchange', x: 752, y: 150 }, cooperative: { id: 'hq', x: 900, y: 400 },
    competitions: { id: 'arena', x: 763, y: 525 },
  };
  const actors: ActorSpec[] = [
    { kind: 'cow', rect: [24, 118, 128, 168], count: 3, seed: 1 },
    { kind: 'sheep', rect: [168, 120, 244, 170], count: 4, seed: 2 },
    { kind: 'pig', rect: [186, 70, 240, 88], count: 3, seed: 3 },
    { kind: 'chicken', rect: [112, 80, 162, 92], count: 5, seed: 4 },
    { kind: 'chicken', rect: [270, 186, 296, 194], count: 1, seed: 9 },
    { kind: 'duck', rect: [70, 532, 150, 566], count: 3, seed: 5 },
    { kind: 'farmer', path: [[20, 188], [640, 188], [1000, 188]], pal: { shirt: '#c4553b', pants: '#3f6fa8' }, speed: 13 },
    { kind: 'farmer', path: [[323, 206], [323, 466], [200, 466]], pal: { shirt: '#4e8a3c', pants: '#6b4226', hat: '#d8c07a' }, speed: 11 },
    { kind: 'farmer', path: [[833, 216], [833, 600]], pal: { shirt: '#7b5cc4', pants: '#3a4a5a', hat: '#c4553b' }, speed: 10 },
    { kind: 'farmer', path: [[714, 266], [990, 266]], pal: { shirt: '#e8a33a', pants: '#4a5a3a', hat: '#e8c35a' }, speed: 9 },
    { kind: 'farmer', path: [[560, 416], [1000, 416]], pal: { shirt: '#3f8a8c', pants: '#5a3a26', hat: '#e8c35a' }, speed: 12 },
    { kind: 'waterer', x: 186, y: 278, pal: { shirt: '#3f6fa8', pants: '#6b4226' } },
    { kind: 'tractor', x: 352, y: 264, minX: 350, maxX: 398 },
  ];
  return {
    items, front, hot, labels, actors, focus,
    windmill: { x: 430, y: 141 }, ticker: { x: 726, y: 115 }, fountain: { x: 851, y: 248 },
    flags: [{ x: 752, y: 68, col: '#3f8a8c', col2: '#f2c94c' }, { x: 893, y: 314, col: '#4e8a3c', col2: '#f2c94c' }, { x: 756, y: 466, col: '#c4553b', col2: '#f2c94c' }],
    sprinklers: [[378, 435], [450, 379]], bunting: [704, 822, 462],
    chimneys: [[321, 80], [599, 223]],
  };
}

// Trees, bushes and ground cover on free grass (deterministic).
function scatter(terrain: TerrainResult, items: StaticItem[], occ: [number, number, number, number][]) {
  const { at } = terrain;
  let s = 7;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const trees: [number, number][] = [];
  const add = (y: number, draw: () => void) => items.push({ y, draw });
  const free = (x: number, y: number, pad: number) => {
    for (const [ox, oy] of [[0, 0], [-pad, 0], [pad, 0], [0, -pad], [-pad, -pad], [pad, -pad], [0, -pad * 2]]) if (at(x + ox, y + oy) !== Ground.Grass) return false;
    for (const [a, b, w, h] of occ) if (x + pad > a && x - pad < a + w && y > b && y - pad * 2.2 < b + h) return false;
    return true;
  };
  const near = (x: number, y: number, d: number) => trees.some(t => Math.abs(t[0] - x) < d && Math.abs(t[1] - y) < d * .8);
  const put = (x: number, y: number, kind: 'pine' | 'tree' | 'bush', seed: number) => {
    trees.push([x, y]);
    const variant = Math.abs(seed) % 7;
    if (kind === 'pine') items.push({ y, nature: true, sway: 4, draw: () => HV.pine(x, y, seed, .9 + (seed % 3) * .15) });
    else if (kind === 'tree') items.push({ y, nature: true, sway: 9, variant, draw: () => HV.tree(x, y, seed, 8 + (seed % 4), seed % 9 === 0 ? '#e0402f' : null) });
    else items.push({ y, nature: true, variant, draw: () => HV.bush(x, y, seed, seed % 3 ? null : ['#f08ab0', '#fff6e8', '#f7d64a'][(seed >> 2) % 3]) });
  };
  for (let x = -4; x < WORLD_W + 8; x += 11) {
    for (const y of [16 + rnd() * 12, 32 + rnd() * 6]) { const xx = x + rnd() * 6; if (free(xx, y, 5) && !near(xx, y, 9)) put(xx, y, rnd() < .45 ? 'pine' : 'tree', (x * 7 + y) | 0); }
    for (const y of [612 + rnd() * 6, 630 + rnd() * 10, 646]) { const xx = x + rnd() * 6; if (free(xx, Math.min(y, 639), 5) && !near(xx, y, 9)) put(xx, y, rnd() < .4 ? 'pine' : 'tree', (x * 5 + y) | 0); }
  }
  for (let y = 40; y < WORLD_H; y += 13) for (const x of [4 + rnd() * 6, WORLD_W - 6 - rnd() * 6]) if (free(x, y, 5) && !near(x, y, 10)) put(x, y, rnd() < .5 ? 'pine' : 'tree', (x + y * 3) | 0);
  for (let i = 0; i < 5000 && trees.length < 520; i++) {
    const x = rnd() * WORLD_W, y = 30 + rnd() * (WORLD_H - 30);
    const nearRiver = Math.abs(riverDepth(x, y)) < 34;
    const k = rnd();
    const kind = k < (nearRiver ? .5 : .28) ? 'tree' : k < .45 ? 'pine' : 'bush';
    if (free(x, y, kind === 'bush' ? 5 : 8) && !near(x, y, kind === 'bush' ? 10 : 15)) put(x, y, kind, i);
  }
  for (let i = 0; i < 2600; i++) {
    const x = Math.floor(rnd() * WORLD_W), y = Math.floor(rnd() * WORLD_H);
    if (at(x, y) !== Ground.Grass || at(x, y - 2) !== Ground.Grass) continue;
    if (occ.some(([a, b, w, h]) => x > a && x < a + w && y > b && y < b + h)) continue;
    const r = rnd();
    if (r < .55) items.push({ y: -1, ground: true, nature: true, draw: () => HV.tuft(x, y) });
    else if (r < .8) items.push({ y: -1, ground: true, nature: true, draw: () => HV.flowers(x, y, i) });
    else if (r < .88 && free(x, y, 4)) { const big = rnd() < .3; add(y, () => HV.rock(x, y, big ? 1.5 : 1)); }
  }
  for (let y = 10; y < WORLD_H; y += 7) for (const side of [-1, 1]) {
    const x = Math.round(riverC(y) + side * (riverHW(y) + 3 + rnd() * 3));
    if (at(x, y) === Ground.Sand || at(x, y) === Ground.Grass) {
      if (rnd() < .4) items.push({ y, nature: true, draw: () => { HV.R(x, y - 5, 1, 5, '#4f8a3c'); HV.R(x + 1, y - 6, 1, 6, '#5fae3f'); HV.P(x + 1, y - 7, '#8a5a32'); } });
      else if (rnd() < .12) add(y, () => HV.rock(x, y));
    }
  }
}
