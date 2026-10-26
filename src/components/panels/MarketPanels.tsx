'use client';
// Commodity exchange, wallet & vault, and the co-op / competition previews.
import { useEffect, useMemo, useRef, useState } from 'react';
import HV from '@/game/art/sprites';
import { COMMODITIES, change, orderBook, recentTrades, series, virtualPrice } from '@/game/data/market';
import { EXCHANGE_FEE, VAULT_FEES } from '@/game/data/economy';
import { useGame } from '@/store/game';
import { getLeaderboard, type LeaderRow } from '@/lib/api';
import { Card, SimTag, SpriteThumb, StageButton, Window } from '@/components/ui/kit';
import { Icon } from '@/components/hud/Icon';

function Chart({ data, up }: { data: number[]; up: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext('2d'); if (!g) return;
    const W = 240, H = 84, mn = Math.min(...data), mx = Math.max(...data), line = up ? '#2f8a3a' : '#c23b2f';
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#efdcae'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#e2c98f'; for (let y = 10; y < H; y += 18) g.fillRect(0, y, W, 1); for (let x = 0; x < W; x += 40) g.fillRect(x, 0, 1, H);
    // one column per pixel, interpolated between daily points, so the line is continuous
    let py: number | null = null;
    for (let x = 0; x < W; x++) {
      const t = x / (W - 1) * (data.length - 1), k = Math.floor(t), f = t - k;
      const v = data[k] + ((data[Math.min(k + 1, data.length - 1)] ?? data[k]) - data[k]) * f;
      const y = Math.round(H - 6 - (v - mn) / (mx - mn || 1) * (H - 14));
      g.fillStyle = up ? 'rgba(47,138,58,.18)' : 'rgba(194,59,47,.18)'; g.fillRect(x, y + 2, 1, H - y - 2);
      g.fillStyle = line; g.fillRect(x, py === null ? y : Math.min(py, y), 1, py === null ? 2 : Math.abs(py - y) + 2);
      py = y;
    }
    g.fillStyle = '#3b2414'; g.fillRect(W - 4, (py ?? 0) - 1, 4, 4);
  }, [data, up]);
  return <canvas ref={ref} width={240} height={84} className="pixel h-[168px] w-full border-2 border-wood" />;
}

