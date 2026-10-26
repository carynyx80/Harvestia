'use client';
import { useEffect, useState } from 'react';
import { ITEM, ITEMS, SHOP_TABS, type Item } from '@/game/data/items';
import { MAX_ITEM_USD, PURCHASE_SPLIT, QUOTE_SECONDS, fmtHrv, fmtUsd, toHrv } from '@/game/data/economy';
import { useGame } from '@/store/game';
import { animalCapacity, buy, coinPrice } from '@/game/sim/engine';
import { MACHINE_RULES, UNAVAILABLE, UNIQUE_BUILDINGS, type AnimalType } from '@/game/sim/rules';
import type { FarmState } from '@/game/sim/state';
import { Card, ItemIcon, SimTag, StageButton, Window } from '@/components/ui/kit';

const TABS = [...SHOP_TABS.map(t => ({ key: t.key as string, label: t.label })), { key: 'listings', label: 'Player listings' }];

/** What the player already has of an item, or why it can't be bought. */
function status(farm: FarmState, item: Item): { note?: string; blocked?: string } {
  if (UNAVAILABLE[item.id]) return { blocked: UNAVAILABLE[item.id] };
  if (item.category === 'machinery') {
    if (item.id === 'mach-storage') return { note: `Owned: ${farm.machines[item.id] ?? 0}` };
    const lvl = farm.machines[item.id];
    if (lvl) return { blocked: `Owned · level ${lvl}/${MACHINE_RULES[item.id]?.maxLevel ?? 1} — upgrade it in Equipment` };
  }
  if (item.category === 'buildings') {
    const n = farm.buildings[item.id] ?? 0;
    if (UNIQUE_BUILDINGS.includes(item.id) && n) return { blocked: 'Already on your farm' };
    if (n) return { note: `You have ${n}` };
  }
  if (item.category === 'livestock') {
    const kind = item.id.replace('animal-', '') as AnimalType;
    return { note: `Pen space: ${farm.animals.filter(a => a.kind === kind).length} / ${animalCapacity(farm, kind)}` };
  }
  if (item.category === 'land' && (item.id === 'land-plot' || item.id === 'land-large')) {
    const locked = farm.plots.filter(p => !p.unlocked).length;
    return locked ? { note: `${locked} plot${locked > 1 ? 's' : ''} for sale` } : { blocked: 'All available land is unlocked' };
  }
  const have = farm.inventory[item.id];
  return have ? { note: `In storage: ${have}` } : {};
}

