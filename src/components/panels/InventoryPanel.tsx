'use client';
import { useState } from 'react';
import { ITEM, type ItemCategory } from '@/game/data/items';
import { fmtHrv, toHrv } from '@/game/data/economy';
import { SELLABLE, coinPrice, feedAll, sell, storageCapacity, storageUsed } from '@/game/sim/engine';
import { CROP_RULES } from '@/game/sim/rules';
import type { CropType } from '@/game/world/geometry';
import { useGame } from '@/store/game';
import { Bar, Card, ItemIcon, Window } from '@/components/ui/kit';

const TABS: { key: string; label: string; cats: ItemCategory[] }[] = [
  { key: 'all', label: 'All', cats: [] },
  { key: 'crops', label: 'Crops', cats: ['crops'] },
  { key: 'seeds', label: 'Seeds', cats: ['seeds'] },
  { key: 'products', label: 'Animal products', cats: ['products'] },
  { key: 'goods', label: 'Goods', cats: ['goods'] },
  { key: 'supplies', label: 'Feed & land', cats: ['feed', 'land'] },
];

export function InventoryPanel({ tab = 'all' }: { tab?: string }) {
  const close = useGame(s => s.closePanel), open = useGame(s => s.openPanel), farm = useGame(s => s.farm), act = useGame(s => s.act);
  const setTool = useGame(s => s.setTool), setSeed = useGame(s => s.setSeed);
  const [pick, setPick] = useState<string | null>(null);
  if (!farm) return null;
  const cats = TABS.find(t => t.key === tab)?.cats ?? [];
  const rows = Object.entries(farm.inventory).filter(([id, q]) => q > 0 && ITEM[id] && (!cats.length || cats.includes(ITEM[id].category)))
    .sort(([a], [b]) => ITEM[a].category.localeCompare(ITEM[b].category) || ITEM[a].name.localeCompare(ITEM[b].name));
  const selId = rows.find(([id]) => id === pick)?.[0] ?? rows[0]?.[0];
  const item = selId ? ITEM[selId] : null, qty = selId ? farm.inventory[selId] : 0;
  const used = storageUsed(farm), cap = storageCapacity(farm);
  const slots = Array.from({ length: Math.max(24, Math.ceil(rows.length / 8) * 8) }, (_, i) => rows[i]);
  const sellable = item && SELLABLE.includes(item.category);

  return (
    <Window title="Inventory" icon="bag" tabs={TABS} tab={tab} onTab={k => { setPick(null); open('inventory', k); }} onClose={close}
      footer={<>Your farm is saved in this browser until accounts arrive (Stage 6). Selling here uses the general store&apos;s fixed price; the commodity exchange opens in Stage 7.</>}>
      <div className="grid gap-3 md:grid-cols-[1fr_260px]">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm">
            <b>Storage</b><Bar value={used / cap} className="w-40" color={used / cap > .9 ? '#c23b2f' : used / cap > .75 ? '#e8a33a' : '#7cc24c'} /><span className="text-muted">{used} / {cap}</span>
            <span className="ml-3"><b>{farm.coins.toLocaleString('en-US')}</b> coins</span>
            <button className="ml-auto text-xs text-muted underline" onClick={() => open('shop', 'machinery')}>More storage</button>
          </div>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
            {slots.map((r, i) => r ? (
              <button key={r[0]} onClick={() => setPick(r[0])} title={ITEM[r[0]].name}
                className={`relative grid aspect-square place-items-center border-2 ${selId === r[0] ? 'border-gold bg-[#fff0b8] shadow-[0_0_0_2px_#f2c94c]' : 'border-wood bg-[#e9d29c] hover:bg-parch-l'}`}>
                <ItemIcon item={ITEM[r[0]]} size={32} />
                <span className="absolute right-0.5 bottom-0 text-[11px] font-bold text-ink [text-shadow:0_0_2px_#fff4d6]">{r[1]}</span>
              </button>
            ) : <div key={`e${i}`} className="aspect-square border-2 border-dashed border-parch-d bg-[#efdcae]" />)}
          </div>
          {!rows.length && <p className="text-sm text-muted">Nothing here yet.</p>}
        </div>
        {item && selId && (
          <Card className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="grid size-16 place-items-center border-2 border-wood bg-[#e9d29c]"><ItemIcon item={item} size={48} /></div>
              <div><b className="block text-lg leading-tight">{item.name}</b><span className="text-xs text-muted capitalize">{item.category}</span></div>
            </div>
            <p className="m-0 text-sm leading-snug">{item.desc}</p>
            <dl className="m-0 grid grid-cols-2 gap-y-0.5 text-sm">
              <dt className="text-muted">In storage</dt><dd className="m-0 font-semibold">{qty}</dd>
              {sellable && <><dt className="text-muted">Sells for</dt><dd className="m-0 font-semibold">{coinPrice(selId)} coins each</dd></>}
              <dt className="text-muted">Reference</dt><dd className="m-0">≈ {fmtHrv(toHrv(item.usd))}</dd>
            </dl>
            <div className="mt-auto flex flex-wrap gap-1.5">
              {sellable && [1, 10].filter(n => n < qty).map(n => <button key={n} className="btn-wood !px-2 !py-0.5 text-sm" onClick={() => act(f => sell(f, selId, n))}>Sell {n}</button>)}
              {sellable && <button className="btn-gold !px-2 !py-0.5 text-sm" onClick={() => act(f => sell(f, selId, qty))}>Sell all · {(coinPrice(selId) * qty).toLocaleString('en-US')}</button>}
              {item.category === 'seeds' && (() => {
                const crop = selId.slice(5) as CropType, locked = CROP_RULES[crop].level > farm.level;
                return <button className="btn-gold !px-2 !py-0.5 text-sm" disabled={locked} onClick={() => { setSeed(selId); setTool('plant'); close(); }}>{locked ? `Unlocks at level ${CROP_RULES[crop].level}` : 'Plant these'}</button>;
              })()}
              {item.category === 'feed' && <button className="btn-gold !px-2 !py-0.5 text-sm" onClick={() => act((f, now) => feedAll(f, now))}>Feed hungry animals</button>}
              {item.category === 'land' && <span className="text-xs text-muted">Select a field in the world and use it from the inspector.</span>}
            </div>
          </Card>
        )}
      </div>
    </Window>
  );
}
