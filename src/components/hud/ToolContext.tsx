'use client';
// Farm controls: the strip above the toolbar shows options for the active tool.
import { ITEM } from '@/game/data/items';
import { CROP_RULES, canCapacity } from '@/game/sim/rules';
import type { CropType } from '@/game/world/geometry';
import { useGame } from '@/store/game';
import { Bar, ItemIcon } from '@/components/ui/kit';

const SEEDS = (Object.keys(CROP_RULES) as CropType[]).map(c => `seed-${c}`);

export function ToolContext() {
  const tool = useGame(s => s.tool), seed = useGame(s => s.seed), setSeed = useGame(s => s.setSeed), open = useGame(s => s.openPanel), farm = useGame(s => s.farm);
  if (!farm) return null;
  let body: React.ReactNode = null;
  if (tool === 'plant') body = (
    <>
      <b className="mr-1 text-sm text-gold">Seed</b>
      {SEEDS.map(id => {
        const crop = id.slice(5) as CropType, qty = farm.inventory[id] ?? 0, locked = CROP_RULES[crop].level > farm.level;
        return (
          <button key={id} onClick={() => setSeed(id)} title={locked ? `${ITEM[id].name} — unlocks at level ${CROP_RULES[crop].level}` : `${ITEM[id].name} (${qty})`} aria-pressed={seed === id}
            className={`relative grid size-9 place-items-center border-2 ${seed === id ? 'border-gold bg-[#fff0b8]' : 'border-wood-d bg-parch hover:bg-parch-l'} ${locked || !qty ? 'opacity-45' : ''}`}>
            <ItemIcon item={ITEM[id]} size={28} />
            <span className="absolute right-0 bottom-0 text-[10px] font-bold text-ink">{locked ? `L${CROP_RULES[crop].level}` : qty}</span>
          </button>
        );
      })}
      <span className="text-xs text-parch-l">{farm.machines['mach-planter'] ? 'Planter: fills the whole field' : 'Plants one spot per click'}</span>
      <button className="btn-wood !py-0.5 text-xs" onClick={() => open('shop', 'seeds')}>Buy seeds</button>
    </>
  );
  else if (tool === 'water') {
    const cap = canCapacity(farm.machines['mach-can'] ?? 1);
    body = <><b className="text-sm text-gold">Watering can</b><Bar value={farm.can / cap} color="#55a9e4" className="w-28" /><span className="text-xs text-parch-l">{farm.can} / {cap} · waters a row · refill at the well or pond</span></>;
  } else if (tool === 'harvest') {
    const ready = farm.plots.filter(p => p.unlocked && p.cells.some(c => c.crop && c.growth >= 1)).length;
    body = <><b className="text-sm text-gold">Harvest</b><span className="text-xs text-parch-l">{ready} field{ready === 1 ? '' : 's'} with ripe crops · {farm.machines['mach-harvester'] ? 'harvester takes the whole field' : 'sickle takes a row'}</span></>;
  } else if (tool === 'build') body = (
    <><b className="text-sm text-gold">Build</b><span className="text-xs text-parch-l">Buildings add animal space and storage</span><button className="btn-wood !py-0.5 text-xs" onClick={() => open('shop', 'buildings')}>Buildings</button><button className="btn-wood !py-0.5 text-xs" onClick={() => open('shop', 'land')}>Land</button></>
  );
  else if (tool === 'upgrade') body = (
    <><b className="text-sm text-gold">Upgrade</b><span className="text-xs text-parch-l">Level up machines with Farm Coins</span><button className="btn-wood !py-0.5 text-xs" onClick={() => open('equipment')}>Equipment</button></>
  );
  if (!body) return null;
  return (
    <div className="panel-dark pointer-events-auto absolute bottom-[96px] left-1/2 flex max-w-[calc(100vw-20px)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 px-2.5 py-1.5">
      {body}
    </div>
  );
}
