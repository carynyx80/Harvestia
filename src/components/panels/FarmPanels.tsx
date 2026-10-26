'use client';
// Player profile, farm overview, equipment and livestock windows — all on live farm state.
import { useState } from 'react';
import HV from '@/game/art/sprites';
import { ITEM } from '@/game/data/items';
import { ACHIEVEMENTS } from '@/game/data/demo';
import { STAGE_NAMES } from '@/game/world/geometry';
import { WEATHER_LABEL, formatHour } from '@/game/env/environment';
import { ANIMAL_RULES, MACHINE_RULES, xpForLevel, type AnimalType } from '@/game/sim/rules';
import { animalCapacity, claimTask, collect, collectAll, feed, feedAll, growthRate, stageOf, taskProgress, upgradeMachine } from '@/game/sim/engine';
import { clearSave, initialState } from '@/game/sim/state';
import { resetOnlineFarm } from '@/lib/sync';
import { useGame } from '@/store/game';
import { Bar, Card, ItemIcon, SpriteThumb, Window } from '@/components/ui/kit';
import { Icon } from '@/components/hud/Icon';
import { fmtSecs } from '@/components/hud/Inspector';

const MEDAL = { gold: '#e3b341', silver: '#c9ced6', bronze: '#c87a3a' };
const drawAvatar = () => HV.farmer(0, 0, 0, false, { shirt: '#c4553b', pants: '#3f6fa8' }, 'front');
const STAT_LABEL: [string, string][] = [['planted', 'Crops planted'], ['harvested', 'Crops harvested'], ['watered', 'Rows watered'], ['collected', 'Products collected'], ['earned', 'Coins earned'], ['spent', 'Coins spent']];