/** Purchase confirmation: quote with expiry, the burn/treasury split and the final total. */
function Confirm({ item, qty, onBack }: { item: Item; qty: number; onBack: () => void }) {
  const act = useGame(s => s.act), farm = useGame(s => s.farm);
  const coins = coinPrice(item.id) * qty;
  const [left, setLeft] = useState(QUOTE_SECONDS);
  const [n, setN] = useState(0);
  useEffect(() => { setLeft(QUOTE_SECONDS); const id = setInterval(() => setLeft(l => Math.max(0, l - 1)), 1000); return () => clearInterval(id); }, [n]);
  const total = toHrv(item.usd) * qty;
  return (
    <Card className="flex flex-col gap-2">
      <b className="text-lg">Confirm purchase</b>
      <div className="flex items-center gap-3"><ItemIcon item={item} size={40} /><div><b>{qty} × {item.name}</b><div className="text-xs text-muted">{fmtUsd(item.usd)} reference each</div></div></div>
      <div className="border-2 border-leaf bg-[#e6f2d0] px-2 py-1.5 text-sm">
        <div className="flex justify-between"><span>Pay now (Farm Coins · simulated)</span><b>{coins.toLocaleString('en-US')}</b></div>
        <div className="flex justify-between text-xs text-muted"><span>Balance after</span><span>{((farm?.coins ?? 0) - coins).toLocaleString('en-US')}</span></div>
      </div>
      <b className="text-xs tracking-wide text-muted uppercase">With $HRV (Stage 8)</b>
      <dl className="m-0 grid grid-cols-[1fr_auto] gap-y-1 text-sm">
        <dt className="text-muted">Total</dt><dd className="m-0 text-right font-bold">{fmtHrv(total)}</dd>
        <dt className="text-muted">Permanently burned ({PURCHASE_SPLIT.burn * 100}%)</dt><dd className="m-0 text-right">{fmtHrv(total * PURCHASE_SPLIT.burn)}</dd>
        <dt className="text-muted">Farmer reward treasury ({PURCHASE_SPLIT.treasury * 100}%)</dt><dd className="m-0 text-right">{fmtHrv(total * PURCHASE_SPLIT.treasury)}</dd>
        <dt className="text-muted">Paid from</dt><dd className="m-0 text-right">Game Vault</dd>
      </dl>
      <div className={`flex items-center justify-between border-2 px-2 py-1 text-sm ${left ? 'border-parch-d' : 'border-down text-down'}`}>
        <span>{left ? `Quote valid for ${left}s` : 'Quote expired'}</span>
        <button className="text-xs underline" onClick={() => setN(x => x + 1)}>Refresh quote</button>
      </div>
      <p className="m-0 text-xs leading-snug text-muted">Prices are quoted by the server from verified $HRV pricing with liquidity checks; the price shown here is a demo rate. Burns only count once the transaction is confirmed on-chain.</p>
      <div className="flex gap-1.5"><button className="btn-wood" onClick={onBack}>Back</button><button className="btn-gold" disabled={(farm?.coins ?? 0) < coins} onClick={() => { if (act({ type: 'buy', item: item.id, qty: qty })) onBack(); }}>Buy for {coins.toLocaleString('en-US')} coins</button></div>
    </Card>
  );
}

