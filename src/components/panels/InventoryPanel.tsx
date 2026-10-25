'use client';
import { useMemo, useState } from 'react';
import { ITEM, type ItemCategory } from '@/game/data/items';
import { INVENTORY, STORAGE_CAPACITY } from '@/game/data/demo';
import { fmtHrv, fmtUsd, toHrv } from '@/game/data/economy';
import { useGame } from '@/store/game';
import { Bar, Card, ItemIcon, SimTag, StageButton, Stars, Window } from '@/components/ui/kit';

const TABS: { key: string; label: string; cats: ItemCategory[] }[] = [
  { key: 'all', label: 'All', cats: [] },
  { key: 'crops', label: 'Crops', cats: ['crops'] },
  { key: 'seeds', label: 'Seeds', cats: ['seeds'] },
  { key: 'products', label: 'Animal products', cats: ['products'] },
  { key: 'goods', label: 'Goods', cats: ['goods'] },
  { key: 'supplies', label: 'Feed', cats: ['feed'] },
];

export function InventoryPanel({ tab = 'all' }: { tab?: string }) {
  const close = useGame(s => s.closePanel), open = useGame(s => s.openPanel);
  const cats = TABS.find(t => t.key === tab)?.cats ?? [];
  const rows = useMemo(() => INVENTORY.filter(r => !cats.length || cats.includes(ITEM[r.id].category)), [cats]);
  const [pick, setPick] = useState<string | null>(null);
  const sel = rows.find(r => r.id === pick) ?? rows[0];
  const item = sel ? ITEM[sel.id] : null;
  const used = INVENTORY.length;
  const slots = Array.from({ length: Math.max(24, Math.ceil(rows.length / 8) * 8) }, (_, i) => rows[i]);

  return (
    <Window title="Inventory" icon="bag" tabs={TABS} tab={tab} onTab={k => open('inventory', k)} onClose={close}
      footer={<>Quantities and values are demo data until your farm is saved on the server (Stage 6). Values use the simulated market.</>}>
      <div className="grid gap-3 md:grid-cols-[1fr_250px]">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm">
            <b>Storage</b><Bar value={used / STORAGE_CAPACITY} className="w-40" color={used / STORAGE_CAPACITY > .85 ? '#e8a33a' : '#7cc24c'} /><span className="text-muted">{used} / {STORAGE_CAPACITY} slots</span>
            <button className="ml-auto text-xs text-muted underline" onClick={() => open('shop', 'machinery')}>Upgrade storage</button>
          </div>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
            {slots.map((r, i) => r ? (
              <button key={r.id} onClick={() => setPick(r.id)} title={ITEM[r.id].name}
                className={`relative grid aspect-square place-items-center border-2 ${sel?.id === r.id ? 'border-gold bg-[#fff0b8] shadow-[0_0_0_2px_#f2c94c]' : 'border-wood bg-[#e9d29c] hover:bg-parch-l'}`}>
                <ItemIcon item={ITEM[r.id]} size={32} />
                <span className="absolute right-0.5 bottom-0 text-[11px] font-bold text-ink [text-shadow:0_0_2px_#fff4d6]">{r.qty}</span>
              </button>
            ) : <div key={`e${i}`} className="aspect-square border-2 border-dashed border-parch-d bg-[#efdcae]" />)}
          </div>
        </div>
        {item && sel && (
          <Card className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="grid size-16 place-items-center border-2 border-wood bg-[#e9d29c]"><ItemIcon item={item} size={48} /></div>
              <div>
                <b className="block text-lg leading-tight">{item.name}</b>
                <span className="text-xs text-muted capitalize">{item.category}</span>
                {sel.quality && <div><Stars n={sel.quality} /></div>}
              </div>
            </div>
            <p className="m-0 text-sm leading-snug">{item.desc}</p>
            <dl className="m-0 grid grid-cols-2 gap-y-0.5 text-sm">
              <dt className="text-muted">In storage</dt><dd className="m-0 font-semibold">{sel.qty}</dd>
              <dt className="text-muted">Est. value each</dt><dd className="m-0 font-semibold">{fmtUsd(item.usd)}</dd>
              <dt className="text-muted">≈ in $HRV</dt><dd className="m-0 font-semibold">{fmtHrv(toHrv(item.usd))}</dd>
            </dl>
            <SimTag>DEMO VALUES</SimTag>
            <div className="mt-auto flex flex-wrap gap-1.5">
              {item.category === 'seeds' ? <StageButton stage={5} gold>Plant</StageButton> : item.category === 'feed' ? <StageButton stage={5} gold>Feed animals</StageButton> : <StageButton stage={7} gold>Sell at exchange</StageButton>}
              {(item.category === 'crops' || item.category === 'products') && <StageButton stage={7}>Process</StageButton>}
            </div>
          </Card>
        )}
      </div>
    </Window>
  );
}