export function ProfilePanel() {
  const close = useGame(s => s.closePanel), open = useGame(s => s.openPanel), farm = useGame(s => s.farm), setFarm = useGame(s => s.setFarm), toast = useGame(s => s.toast);
  const session = useGame(s => s.session), connection = useGame(s => s.connection);
  const [confirmReset, setConfirmReset] = useState(false);
  if (!farm) return null;
  // early achievements follow live stats; the rest unlock in later stages
  const got = (name: string) => name === 'First Harvest' ? (farm.stats.harvested ?? 0) > 0 : name === 'Mechanised' ? !!farm.machines['mach-tractor'] : name === 'Rancher' ? (['chicken', 'sheep', 'pig', 'cow'] as AnimalType[]).every(k => farm.animals.some(a => a.kind === k)) : name === 'Green Thumb' ? (farm.stats.planted ?? 0) >= 50 : false;
  return (
    <Window title="Farmer profile" icon="home" onClose={close} width={760} footer="Your farm is saved on the Harvestia server under a guest account kept in this browser. Sign in with your wallet (one signed message — never a seed phrase or private key) to keep this farm on any device.">
      <div className="grid gap-3 md:grid-cols-[220px_1fr]">
        <Card className="flex flex-col items-center gap-2 text-center">
          <div className="grid h-28 w-full place-items-center border-2 border-wood bg-[#9fd3e6] shadow-[inset_0_-24px_0_#5fb44b]"><SpriteThumb draw={drawAvatar} box={96} maxScale={6} /></div>
          <b className="text-xl">{session?.farmName ?? 'Sunny Acres'}</b>
          <span className="text-sm text-muted">{session ? `Guest farmer · ${session.playerName}` : connection === 'offline' ? 'Offline — local farm' : 'Connecting…'}</span>
          <div className="w-full text-left text-sm"><div className="flex justify-between"><b>Level {farm.level}</b><span className="text-muted">{farm.xp} / {xpForLevel(farm.level)} XP</span></div><Bar value={farm.xp / xpForLevel(farm.level)} /></div>
          <div className="w-full text-left text-sm"><b>{farm.coins.toLocaleString('en-US')}</b> Farm Coins</div>
          <button className="btn-gold w-full" onClick={() => open('wallet')}>Wallet & Game Vault</button>
          {confirmReset
            ? <div className="flex w-full gap-1"><button className="btn-wood flex-1 !px-1 text-xs" onClick={() => setConfirmReset(false)}>Keep farm</button><button className="btn-wood flex-1 !bg-down !px-1 text-xs" onClick={async () => { setConfirmReset(false); clearSave(); const online = await resetOnlineFarm().catch(() => false); if (!online) setFarm(initialState(Date.now())); toast(online ? 'Farm reset to the starter farm on the server' : 'Farm reset to the starter farm', 'info'); }}>Reset</button></div>
            : <button className="text-xs text-muted underline" onClick={() => setConfirmReset(true)}>Start over (reset farm)</button>}
        </Card>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {STAT_LABEL.map(([k, label]) => <Card key={k}><div className="text-xs text-muted">{label}</div><b className="text-lg">{(farm.stats[k] ?? 0).toLocaleString('en-US')}</b></Card>)}
          </div>
          <div>
            <b className="mb-1 block">Achievements</b>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ACHIEVEMENTS.map(a => (
                <Card key={a.name} className={`text-center ${got(a.name) ? '' : 'opacity-55 grayscale'}`}>
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
  const close = useGame(s => s.closePanel), open = useGame(s => s.openPanel), env = useGame(s => s.env), farm = useGame(s => s.farm), act = useGame(s => s.act);
  const conditions = useGame(s => s.conditions), activity = useGame(s => s.live.feed);
  if (!farm) return null;
  const fields = farm.plots.filter(p => p.unlocked);
  const byStage = [0, 1, 2, 3].map(st => fields.reduce((n, p) => n + p.cells.filter(c => c.crop && stageOf(c.growth) === st).length, 0));
  const empty = fields.reduce((n, p) => n + p.cells.filter(c => !c.crop).length, 0);
  const c = conditions(), rate = growthRate(farm, c);
  return (
    <Window title="My farm" icon="home" onClose={close} width={760} footer="Crops only grow while their soil is wet. Rain waters every field; the irrigation pump and irrigation channels keep their fields wet.">
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <b className="mb-1 block">Crops</b>
          <div className="grid grid-cols-5 gap-1.5 text-center">
            <div className="border-2 border-parch-d bg-parch p-1"><b className="block text-xl">{empty}</b><span className="text-[11px] text-muted">Empty</span></div>
            {STAGE_NAMES.map((n, i) => <div key={n} className="border-2 border-parch-d bg-parch p-1"><b className="block text-xl">{byStage[i]}</b><span className="text-[11px] text-muted">{n}</span></div>)}
          </div>
          <div className="mt-2 flex justify-between text-sm"><span>{fields.length} fields · {farm.plots.length - fields.length} locked</span><button className="text-xs underline" onClick={() => open('shop', 'land')}>Buy land</button></div>
        </Card>
        <Card>
          <b className="mb-1 block">Today</b>
          <div className="flex items-center gap-2 text-sm"><Icon name={env.night > .5 ? 'moon' : 'sun'} size={22} />{c.season[0].toUpperCase() + c.season.slice(1)}, day {env.seasonDay} · {WEATHER_LABEL[c.weather]} · {formatHour(env.hour)}</div>
          <div className="mt-1 text-sm">Growth speed right now: <b className={rate >= 1 ? 'text-up' : 'text-down'}>{Math.round(rate * 100)}%</b></div>
          <div className="mt-1 text-xs text-muted">Weather, season and your tractor all change how fast crops grow.</div>
        </Card>
        <Card className="md:col-span-2">
          <b className="mb-1 block">Tasks</b>
          <div className="grid gap-2 sm:grid-cols-3">
            {farm.tasks.map((_, i) => {
              const { rule, value } = taskProgress(farm, i), done = value >= rule.target;
              return (
                <div key={`${rule.id}-${i}`} className={`border-2 p-2 ${done ? 'border-leaf bg-[#e6f2d0]' : 'border-parch-d bg-parch'}`}>
                  <b className="block text-sm">{rule.text}</b>
                  <Bar value={value / rule.target} className="my-1" />
                  <div className="flex items-center justify-between text-xs"><span>{value} / {rule.target}</span><span className="text-muted">+{rule.coins} coins · +{rule.xp} XP</span></div>
                  {done && <button className="btn-gold mt-1 w-full !py-0.5 text-sm" onClick={() => act({ type: 'claimTask', index: i })}>Claim</button>}
                </div>
              );
            })}
          </div>
        </Card>
        <Card className="md:col-span-2">
          <b className="mb-1 block">Village activity</b>
          {activity.length
            ? <ul className="m-0 list-none p-0 text-sm">{activity.slice(0, 6).map(f => <li key={`${f.at}-${f.text}`} className="flex justify-between gap-2 py-0.5"><span>{f.text}</span><span className="shrink-0 text-xs text-muted">{new Date(f.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></li>)}</ul>
            : <p className="m-0 text-sm text-muted">Quiet so far. Big harvests, level-ups and new land from every farm show up here as they happen.</p>}
        </Card>
      </div>
    </Window>
  );
}

const MACHINE_ORDER = ['mach-tractor', 'mach-harvester', 'mach-pump', 'mach-can', 'mach-planter', 'mach-storage', 'mach-mill'];

export function EquipmentPanel() {
  const close = useGame(s => s.closePanel), open = useGame(s => s.openPanel), farm = useGame(s => s.farm), act = useGame(s => s.act);
  const [pick, setPick] = useState(MACHINE_ORDER[0]);
  if (!farm) return null;
  const item = ITEM[pick], level = farm.machines[pick] ?? 0, rule = MACHINE_RULES[pick];
  const cost = level && level < rule.maxLevel ? rule.upgrade(level) : 0;
  return (
    <Window title="Equipment" icon="tractor" onClose={close} width={820} footer="Machines are bought in the Marketplace and levelled up here with Farm Coins.">
      <div className="grid gap-3 md:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-1.5">
          {MACHINE_ORDER.map(id => {
            const it = ITEM[id], lv = farm.machines[id] ?? 0;
            return (
              <button key={id} onClick={() => setPick(id)} className={`flex items-center gap-3 border-2 p-2 text-left ${pick === id ? 'border-gold bg-[#fff0b8]' : 'border-wood bg-[#e9d29c] hover:bg-parch-l'} ${lv ? '' : 'opacity-65'}`}>
                <span className="grid size-12 place-items-center"><ItemIcon item={it} size={44} /></span>
                <span className="flex-1"><b className="block">{it.name} {lv ? <span className="text-sm font-normal text-muted">{id === 'mach-storage' ? `×${lv}` : `Lv ${lv}`}</span> : null}</b><span className="text-xs text-muted">{lv ? MACHINE_RULES[id].describe(lv) : 'Not owned'}</span></span>
              </button>
            );
          })}
        </div>
        <Card className="flex flex-col gap-2">
          <div className="grid h-24 place-items-center border-2 border-wood bg-[#9fd3e6] shadow-[inset_0_-14px_0_#5fb44b]"><ItemIcon item={item} size={80} /></div>
          <b className="text-lg">{item.name}</b>
          <div className="text-sm">{level ? rule.describe(level) : item.effect}</div>
          {rule.maxLevel > 1 && level > 0 && <div className="flex gap-1">{Array.from({ length: rule.maxLevel }, (_, i) => <span key={i} className={`h-3 flex-1 border-2 border-wood-d ${i < level ? 'bg-gold' : 'bg-parch'}`} />)}</div>}
          {level > 0 && level < rule.maxLevel && <div className="text-sm text-muted">Next: {rule.describe(level + 1)}</div>}
          <div className="mt-auto flex flex-wrap gap-1.5">
            {!level && <button className="btn-gold" onClick={() => open('shop', 'machinery')}>Buy in Marketplace</button>}
            {level > 0 && level < rule.maxLevel && <button className="btn-gold" disabled={farm.coins < cost} onClick={() => act({ type: 'upgrade', machine: pick })}>Upgrade · {cost.toLocaleString('en-US')} coins</button>}
            {level > 0 && level >= rule.maxLevel && pick !== 'mach-storage' && <span className="text-sm text-muted">{rule.maxLevel > 1 ? 'Maximum level' : 'Owned'}</span>}
          </div>
        </Card>
      </div>
    </Window>
  );
}

const ANIMAL_DRAW: Record<AnimalType, () => void> = {
  cow: () => HV.cow(0, 0, 0), sheep: () => HV.sheep(0, 0, 0), pig: () => HV.pig(0, 0, 0), chicken: () => HV.chicken(0, 0, 0),
};
const KINDS: { key: 'all' | AnimalType; label: string }[] = [{ key: 'all', label: 'All' }, { key: 'cow', label: 'Cows' }, { key: 'sheep', label: 'Sheep' }, { key: 'pig', label: 'Pigs' }, { key: 'chicken', label: 'Chickens' }];

export function LivestockPanel({ tab = 'all' }: { tab?: string }) {
  const close = useGame(s => s.closePanel), open = useGame(s => s.openPanel), farm = useGame(s => s.farm), act = useGame(s => s.act);
  if (!farm) return null;
  const now = Date.now();
  const list = farm.animals.filter(a => tab === 'all' || a.kind === tab);
  const ready = farm.animals.filter(a => a.ready).length, hungry = farm.animals.filter(a => a.fedUntil < now).length;
  return (
    <Window title="Livestock" icon="cow" tabs={KINDS} tab={tab} onTab={k => open('livestock', k)} onClose={close} width={820}
      footer="Animals produce only while fed. Each bag of feed lasts several production cycles; unfed animals slowly lose health.">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <b>{farm.animals.length} animals</b><span className="text-muted">· {ready} ready · {hungry} hungry</span>
        {tab !== 'all' && <span className="text-muted">· space {farm.animals.filter(a => a.kind === tab).length}/{animalCapacity(farm, tab as AnimalType)}</span>}
        <span className="ml-auto flex gap-1.5">
          <button className="btn-gold !py-0.5" disabled={!ready} onClick={() => act({ type: 'collectAll' })}>Collect all</button>
          <button className="btn-wood !py-0.5" disabled={!hungry} onClick={() => act({ type: 'feedAll' })}>Feed hungry</button>
          <button className="btn-wood !py-0.5" onClick={() => open('shop', 'livestock')}>Buy animals</button>
        </span>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {list.map(a => {
          const rule = ANIMAL_RULES[a.kind], fed = a.fedUntil > now, feedLeft = farm.inventory[rule.feed] ?? 0;
          return (
            <Card key={a.id} className="flex items-center gap-3">
              <span className="grid size-14 shrink-0 place-items-center border-2 border-wood bg-[#9fd3e6] shadow-[inset_0_-10px_0_#5fb44b]"><SpriteThumb draw={ANIMAL_DRAW[a.kind]} box={44} /></span>
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between gap-1"><b className="text-sm">{a.name}</b><span className={`border-2 px-1 ${a.ready ? 'border-leaf bg-[#e6f2d0] font-bold text-up' : 'border-parch-d text-muted'}`}>{ITEM[rule.product].name}: {a.ready ? 'Ready' : fed ? fmtSecs(rule.cycle - a.progress) : 'paused'}</span></div>
                <div className="mt-1 grid grid-cols-[52px_1fr] items-center gap-x-2 gap-y-0.5">
                  <span className="text-muted">Health</span><Bar value={a.health} />
                  <span className="text-muted">Output</span><Bar value={a.progress / rule.cycle} color="#e8b93c" />
                  <span className="text-muted">Fed</span><span className={fed ? '' : 'font-bold text-down'}>{fed ? fmtSecs((a.fedUntil - now) / 1000) : 'Hungry'}</span>
                </div>
                <div className="mt-1 flex gap-1">
                  {a.ready && <button className="btn-gold !px-1.5 !py-0 text-xs" onClick={() => act({ type: 'collect', animal: a.id })}>Collect</button>}
                  <button className="btn-wood !px-1.5 !py-0 text-xs" disabled={!feedLeft} onClick={() => act({ type: 'feed', animal: a.id })}>Feed ({feedLeft})</button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </Window>
  );
}
