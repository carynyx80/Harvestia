// Harvestia — UI layer: pixel icons, logo, HUD panels, camera, minimap, inspector.
(function () {
'use strict';
const PAL = { k: '#3b2414', r: '#c4553b', R: '#e47b57', c: '#efdcb2', b: '#5ea9d1', B: '#c7ecff', g: '#3f8e3f', G: '#7fcf5c', y: '#e8b93c', Y: '#f7e08a', w: '#8a5530', W: '#c48d52', s: '#8c93a0', S: '#dfe4ea', h: '#f2c29b', x: '#2a2a2a', o: '#f2a33a', e: '#e0402f', f: '#f7f4ee', n: '#4ce06a', m: '#ff5a4a', p: '#f2a3ae' };
const ICONS = {
  home: ['.....kk.....', '....kRRk....', '...kRrrrk...', '..kRrrrrrk..', '.kRrrrrrrrk.', 'kkkkkkkkkkkk', '.kcccccccck.', '.kcbbckkcck.', '.kcBbckwcck.', '.kcccckwcck.', '.kcccckwcck.', '.kkkkkkkkkk.'],
  bag: ['....kkkk....', '...kWWWWk...', '....kwwk....', '..kkWWWWkk..', '.kWWWWWWWWk.', '.kWWWyyWWWk.', 'kWWWWyyWWWWk', 'kWWWWWWWWWWk', 'kwWWWWWWWWwk', 'kwwWWWWWWwwk', '.kwwwwwwwwk.', '..kkkkkkkk..'],
  cow: ['............', '.kS......Sk.', '..kkkkkkkk..', '.kfffxxfffk.', 'kffkfxxfkffk', '.kffffffffk.', '..kfffffxk..', '..kpppppppk.', '..kpkpppkpk.', '..kpppppppk.', '...kkkkkkk..', '............'],
  tractor: ['............', '..kkkkk.....', '..kbBbk..k..', '..kbbbk..k..', '..kgggkkkkk.', '.kgGGGGGGGk.', '.kggggggggk.', 'kkkkkgggkkkk', 'kxxxxkkkxxk.', 'kxyyxk.kxyxk', 'kxxxxk..kxk.', '.kkkk....k..'],
  stall: ['kkkkkkkkkkkk', 'keeffeeffeek', 'keeffeeffeek', '.ekfekfekfe.', '.k........k.', '.k.yo.Ge.ek.', 'kkkkkkkkkkkk', 'kWWWWWWWWWWk', 'kwwwwwwwwwwk', 'kWWWWWWWWWWk', 'kwwwwwwwwwwk', 'kkkkkkkkkkkk'],
  chart: ['kkkkkkkkkkkk', 'kxxxxxxxxxxk', 'kxxxxxxxxnxk', 'kxxxxxxxnnxk', 'kxxmxxxnxxxk', 'kxmxmxnxxxxk', 'kmxxxmxxxxxk', 'kxxxxxxxxxxk', 'kxnxmxnxnxxk', 'kxnxmxnxnxxk', 'kkkkkkkkkkkk', '....kkkk....'],
  coop: ['............', '..kkk..kkk..', '.khhhkkhhhk.', '.khhhkkhhhk.', '..kkk..kkk..', '.kgggkkbbbk.', 'kgggggkbbbbk', 'kgggggkbbbbk', 'kgggggkbbbbk', 'kgggk.kkbbbk', '.kkk...kkkk.', '............'],
  trophy: ['kkkkkkkkkkkk', 'kyYYYyyyyyyk', 'kyYyyyyyyyyk', 'kkyYyyyyyykk', 'k.kyyyyyyk.k', 'kk.kyyyyk.kk', '....kyyk....', '.....kk.....', '....kyyk....', '...kkkkkk...', '...kwwwwk...', '...kkkkkk...'],
  seed: ['............', '.......kk...', '..kk..kGGk..', '.kGGk.kGgk..', '.kgGGkGgk...', '..kggGgk....', '....kgk.....', '....kgk.....', '..kkwwwkk...', '.kwWWWWWwk..', '.kwwwwwwwk..', '..kkkkkkk...'],
  water: ['...kkkk.....', '..k....k....', '.kkkkkkkk...', '.kSSSSSSk..k', 'kkSSSSSSkkkb', 'kSsSSSSSSkb.', 'kSsSSSSSkk.b', '.kSSSSSSk...', '.ksssssskb..', '.kkkkkkkk...', '......b.....', '..b.....b...'],
  harvest: ['..y..y..y...', '.yYy.yYy.yY.', '.yYy.yYyyYy.', '..yy.yYy.y..', '...y..y..y..', '...y..y.y...', '....y.yy....', '....kkkkk...', '....kwwwk...', '....y.y.y...', '...y..y..y..', '..y...y...y.'],
  build: ['..kkkkkkk...', '.kSSSSSSSkk.', 'kSSSSSSSSSSk', '.kkkkWWkkkk.', '....kWWk....', '....kWwk....', '....kWwk....', '....kWwk....', '....kWwk....', '....kWwk....', '....kwwk....', '.....kk.....'],
  upgrade: ['.....kk.....', '....kGGk....', '...kGGGGk...', '..kGGGGGGk..', '.kGGGGGGGGk.', 'kkkkGGGGkkkk', '...kGggGk...', '...kGggGk...', '...kGggGk...', '...kGggGk...', '...kggggk...', '...kkkkkk...'],
  coin: ['...kkkkkk...', '..kyYYYYyk..', '.kyYyyyyyyk.', 'kyYykyykyyyk', 'kyYykyykyyyk', 'kyyykkkkyyyk', 'kyyykyykyyyk', 'kyyykyykyyyk', '.kyyyyyyyyk.', '..kyyyyyyk..', '...kkkkkk...', '............'],
  vault: ['kkkkkkkkkkkk', 'kSSSSSSSSSsk', 'kSkkkkkkkSsk', 'kSk..yy.kSsk', 'kSk.yYYykSsk', 'kSk.yYyykSsk', 'kSk..yy.kSsk', 'kSkkkkkkkSsk', 'kSSSSSSSSSsk', 'kssssssssssk', 'kkkkkkkkkkkk', '.kk......kk.'],
  sun: ['.....o......', '.o...o...o..', '..o.....o...', '....yyy.....', '...yYYYy....', 'ooyYYYYYyoo.', '...yYYYy....', '....yyy.....', '..o.....o...', '.o...o...o..', '.....o......', '............'],
  cloud: ['............', '............', '....kkkk....', '...kffffk...', '.kkffffffkk.', 'kffffffffffk', 'kfffSSSSfffk', '.kkkkkkkkkk.', '............', '............', '............', '............'],
  rain: ['............', '....kkkk....', '...kSSSSk...', '.kkSSSSSSkk.', 'ksSSSSSSSSsk', 'kssssssssssk', '.kkkkkkkkkk.', '..b..b..b...', '.b..b..b....', '...b..b..b..', '..b..b..b...', '............'],
  gear: ['....kkkk....', '.kk.kSSk.kk.', '.kSkkSSkkSk.', '..kSSSSSSk..', 'kkkSSkkSSkkk', 'kSSSk..kSSSk', 'kSSSk..kSSSk', 'kkkSSkkSSkkk', '..kSSSSSSk..', '.kSkkSSkkSk.', '.kk.kSSk.kk.', '....kkkk....'],
};
const iconURL = {};
for (const [k, rows] of Object.entries(ICONS)) {
  const c = document.createElement('canvas'); c.width = 12; c.height = 12; const g = c.getContext('2d');
  rows.forEach((row, y) => { for (let x = 0; x < 12; x++) { const ch = (row[x] || '.'); if (PAL[ch]) { g.fillStyle = PAL[ch]; g.fillRect(x, y, 1, 1); } } });
  iconURL[k] = c.toDataURL();
}
HV.iconURL = iconURL;
const paintIcons = root => root.querySelectorAll('.ic[data-i]').forEach(el => { el.style.backgroundImage = `url(${iconURL[el.dataset.i]})`; });

// ---------- crisp pixel text (font rasterised then thresholded, so no anti-aliasing)
HV.pixelText = (g, text, x, y, size, fill, outline, shadow) => {
  const tc = document.createElement('canvas'); tc.width = Math.ceil(size * text.length * .9) + 8; tc.height = Math.ceil(size * 1.4);
  const tg = tc.getContext('2d'); tg.font = `700 ${size}px "Pixelify Sans"`; tg.textBaseline = 'top'; tg.fillStyle = '#000'; tg.fillText(text, 2, 2);
  const w = Math.ceil(tg.measureText(text).width) + 4, d = tg.getImageData(0, 0, tc.width, tc.height).data;
  const on = (px, py) => px >= 0 && py >= 0 && px < tc.width && py < tc.height && d[(py * tc.width + px) * 4 + 3] > 110;
  let top = tc.height, bot = 0;
  for (let py = 0; py < tc.height; py++) for (let px = 0; px < tc.width; px++) if (on(px, py)) { top = Math.min(top, py); bot = Math.max(bot, py); }
  const ox = Math.round(x - w / 2), oy = y - top;
  for (let py = 0; py < tc.height; py++) for (let px = 0; px < tc.width; px++) {
    if (on(px, py)) continue;
    let n = false; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [0, 2], [1, 2], [-1, 2]]) if (on(px + a, py + b)) { n = true; break; }
    if (n) { g.fillStyle = outline; g.fillRect(ox + px, oy + py, 1, 1); }
  }
  for (let py = 0; py < tc.height; py++) for (let px = 0; px < tc.width; px++) if (on(px, py)) {
    const f = (py - top) / Math.max(1, bot - top);
    g.fillStyle = on(px, py + 1) ? fill(f) : shadow; g.fillRect(ox + px, oy + py, 1, 1);
  }
};

