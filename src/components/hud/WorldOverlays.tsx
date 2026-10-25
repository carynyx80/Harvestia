'use client';
import { useGame } from '@/store/game';
import { ApiStatus } from './ApiStatus';
import { Icon } from './Icon';

const LABELS: [string, number, number][] = [
  ['Livestock Ranch', 140, 22], ['Main Farm', 238, 214], ['Mill & Industry', 520, 96],
  ['Marketplace', 850, 68], ['Co-op Village', 900, 330], ['Riverside', 112, 600],
];

/** Zone plaques that follow the camera. */
export function ZoneLabels() {
  const cam = useGame(s => s.camera);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {LABELS.map(([t, x, y]) => (
        <div key={t} className="zone-label absolute -translate-x-1/2 -translate-y-1/2" style={{ left: (x - cam.x) * cam.zoom, top: (y - cam.y) * cam.zoom }}>{t}</div>
      ))}
    </div>
  );
}

export function HoverTip() {
  const h = useGame(s => s.hover);
  if (!h) return null;
  return (
    <div className="pointer-events-none absolute z-20 border-2 border-gold bg-wood-d px-2 py-1 text-sm whitespace-nowrap text-parch-l" style={{ left: h.sx + 14, top: h.sy + 14 }}>
      {h.label}<small className="ml-1.5 text-parch-d">{h.sub}</small>
    </div>
  );
}

/** Frame around the Phaser minimap camera (the map itself is drawn by Phaser). */
export function MinimapFrame() {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 hidden h-[132px] w-[204px] border-[3px] border-wood-d shadow-[inset_0_0_0_3px_#f4e4bc] md:block" aria-hidden />
  );
}

export function ViewControls() {
  const zoom = useGame(s => s.camera.zoom), grid = useGame(s => s.grid), toggleGrid = useGame(s => s.toggleGrid), requestZoom = useGame(s => s.requestZoom);
  return (
    <div className="panel pointer-events-auto absolute right-2.5 bottom-2.5 hidden w-[262px] px-3 py-2.5 lg:block">
      <div className="flex items-center justify-between">
        <b className="text-base">Stage 2 · Playable world</b>
        <a href="/concept/index.html" className="text-xs text-muted underline">Stage 1 art</a>
      </div>
      <div className="mt-1 text-xs text-muted">Drag or WASD to move · scroll to zoom · click anything</div>
      <div className="mt-1 mb-2"><ApiStatus /></div>
      <div className="flex items-center gap-1.5">
        <button className="btn-wood !px-2.5 !py-0.5" onClick={() => requestZoom(-1)} aria-label="Zoom out">−</button>
        <span className="w-12 text-center text-sm font-semibold">{zoom.toFixed(zoom % 1 ? 1 : 0)}×</span>
        <button className="btn-wood !px-2.5 !py-0.5" onClick={() => requestZoom(1)} aria-label="Zoom in">+</button>
        <button className={`${grid ? 'btn-gold' : 'btn-wood'} ml-auto !px-2.5 !py-0.5 text-sm`} onClick={toggleGrid} aria-pressed={grid}>Grid (G)</button>
      </div>
    </div>
  );
}

export function LoadingScreen() {
  const ready = useGame(s => s.ready);
  if (ready) return null;
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-[#0b0e13]">
      <div className="flex flex-col items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/harvestia-logo-480.png" alt="Harvestia" className="w-[min(360px,70vw)]" />
        <div className="flex items-center gap-2 text-parch-d"><Icon name="seed" size={20} className="animate-bounce" />Growing your world…</div>
      </div>
    </div>
  );
}
