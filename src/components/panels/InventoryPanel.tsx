'use client';
import { useState } from 'react';
import { ITEM, type ItemCategory } from '@/game/data/items';
import { fmtHrv, toHrv } from '@/game/data/economy';
import { SELLABLE, coinPrice, storageCapacity, storageUsed } from '@/game/sim/engine';
import { BASE_STORAGE, CROP_RULES, PERISHABLE, STORAGE_UPGRADE } from '@/game/sim/rules';
import { COMMODITY_BY_ITEM } from '../../../shared/market';
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
  { key: 'storage', label: 'Storage', cats: [] },
];

export function InventoryPanel({ tab = 'all' }: { tab?: string }) {
  const close = useGame(s => s.closePanel), open = useGame(s => s.openPanel), farm = useGame(s => s.farm), act = useGame(s => s.act), market = useGame(s => s.market);
  const setTool = useGame(s => s.setTool), setSeed = useGame(s => s.setSeed);
  const [pick, setPick] = useState<string | null>(null);
  if (!farm) return null;
  if (tab === 'storage') return <StorageView />;
  const cats = TABS.find(t => t.key === tab)?.cats ?? [];
  const rows = Object.entries(farm.inventory).filter(([id, q]) => q > 0 && ITEM[id] && (!cats.length || cats.includes(ITEM[id].category)))
    .sort(([a], [b]) => ITEM[a].category.localeCompare(ITEM[b].category) || ITEM[a].name.localeCompare(ITEM[b].name));
  const selId = rows.find(([id]) => id === pick)?.[0] ?? rows[0]?.[0];
  const item = selId ? ITEM[selId] : null, qty = selId ? farm.inventory[selId] : 0;
  const used = storageUsed(farm), cap = storageCapacity(farm);
  const slots = Array.from({ length: Math.max(24, Math.ceil(rows.length / 8) * 8) }, (_, i) => rows[i]);
  const quote = selId ? market?.commodities.find(c => c.item === selId)?.price : undefined;
  const exchange = !!(selId && COMMODITY_BY_ITEM[selId]);
  const sellable = item && SELLABLE.includes(item.category) && !exchange;

  return (
    <Window title="Inventory" icon="bag" tabs={TABS} tab={tab} onTab={k => { setPick(null); open('inventory', k); }} onClose={close}
      footer={<>Your farm is saved on the Harvestia server. Animal products and goods sell at the general store&apos;s fixed price; crops trade at the commodity exchange, whose prices follow real markets within bounds.</>}>
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
              {exchange && <><dt className="text-muted">Exchange bid</dt><dd className="m-0 font-semibold">{quote ? `${quote.bid.toFixed(2)} coins` : '—'}</dd></>}
              {PERISHABLE[selId] && <><dt className="text-muted">Spoils</dt><dd className="m-0">{farm.buildings['bld-cold'] ? 'No — cold storage' : `${PERISHABLE[selId] * 100}% per hour`}</dd></>}
              <dt className="text-muted">Reference</dt><dd className="m-0">≈ {fmtHrv(toHrv(item.usd))}</dd>
            </dl>
            <div className="mt-auto flex flex-wrap gap-1.5">
              {sellable && [1, 10].filter(n => n < qty).map(n => <button key={n} className="btn-wood !px-2 !py-0.5 text-sm" onClick={() => act({ type: 'sell', item: selId, qty: n })}>Sell {n}</button>)}
              {sellable && <button className="btn-gold !px-2 !py-0.5 text-sm" onClick={() => act({ type: 'sell', item: selId, qty: qty })}>Sell all · {(coinPrice(selId) * qty).toLocaleString('en-US')}</button>}
              {item.category === 'seeds' && (() => {
                const crop = selId.slice(5) as CropType, locked = CROP_RULES[crop].level > farm.level;
                return <button className="btn-gold !px-2 !py-0.5 text-sm" disabled={locked} onClick={() => { setSeed(selId); setTool('plant'); close(); }}>{locked ? `Unlocks at level ${CROP_RULES[crop].level}` : 'Plant these'}</button>;
              })()}
              {exchange && quote && Math.min(qty, 10) > 0 && <button className="btn-wood !px-2 !py-0.5 text-sm" onClick={() => act({ type: 'trade', item: selId, side: 'sell', qty: Math.min(qty, 10), limit: quote.bid })}>Sell {Math.min(qty, 10)} at {quote.bid.toFixed(2)}</button>}
              {exchange && <button className="btn-gold !px-2 !py-0.5 text-sm" onClick={() => open('exchange', COMMODITY_BY_ITEM[selId].key)}>Trade at the exchange</button>}
              {item.category === 'feed' && <button className="btn-gold !px-2 !py-0.5 text-sm" onClick={() => act({ type: 'feedAll' })}>Feed hungry animals</button>}
              {item.category === 'land' && <span className="text-xs text-muted">Select a field in the world and use it from the inspector.</span>}
            </div>
          </Card>
        )}
      </div>
    </Window>
  );
}

