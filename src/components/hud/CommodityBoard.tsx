'use client';
import { useEffect, useRef } from 'react';
import HV from '@/game/art/sprites';
import type { CropType } from '@/game/world/geometry';
import { Icon, Sprite } from './Icon';

// Demonstration values only — clearly labelled. Licensed reference feeds arrive in Stage 7.
const COMMODITIES: { name: string; unit: string; price: number; crop: CropType }[] = [
  { name: 'Wheat', unit: '/bu', price: 5.48, crop: 'wheat' }, { name: 'Corn', unit: '/bu', price: 4.27, crop: 'corn' },
  { name: 'Soybeans', unit: '/bu', price: 10.36, crop: 'soy' }, { name: 'Coffee', unit: '/lb', price: 2.61, crop: 'coffee' },
  { name: 'Cocoa', unit: '/t', price: 6840, crop: 'cocoa' },
];
const series = (i: number) => { let v = 100; return Array.from({ length: 28 }, (_, k) => (v += (HV.hash(k, i, 31) - .48) * 3.2)); };
const cropDraws = Object.fromEntries(COMMODITIES.map(c => [c.crop, () => HV.crop(c.crop, 3, 7, 14)]));

function Spark({ s, up }: { s: number[]; up: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext('2d'); if (!g) return;
    const mn = Math.min(...s), mx = Math.max(...s), line = up ? '#2f8a3a' : '#c23b2f', fill = up ? 'rgba(47,138,58,.15)' : 'rgba(194,59,47,.15)';
    g.clearRect(0, 0, 56, 18);
    let py: number | null = null;
    s.forEach((v, k) => {
      const x = k * 2, y = Math.round(16 - (v - mn) / (mx - mn || 1) * 14);
      g.fillStyle = fill; g.fillRect(x, y, 2, 18 - y);
      g.fillStyle = line; if (py !== null) g.fillRect(x, Math.min(py, y), 1, Math.abs(py - y) + 1); g.fillRect(x, y, 2, 1);
      py = y;
    });
  }, [s, up]);
  return <canvas ref={ref} width={56} height={18} className="pixel h-[18px] w-14" />;
}

export function CommodityBoard() {
  return (
    <aside className="panel pointer-events-auto absolute top-[72px] right-2.5 hidden w-[262px] px-3 py-2.5 text-sm lg:block">
      <div className="mb-1.5 flex items-center gap-1.5 text-base font-bold"><Icon name="chart" size={20} />Commodity Board <em className="tag ml-auto not-italic">SIMULATED</em></div>
      {COMMODITIES.map((c, i) => {
        const s = series(i), ch = (s[27] - s[20]) / s[20] * 100, up = ch >= 0;
        return (
          <div key={c.name} className="grid grid-cols-[22px_1fr_56px_52px] items-center gap-1.5 border-b border-parch-d py-[3px]">
            <Sprite w={14} h={14} scale={1.6} draw={cropDraws[c.crop]} />
            <div className="leading-none font-semibold">{c.name}<small className="block text-[11px] font-normal text-muted">sim {c.price >= 1000 ? c.price.toLocaleString('en-US') : `$${c.price.toFixed(2)}`}{c.unit}</small></div>
            <Spark s={s} up={up} />
            <div className={`text-right text-[13px] font-bold ${up ? 'text-up' : 'text-down'}`}>{up ? '▲' : '▼'} {Math.abs(ch).toFixed(1)}%</div>
          </div>
        );
      })}
      <p className="mt-1.5 text-[11px] leading-tight text-muted">Demo values — not live market data. Licensed reference feeds arrive in Stage 7 with source and timestamp.</p>
      <div className="mt-2 mb-1.5 flex items-center gap-1.5 border-t-2 border-dashed border-parch-d pt-2 font-bold"><Icon name="sun" size={20} />Forecast</div>
      <div className="grid grid-cols-4 gap-1 text-center text-xs">
        {([['Today', 'sun', '24°'], ['Tue', 'cloud', '21°'], ['Wed', 'rain', '18°'], ['Thu', 'sun', '25°']] as const).map(([d, i, t]) => (
          <div key={d} className="border-2 border-parch-d bg-parch-l pt-1 pb-0.5">{d}<Icon name={i} size={22} className="mx-auto my-0.5 block" /><b className="block">{t}</b></div>
        ))}
      </div>
    </aside>
  );
}