function drawAvatar() { const g = document.getElementById('avatar').getContext('2d'); HV.use(g); HV.farmer(2, 1, 0, false, { shirt: '#c4553b', pants: '#3f6fa8' }, 'front'); }

// ---------- HUD content
const COMMOD = [
  { k: 'Wheat', u: '/bu', p: 5.48, crop: 'wheat' }, { k: 'Corn', u: '/bu', p: 4.27, crop: 'corn' }, { k: 'Soybeans', u: '/bu', p: 10.36, crop: 'soy' },
  { k: 'Coffee', u: '/lb', p: 2.61, crop: 'coffee' }, { k: 'Cocoa', u: '/t', p: 6840, crop: 'cocoa' },
];
function buildBoard() {
  const rows = document.getElementById('rows');
  COMMOD.forEach((c, i) => {
    let v = 100; const s = []; for (let k = 0; k < 28; k++) { v += (HV.hash(k, i, 31) - .48) * 3.2; s.push(v); }
    const ch = (s[27] - s[20]) / s[20] * 100;
    const el = document.createElement('div'); el.className = 'crow';
    el.innerHTML = `<canvas class="ci" width="14" height="14"></canvas><div class="nm">${c.k}<small>sim ${c.p >= 1000 ? c.p.toLocaleString() : '$' + c.p.toFixed(2)}${c.u}</small></div><canvas class="sp" width="56" height="18"></canvas><div class="ch ${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(1)}%</div>`;
    rows.appendChild(el);
    const ci = el.querySelector('.ci').getContext('2d'); HV.use(ci); HV.crop(c.crop, 3, 7, 14);
    const sp = el.querySelector('.sp').getContext('2d'); const mn = Math.min(...s), mx = Math.max(...s);
    sp.fillStyle = ch >= 0 ? 'rgba(47,138,58,.15)' : 'rgba(194,59,47,.15)';
    let py = null;
    s.forEach((val, k) => { const x = k * 2, y = Math.round(16 - (val - mn) / (mx - mn || 1) * 14); sp.fillRect(x, y, 2, 18 - y); sp.fillStyle = ch >= 0 ? '#2f8a3a' : '#c23b2f'; if (py !== null) sp.fillRect(x, Math.min(py, y), 1, Math.abs(py - y) + 1); sp.fillRect(x, y, 2, 1); sp.fillStyle = ch >= 0 ? 'rgba(47,138,58,.15)' : 'rgba(194,59,47,.15)'; py = y; });
  });
  document.getElementById('forecast').innerHTML = [['Today', 'sun', '24°'], ['Tue', 'cloud', '21°'], ['Wed', 'rain', '18°'], ['Thu', 'sun', '25°']].map(([d, i, t]) => `<div>${d}<span class="ic" data-i="${i}"></span><b>${t}</b></div>`).join('');
  const tools = [['seed', 'Plant'], ['water', 'Water'], ['harvest', 'Harvest'], ['build', 'Build'], ['upgrade', 'Upgrade'], ['bag', 'Inventory']];
  const tb = document.getElementById('tools');
  tb.innerHTML = tools.map(([i, l], k) => `<button class="tool${k === 0 ? ' on' : ''}" data-k="${k}"><kbd>${k + 1}</kbd><span class="ic" data-i="${i}"></span><span class="l">${l}</span></button>`).join('');
  tb.addEventListener('click', e => { const b = e.target.closest('.tool'); if (!b) return; tb.querySelectorAll('.tool').forEach(x => x.classList.toggle('on', x === b)); });
  document.getElementById('left').addEventListener('click', e => { const b = e.target.closest('.nav'); if (!b) return; document.querySelectorAll('.nav').forEach(x => x.classList.toggle('on', x === b)); });
  addEventListener('keydown', e => { const n = +e.key; if (n >= 1 && n <= 6) tb.querySelectorAll('.tool').forEach((x, k) => x.classList.toggle('on', k === n - 1)); });
}

