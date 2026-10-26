'use client';
// Action feedback: toast messages and floating "+2 Wheat" labels in the world.
import { useGame } from '@/store/game';

const TOAST_TONE = {
  good: 'border-leaf bg-[#e6f2d0] text-ink',
  bad: 'border-down bg-[#f8dcd4] text-ink',
  info: 'border-wood bg-parch text-ink',
  level: 'border-gold bg-[#fff0b8] text-ink shadow-[0_0_0_3px_#f2c94c]',
};
const POP_TONE = { good: '#b9ec8a', gold: '#f7e08a', blue: '#a6dcf7' };

export function Toasts() {
  const toasts = useGame(s => s.toasts);
  return (
    <div className="pointer-events-none absolute bottom-[164px] left-1/2 z-40 flex w-[min(420px,calc(100vw-20px))] -translate-x-1/2 flex-col-reverse items-center gap-1.5" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`animate-[toastIn_.18s_ease-out] border-[3px] px-3 py-1.5 text-sm font-semibold [clip-path:var(--notch)] ${TOAST_TONE[t.tone]}`}>
          {t.tone === 'level' ? '★ ' : ''}{t.text}
        </div>
      ))}
    </div>
  );
}

export function WorldPopups() {
  const popups = useGame(s => s.popups), cam = useGame(s => s.camera);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {popups.map(p => (
        <div key={p.id} className="absolute -translate-x-1/2 animate-[popUp_1.6s_ease-out_forwards] text-base font-bold whitespace-nowrap [text-shadow:0_2px_0_#2a1a10,2px_0_0_#2a1a10,-2px_0_0_#2a1a10,0_-2px_0_#2a1a10]"
          style={{ left: (p.x - cam.x) * cam.zoom, top: (p.y - cam.y) * cam.zoom, color: POP_TONE[p.tone] }}>{p.text}</div>
      ))}
    </div>
  );
}
