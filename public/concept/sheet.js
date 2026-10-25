// Harvestia — Stage 1 art-direction sheet, rendered from the same sprite functions as the world.
(function () {
'use strict';
let built = false;
const body = () => document.getElementById('sheetBody');
function section(title, text) {
  const s = document.createElement('div'); s.className = 'sec';
  s.innerHTML = `<h2>${title}</h2>${text ? `<p>${text}</p>` : ''}<div class="grid"></div>`;
  body().appendChild(s); return s.querySelector('.grid');
}
function sprite(grid, name, sub, w, h, scale, draw, bg = true) {
  const c = document.createElement('div'); c.className = 'cardS' + (bg ? '' : ' nobg');
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.style.width = w * scale + 'px'; cv.style.height = h * scale + 'px';
  if (bg) { const g = cv.getContext('2d'); const T = HV.TERRAIN; const img = g.createImageData(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const col = T.grass(x + 300, y + 300), i = (y * w + x) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255; } g.putImageData(img, 0, 0); }
  HV.use(cv.getContext('2d')); draw();
  c.appendChild(cv); c.insertAdjacentHTML('beforeend', `<b>${name}</b>${sub ? `<small>${sub}</small>` : ''}`);
  grid.appendChild(c);
}
function tile(grid, name, sub, fn) {
  const w = 40, h = 40, c = document.createElement('div'); c.className = 'cardS nobg';
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.style.width = '120px'; cv.style.height = '120px';
  const g = cv.getContext('2d'), img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const col = fn(x, y), i = (y * w + x) * 4; img.data.set([col[0], col[1], col[2], 255], i); }
  g.putImageData(img, 0, 0);
  c.appendChild(cv); c.insertAdjacentHTML('beforeend', `<b>${name}</b><small>${sub}</small>`); grid.appendChild(c);
}

HV.buildSheet = function () {
  if (built) return; built = true;
  const T = HV.TERRAIN;

  // palette
  const pal = section('Palette', 'Warm, saturated farm greens and earth tones, sun-gold accents for value (crops, coins, $HRV), teal for the exchange and finance layer. Every sprite draws only from these ramps.');
  const ramps = [
    ['Meadow', ['#3d8a3a', '#479840', '#52a645', '#5fb44b', '#6dc053', '#86d466']],
    ['Foliage', ['#1d4f35', '#2a6430', '#3b893b', '#52a645', '#6cbf52', '#8edb6c']],
    ['Soil & paths', ['#4a2a16', '#5a3420', '#7a4a2a', '#8f5a33', '#c99a60', '#e8cc96']],
    ['Water', ['#2a6db6', '#3079c4', '#3d8fd6', '#55a9e4', '#86ccf2', '#e3f6ff']],
    ['Timber', ['#3b2414', '#5a3420', '#7a4a28', '#a87443', '#c48d52', '#e0b07a']],
    ['Harvest gold', ['#a8801f', '#c99a2e', '#e3b341', '#f2c94c', '#f7e08a', '#fff4d6']],
    ['Roof accents', ['#8b3324', '#c4553b', '#3f6fa8', '#4e8a3c', '#3f8a8c', '#5f6b78']],
    ['Parchment UI', ['#3b2414', '#5a3a22', '#e2c98f', '#e9d29c', '#f4e4bc', '#fff4d6']],
  ];
  for (const [n, cols] of ramps) {
    const c = document.createElement('div'); c.className = 'cardS sw';
    c.innerHTML = `<i style="background:linear-gradient(90deg,${cols.map((x, i) => `${x} ${i * 100 / cols.length}% ${(i + 1) * 100 / cols.length}%`).join(',')})"></i><b>${n}</b><code>${cols[2]} · ${cols[4]}</code>`;
    pal.appendChild(c);
  }

  const ter = section('Terrain', 'Shown at 3×. Grass uses two noise octaves plus sparse highlight pixels for a lush, hand-painted read; soil furrows line up with the crop grid so planted rows sit on ridges.');
  tile(ter, 'Meadow grass', 'base ground', (x, y) => T.grass(x + 40, y + 90));
  tile(ter, 'Dirt road', 'paths & lanes', (x, y) => T.path(x, y, y < 2 || y > 37));
  tile(ter, 'Market cobbles', 'plazas', (x, y) => T.stone(x + 3, y + 1, false));
  tile(ter, 'Tilled soil', 'crop plots', (x, y) => T.soil(x + 1, y + 1, 60, 60, false));
  tile(ter, 'Watered soil', 'after watering', (x, y) => T.soil(x + 1, y + 1, 60, 60, true));
  tile(ter, 'Rice paddy', 'flooded field', (x, y) => T.paddy(x + 3, y + 3, 60, 60));
  tile(ter, 'River / pond', 'depth shading', (x, y) => y < 3 ? T.sand(x, y, false) : y < 5 ? T.sand(x, y, true) : T.water((y - 4) / 2.4, x * 3, y * 3));

  const crops = section('Crops — growth stages', 'Every crop has four readable states: seeded → sprouting → growing → ready. Ready crops get a brighter top highlight so they pop from across the farm. Market-referenced crops: wheat, corn, soybeans, coffee, cocoa.');
  const names = { wheat: 'Wheat', corn: 'Corn', soy: 'Soybeans', coffee: 'Coffee', cocoa: 'Cocoa', tomato: 'Tomatoes', potato: 'Potatoes', rice: 'Rice' };
  for (const k of HV.CROPS) sprite(crops, names[k], 'seed · sprout · grow · ready', 64, 24, 4, () => {
    HV.R(0, 0, 64, 24, k === 'rice' ? '#5f93a3' : '#7a4a2a');
    for (let y = 0; y < 24; y += 5) HV.R(0, y, 64, 1, k === 'rice' ? '#7fb0bf' : '#6b3f24');
    for (let s = 0; s < 4; s++) { HV.R(s * 16 + 2, 21, 13, 2, k === 'rice' ? '#7fb0bf' : '#8f5a33'); HV.crop(k, s, s * 16 + 8, 21); }
  }, false);

  const ani = section('Livestock', 'Side-view sprites with 2-frame walks; chickens peck, ducks bob. Animals wander inside their pens in the live world.');
  sprite(ani, 'Cow', 'walk frames', 46, 18, 4, () => { HV.cow(2, 3, 0); HV.cow(25, 3, 1, true); });
  sprite(ani, 'Sheep', 'walk frames', 36, 16, 4, () => { HV.sheep(3, 3, 0); HV.sheep(20, 3, 1, true); });
  sprite(ani, 'Pig', 'walk frames', 36, 14, 4, () => { HV.pig(3, 2, 0); HV.pig(20, 2, 1, true); });
  sprite(ani, 'Chicken', 'walk · peck', 26, 12, 4, () => { HV.chicken(3, 3, 0); HV.chicken(15, 3, 3); });
  sprite(ani, 'Duck', 'swim', 26, 10, 4, () => { HV.R(0, 0, 26, 10, '#3d8fd6'); HV.duck(3, 3, 0); HV.duck(14, 3, 1, true); });

  const bl = section('Buildings', 'Three-quarter top-down, warm timber and plaster, shingled roofs with a darker eave line and a cast shadow to the lower-right. Each zone has a roof colour: red farm, slate ranch, brown industry, teal exchange, navy vault, green co-op.');
  sprite(bl, 'Farmhouse', 'Main Farm', 64, 70, 2.5, () => HV.farmhouse(4, 10));
  sprite(bl, 'Cow barn', 'Livestock', 68, 62, 2.5, () => HV.barn(4, 4));
  sprite(bl, 'Chicken coop', 'Livestock', 38, 38, 2.5, () => HV.coop(4, 2));
  sprite(bl, 'Windmill', 'Industry', 70, 76, 2.5, () => { HV.windmillTower(35, 72); HV.blades(35, 27, .4, 30); });
  sprite(bl, 'Grain mill', 'Industry', 58, 60, 2.5, () => HV.mill(4, 3));
  sprite(bl, 'Silo', 'Storage', 26, 52, 2.5, () => HV.silo(4, 3));
  sprite(bl, 'Greenhouse', 'Industry', 52, 44, 2.5, () => HV.greenhouse(4, 4));
  sprite(bl, 'Dairy', 'Industry', 56, 56, 2.5, () => HV.dairy(4, 4));
  sprite(bl, 'Food processing', 'Industry', 60, 66, 2.5, () => HV.factory(4, 12));
  sprite(bl, 'Commodity Exchange', 'Marketplace', 106, 122, 2.5, () => { HV.exchange(5, 22); HV.ticker(27, 53, 52, 8, 3); HV.flag(53, 4, 1, '#3f8a8c', '#f2c94c'); });
  sprite(bl, 'HRV Game Vault', 'Marketplace', 68, 74, 2.5, () => HV.vault(4, 3));
  sprite(bl, 'Market stall', 'Marketplace', 64, 30, 2.5, () => { HV.stall(3, 3, '#c4553b', ['#e0402f', '#f2c94c', '#8fd45c', '#3f6fa8']); HV.stall(34, 3, '#3f6fa8', ['#f4efe2', '#f2c94c', '#e9e0c8', '#4f9a3c']); });
  sprite(bl, 'Cooperative HQ', 'Co-op Village', 84, 72, 2.5, () => HV.hq(4, 4));
  sprite(bl, 'Leaderboard tower', 'Co-op Village', 38, 84, 2.5, () => HV.tower(4, 8));
  sprite(bl, 'Cottage', 'Co-op Village', 44, 48, 2.5, () => HV.cottage(4, 4, ['#3f6fa8', '#2a4e7c', '#6a98cf']));

  const mach = section('Machinery & tools', 'Chunky readable silhouettes with visible wheels and moving parts. Tractor wheels rotate and puff exhaust; sprinklers throw animated water arcs.');
  sprite(mach, 'Tractor', 'drives plot rows', 64, 26, 3, () => { HV.tractor(3, 3, 0); HV.tractor(34, 3, 1, true); });
  sprite(mach, 'Combine harvester', 'whole-field harvest', 50, 34, 3, () => HV.harvester(4, 4));
  sprite(mach, 'Irrigation pump', 'auto-watering', 28, 22, 3, () => { HV.pump(4, 6); HV.sprinklerHead(24, 20); });
  sprite(mach, 'Watering can · tools', 'starter kit', 40, 22, 3, () => { HV.farmer(3, 4, 0, false, { shirt: '#3f6fa8', pants: '#6b4226' }, 'water'); HV.crate(22, 10, '#f2c94c'); HV.sack(36, 19); });

  const ch = section('Characters', '9×14 farmers with 4-frame walks. Hat, shirt and overalls are palette slots for player customisation.');
  const pals = [{ shirt: '#c4553b', pants: '#3f6fa8' }, { shirt: '#4e8a3c', pants: '#6b4226', hat: '#d8c07a' }, { shirt: '#7b5cc4', pants: '#3a4a5a', hat: '#c4553b' }, { shirt: '#e8a33a', pants: '#4a5a3a' }];
  sprite(ch, 'Farmers', 'front · walk cycle', 80, 20, 4, () => { pals.forEach((p, i) => HV.farmer(3 + i * 19, 3, i, i === 3, p, i === 0 ? 'front' : 'walk')); });

  const nat = section('Nature props', 'Rounded clumped canopies with top-left light; pines for forest edges; bushes, rocks, flowers and reeds give the dense, lived-in ground cover.');
  sprite(nat, 'Trees', 'oak · fruit · pine', 70, 40, 3, () => { HV.tree(12, 36, 1, 9); HV.tree(34, 36, 2, 8, '#e0402f'); HV.pine(56, 36, 3, 1); });
  sprite(nat, 'Ground cover', 'bush · rock · flowers', 60, 22, 3, () => { HV.bush(10, 18, 3, '#f08ab0'); HV.rock(26, 18, 1.4); HV.flowers(42, 15, 4); HV.flowers(52, 17, 9); HV.tuft(36, 19); });
  sprite(nat, 'Fences & props', 'pens · hay · well', 76, 34, 3, () => { HV.fenceH(2, 34, 30); HV.hay(38, 20); HV.barrel(52, 20); HV.well(58, 8); });

  const ui = section('Interface kit', 'Parchment panels inside dark timber frames with notched pixel corners. Gold marks value and selection; green for growth/positive, red for negative. Icons are 12×12 pixel art shown at 2–3×.');
  const ig = document.createElement('div'); ig.className = 'cardS'; ig.style.textAlign = 'left';
  ig.innerHTML = Object.keys(HV.iconURL).map(k => `<span style="display:inline-flex;flex-direction:column;align-items:center;width:64px;margin:4px;font-size:12px"><img src="${HV.iconURL[k]}" style="width:36px;height:36px;image-rendering:pixelated">${k}</span>`).join('');
  ui.appendChild(ig);

  const play = section('What becomes playable', 'Everything in the concept is drawn by the game renderer, not a mock-up. These are the objects that turn into interactive game objects, and the stage where each one starts working.');
  const rows = [
    ['Crop plots (8 crops, 4 stages)', 'Select plot → plant → water → grow → harvest. Growth timers validated server-side.', '2 (select) · 5 (play)'],
    ['Farmhouse, well, seed crates', 'Home base, profile, storage chest, watering-can refill.', '2 · 5'],
    ['Cow pasture, sheep pen, pigs, chicken coop', 'Buy, feed and collect milk / wool / eggs on production timers.', '5'],
    ['Tractor, harvester, pump & sprinklers, shed', 'Machinery that speeds planting, harvesting and auto-watering.', '5'],
    ['Windmill, grain mill, dairy, food processing', 'Processing chains (wheat → flour, milk → cheese, cocoa → chocolate).', '3 (animation) · 7'],
    ['Silos, warehouse, market storage', 'Inventory capacity and produce storage upgrades.', '5 · 7'],
    ['Commodity Exchange (ticker board)', 'Trade virtual commodities referenced to real markets; simulated values always labelled.', '7'],
    ['Market stalls, delivery-contract board', 'Seed & tool shop, player listings in $HRV, delivery contracts.', '4 · 7'],
    ['HRV Game Vault', 'Wallet balance, deposits / withdrawals, burns and treasury history.', '8'],
    ['Co-op HQ, community market, shared mill', 'Cooperatives, pooled production and co-op contracts.', '10'],
    ['Leaderboard tower, competition grounds', 'Rankings, timed harvest races, play-credit tournaments.', '10'],
    ['Expansion plots (dashed outline)', 'Locked land unlocked with land upgrades.', '5'],
    ['Weather, seasons, day/night', 'Clouds, rain, drought tint, seasonal palettes and lighting.', '3'],
  ];
  const tb = document.createElement('table'); tb.className = 'play';
  tb.innerHTML = '<tr><th>Object in the concept</th><th>Gameplay</th><th>Stage</th></tr>' + rows.map(r => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td class="s">${r[2]}</td></tr>`).join('');
  play.appendChild(tb);
};
})();
