'use client';
import { CROP_NAMES, STAGE_NAMES, TILE } from '@/game/world/geometry';
import { useGame, type PanelId, type Selection } from '@/store/game';

const PRODUCT = { cow: 'Milk', sheep: 'Wool', pig: 'Truffles', chicken: 'Eggs', duck: 'Feathers' } as const;
const BUILDABLE = new Set(['Meadow']);

function body(sel: Selection, tool: string): { zone: string; title: string; rows: [string, string][]; text: string; stage: number } {
  switch (sel.type) {
    case 'hotspot':
      return { zone: sel.hot.zone, title: sel.hot.name, rows: [], text: sel.hot.play, stage: sel.hot.stage };
    case 'cell': {
      const crop = sel.crop ? CROP_NAMES[sel.crop] : 'Empty';
      return {
        zone: sel.hot.zone, title: sel.hot.name,
        rows: [['Crop', crop], ['Growth', sel.crop ? STAGE_NAMES[sel.cropStage] : 'Ready to plant'], ['Cell', `Row ${sel.row + 1}, column ${sel.col + 1}`], ['World tile', `${sel.tile[0]}, ${sel.tile[1]}`]],
        text: tool === 'plant' || tool === 'water' || tool === 'harvest'
          ? `${tool[0].toUpperCase() + tool.slice(1)} tool selected — the action itself arrives with core gameplay.`
          : 'Each planting cell becomes a server-tracked crop slot.',
        stage: 5,
      };
    }
    case 'animal':
      return { zone: 'Livestock Ranch', title: sel.kind[0].toUpperCase() + sel.kind.slice(1), rows: [['Home', sel.zone], ['Produces', PRODUCT[sel.kind]], ['Health', 'Good (demo)']], text: 'Feeding, health and production timers arrive with core gameplay.', stage: 5 };
    case 'farmer':
      return { zone: 'Village', title: 'Neighbour farmer', rows: [], text: 'Other players will walk the roads; visiting their farms arrives with multiplayer.', stage: 10 };
    case 'tile':
      return { zone: 'Terrain', title: sel.terrain, rows: [['Tile', `${sel.tile[0]}, ${sel.tile[1]}`], ['Grid', `${TILE} × ${TILE}`], ['Buildable', BUILDABLE.has(sel.terrain) ? 'Yes' : 'No']], text: 'Press G to show the terrain grid used for building placement.', stage: 5 };
  }
}

// Which window a selected world object opens.
const ACTIONS: Record<string, [string, PanelId, string?]> = {
  house: ['Farmer profile', 'profile'], seedcrates: ['Seeds', 'inventory', 'seeds'], well: ['Equipment', 'equipment'],
  trading: ['Open shop', 'shop', 'seeds'], market: ['Player listings', 'shop', 'listings'], exchange: ['Open exchange', 'exchange'],
  vault: ['Wallet & vault', 'wallet'], board: ['Farm tasks', 'farm'], storage: ['Inventory', 'inventory'],
  shed: ['Equipment', 'equipment'], harvester: ['Equipment', 'equipment'], pump: ['Equipment', 'equipment'],
  barn: ['Livestock', 'livestock', 'cow'], pasture: ['Livestock', 'livestock', 'cow'], sheeppen: ['Livestock', 'livestock', 'sheep'],
  coop: ['Livestock', 'livestock', 'chicken'], pigshed: ['Livestock', 'livestock', 'pig'], feed: ['Feed', 'inventory', 'supplies'],
  silo1: ['Inventory', 'inventory', 'crops'], silo2: ['Inventory', 'inventory', 'crops'], warehouse: ['Inventory', 'inventory'],
  greenhouse: ['Buildings', 'shop', 'buildings'], mill: ['Inventory', 'inventory', 'goods'], dairy: ['Inventory', 'inventory', 'goods'], factory: ['Inventory', 'inventory', 'goods'],
  hq: ['Cooperatives', 'coop'], cmk1: ['Cooperatives', 'coop'], cmk2: ['Cooperatives', 'coop'], sharedmill: ['Cooperatives', 'coop'],
  tower: ['Leaderboard', 'competitions'], arena: ['Competitions', 'competitions'],
};
function actionFor(sel: Selection): [string, PanelId, string?] | null {
  if (sel.type === 'animal') return sel.kind === 'duck' ? null : ['Livestock', 'livestock', sel.kind];
  if (sel.type === 'cell') return ['Seeds', 'inventory', 'seeds'];
  if (sel.type === 'hotspot') {
    if (sel.hot.kind === 'plot') return sel.hot.crop ? ['Sell at exchange', 'exchange', sel.hot.crop] : ['Buy land', 'shop', 'land'];
    return ACTIONS[sel.hot.id] ?? null;
  }
  return null;
}

export function Inspector() {
  const sel = useGame(s => s.selected), tool = useGame(s => s.tool), select = useGame(s => s.select), open = useGame(s => s.openPanel);
  if (!sel) return null;
  const b = body(sel, tool);
  return (
    <section className="panel pointer-events-auto absolute right-2.5 bottom-[118px] w-[min(290px,calc(100vw-20px))] px-3.5 py-3 text-sm lg:bottom-auto lg:top-[440px]" aria-live="polite">
      <button className="absolute top-1.5 right-2 text-lg font-bold" aria-label="Close" onClick={() => select(null)}>×</button>
      <div className="text-xs tracking-wide text-muted uppercase">{b.zone}</div>
      <h3 className="m-0 text-[19px] font-bold">{b.title}</h3>
      {b.rows.length > 0 && (
        <dl className="my-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          {b.rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="m-0 font-semibold">{v}</dd></div>)}
        </dl>
      )}
      {sel.type === 'cell' && sel.crop && (
        <div className="mb-2 h-3 border-2 border-wood-d bg-[#6b4a2e]"><i className="xp-fill block h-full" style={{ width: `${(sel.cropStage / 3) * 100}%` }} /></div>
      )}
      <p className="my-2 leading-snug">{b.text}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-block border-2 border-[#2a5f61] bg-teal px-1.5 py-0.5 text-xs text-white">Playable from Stage {b.stage}</span>
        {(() => { const a = actionFor(sel); return a && <button className="btn-gold ml-auto !px-2 !py-0.5 text-sm" onClick={() => open(a[1], a[2])}>{a[0]}</button>; })()}
      </div>
    </section>
  );
}
