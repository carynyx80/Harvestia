'use client';
// Agricultural processing and delivery contracts — both run on server-validated timers.
import { useState } from 'react';
import { ITEM } from '@/game/data/items';
import { FACILITIES, MAX_BATCHES, RECIPES, RECIPE_BY_ID, recipeSeconds, type Facility } from '@/game/sim/rules';
import { facilityOpen } from '@/game/sim/engine';
import { CONTRACT_PREMIUM } from '../../../shared/sim/rules';
import { useGame } from '@/store/game';
import { Bar, Card, ItemIcon, Window } from '@/components/ui/kit';
import { fmtSecs } from '@/components/hud/Inspector';

const TABS = (Object.keys(FACILITIES) as Facility[]).map(k => ({ key: k, label: FACILITIES[k].name }));

function Stack({ id, n, have }: { id: string; n: number; have?: number }) {
  const short = have !== undefined && have < n;
  return (
    <span className="inline-flex items-center gap-1" title={ITEM[id].name}>
      <ItemIcon item={ITEM[id]} size={24} />
      <b className={short ? 'text-down' : ''}>{n}</b>{have !== undefined && <small className="text-muted">/{have}</small>}
    </span>
  );
}

export function ProcessingPanel({ tab = 'mill' }: { tab?: string }) {
  const close = useGame(s => s.closePanel), open = useGame(s => s.openPanel), farm = useGame(s => s.farm), act = useGame(s => s.act), offset = useGame(s => s.serverOffset);
  const [batches, setBatches] = useState<Record<string, number>>({});
  if (!farm) return null;
  const f = (tab in FACILITIES ? tab : 'mill') as Facility, info = FACILITIES[f], job = farm.jobs[f], now = Date.now() + offset;
  const opened = facilityOpen(farm, f);
  return (
    <Window title="Processing" icon="build" tabs={TABS} tab={f} onTab={k => open('processing', k)} onClose={close} width={820}
      footer="Processing runs on the server's clock: inputs are taken when a job starts and the goods are ready when the timer ends, even if you close the game. Goods are worth roughly 25–50% more than their ingredients.">
      <Card className="mb-3 flex flex-wrap items-center gap-3">
        <div className="min-w-[200px] flex-1"><b className="text-lg">{info.name}</b><p className="m-0 text-sm">{info.desc}</p></div>
        {!opened ? (
          <button className="btn-gold" onClick={() => open('shop', 'buildings')}>Build the {ITEM[info.needs!].name.toLowerCase()}</button>
        ) : job ? (() => {
          const r = RECIPE_BY_ID[job.recipe], done = now >= job.endsAt, p = (now - job.startedAt) / (job.endsAt - job.startedAt);
          return (
            <div className="flex min-w-[260px] items-center gap-3">
              <ItemIcon item={ITEM[r.output[0]]} size={36} />
              <div className="flex-1 text-sm"><b>{r.output[1] * job.batches} {ITEM[r.output[0]].name.toLowerCase()}</b>
                <Bar value={done ? 1 : p} className="my-1" color={done ? '#e8b93c' : '#7cc24c'} />
                <span className="text-muted">{done ? 'Ready to collect' : `Ready in ${fmtSecs((job.endsAt - now) / 1000)}`}</span></div>
              <button className="btn-gold" disabled={!done} onClick={() => act({ type: 'collectJob', facility: f })}>Collect</button>
            </div>
          );
        })() : <span className="text-sm text-muted">Idle — start a recipe below.</span>}
      </Card>
      <div className="grid gap-2 sm:grid-cols-2">
        {RECIPES.filter(r => r.facility === f).map(r => {
          const n = batches[r.id] ?? 1, locked = r.level > farm.level, secs = recipeSeconds(r, farm.machines);
          const short = Object.entries(r.inputs).some(([id, q]) => (farm.inventory[id] ?? 0) < q * n);
          const max = Math.max(1, Math.min(MAX_BATCHES, ...Object.entries(r.inputs).map(([id, q]) => Math.floor((farm.inventory[id] ?? 0) / q))));
          const set = (v: number) => setBatches(b => ({ ...b, [r.id]: Math.max(1, Math.min(MAX_BATCHES, v)) }));
          return (
            <Card key={r.id} className={`flex flex-col gap-1.5 ${locked ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-2 text-sm">
                {Object.entries(r.inputs).map(([id, q]) => <Stack key={id} id={id} n={q * n} have={farm.inventory[id] ?? 0} />)}
                <span className="text-muted">→</span>
                <Stack id={r.output[0]} n={r.output[1] * n} />
                <b className="ml-1">{ITEM[r.output[0]].name}</b>
              </div>
              <div className="text-xs text-muted">{fmtSecs(secs)} per batch{f === 'mill' && farm.machines['mach-mill'] ? ' (millstones: 2× speed)' : ''} · +{r.xp} XP per batch{locked ? ` · unlocks at level ${r.level}` : ''}</div>
              <div className="flex items-center gap-1 text-sm">
                <button className="btn-wood !px-2 !py-0" onClick={() => set(n - 1)} aria-label="Fewer batches">−</button>
                <span className="w-16 text-center">{n} batch{n > 1 ? 'es' : ''}</span>
                <button className="btn-wood !px-2 !py-0" onClick={() => set(n + 1)} aria-label="More batches">+</button>
                <button className="text-xs underline" onClick={() => set(max)}>max</button>
                <button className="btn-gold ml-auto !py-0.5" disabled={!opened || !!job || locked || short} onClick={() => act({ type: 'process', recipe: r.id, batches: n })}>
                  {job ? 'Busy' : short ? 'Not enough' : `Start · ${fmtSecs(secs * n)}`}
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </Window>
  );
}

export function ContractsPanel() {
  const close = useGame(s => s.closePanel), farm = useGame(s => s.farm), act = useGame(s => s.act), offset = useGame(s => s.serverOffset), open = useGame(s => s.openPanel);
  if (!farm) return null;
  const now = Date.now() + offset;
  return (
    <Window title="Delivery Contracts" icon="stall" onClose={close} width={820}
      footer={<>Contracts pay {Math.round((CONTRACT_PREMIUM - 1) * 100)}% over the goods&apos; fixed base value in Farm Coins — never a live market price, so payouts stay bounded. Delivered or declined slots get a new contract after 10 minutes; unfinished contracts expire after 2 hours.</>}>
      <div className="grid gap-3 md:grid-cols-3">
        {farm.contracts.map((c, i) => {
          if (!c.items.length) return (
            <Card key={`w${i}`} className="grid min-h-40 place-items-center text-center text-sm text-muted">New contract in {fmtSecs(Math.max(0, (c.availableAt - now) / 1000))}</Card>
          );
          const ready = c.items.every(([id, n]) => (farm.inventory[id] ?? 0) >= n);
          return (
            <Card key={c.id} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between"><b>Contract #{c.id}</b><span className="text-xs text-muted">expires in {fmtSecs(Math.max(0, (c.expiresAt - now) / 1000))}</span></div>
              <div className="flex flex-col gap-1 text-sm">
                {c.items.map(([id, n]) => {
                  const have = farm.inventory[id] ?? 0;
                  return (
                    <div key={id} className="flex items-center gap-2">
                      <ItemIcon item={ITEM[id]} size={28} />
                      <span className="flex-1">{n} {ITEM[id].name.toLowerCase()}</span>
                      <b className={have >= n ? 'text-up' : 'text-down'}>{Math.min(have, n)}/{n}</b>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-parch-d pt-1 text-sm">Reward: <b>{c.coins.toLocaleString('en-US')} coins</b> · <b>{c.xp} XP</b></div>
              <div className="mt-auto flex gap-1.5">
                <button className="btn-gold flex-1 !py-0.5" disabled={!ready} onClick={() => act({ type: 'deliver', index: i })}>{ready ? 'Deliver' : 'Not enough yet'}</button>
                <button className="btn-wood !py-0.5 text-sm" onClick={() => act({ type: 'skipContract', index: i })}>Decline</button>
              </div>
              {!ready && c.items.some(([id]) => id.startsWith('good-')) && <button className="self-start text-xs underline" onClick={() => open('processing', RECIPES.find(r => c.items.some(([id]) => id === r.output[0]))?.facility)}>Make goods at processing</button>}
            </Card>
          );
        })}
      </div>
    </Window>
  );
}
