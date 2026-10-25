'use client';
// Player profile, farm overview, equipment and livestock windows.
import { useCallback, useState } from 'react';
import HV from '@/game/art/sprites';
import { ITEM } from '@/game/data/items';
import { ACHIEVEMENTS, ANIMALS, MACHINES, PLAYER, TASKS, type Animal } from '@/game/data/demo';
import { fmtHrv, fmtUsd, toHrv } from '@/game/data/economy';
import { PLOTS, STAGE_NAMES } from '@/game/world/geometry';
import { WEATHER_LABEL, formatHour } from '@/game/env/environment';
import { useGame } from '@/store/game';
import { Bar, Card, ItemIcon, SimTag, SpriteThumb, StageButton, Window } from '@/components/ui/kit';
import { Icon } from '@/components/hud/Icon';

const MEDAL = { gold: '#e3b341', silver: '#c9ced6', bronze: '#c87a3a' };
const drawAvatar = () => HV.farmer(0, 0, 0, false, { shirt: '#c4553b', pants: '#3f6fa8' }, 'front');

export function ProfilePanel() {
  const close = useGame(s => s.closePanel), open = useGame(s => s.openPanel);
  return (
    <Window title="Farmer profile" icon="home" onClose={close} width={760} footer="Profile data is a demo until accounts arrive in Stage 6. Wallet ownership is proven by signing a one-time message — never by a seed phrase or private key.">
      <div className="grid gap-3 md:grid-cols-[220px_1fr]">
        <Card className="flex flex-col items-center gap-2 text-center">
          <div className="grid h-28 w-full place-items-center border-2 border-wood bg-[#9fd3e6] shadow-[inset_0_-24px_0_#5fb44b]"><SpriteThumb draw={drawAvatar} box={96} maxScale={6} /></div>
          <b className="text-xl">{PLAYER.farm}</b>
          <span className="text-sm text-muted">{PLAYER.farmer} · since {PLAYER.joined}</span>
          <div className="w-full text-left text-sm"><div className="flex justify-between"><b>Level {PLAYER.level}</b><span className="text-muted">{PLAYER.xp} / {PLAYER.xpNext} XP</span></div><Bar value={PLAYER.xp / PLAYER.xpNext} /></div>
          <button className="btn-gold w-full" onClick={() => open('wallet')}>Wallet & Game Vault</button>
        </Card>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PLAYER.stats.map(([k, v]) => <Card key={k}><div className="text-xs text-muted">{k}</div><b className="text-lg">{v}</b></Card>)}
          </div>
          <div>
            <b className="mb-1 block">Achievements</b>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ACHIEVEMENTS.map(a => (
                <Card key={a.name} className={`text-center ${a.got ? '' : 'opacity-55 grayscale'}`}>
                  <div className="mx-auto mb-1 grid size-9 place-items-center rounded-full border-2 border-wood-d" style={{ background: MEDAL[a.tier] }}><Icon name="trophy" size={20} /></div>
                  <b className="block text-sm leading-tight">{a.name}</b><span className="text-[11px] leading-tight text-muted">{a.desc}</span>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Window>
  );
}

export function FarmPanel() {
  const close = useGame(s => s.closePanel), open = useGame(s => s.openPanel), env = useGame(s => s.env);
  const fields = PLOTS.filter(p => p.kind !== 'expansion');
  const byStage = [0, 1, 2, 3].map(st => fields.filter(p => p.crop && p.kind !== 'watered' && p.stage === st).length);
  const locked = PLOTS.length - fields.length;
  return (
    <Window title="My farm" icon="home" onClose={close} width={760} footer="Field stages come from the live world; tasks and totals are demo data until core gameplay (Stage 5).">
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <b className="mb-1 block">Fields</b>
          <div className="grid grid-cols-4 gap-1.5 text-center">
            {STAGE_NAMES.map((n, i) => <div key={n} className="border-2 border-parch-d bg-parch p-1"><b className="block text-xl">{byStage[i]}</b><span className="text-[11px] text-muted">{n}</span></div>)}
          </div>
          <div className="mt-2 flex justify-between text-sm"><span>{fields.length} fields · {locked} locked expansion plots</span><button className="text-xs underline" onClick={() => open('shop', 'land')}>Buy land</button></div>
        </Card>
        <Card>
          <b className="mb-1 block">Today</b>
          <div className="flex items-center gap-2 text-sm"><Icon name={env.night > .5 ? 'moon' : 'sun'} size={22} />{env.season[0].toUpperCase() + env.season.slice(1)}, day {env.day} · {WEATHER_LABEL[env.weather]} {env.temp}° · {formatHour(env.hour)}</div>
          <ul className="m-0 mt-2 list-none p-0 text-sm">
            {TASKS.map(t => <li key={t.text} className="flex items-center gap-2 py-0.5"><span className={`grid size-4 place-items-center border-2 border-wood-d text-[10px] ${t.done ? 'bg-leaf text-white' : 'bg-parch'}`}>{t.done ? '✓' : ''}</span><span className={t.done ? 'text-muted line-through' : ''}>{t.text}</span></li>)}
          </ul>
        </Card>
        <Card className="md:col-span-2">
          <b className="mb-1 block">Shortcuts</b>
          <div className="flex flex-wrap gap-1.5">
            <button className="btn-wood" onClick={() => open('inventory')}>Inventory (I)</button>
            <button className="btn-wood" onClick={() => open('livestock')}>Livestock (L)</button>
            <button className="btn-wood" onClick={() => open('equipment')}>Equipment (M)</button>
            <button className="btn-wood" onClick={() => open('shop', 'seeds')}>Shop (B)</button>
            <button className="btn-wood" onClick={() => open('exchange')}>Exchange (E)</button>
            <StageButton stage={5} gold>Harvest all ready</StageButton>
          </div>
        </Card>
      </div>
    </Window>
  );
}

export function EquipmentPanel() {
  const close = useGame(s => s.closePanel), open = useGame(s => s.openPanel);
  const [pick, setPick] = useState(MACHINES[0].id);
  const m = MACHINES.find(x => x.id === pick)!, item = ITEM[m.item];
  return (
    <Window title="Equipment" icon="tractor" onClose={close} width={820} footer="Machine levels and condition are demo data. Upgrades are priced in $HRV and capped at the $15 reference limit.">
      <div className="grid gap-3 md:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-1.5">
          {MACHINES.map(x => {
            const it = ITEM[x.item];
            return (
              <button key={x.id} onClick={() => setPick(x.id)} className={`flex items-center gap-3 border-2 p-2 text-left ${pick === x.id ? 'border-gold bg-[#fff0b8]' : 'border-wood bg-[#e9d29c] hover:bg-parch-l'}`}>
                <span className="grid size-14 place-items-center"><ItemIcon item={it} size={52} /></span>
                <span className="flex-1"><b className="block">{it.name} <span className="text-sm font-normal text-muted">Lv {x.level}</span></b><span className="text-xs text-muted">{x.status}</span><Bar value={x.condition} className="mt-1 w-40" color={x.condition < .7 ? '#e8a33a' : '#7cc24c'} /></span>
              </button>
            );
          })}
          <button className="text-left text-sm underline" onClick={() => open('shop', 'machinery')}>Browse machinery in the shop →</button>
        </div>
        <Card className="flex flex-col gap-2">
          <div className="grid h-24 place-items-center border-2 border-wood bg-[#9fd3e6] shadow-[inset_0_-14px_0_#5fb44b]"><ItemIcon item={item} size={88} /></div>
          <b className="text-lg">{item.name}</b>
          <div className="text-sm">{item.effect}</div>
          <div className="flex gap-1">{Array.from({ length: m.maxLevel }, (_, i) => <span key={i} className={`h-3 flex-1 border-2 border-wood-d ${i < m.level ? 'bg-gold' : 'bg-parch'}`} />)}</div>
          <div className="flex justify-between text-sm"><span className="text-muted">Condition</span><b>{Math.round(m.condition * 100)}%</b></div>
          <div className="flex justify-between text-sm"><span className="text-muted">Next upgrade</span><b>{m.level < m.maxLevel ? `${fmtHrv(toHrv(m.upgradeUsd))} ≈ ${fmtUsd(m.upgradeUsd)}` : 'Max level'}</b></div>
          <div className="mt-auto flex flex-wrap gap-1.5"><StageButton stage={5} gold>Upgrade</StageButton><StageButton stage={5}>Repair</StageButton></div>
        </Card>
      </div>
    </Window>
  );
}

const ANIMAL_DRAW = {
  cow: () => HV.cow(0, 0, 0), sheep: () => HV.sheep(0, 0, 0), pig: () => HV.pig(0, 0, 0), chicken: () => HV.chicken(0, 0, 0),
};
const KINDS: { key: 'all' | Animal['kind']; label: string }[] = [{ key: 'all', label: 'All' }, { key: 'cow', label: 'Cows' }, { key: 'sheep', label: 'Sheep' }, { key: 'pig', label: 'Pigs' }, { key: 'chicken', label: 'Chickens' }];

export function LivestockPanel({ tab = 'all' }: { tab?: string }) {
  const close = useGame(s => s.closePanel), open = useGame(s => s.openPanel);
  const list = ANIMALS.filter(a => tab === 'all' || a.kind === tab);
  const draw = useCallback((k: Animal['kind']) => ANIMAL_DRAW[k], []);
  const ready = ANIMALS.filter(a => a.readyIn === 'Ready').length;
  return (
    <Window title="Livestock" icon="cow" tabs={KINDS} tab={tab} onTab={k => open('livestock', k)} onClose={close} width={820}
      footer="Health, feeding and production timers are demo values; in Stage 5 they run on server-validated timers.">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm"><b>{ANIMALS.length} animals</b><span className="text-muted">· {ready} products ready to collect</span><span className="ml-auto flex gap-1.5"><StageButton stage={5} gold>Collect all</StageButton><StageButton stage={5}>Feed all</StageButton><button className="btn-wood" onClick={() => open('shop', 'livestock')}>Buy animals</button></span></div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {list.map(a => (
          <Card key={a.name} className="flex items-center gap-3">
            <span className="grid size-14 shrink-0 place-items-center border-2 border-wood bg-[#9fd3e6] shadow-[inset_0_-10px_0_#5fb44b]"><SpriteThumb draw={draw(a.kind)} box={44} /></span>
            <div className="flex-1 text-xs">
              <div className="flex items-center justify-between"><b className="text-sm">{a.name}</b><span className={`border-2 px-1 ${a.readyIn === 'Ready' ? 'border-leaf bg-[#e6f2d0] font-bold text-up' : 'border-parch-d text-muted'}`}>{a.product}: {a.readyIn}</span></div>
              <div className="mt-1 grid grid-cols-[52px_1fr] items-center gap-x-2 gap-y-0.5">
                <span className="text-muted">Health</span><Bar value={a.health} />
                <span className="text-muted">Happy</span><Bar value={a.happiness} color="#f2a3ae" />
                <span className="text-muted">Fed</span><Bar value={a.fed} color={a.fed < .5 ? '#e8a33a' : '#e8b93c'} />
              </div>
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-2"><SimTag>DEMO HERD</SimTag></div>
    </Window>
  );
}
