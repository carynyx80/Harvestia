'use client';
// Shared pixel-UI building blocks for game windows.
import { useEffect, useRef, type ReactNode } from 'react';
import HV from '@/game/art/sprites';
import { record, replay } from '@/game/render/atlas';
import type { Item } from '@/game/data/items';
import { Icon, type IconName } from '@/components/hud/Icon';

/** A game window: wooden title bar, optional tabs, parchment body. */
export function Window({ title, icon, tabs, tab, onTab, onClose, children, width = 880, footer }: {
  title: string; icon: IconName; tabs?: { key: string; label: string }[]; tab?: string; onTab?: (k: string) => void;
  onClose: () => void; children: ReactNode; width?: number; footer?: ReactNode;
}) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 grid place-items-center bg-[rgba(18,12,6,.35)] p-3 pt-16 pb-24" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-label={title} className="flex max-h-[calc(100vh-150px)] flex-col border-[3px] border-wood-d bg-parch shadow-[0_6px_0_rgba(0,0,0,.35)] [clip-path:var(--notch)]" style={{ width: `min(${width}px, 100%)` }}>
        <header className="flex flex-wrap items-center gap-2 border-b-[3px] border-wood-d bg-bark px-3 py-2 text-parch-l shadow-[inset_0_2px_0_#8a5a32]">
          <Icon name={icon} size={24} />
          <h2 className="m-0 mr-2 text-lg font-bold text-gold [text-shadow:0_2px_0_#2a1a10]">{title}</h2>
          {tabs && (
            <nav className="flex flex-wrap gap-1" role="tablist">
              {tabs.map(t => (
                <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => onTab?.(t.key)}
                  className={`border-2 px-2 py-0.5 text-sm font-semibold ${tab === t.key ? 'border-gold bg-parch text-ink' : 'border-wood-d bg-wood text-parch-l hover:bg-wood-l'}`}>{t.label}</button>
              ))}
            </nav>
          )}
          <button onClick={onClose} aria-label="Close" className="ml-auto grid size-8 place-items-center border-2 border-wood-d bg-wood-l text-lg font-bold text-parch-l hover:brightness-110">×</button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-3">{children}</div>
        {footer && <footer className="border-t-2 border-parch-d bg-[#efdcae] px-3 py-2 text-xs text-muted">{footer}</footer>}
      </section>
    </div>
  );
}

/** Draws a sprite at its natural pixel size into a canvas, scaled by a whole number to fit `box`. */
export function SpriteThumb({ draw, box = 48, maxScale = 4, className = '' }: { draw: () => void; box?: number; maxScale?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const rec = record(draw);
    const x0 = Math.floor(rec.x0), y0 = Math.floor(rec.y0), w = Math.max(1, Math.ceil(rec.x1) - x0), h = Math.max(1, Math.ceil(rec.y1) - y0);
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d')!; g.clearRect(0, 0, w, h); replay(g, rec, -x0, -y0);
    const s = Math.max(1, Math.min(maxScale, Math.floor(box / Math.max(w, h))));
    cv.style.width = `${w * s}px`; cv.style.height = `${h * s}px`;
  }, [draw, box, maxScale]);
  return <canvas ref={ref} className={`pixel ${className}`} />;
}

/** A 16×16 item icon (or a trimmed thumbnail for world sprites). */
export function ItemIcon({ item, size = 32 }: { item: Item; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (item.thumb) return;
    const g = ref.current?.getContext('2d'); if (!g) return;
    g.clearRect(0, 0, 16, 16); HV.use(g); item.art();
  }, [item]);
  if (item.thumb) return <span className="grid place-items-center" style={{ width: size, height: size }}><SpriteThumb draw={item.art} box={size} /></span>;
  return <canvas ref={ref} width={16} height={16} className="pixel" style={{ width: size, height: size }} />;
}

export function Bar({ value, color = '#7cc24c', className = '' }: { value: number; color?: string; className?: string }) {
  return (
    <div className={`h-2.5 border-2 border-wood-d bg-[#6b4a2e] ${className}`}>
      <i className="block h-full" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color, boxShadow: 'inset 0 2px 0 rgba(255,255,255,.35)' }} />
    </div>
  );
}

export function Stars({ n }: { n: number }) {
  return <span className="tracking-tighter text-gold-d" aria-label={`${n} star quality`}>{'★'.repeat(n)}<span className="text-parch-d">{'★'.repeat(3 - n)}</span></span>;
}

/** Marks demonstration values in the interface. */
export function SimTag({ children = 'SIMULATED' }: { children?: ReactNode }) {
  return <em className="tag self-start not-italic">{children}</em>;
}

/** A disabled action that says when it becomes available. */
export function StageButton({ children, stage, gold }: { children: ReactNode; stage: number; gold?: boolean }) {
  return (
    <button disabled className={`${gold ? 'btn-gold' : 'btn-wood'} cursor-not-allowed opacity-80`} title={`Available from Stage ${stage}`}>
      {children} <small className="ml-1 opacity-80">· Stage {stage}</small>
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`border-2 border-parch-d bg-parch-l p-2.5 ${className}`}>{children}</div>;
}
