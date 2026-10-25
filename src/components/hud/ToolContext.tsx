'use client';
// Farm controls: the strip above the toolbar shows options for the active tool.
import { ITEM } from '@/game/data/items';
import { INVENTORY, MACHINES } from '@/game/data/demo';
import { PLOTS } from '@/game/world/geometry';
import { useGame } from '@/store/game';
import { Bar, ItemIcon } from '@/components/ui/kit';

const SEEDS = INVENTORY.filter(r => r.id.startsWith('seed-'));
const READY = PLOTS.filter(p => p.crop && p.stage === 3 && p.kind !== 'watered').length;
const CAN = MACHINES.find(m => m.item === 'mach-can')!;

export function ToolContext() {
  const tool = useGame(s => s.tool), seed = useGame(s => s.seed), setSeed = useGame(s => s.setSeed), open = useGame(s => s.openPanel);
  let body: React.ReactNode = null;
  if (tool === 'plant') body = (
    <>
      <b className="mr-1 text-sm text-gold">Seed</b>
      {SEEDS.map(r => (
        <button key={r.id} onClick={() => setSeed(r.id)} title={ITEM[r.id].name} aria-pressed={seed === r.id}
          className={`relative grid size-9 place-items-center border-2 ${seed === r.id ? 'border-gold bg-[#fff0b8]' : 'border-wood-d bg-parch hover:bg-parch-l'}`}>
          <ItemIcon item={ITEM[r.id]} size={28} /><span className="absolute right-0 bottom-0 text-[10px] font-bold text-ink">{r.qty}</span>
        </button>
      ))}
      <button className="btn-wood ml-1 !py-0.5 text-xs" onClick={() => open('shop', 'seeds')}>Buy seeds</button>
    </>
  );
  else if (tool === 'water') body = (
    <><b className="text-sm text-gold">Watering can</b><Bar value={.8} color="#55a9e4" className="w-28" /><span className="text-xs text-parch-l">8 / 10 · refill at the well or pond</span><span className="text-xs text-parch-d">Lv {CAN.level}</span></>
  );
  else if (tool === 'harvest') body = (
    <><b className="text-sm text-gold">Harvest</b><span className="text-xs text-parch-l">{READY} fields ready · click a ripe field to harvest</span></>
  );
  else if (tool === 'build') body = (
    <><b className="text-sm text-gold">Build</b><span className="text-xs text-parch-l">Place buildings on free meadow tiles (G shows the grid)</span><button className="btn-wood !py-0.5 text-xs" onClick={() => open('shop', 'buildings')}>Buildings</button></>
  );
  else if (tool === 'upgrade') body = (
    <><b className="text-sm text-gold">Upgrade</b><span className="text-xs text-parch-l">Click a machine or building to upgrade it</span><button className="btn-wood !py-0.5 text-xs" onClick={() => open('equipment')}>Equipment</button><button className="btn-wood !py-0.5 text-xs" onClick={() => open('shop', 'land')}>Land</button></>
  );
  if (!body) return null;
  return (
    <div className="panel-dark pointer-events-auto absolute bottom-[96px] left-1/2 flex max-w-[calc(100vw-20px)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 px-2.5 py-1.5">
      {body}
      <span className="ml-1 border-l border-wood-l pl-2 text-[10px] text-parch-d">Actions: Stage 5</span>
    </div>
  );
}
