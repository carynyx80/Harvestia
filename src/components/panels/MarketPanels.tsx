'use client';
// Commodity exchange, wallet & vault, and the co-op / competition previews.
import { useEffect, useMemo, useRef, useState } from 'react';
import HV from '@/game/art/sprites';
import { VAULT_FEES } from '@/game/data/economy';
import { tradeTotal, type RefInfo } from '../../../shared/market';
import { tradeUsed } from '@/game/sim/engine';
import { useGame } from '@/store/game';
import { getLeaderboard, getMarketHistory, type LeaderRow, type MarketHistory } from '@/lib/api';
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
    if (data.length < 2) return;
    // one column per pixel, interpolated between points, so the line is continuous
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

const STATUS: Record<RefInfo['status'], [string, string]> = {
  ok: ['Reference in use', 'bg-leaf text-white'],
  outage: ['Provider unreachable — using last valid value', 'bg-gold text-ink'],
  stale: ['Stale — not used until new data arrives', 'bg-down text-white'],
  none: ['No reference data yet', 'bg-parch-d text-ink'],
};
const fmtRef = (r: RefInfo) => r.value === null ? '—' : r.unit === 'US¢/lb' ? `${r.value.toFixed(1)}¢/lb` : `$${r.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}/t`;
const fmtMonth = (p: string | null) => p ? new Date(`${p}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';
const ago = (t: number) => { const m = Math.round((Date.now() - t) / 60_000); return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };
const drawCrop = (key: string) => () => HV.crop(key, 3, 8, 15);

export function ExchangePanel({ tab = 'wheat' }: { tab?: string }) {
  const close = useGame(s => s.closePanel), open = useGame(s => s.openPanel), market = useGame(s => s.market), farm = useGame(s => s.farm), act = useGame(s => s.act);
  const c = market?.commodities.find(x => x.key === tab) ?? market?.commodities[0];
  const [view, setView] = useState<'game' | 'reference'>('game');
  const [side, setSide] = useState<'buy' | 'sell'>('sell');
  const [qty, setQty] = useState(10);
  const [hist, setHist] = useState<MarketHistory | null>(null);
  const key = c?.key, publishedAt = c?.price?.at, traded = farm?.stats.traded ?? 0;
  // refetch on new prices and after the player's own trades land
  useEffect(() => {
    if (!key) return;
    let alive = true;
    getMarketHistory(key, 7).then(h => alive && setHist(h), () => alive && setHist(null));
    return () => { alive = false; };
  }, [key, publishedAt, traded]);
  const draw = useMemo(() => drawCrop(c?.key ?? 'wheat'), [c?.key]);

  if (!market || !c) {
    return (
      <Window title="Commodity Exchange" icon="chart" onClose={close} width={560}>
        <p className="m-0 text-sm">{useGame.getState().connection === 'offline' ? 'The exchange can’t be reached right now. Prices and trading come back as soon as the farm server does.' : 'Loading market prices…'}</p>
      </Window>
    );
  }

  const price = c.price, ref = c.ref;
  const unitPrice = price ? (side === 'buy' ? price.ask : price.bid) : 0;
  const t = tradeTotal(side, qty, unitPrice);
  const have = farm?.inventory[c.item] ?? 0;
  const used = farm ? tradeUsed(farm, c.item, side, Date.now()) : 0;
  const left = market.rules.perDay - used;
  const block = !price ? 'No price published yet' : qty > market.rules.perOrder ? `Max ${market.rules.perOrder} per order` : qty > left ? `Only ${left} left today` : side === 'sell' && qty > have ? `You have ${have}` : side === 'buy' && (farm?.coins ?? 0) < t.total ? 'Not enough coins' : '';
  const series = view === 'game' ? (hist?.prices.map(p => p.mid) ?? []) : (hist?.reference.map(r => r.value) ?? []);
  const up = series.length > 1 ? series[series.length - 1] >= series[0] : true;

  return (
    <Window title="Commodity Exchange" icon="chart" onClose={close} width={1000}
      footer={<>In-game prices are set by the server every {market.rules.publishEveryMs / 60_000} minutes from a bounded formula: each update moves at most ±{market.rules.step * 100}% and stays within ±{market.rules.dayBand * 100}% of the price a day earlier. Real-market references are monthly averages and can move a game price only {Math.round((1 - market.rules.refBounds[0]) * 100)}% down or {Math.round((market.rules.refBounds[1] - 1) * 100)}% up. Virtual crops are not claims on physical commodities.</>}>
      <div className="grid gap-3 lg:grid-cols-[200px_1fr_260px]">
        <div className="flex flex-col gap-1">
          {market.commodities.map(x => (
            <button key={x.key} onClick={() => open('exchange', x.key)} className={`flex items-center gap-2 border-2 px-2 py-1 text-left text-sm ${x.key === c.key ? 'border-gold bg-[#fff0b8]' : 'border-wood bg-[#e9d29c] hover:bg-parch-l'}`}>
              <SpriteThumb draw={drawCrop(x.key)} box={20} maxScale={2} />
              <span className="flex-1 leading-tight"><b>{x.name}</b><small className="block text-[10px] text-muted">{x.ref ? (x.ref.status === 'ok' ? 'Real-market referenced' : `Reference ${x.ref.status}`) : 'In-game only'}</small></span>
              <span className="text-right leading-tight"><b className="block">{x.price?.mid.toFixed(2) ?? '—'}</b>
                {x.change24h !== null && <small className={`block text-[11px] font-bold ${x.change24h >= 0 ? 'text-up' : 'text-down'}`}>{x.change24h >= 0 ? '▲' : '▼'}{Math.abs(x.change24h).toFixed(1)}%</small>}</span>
            </button>
          ))}
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-end gap-3">
            <SpriteThumb draw={draw} box={40} />
            <div><b className="text-2xl">{c.name}</b><div className="text-sm text-muted">{price ? `Published ${ago(price.at)} · ${c.volume24h.toLocaleString('en-US')} units traded in 24h` : 'Waiting for the first published price'}</div></div>
            {price && <div className="ml-auto text-right"><b className="text-2xl">{price.mid.toFixed(2)}</b> <span className="text-sm">coins / unit</span>
              <div className="text-sm">Exchange buys at <b className="text-up">{price.bid.toFixed(2)}</b> · sells at <b className="text-down">{price.ask.toFixed(2)}</b></div></div>}
          </div>

          {ref ? (
            <Card className="text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <b>Real-market reference</b>
                <span className={`border-2 border-wood-d px-1.5 text-[11px] font-bold ${STATUS[ref.status][1]}`}>{STATUS[ref.status][0]}</span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-4">
                <span className="text-muted">{ref.label}</span><b>{fmtRef(ref)}</b>
                <span className="text-muted">Month</span><b>{fmtMonth(ref.period)} average</b>
                <span className="text-muted">24-month average</span><b>{ref.average !== null && ref.usdPerTonne !== null && ref.value !== null ? fmtRef({ ...ref, value: ref.average * ref.value / ref.usdPerTonne }) : '—'}</b>
                <span className="text-muted">vs average</span><b className={(ref.ratio ?? 1) >= 1 ? 'text-up' : 'text-down'}>{ref.ratio !== null ? `${ref.ratio >= 1 ? '+' : ''}${((ref.ratio - 1) * 100).toFixed(1)}%` : '—'}</b>
              </div>
              <p className="m-0 mt-1 text-[11px] leading-snug text-muted">
                Source: {ref.attribution || ref.source}{ref.url && <> · <a className="underline" href={ref.url} target="_blank" rel="noreferrer">series</a></>}.
                {ref.fetchedAt && <> Checked {ago(ref.lastOkAt ?? ref.fetchedAt)}.</>}{ref.rejected > 0 && <> {ref.rejected} implausible value{ref.rejected > 1 ? 's' : ''} rejected.</>}{ref.lastError && <> Last error: {ref.lastError}.</>}
              </p>
            </Card>
          ) : <Card className="text-sm"><b>No real-world reference.</b> {c.name} is priced only by in-game supply and demand, season and balancing.</Card>}

          <div className="flex items-center gap-1 text-xs">
            <button onClick={() => setView('game')} className={`${view === 'game' ? 'btn-gold' : 'btn-wood'} !px-2 !py-0`}>Game price · 7D</button>
            {ref && <button onClick={() => setView('reference')} className={`${view === 'reference' ? 'btn-gold' : 'btn-wood'} !px-2 !py-0`}>Reference · 24M</button>}
            <span className="ml-auto text-muted">{series.length ? `${series.length} points` : 'No history yet'}</span>
          </div>
          <Chart data={series} up={up} />

          {price && (
            <Card>
              <b className="mb-1 block text-sm">How the in-game price is set</b>
              <table className="w-full text-xs"><tbody>
                <tr><td className="text-muted">Base value</td><td className="text-right">{price.base.toFixed(2)}</td></tr>
                {price.parts.map(p => <tr key={p.key}><td className="text-muted">× {p.label}</td><td className="text-right">{p.value.toFixed(3)}</td></tr>)}
                <tr className="border-t border-parch-d"><td>Target</td><td className="text-right">{price.target.toFixed(2)}</td></tr>
                <tr className="font-bold"><td>Published price (moves toward the target in bounded steps)</td><td className="text-right">{price.mid.toFixed(2)}</td></tr>
              </tbody></table>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Card className="flex flex-col gap-1.5">
            <div className="grid grid-cols-2 gap-1">{(['buy', 'sell'] as const).map(s => <button key={s} onClick={() => setSide(s)} className={`${side === s ? (s === 'buy' ? 'bg-leaf text-white' : 'bg-down text-white') : 'bg-parch'} border-2 border-wood-d py-1 text-sm font-bold capitalize`}>{s}</button>)}</div>
            <label className="flex items-center justify-between text-sm">Quantity
              <span className="flex items-center gap-1"><button className="btn-wood !px-2 !py-0" onClick={() => setQty(q => Math.max(1, q - 5))}>−</button><input value={qty} onChange={e => setQty(Math.max(1, Math.min(market.rules.perOrder, Number(e.target.value.replace(/\D/g, '')) || 1)))} className="w-14 border-2 border-wood bg-parch-l px-1 text-center" inputMode="numeric" aria-label="Quantity" /><button className="btn-wood !px-2 !py-0" onClick={() => setQty(q => Math.min(market.rules.perOrder, q + 5))}>+</button></span>
            </label>
            {side === 'sell' && have > 0 && <button className="self-end text-xs underline" onClick={() => setQty(Math.min(have, market.rules.perOrder, left))}>Sell max ({Math.min(have, market.rules.perOrder, left)})</button>}
            <div className="flex justify-between text-sm"><span className="text-muted">{side === 'buy' ? 'Ask' : 'Bid'} per unit</span><b>{unitPrice.toFixed(2)}</b></div>
            <div className="flex justify-between text-sm"><span className="text-muted">Fee ({market.rules.fee * 100}%)</span><b>{t.fee}</b></div>
            <div className="flex justify-between border-t border-parch-d pt-1 text-sm"><span>{side === 'buy' ? 'You pay' : 'You receive'}</span><b>{t.total.toLocaleString('en-US')} coins</b></div>
            <div className="text-xs text-muted">In storage: {have} · today {used}/{market.rules.perDay} {side === 'buy' ? 'bought' : 'sold'}</div>
            <button className="btn-gold" disabled={!!block} onClick={() => act({ type: 'trade', item: c.item, side, qty, limit: unitPrice })}>{block || `${side === 'buy' ? 'Buy' : 'Sell'} ${qty} at ${unitPrice.toFixed(2)}`}</button>
            <p className="m-0 text-[11px] leading-snug text-muted">Your order fills at this price or better. If the price moves against you first, the server refuses it and you can review the new price.</p>
          </Card>
          <Card className="text-xs">
            <b className="mb-1 block text-sm">Supply &amp; demand</b>
            <div className="flex justify-between"><span className="text-muted">Net sold to the exchange</span><b>{c.pressure.toLocaleString('en-US')} units</b></div>
            <div className="text-muted">Player selling pushes prices down, buying pushes them up. The effect fades by half every 6 hours.</div>
          </Card>
          <Card className="text-xs">
            <b className="mb-1 block text-sm">Recent trades</b>
            {hist?.trades.length ? hist.trades.slice(0, 8).map((x, k) => <div key={k} className="flex justify-between"><span className={x.side === 'sell' ? 'text-down' : 'text-up'}>{x.side === 'sell' ? 'Sold' : 'Bought'} {x.qty}</span><span>{x.price.toFixed(2)}</span><span className="text-muted">{ago(x.at)}</span></div>)
              : <span className="text-muted">No trades yet — be the first.</span>}
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