export function ShopPanel({ tab = 'seeds' }: { tab?: string }) {
  const close = useGame(s => s.closePanel), open = useGame(s => s.openPanel), farm = useGame(s => s.farm);
  const items = ITEMS.filter(i => i.category === tab);
  const [pick, setPick] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [confirm, setConfirm] = useState(false);
  const item = items.find(i => i.id === pick) ?? items[0];
  useEffect(() => { setConfirm(false); setQty(1); }, [pick, tab]);
  const range = SHOP_TABS.find(t => t.key === tab)?.range;

  return (
    <Window title="Marketplace" icon="stall" tabs={TABS} tab={tab} onTab={k => { setPick(null); open('shop', k); }} onClose={close}
      footer={<>Play uses simulated Farm Coins (100 coins = $1 reference). Every item also shows its $HRV price at a demo rate; no single item costs more than {fmtUsd(MAX_ITEM_USD)}. Real $HRV quotes arrive with the token (Stage 8).</>}>
      {tab === 'listings' ? <Listings /> : (
        <div className="grid gap-3 md:grid-cols-[1fr_280px]">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm"><b>General Store</b><span className="text-muted">· {SHOP_TABS.find(t => t.key === tab)?.label} {range}</span><span className="ml-auto"><SimTag>DEMO RATE · 1 HRV = $0.0125</SimTag></span></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {items.map(i => (
                <button key={i.id} onClick={() => setPick(i.id)}
                  className={`flex flex-col items-center gap-1 border-2 p-2 text-center ${item?.id === i.id ? 'border-gold bg-[#fff0b8] shadow-[0_0_0_2px_#f2c94c]' : 'border-wood bg-[#e9d29c] hover:bg-parch-l'}`}>
                  <span className="grid h-14 place-items-center"><ItemIcon item={i} size={i.thumb ? 56 : 40} /></span>
                  <b className="text-sm leading-tight">{i.name}</b>
                  <span className="text-sm font-bold text-up">{coinPrice(i.id).toLocaleString('en-US')} coins</span>
                  <span className="text-[11px] text-muted">{fmtHrv(toHrv(i.usd))} · ≈ {fmtUsd(i.usd)}</span>
                </button>
              ))}
            </div>
          </div>
          {item && (confirm ? <Confirm item={item} qty={qty} onBack={() => setConfirm(false)} /> : (
            <Card className="flex flex-col gap-2">
              <div className="grid h-24 place-items-center border-2 border-wood bg-[#9fd3e6] shadow-[inset_0_-14px_0_#5fb44b]"><ItemIcon item={item} size={item.thumb ? 88 : 64} /></div>
              <b className="text-lg leading-tight">{item.name}</b>
              <p className="m-0 text-sm leading-snug">{item.desc}</p>
              {item.effect && <div className="border-l-4 border-leaf bg-[#e6f2d0] px-2 py-1 text-sm"><b>Effect:</b> {item.effect}</div>}
              <div className="flex items-center justify-between text-sm"><span className="text-muted">Price each</span><b>{coinPrice(item.id).toLocaleString('en-US')} coins <span className="font-normal text-muted">· {fmtHrv(toHrv(item.usd))}</span></b></div>
              {farm && (() => { const st = status(farm, item); return st.blocked ? <div className="border-2 border-parch-d bg-parch px-2 py-1 text-sm text-muted">{st.blocked}</div> : st.note ? <div className="text-sm text-muted">{st.note}</div> : null; })()}
              {(tab === 'seeds' || tab === 'feed' || tab === 'livestock') && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted">Quantity</span>
                  <button className="btn-wood !px-2 !py-0" onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Fewer">−</button>
                  <b className="w-8 text-center">{qty}</b>
                  <button className="btn-wood !px-2 !py-0" onClick={() => setQty(q => Math.min(99, q + 1))} aria-label="More">+</button>
                  <b className="ml-auto">{(coinPrice(item.id) * qty).toLocaleString('en-US')} coins</b>
                </div>
              )}
              <button className="btn-gold mt-auto" disabled={!!(farm && status(farm, item).blocked)} onClick={() => setConfirm(true)}>Review purchase</button>
            </Card>
          ))}
        </div>
      )}
    </Window>
  );
}

function Listings() {
  const rows = [
    ['crop-corn', 'MeadowMoss', 120, 5.1], ['prod-milk', 'Dairy Dan', 40, 14.8], ['good-cheese', 'Brie Farms', 12, 40.2],
    ['crop-coffee', 'HighlandBeans', 30, 66.5], ['prod-wool', 'Shepherd Sue', 25, 22.4], ['good-chocolate', 'CocoaCoop', 8, 92.0],
  ] as [string, string, number, number][];
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm"><b>Player listings</b><span className="text-muted">· buy produce from other farmers</span><span className="ml-auto"><SimTag>PREVIEW · STAGE 8</SimTag></span></div>
      <table className="w-full border-collapse text-sm">
        <thead><tr className="bg-bark text-left text-parch-l"><th className="p-1.5">Item</th><th className="p-1.5">Seller</th><th className="p-1.5 text-right">Qty</th><th className="p-1.5 text-right">Price each</th><th className="p-1.5" /></tr></thead>
        <tbody>
          {rows.map(([id, seller, q, hrv]) => (
            <tr key={id} className="border-b border-parch-d">
              <td className="p-1.5"><span className="flex items-center gap-2"><ItemIcon item={ITEM[id]} size={24} />{ITEM[id].name}</span></td>
              <td className="p-1.5 text-muted">{seller}</td><td className="p-1.5 text-right">{q}</td><td className="p-1.5 text-right font-semibold">{fmtHrv(hrv)}</td>
              <td className="p-1.5 text-right"><StageButton stage={8}>Buy</StageButton></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">The server checks the seller really owns the goods before any trade settles, and a transparent marketplace fee applies.</p>
    </div>
  );
}