/** Produce storage: where capacity comes from and what is spoiling. */
function StorageView() {
  const close = useGame(s => s.closePanel), open = useGame(s => s.openPanel), farm = useGame(s => s.farm)!;
  const used = storageUsed(farm), cap = storageCapacity(farm), cold = !!farm.buildings['bld-cold'];
  const rows: [string, number][] = [
    ['Farm warehouse', BASE_STORAGE],
    [`Storage upgrades ×${farm.machines['mach-storage'] ?? 0}`, (farm.machines['mach-storage'] ?? 0) * STORAGE_UPGRADE],
    [`Grain silos ×${farm.buildings['bld-silo'] ?? 0}`, (farm.buildings['bld-silo'] ?? 0) * 200],
  ];
  const byCat = Object.entries(farm.inventory).reduce<Record<string, number>>((m, [id, q]) => { const c = ITEM[id]?.category ?? 'other'; m[c] = (m[c] ?? 0) + q; return m; }, {});
  return (
    <Window title="Inventory" icon="bag" tabs={TABS} tab="storage" onTab={k => open('inventory', k)} onClose={close}
      footer="Everything you own shares one storage capacity. Eggs, milk and tomatoes spoil slowly unless you have cold storage; spoilage runs on the server's clock even while you are away.">
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <b className="mb-1 block">Capacity</b>
          <div className="mb-2 flex items-center gap-2 text-sm"><Bar value={used / cap} className="flex-1" color={used / cap > .9 ? '#c23b2f' : '#7cc24c'} /><b>{used} / {cap}</b></div>
          <table className="w-full text-sm"><tbody>
            {rows.map(([k, v]) => <tr key={k}><td className="text-muted">{k}</td><td className="text-right">+{v}</td></tr>)}
          </tbody></table>
          <div className="mt-2 flex gap-1.5"><button className="btn-wood !py-0.5 text-sm" onClick={() => open('shop', 'machinery')}>Storage upgrade</button><button className="btn-wood !py-0.5 text-sm" onClick={() => open('shop', 'buildings')}>Grain silo</button></div>
        </Card>
        <Card>
          <b className="mb-1 block">In storage</b>
          <table className="w-full text-sm"><tbody>
            {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => <tr key={k}><td className="capitalize text-muted">{k}</td><td className="text-right">{v}</td></tr>)}
          </tbody></table>
        </Card>
        <Card className="md:col-span-2">
          <div className="mb-1 flex items-center gap-2"><b>Perishables</b>
            <span className={`border-2 border-wood-d px-1.5 text-[11px] font-bold ${cold ? 'bg-leaf text-white' : 'bg-gold text-ink'}`}>{cold ? 'Cold storage: kept fresh' : 'No cold storage'}</span>
            {!cold && <button className="btn-gold ml-auto !py-0.5 text-sm" onClick={() => open('shop', 'buildings')}>Build cold storage</button>}</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {Object.entries(PERISHABLE).map(([id, rate]) => (
              <div key={id} className="flex items-center gap-2 border-2 border-parch-d bg-parch p-1.5 text-sm">
                <ItemIcon item={ITEM[id]} size={28} />
                <span className="flex-1"><b className="block">{ITEM[id].name}: {farm.inventory[id] ?? 0}</b><span className="text-xs text-muted">{cold ? 'not spoiling' : `loses ${rate * 100}% per hour`}</span></span>
              </div>
            ))}
          </div>
          {(farm.stats.spoiled ?? 0) > 0 && <p className="m-0 mt-1 text-xs text-muted">Lost to spoilage so far: {farm.stats.spoiled}</p>}
        </Card>
      </div>
    </Window>
  );
}