export function ExchangePanel({ tab = 'wheat' }: { tab?: string }) {
  const close = useGame(s => s.closePanel), open = useGame(s => s.openPanel);
  const i = Math.max(0, COMMODITIES.findIndex(c => c.key === tab)), c = COMMODITIES[i];
  const [range, setRange] = useState(30);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [qty, setQty] = useState(10);
  const full = useMemo(() => series(i), [i]);
  const data = full.slice(-range), ch = change(full, 7), up = ch >= 0;
  const vp = virtualPrice(i), book = orderBook(vp.price, i), trades = recentTrades(vp.price, i);
  const draw = useMemo(() => () => HV.crop(c.key, 3, 8, 15), [c.key]);
  const total = qty * vp.price, fee = total * EXCHANGE_FEE;

  return (
    <Window title="Commodity Exchange" icon="chart" onClose={close} width={980}
      footer={<>All figures are <b>simulated</b>. In Stage 7, reference prices come from licensed data providers with source and timestamp, stale or outlier prices are rejected, and in-game prices move within bounded limits. Virtual crops are not claims on physical commodities.</>}>
      <div className="grid gap-3 lg:grid-cols-[190px_1fr_250px]">
        <div className="flex flex-col gap-1">
          {COMMODITIES.map((x, k) => {
            const s = series(k), d = change(s, 7);
            return (
              <button key={x.key} onClick={() => open('exchange', x.key)} className={`flex items-center gap-2 border-2 px-2 py-1 text-left text-sm ${k === i ? 'border-gold bg-[#fff0b8]' : 'border-wood bg-[#e9d29c] hover:bg-parch-l'}`}>
                <SpriteThumb draw={() => HV.crop(x.key, 3, 8, 15)} box={20} maxScale={2} />
                <span className="flex-1 leading-tight"><b>{x.name}</b><small className="block text-[10px] text-muted">{x.referenced ? 'Real-market referenced' : 'In-game only'}</small></span>
                <b className={d >= 0 ? 'text-up' : 'text-down'}>{d >= 0 ? '▲' : '▼'}{Math.abs(d).toFixed(1)}%</b>
              </button>
            );
          })}
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-end gap-3">
            <SpriteThumb draw={draw} box={40} />
            <div><b className="text-2xl">{c.name}</b><div className="text-sm text-muted">{c.referenced ? `Reference (sim): ${c.ref >= 1000 ? c.ref.toLocaleString('en-US') : `$${c.ref.toFixed(2)}`}/${c.unit}` : 'Priced by in-game supply and demand'}</div></div>
            <div className="ml-auto text-right"><b className="text-2xl">{vp.price.toFixed(2)}</b> <span className="text-sm">coins / unit</span><div className={`text-sm font-bold ${up ? 'text-up' : 'text-down'}`}>{up ? '▲' : '▼'} {Math.abs(ch).toFixed(1)}% · 7d</div></div>
          </div>
          <div className="flex items-center gap-1 text-xs">
            {[7, 30, 60].map(r => <button key={r} onClick={() => setRange(r)} className={`${range === r ? 'btn-gold' : 'btn-wood'} !px-2 !py-0`}>{r}D</button>)}
            <span className="ml-auto"><SimTag /></span>
          </div>
          <Chart data={data} up={up} />
          <Card>
            <b className="mb-1 block text-sm">How the in-game price is set</b>
            <table className="w-full text-xs"><tbody>
              <tr><td className="text-muted">Base value</td><td className="text-right">{vp.base.toFixed(2)}</td></tr>
              {vp.parts.map(p => <tr key={p.label}><td className="text-muted">× {p.label}</td><td className="text-right">{p.value.toFixed(3)}</td></tr>)}
              <tr className="border-t border-parch-d font-bold"><td>Price (daily move capped ±{vp.bound * 100}%)</td><td className="text-right">{vp.price.toFixed(2)}</td></tr>
            </tbody></table>
          </Card>
        </div>

        <div className="flex flex-col gap-2">
          <Card className="flex flex-col gap-1.5">
            <div className="grid grid-cols-2 gap-1">{(['buy', 'sell'] as const).map(s => <button key={s} onClick={() => setSide(s)} className={`${side === s ? (s === 'buy' ? 'bg-leaf text-white' : 'bg-down text-white') : 'bg-parch'} border-2 border-wood-d py-1 text-sm font-bold capitalize`}>{s}</button>)}</div>
            <label className="flex items-center justify-between text-sm">Quantity
              <span className="flex items-center gap-1"><button className="btn-wood !px-2 !py-0" onClick={() => setQty(q => Math.max(1, q - 5))}>−</button><input value={qty} onChange={e => setQty(Math.max(1, Math.min(9999, Number(e.target.value.replace(/\D/g, '')) || 1)))} className="w-14 border-2 border-wood bg-parch-l px-1 text-center" inputMode="numeric" aria-label="Quantity" /><button className="btn-wood !px-2 !py-0" onClick={() => setQty(q => q + 5)}>+</button></span>
            </label>
            <div className="flex justify-between text-sm"><span className="text-muted">Price</span><b>{vp.price.toFixed(2)}</b></div>
            <div className="flex justify-between text-sm"><span className="text-muted">Fee ({EXCHANGE_FEE * 100}%)</span><b>{fee.toFixed(2)}</b></div>
            <div className="flex justify-between border-t border-parch-d pt-1 text-sm"><span>{side === 'buy' ? 'You pay' : 'You receive'}</span><b>{(side === 'buy' ? total + fee : total - fee).toFixed(2)} coins</b></div>
            <StageButton stage={7} gold>Place {side} order</StageButton>
          </Card>
          <Card className="text-xs">
            <b className="mb-1 block text-sm">Order book</b>
            {book.asks.map(r => <div key={`a${r.price}`} className="flex justify-between text-down"><span>{r.price.toFixed(2)}</span><span>{r.qty}</span></div>)}
            <div className="my-0.5 border-y border-parch-d text-center font-bold">{vp.price.toFixed(2)}</div>
            {book.bids.map(r => <div key={`b${r.price}`} className="flex justify-between text-up"><span>{r.price.toFixed(2)}</span><span>{r.qty}</span></div>)}
          </Card>
          <Card className="text-xs">
            <b className="mb-1 block text-sm">Recent trades</b>
            {trades.map((t, k) => <div key={k} className="flex justify-between"><span className={t.side === 'buy' ? 'text-up' : 'text-down'}>{t.price.toFixed(2)}</span><span>{t.qty}</span><span className="text-muted">{t.ago}</span></div>)}
          </Card>
        </div>
      </div>
    </Window>
  );
}