// ---------- world view + camera
const cv = document.getElementById('world'), ctx = cv.getContext('2d');
const W = HV.WORLD;
const cam = { x: 0, y: 0, ds: 3 };
let dpr = 1, cw = 0, ch = 0, world, hover = null;
function resize() {
  dpr = window.devicePixelRatio || 1; cw = Math.round(innerWidth * dpr); ch = Math.round(innerHeight * dpr);
  cv.width = cw; cv.height = ch; ctx.imageSmoothingEnabled = false;
  clamp();
}
const minDs = () => Math.max(1, Math.ceil(Math.max(cw / W.w, ch / W.h)));
function clamp() {
  cam.ds = Math.max(minDs(), Math.min(8 * Math.ceil(dpr), cam.ds));
  const vw = cw / cam.ds, vh = ch / cam.ds;
  cam.x = Math.max(0, Math.min(W.w - vw, cam.x)); cam.y = Math.max(0, Math.min(W.h - vh, cam.y));
}
const toWorld = (sx, sy) => [cam.x + sx * dpr / cam.ds, cam.y + sy * dpr / cam.ds];
const toScreen = (wx, wy) => [(wx - cam.x) * cam.ds / dpr, (wy - cam.y) * cam.ds / dpr];
function zoomAt(sx, sy, nd) {
  const [wx, wy] = toWorld(sx, sy); const old = cam.ds; cam.ds = nd; clamp();
  if (cam.ds === old) return;
  cam.x = wx - sx * dpr / cam.ds; cam.y = wy - sy * dpr / cam.ds; clamp();
}
let drag = null;
cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: 0 }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => {
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
    if (drag.moved > 4) { cv.classList.add('drag'); cam.x = drag.cx - dx * dpr / cam.ds; cam.y = drag.cy - dy * dpr / cam.ds; clamp(); }
  }
  const [wx, wy] = toWorld(e.clientX, e.clientY);
  hover = pick(wx, wy);
  const tip = document.getElementById('hoverTip');
  if (hover && !(drag && drag.moved > 4)) { tip.hidden = false; tip.innerHTML = `${hover.name}<small>${hover.zone}</small>`; tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 14) + 'px'; }
  else tip.hidden = true;
});
cv.addEventListener('pointerup', e => {
  cv.classList.remove('drag');
  if (drag && drag.moved <= 4) { const [wx, wy] = toWorld(e.clientX, e.clientY); const h = pick(wx, wy); showCard(h, e.clientX, e.clientY); }
  drag = null;
});
cv.addEventListener('pointerleave', () => { hover = null; document.getElementById('hoverTip').hidden = true; });
cv.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, cam.ds + (e.deltaY < 0 ? 1 : -1)); }, { passive: false });
addEventListener('keydown', e => {
  const s = 24 * dpr / cam.ds * 3;
  if (e.key === '+' || e.key === '=') zoomAt(innerWidth / 2, innerHeight / 2, cam.ds + 1);
  else if (e.key === '-' || e.key === '_') zoomAt(innerWidth / 2, innerHeight / 2, cam.ds - 1);
  else if (['ArrowLeft', 'a'].includes(e.key)) cam.x -= s; else if (['ArrowRight', 'd'].includes(e.key)) cam.x += s;
  else if (['ArrowUp', 'w'].includes(e.key)) cam.y -= s; else if (['ArrowDown', 's'].includes(e.key)) cam.y += s;
  else if (e.key === 'Escape') document.getElementById('card').hidden = true;
  clamp();
});
function pick(wx, wy) {
  let best = null;
  for (const h of world.hot) if (wx >= h.x && wx < h.x + h.w && wy >= h.y - 4 && wy < h.y + h.h) if (!best || h.w * h.h < best.w * best.h) best = h;
  return best;
}
function showCard(h, sx, sy) {
  const card = document.getElementById('card');
  if (!h) { card.hidden = true; return; }
  card.innerHTML = `<button class="x" aria-label="Close">×</button><div class="z">${h.zone}</div><h3>${h.name}</h3><p>${h.play}</p><span class="stg">Playable from Stage ${h.stage}</span>`;
  card.hidden = false;
  const r = card.getBoundingClientRect();
  card.style.left = Math.min(innerWidth - r.width - 10, Math.max(10, sx + 16)) + 'px';
  card.style.top = Math.min(innerHeight - r.height - 10, Math.max(10, sy - 20)) + 'px';
  card.querySelector('.x').onclick = () => card.hidden = true;
}

