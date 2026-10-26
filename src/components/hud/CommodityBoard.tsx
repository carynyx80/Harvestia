'use client';
import { useEffect, useMemo, useState } from 'react';
import HV from '@/game/art/sprites';
import { useGame } from '@/store/game';
import { DAY_SECONDS, isSnowing, temperature, type Weather } from '@/game/env/environment';
import { worldAt } from '../../../shared/world';
import { Icon, Sprite, type IconName } from './Icon';

const cropDraws: Record<string, () => void> = {};
const drawFor = (key: string) => (cropDraws[key] ??= () => HV.crop(key, 3, 7, 14));
const WEATHER_ICON: Record<Weather, IconName> = { sunny: 'sun', cloudy: 'cloud', rainy: 'rain', stormy: 'storm', drought: 'drought' };
const fmtRef = (unit: string, v: number) => unit === 'US¢/lb' ? `${v.toFixed(0)}¢/lb` : `$${Math.round(v).toLocaleString('en-US')}/t`;
const fmtMonth = (p: string) => new Date(`${p}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });

/** Real reference prices and in-game prices for the referenced crops, plus the shared world's forecast. */
export function CommodityBoard() {
  const open = useGame(s => s.openPanel), market = useGame(s => s.market), offset = useGame(s => s.serverOffset);
  const board = market?.commodities.filter(c => c.ref) ?? [];
  // the forecast is the world clock's own schedule, so it is exact; refresh it every game hour
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), DAY_SECONDS * 1000 / 24); return () => clearInterval(id); }, []);
  const forecast = useMemo(() => {
    void tick;
    const now = Date.now() + offset, today = worldAt(now);
    return [0, 1, 2, 3].map(k => {
      // midday of each game day
      const w = worldAt(now + ((k * 24 + 12 - today.hour) * DAY_SECONDS * 1000) / 24);
      return { label: k === 0 ? 'Today' : `Day ${w.seasonDay}`, weather: w.weather, season: w.season, temp: temperature(w.season, w.weather, 13) };
    });
  }, [tick, offset]);
  const sources = [...new Set(board.map(c => c.ref!.source))];

  return (
    <aside className="panel pointer-events-auto absolute top-[72px] right-2.5 hidden w-[262px] px-3 py-2.5 text-sm lg:block">
      <div className="mb-1.5 flex items-center gap-1.5 text-base font-bold"><Icon name="chart" size={20} />Commodity Board</div>
      {!market && <p className="m-0 text-xs text-muted">Loading market prices…</p>}
      {board.map(c => {
        const r = c.ref!, up = (c.change24h ?? 0) >= 0;
        return (
          <button key={c.key} onClick={() => open('exchange', c.key)} title={`Open ${c.name} in the exchange`} className="grid w-full grid-cols-[22px_1fr_auto] items-center gap-1.5 border-b border-parch-d py-[3px] text-left hover:bg-parch-l">
            <Sprite w={14} h={14} scale={1.6} draw={drawFor(c.key)} />
            <div className="leading-none font-semibold">{c.name}
              <small className={`block text-[11px] font-normal ${r.status === 'ok' ? 'text-muted' : 'text-down'}`}>
                {r.value !== null && r.period ? `${fmtRef(r.unit, r.value)} · ${fmtMonth(r.period)}` : 'no reference'}{r.status === 'stale' ? ' · stale' : r.status === 'outage' ? ' · cached' : ''}
              </small>
            </div>
            <div className="text-right leading-none"><b className="text-[13px]">{c.price?.mid.toFixed(2) ?? '—'}</b>
              {c.change24h !== null && <small className={`block text-[11px] font-bold ${up ? 'text-up' : 'text-down'}`}>{up ? '▲' : '▼'} {Math.abs(c.change24h).toFixed(1)}%</small>}
            </div>
          </button>
        );
      })}
      {!!board.length && <p className="mt-1.5 text-[11px] leading-tight text-muted">Real monthly averages from {sources.join(', ')}. Right: in-game coins per unit and 24h change.</p>}
      <div className="mt-2 mb-1.5 flex items-center gap-1.5 border-t-2 border-dashed border-parch-d pt-2 font-bold"><Icon name="sun" size={20} />Forecast</div>
      <div className="grid grid-cols-4 gap-1 text-center text-xs">
        {forecast.map(f => (
          <div key={f.label} className="border-2 border-parch-d bg-parch-l pt-1 pb-0.5">{f.label}<Icon name={isSnowing(f.season, f.weather) ? 'snow' : WEATHER_ICON[f.weather]} size={22} className="mx-auto my-0.5 block" /><b className="block">{f.temp}°</b></div>
        ))}
      </div>
    </aside>
  );
}
