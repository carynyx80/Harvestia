'use client';
// Launch gate: until gameplay opens, a countdown covers the (visible, blurred) world.
// The server also refuses farm actions before then, so this is not just cosmetic.
import { useEffect, useState } from 'react';
import { useGame } from '@/store/game';
import { LAUNCH_OPENS_AT, TOKEN_LAUNCH_AT } from '../../shared/launch';

const OPENS = Number(process.env.NEXT_PUBLIC_LAUNCH_OPENS_AT) || LAUNCH_OPENS_AT;
const pad = (n: number) => String(n).padStart(2, '0');
const OPEN_DATE = new Date(OPENS);
const OPEN_DAY = OPEN_DATE.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
const OPEN_TIME = OPEN_DATE.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
const TOKEN_DATE = new Date(TOKEN_LAUNCH_AT);
const TOKEN_DAY = TOKEN_DATE.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const TOKEN_TIME = TOKEN_DATE.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
const OPEN_FULL = OPEN_DATE.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export function LaunchGate() {
  const offset = useGame(s => s.serverOffset), toast = useGame(s => s.toast);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const t = now === null ? null : now + offset;
  const open = t !== null && t >= OPENS;
  useEffect(() => { if (open && now !== null && now + offset - OPENS < 5000) toast('The doors are open — welcome to Harvestia!', 'good'); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (t === null || open) return null;

  const left = Math.max(0, OPENS - t), d = Math.floor(left / 86_400_000), h = Math.floor(left / 3600_000) % 24, m = Math.floor(left / 60_000) % 60, s = Math.floor(left / 1000) % 60;
  const tokenLive = t >= TOKEN_LAUNCH_AT;
  return (
    <div className="pointer-events-auto absolute inset-0 z-[60] grid place-items-center bg-[#0b0e13]/70 p-4 backdrop-blur-[3px]" role="dialog" aria-modal="true" aria-label="Harvestia opens soon">
      <div className="panel flex w-[min(560px,100%)] flex-col items-center gap-3 px-6 py-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/harvestia-logo-480.png" alt="Harvestia" className="w-[min(300px,70vw)] drop-shadow-[0_3px_0_rgba(20,10,4,.55)]" />
        <b className="text-2xl leading-tight">Doors open {OPEN_DAY} at {OPEN_TIME} UTC</b>
        <span className="text-sm text-muted">{OPEN_FULL}</span>
        <div className="flex items-end gap-2" aria-live="polite">
          {[...(d > 0 ? [[d, d === 1 ? 'day' : 'days']] : []), [h, 'hours'], [m, 'min'], [s, 'sec']].map(([v, l]) => (
            <div key={l as string} className="flex w-20 flex-col items-center border-2 border-wood-d bg-parch-l py-1">
              <b className="text-4xl leading-none tabular-nums">{pad(v as number)}</b><small className="text-xs text-muted">{l}</small>
            </div>
          ))}
        </div>
        <p className="m-0 text-sm leading-snug">
          {tokenLive ? <><b>$HRV is live on Robinhood Chain.</b> </> : <><b>$HRV launches on Robinhood Chain on {TOKEN_DAY} at {TOKEN_TIME} UTC.</b> </>}
          The doors open one hour after the token. Your farm, the commodity exchange and wallet sign-in will be ready the moment they do.
        </p>
        <div className="flex gap-2">
          <a className="btn-gold" href="https://x.com/Harvestiaa" target="_blank" rel="noreferrer">Follow @Harvestiaa</a>
        </div>
      </div>
    </div>
  );
}
