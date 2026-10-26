'use client';
// Details and actions for whatever is selected in the world, from live farm state.
import type { ReactNode } from 'react';
import { CROP_NAMES, STAGE_NAMES, TILE } from '@/game/world/geometry';
import { ITEM } from '@/game/data/items';
import { ANIMAL_RULES, CROP_RULES } from '@/game/sim/rules';
import { cellsOf, collect, feed, harvest, improveField, isPumped, isWet, plant, refill, secondsToReady, stageOf, water } from '@/game/sim/engine';
import type { FarmState } from '@/game/sim/state';
import { useGame, type PanelId, type Selection } from '@/store/game';
import { Bar } from '@/components/ui/kit';

const PRODUCT_NAME = { cow: 'Milk', sheep: 'Wool', pig: 'Truffles', chicken: 'Eggs', duck: 'Feathers' } as const;
const BUILDABLE = new Set(['Meadow']);

// Which window a selected building opens.
const LINKS: Record<string, [string, PanelId, string?]> = {
  house: ['Farmer profile', 'profile'], seedcrates: ['Seeds', 'inventory', 'seeds'],
  trading: ['Open shop', 'shop', 'seeds'], market: ['Player listings', 'shop', 'listings'], exchange: ['Open exchange', 'exchange'],
  vault: ['Wallet & vault', 'wallet'], board: ['Delivery contracts', 'contracts'], storage: ['Produce storage', 'inventory', 'storage'],
  shed: ['Equipment', 'equipment'], harvester: ['Equipment', 'equipment'], pump: ['Equipment', 'equipment'],
  barn: ['Livestock', 'livestock', 'cow'], pasture: ['Livestock', 'livestock', 'cow'], sheeppen: ['Livestock', 'livestock', 'sheep'],
  coop: ['Livestock', 'livestock', 'chicken'], pigshed: ['Livestock', 'livestock', 'pig'], feed: ['Feed', 'inventory', 'supplies'],
  silo1: ['Inventory', 'inventory', 'crops'], silo2: ['Inventory', 'inventory', 'crops'], warehouse: ['Produce storage', 'inventory', 'storage'],
  greenhouse: ['Buildings', 'shop', 'buildings'], mill: ['Grain mill', 'processing', 'mill'], windmill: ['Grain mill', 'processing', 'mill'], dairy: ['Dairy', 'processing', 'dairy'], factory: ['Food processing', 'processing', 'factory'],
  hq: ['Cooperatives', 'coop'], cmk1: ['Cooperatives', 'coop'], cmk2: ['Cooperatives', 'coop'], sharedmill: ['Cooperatives', 'coop'],
  tower: ['Leaderboard', 'competitions'], arena: ['Competitions', 'competitions'],
};

export const fmtSecs = (s: number) => !isFinite(s) ? 'paused — soil is dry' : s <= 0 ? 'ready' : s < 60 ? `${Math.ceil(s)}s` : `${Math.floor(s / 60)}m ${Math.ceil(s % 60)}s`;

function Row({ k, children }: { k: string; children: ReactNode }) {
  return <><dt className="text-muted">{k}</dt><dd className="m-0 font-semibold">{children}</dd></>;
}

function FieldImprovements({ farm, plot }: { farm: FarmState; plot: number }) {
  const act = useGame(s => s.act);
  const p = farm.plots[plot];
  const items = (['land-fertile', 'land-irrigation'] as const).filter(id => (farm.inventory[id] ?? 0) > 0 && !(id === 'land-fertile' ? p.fertile : p.irrigated));
  if (!items.length) return null;
  return <>{items.map(id => <button key={id} className="btn-wood !px-2 !py-0.5 text-xs" onClick={() => act({ type: 'improve', item: id, plot: plot })}>Use {ITEM[id].name.toLowerCase()}</button>)}</>;
}