export function WalletPanel() {
  const close = useGame(s => s.closePanel);
  return (
    <Window title="Wallet & Game Vault" icon="vault" onClose={close} width={760}
      footer="Harvestia never asks for your seed phrase or private key. Fees are proposals and are always shown before you confirm. Vault contracts will be audited before mainnet.">
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="flex flex-col gap-1">
          <div className="flex items-center gap-2"><Icon name="coin" /><b className="text-lg">Wallet balance</b></div>
          <b className="text-3xl text-gold-d">— HRV</b>
          <p className="m-0 text-sm leading-snug">Read automatically from the $HRV token on Robinhood Chain once you connect — no need to type your holdings. Refreshes after each confirmed transaction.</p>
        </Card>
        <Card className="flex flex-col gap-1">
          <div className="flex items-center gap-2"><Icon name="vault" /><b className="text-lg">Game Vault balance</b></div>
          <b className="text-3xl text-gold-d">— HRV</b>
          <p className="m-0 text-sm leading-snug">Tokens you deposit for spending in the game. Shop purchases, upgrades and marketplace trades settle from here.</p>
        </Card>
        <Card className="md:col-span-2">
          <div className="grid gap-2 text-center sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
            <div><b>Your wallet</b><div className="text-xs text-muted">Robinhood Chain</div></div>
            <div className="text-sm">deposit → <b>{VAULT_FEES.deposit * 100}% fee</b></div>
            <div><b>Game Vault</b><div className="text-xs text-muted">in-game balance</div></div>
            <div className="text-sm">← withdraw <b>{VAULT_FEES.withdraw * 100}% fee</b></div>
            <div><b>Purchases</b><div className="text-xs text-muted">50% burned · 50% reward treasury</div></div>
          </div>
        </Card>
        <Card className="md:col-span-2 flex flex-wrap items-center gap-2">
          <StageButton stage={8} gold>Connect wallet</StageButton><StageButton stage={8}>Deposit</StageButton><StageButton stage={8}>Withdraw</StageButton>
          <span className="ml-auto text-sm text-muted">Total burned: <b>0 HRV</b> · Reward treasury: <b>0 HRV</b></span>
        </Card>
      </div>
    </Window>
  );
}

export function CoopPanel() {
  const close = useGame(s => s.closePanel);
  const coops = [['Golden Sheaf', 24, 'Wheat & flour'], ['River Valley', 18, 'Dairy'], ['Bean Counters', 12, 'Coffee & cocoa'], ['Meadow Folk', 31, 'Mixed farming']] as const;
  return (
    <Window title="Cooperatives" icon="coop" onClose={close} width={700} footer="Preview of the co-op interface. Joining, pooled production and group contracts arrive in Stage 10.">
      <div className="mb-2"><SimTag>PREVIEW · STAGE 10</SimTag></div>
      <div className="grid gap-2 sm:grid-cols-2">
        {coops.map(([n, m, f]) => <Card key={n} className="flex items-center gap-2"><Icon name="coop" size={32} /><div className="flex-1"><b>{n}</b><div className="text-xs text-muted">{m} members · {f}</div></div><StageButton stage={10}>Join</StageButton></Card>)}
      </div>
    </Window>
  );
}

export function CompetitionsPanel() {
  const close = useGame(s => s.closePanel), me = useGame(s => s.session?.farmId);
  const [board, setBoard] = useState<{ rows: LeaderRow[]; updatedAt: number } | null | 'error'>(null);
  useEffect(() => { let alive = true; getLeaderboard().then(b => alive && setBoard(b), () => alive && setBoard('error')); return () => { alive = false; }; }, []);
  return (
    <Window title="Competitions" icon="trophy" onClose={close} width={700} footer="Competitions use non-redeemable play credits. Token wagering stays disabled pending legal review.">
      <div className="mb-2"><SimTag>PREVIEW · STAGE 10</SimTag></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card><b className="mb-1 block">Autumn harvest race</b><p className="m-0 text-sm">Harvest the most wheat in 10 game-minutes. Starts in 2 days.</p><div className="mt-2"><StageButton stage={10} gold>Enter (play credits)</StageButton></div></Card>
        <Card>
          <b className="mb-1 block">Farm leaderboard <span className="text-xs font-normal text-muted">· live, by level and XP</span></b>
          {board === null ? <p className="m-0 text-sm text-muted">Loading…</p>
            : board === 'error' ? <p className="m-0 text-sm text-down">Leaderboard unavailable — the farm server can&apos;t be reached.</p>
            : <ol className="m-0 list-none p-0 text-sm">{board.rows.slice(0, 10).map((r, k) => <li key={r.farmId} className={`flex justify-between gap-2 py-0.5 ${r.farmId === me ? 'font-bold' : ''}`}><span>{k + 1}. {r.name}{r.farmId === me ? ' (you)' : ''}</span><span>Lv {r.level} · {r.xp.toLocaleString('en-US')} XP</span></li>)}</ol>}
        </Card>
      </div>
    </Window>
  );
}