// ---------- labels & minimap
const labelEls = [];
function buildLabels() {
  const box = document.getElementById('labels');
  for (const [t, x, y] of world.labels) { const el = document.createElement('div'); el.className = 'zl'; el.textContent = t; box.appendChild(el); labelEls.push([el, x, y]); }
}
const mini = document.getElementById('minimap'), mg = mini.getContext('2d');
mini.addEventListener('click', e => { const r = mini.getBoundingClientRect(); const wx = (e.clientX - r.left) / r.width * W.w, wy = (e.clientY - r.top) / r.height * W.h; cam.x = wx - cw / cam.ds / 2; cam.y = wy - ch / cam.ds / 2; clamp(); });

function loop(ts) {
  const t = ts / 1000;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#1d3a1f'; ctx.fillRect(0, 0, cw, ch);
  ctx.setTransform(cam.ds, 0, 0, cam.ds, -Math.round(cam.x * cam.ds), -Math.round(cam.y * cam.ds));
  ctx.imageSmoothingEnabled = false;
  HV.drawWorld(ctx, t);
  if (hover) {
    const p = Math.floor(t * 8) % 4, { x, y, w, h } = hover;
    HV.use(ctx);
    for (let k = -p; k < w + 4; k += 4) { HV.R(x - 2 + k, y - 6, 2, 1, '#fff3b0'); HV.R(x - 2 + w + 2 - k, y + h + 1, 2, 1, '#fff3b0'); }
    for (let k = -p; k < h + 8; k += 4) { HV.R(x - 2, y - 6 + h + 6 - k, 1, 2, '#fff3b0'); HV.R(x + w + 1, y - 6 + k, 1, 2, '#fff3b0'); }
  }
  for (const [el, x, y] of labelEls) { const [sx, sy] = toScreen(x, y); el.style.left = sx + 'px'; el.style.top = sy + 'px'; }
  mg.imageSmoothingEnabled = true; mg.drawImage(world.base, 0, 0, 192, 120);
  mg.strokeStyle = '#fff3b0'; mg.lineWidth = 2;
  mg.strokeRect(cam.x / W.w * 192, cam.y / W.h * 120, cw / cam.ds / W.w * 192, ch / cam.ds / W.h * 120);
  requestAnimationFrame(loop);
}

async function start() {
  try { await document.fonts.load('700 21px "Pixelify Sans"'); } catch (e) { /* fall back to system font */ }
  world = HV.buildWorld();
  resize(); addEventListener('resize', resize);
  cam.ds = Math.max(minDs(), Math.round(2 * dpr)); cam.x = 120; cam.y = 40; clamp();
  drawAvatar(); buildBoard(); buildLabels(); paintIcons(document);
  document.getElementById('openSheet').onclick = () => { HV.buildSheet && HV.buildSheet(); document.getElementById('sheet').hidden = false; };
  document.getElementById('closeSheet').onclick = () => { document.getElementById('sheet').hidden = true; };
  HV.cam = cam; HV.clampCam = clamp;
  requestAnimationFrame(loop);
}
start();
})();