export function Inspector() {
  const sel = useGame(s => s.selected), select = useGame(s => s.select), open = useGame(s => s.openPanel);
  const farm = useGame(s => s.farm), act = useGame(s => s.act), seed = useGame(s => s.seed), env = useGame(s => s.env);
  if (!sel) return null;
  const c = { weather: env.weather, season: env.season }, now = Date.now();
  let zone = '', title = '', text = '', stage = 0;
  let rows: ReactNode = null, bar: ReactNode = null, actions: ReactNode = null;

  if (sel.type === 'cell' && farm) {
    const ce = farm.plots[sel.plot].cells[sel.cell], wet = isWet(farm, sel.plot, sel.cell, now, c);
    const p = farm.plots[sel.plot];
    zone = sel.hot.name; title = ce.crop ? CROP_NAMES[ce.crop] : 'Empty soil'; stage = 5;
    const why = c.weather === 'rainy' || c.weather === 'stormy' ? 'rain' : p.irrigated ? 'irrigated' : isPumped(farm, sel.plot) ? 'pump' : wet ? 'watered' : '';
    rows = (
      <dl className="my-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {ce.crop && <Row k="Stage">{STAGE_NAMES[stageOf(ce.growth)]}</Row>}
        {ce.crop && <Row k="Ready in">{fmtSecs(secondsToReady(farm, sel.plot, sel.cell, now, c))}</Row>}
        <Row k="Soil">{wet ? `Wet (${why})` : 'Dry — needs water'}{p.fertile ? ' · fertile' : ''}</Row>
        {ce.crop && <Row k="Yield">{CROP_RULES[ce.crop].yield + (p.fertile ? 1 : 0)} per plant</Row>}
      </dl>
    );
    if (ce.crop) bar = <Bar value={ce.growth} className="mb-2" color={ce.growth >= 1 ? '#e8b93c' : '#7cc24c'} />;
    text = ce.crop ? (ce.growth >= 1 ? 'Ripe! Harvest it with the harvest tool or the button below.' : 'Growing. Keep the soil wet so it keeps growing.') : 'Ready for planting. Pick a seed with the Plant tool.';
    actions = <>
      {!ce.crop && <button className="btn-gold !px-2 !py-0.5 text-sm" onClick={() => act({ type: 'plant', plot: sel.plot, cell: sel.cell, seed: seed })}>Plant {ITEM[seed]?.name.replace(' seeds', '').toLowerCase()}</button>}
      {ce.crop && ce.growth >= 1 && <button className="btn-gold !px-2 !py-0.5 text-sm" onClick={() => act({ type: 'harvest', plot: sel.plot, cell: sel.cell })}>Harvest</button>}
      {(!ce.crop || ce.growth < 1) && <button className="btn-wood !px-2 !py-0.5 text-sm" onClick={() => act({ type: 'water', plot: sel.plot, cell: sel.cell })}>Water row ({farm.can})</button>}
      <FieldImprovements farm={farm} plot={sel.plot} />
    </>;
  } else if (sel.type === 'hotspot' && sel.hot.kind === 'plot' && farm && sel.hot.plot !== undefined) {
    const plot = sel.hot.plot, p = farm.plots[plot];
    zone = 'Main Farm'; title = sel.hot.name; stage = 5;
    if (!p.unlocked) {
      text = 'Locked land. Buy an expansion plot in the Land shop to farm it.';
      actions = <button className="btn-gold !px-2 !py-0.5 text-sm" onClick={() => open('shop', 'land')}>Buy land</button>;
    } else {
      const planted = p.cells.filter(x => x.crop).length, ready = p.cells.filter(x => x.crop && x.growth >= 1).length;
      rows = <dl className="my-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5"><Row k="Planted">{planted} / {cellsOf(plot).length}</Row><Row k="Ripe">{ready}</Row><Row k="Extras">{[p.fertile && 'fertile', p.irrigated && 'irrigated', isPumped(farm, plot) && 'pump-watered'].filter(Boolean).join(', ') || 'none'}</Row></dl>;
      text = 'Click a planting spot with a tool to plant, water or harvest.';
      actions = <><button className="btn-wood !px-2 !py-0.5 text-sm" onClick={() => open('exchange', p.cells.find(x => x.crop)?.crop ?? 'wheat')}>Market prices</button><FieldImprovements farm={farm} plot={plot} /></>;
    }
  } else if (sel.type === 'animal' && sel.kind !== 'duck' && farm) {
    const a = farm.animals.find(x => x.id === sel.id);
    if (a) {
      const rule = ANIMAL_RULES[a.kind], fed = a.fedUntil > now;
      zone = sel.zone; title = `${a.name} the ${a.kind}`; stage = 5;
      rows = <dl className="my-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5"><Row k="Health">{Math.round(a.health * 100)}%</Row><Row k="Fed">{fed ? `for ${fmtSecs((a.fedUntil - now) / 1000)}` : 'Hungry'}</Row><Row k={PRODUCT_NAME[a.kind]}>{a.ready ? 'Ready to collect' : fed ? `in ${fmtSecs(rule.cycle - a.progress)}` : 'paused until fed'}</Row></dl>;
      bar = <Bar value={a.progress / rule.cycle} className="mb-2" color="#e8b93c" />;
      text = fed ? 'Producing while fed.' : `Feed it ${ITEM[rule.feed].name.toLowerCase()} to restart production (you have ${farm.inventory[rule.feed] ?? 0}).`;
      actions = <>
        {a.ready && <button className="btn-gold !px-2 !py-0.5 text-sm" onClick={() => act({ type: 'collect', animal: a.id })}>Collect {PRODUCT_NAME[a.kind].toLowerCase()}</button>}
        <button className="btn-wood !px-2 !py-0.5 text-sm" onClick={() => act({ type: 'feed', animal: a.id })}>Feed</button>
        <button className="btn-wood !px-2 !py-0.5 text-sm" onClick={() => open('livestock', a.kind)}>Herd</button>
      </>;
    }
  } else if (sel.type === 'hotspot') {
    zone = sel.hot.zone; title = sel.hot.name; text = sel.hot.play; stage = sel.hot.stage;
    if ((sel.hot.id === 'well' || sel.hot.id === 'pond') && farm) actions = <button className="btn-gold !px-2 !py-0.5 text-sm" onClick={() => act({ type: 'refill' })}>Refill watering can ({farm.can})</button>;
    const link = LINKS[sel.hot.id];
    if (link) actions = <>{actions}<button className="btn-gold !px-2 !py-0.5 text-sm" onClick={() => open(link[1], link[2])}>{link[0]}</button></>;
  } else if (sel.type === 'animal') {
    zone = sel.zone; title = 'Duck'; text = 'Wild ducks enjoy the pond. They are not part of your herd.'; stage = 3;
  } else if (sel.type === 'farmer') {
    zone = 'Village'; title = 'Neighbour farmer'; text = 'Other players will walk the roads; visiting their farms arrives with multiplayer.'; stage = 10;
  } else if (sel.type === 'tile') {
    zone = 'Terrain'; title = sel.terrain; stage = 5;
    rows = <dl className="my-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5"><Row k="Tile">{sel.tile[0]}, {sel.tile[1]}</Row><Row k="Grid">{TILE} × {TILE}</Row><Row k="Buildable">{BUILDABLE.has(sel.terrain) ? 'Yes' : 'No'}</Row></dl>;
    text = 'Press G to show the terrain grid.';
  }
  if (!title) return null;

  return (
    <section className="panel pointer-events-auto absolute right-2.5 bottom-[118px] w-[min(290px,calc(100vw-20px))] px-3.5 py-3 text-sm lg:bottom-auto lg:top-[440px]" aria-live="polite">
      <button className="absolute top-1.5 right-2 text-lg font-bold" aria-label="Close" onClick={() => select(null)}>×</button>
      <div className="text-xs tracking-wide text-muted uppercase">{zone}</div>
      <h3 className="m-0 text-[19px] font-bold">{title}</h3>
      {rows}
      {bar}
      <p className="my-1.5 leading-snug">{text}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {actions}
        {stage > 7 && <span className="inline-block border-2 border-[#2a5f61] bg-teal px-1.5 py-0.5 text-xs text-white">Playable from Stage {stage}</span>}
      </div>
    </section>
  );
}
