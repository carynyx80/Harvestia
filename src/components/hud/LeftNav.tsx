'use client';
import { useState } from 'react';
import { useGame } from '@/store/game';
import { Icon, type IconName } from './Icon';

const NAV: { key: string; label: string; icon: IconName }[] = [
  { key: 'farm', label: 'My Farm', icon: 'home' },
  { key: 'inventory', label: 'Inventory', icon: 'bag' },
  { key: 'livestock', label: 'Livestock', icon: 'cow' },
  { key: 'machinery', label: 'Machinery', icon: 'tractor' },
  { key: 'marketplace', label: 'Marketplace', icon: 'stall' },
  { key: 'exchange', label: 'Commodity Exchange', icon: 'chart' },
  { key: 'cooperative', label: 'Cooperative', icon: 'coop' },
  { key: 'competitions', label: 'Competitions', icon: 'trophy' },
];

/** Zone navigation: each entry flies the camera to its part of the world. */
export function LeftNav() {
  const requestFocus = useGame(s => s.requestFocus);
  const [active, setActive] = useState('farm');
  const [notice, setNotice] = useState(false);
  return (
    <nav className="panel pointer-events-auto absolute top-[118px] left-2.5 flex flex-col gap-1 p-[7px] sm:top-[128px]" aria-label="Zones">
      {NAV.map(n => (
        <button
          key={n.key}
          data-on={active === n.key}
          className="slot group relative grid size-[46px] place-items-center p-0"
          aria-label={n.label}
          onClick={() => {
            setActive(n.key);
            if (n.key === 'inventory') { setNotice(true); setTimeout(() => setNotice(false), 2200); }
            else requestFocus(n.key);
          }}
        >
          <Icon name={n.icon} size={28} />
          <span className="pointer-events-none absolute top-2 left-[54px] z-10 hidden bg-wood-d px-2 py-1 text-sm whitespace-nowrap text-parch-l group-hover:block">{n.label}</span>
        </button>
      ))}
      {notice && <div className="absolute top-12 left-[64px] w-48 border-2 border-gold bg-wood-d px-2 py-1.5 text-sm text-parch-l">Inventory opens with the game UI in Stage 4.</div>}
    </nav>
  );
}
