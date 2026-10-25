'use client';
import { useState } from 'react';
import { useGame, type PanelId } from '@/store/game';
import { Icon, type IconName } from './Icon';

// key = camera focus in the world (none for inventory); panel = window to open
const NAV: { key: string; label: string; icon: IconName; panel: PanelId; tab?: string }[] = [
  { key: 'farm', label: 'My Farm', icon: 'home', panel: 'farm' },
  { key: 'inventory', label: 'Inventory', icon: 'bag', panel: 'inventory' },
  { key: 'livestock', label: 'Livestock', icon: 'cow', panel: 'livestock' },
  { key: 'machinery', label: 'Machinery', icon: 'tractor', panel: 'equipment' },
  { key: 'marketplace', label: 'Marketplace', icon: 'stall', panel: 'shop', tab: 'seeds' },
  { key: 'exchange', label: 'Commodity Exchange', icon: 'chart', panel: 'exchange' },
  { key: 'cooperative', label: 'Cooperative', icon: 'coop', panel: 'coop' },
  { key: 'competitions', label: 'Competitions', icon: 'trophy', panel: 'competitions' },
];

/** Main navigation: opens each window and flies the camera to its part of the world. */
export function LeftNav() {
  const requestFocus = useGame(s => s.requestFocus), openPanel = useGame(s => s.openPanel), panel = useGame(s => s.panel);
  const [active, setActive] = useState('farm');
  return (
    <nav className="panel pointer-events-auto absolute top-[118px] left-2.5 flex flex-col gap-1 p-[7px] sm:top-[128px]" aria-label="Zones">
      {NAV.map(n => (
        <button
          key={n.key}
          data-on={panel ? panel.id === n.panel : active === n.key}
          className="slot group relative grid size-[46px] place-items-center p-0"
          aria-label={n.label}
          onClick={() => {
            setActive(n.key);
            if (n.key !== 'inventory') requestFocus(n.key);
            openPanel(n.panel, n.tab);
          }}
        >
          <Icon name={n.icon} size={28} />
          <span className="pointer-events-none absolute top-2 left-[54px] z-10 hidden bg-wood-d px-2 py-1 text-sm whitespace-nowrap text-parch-l group-hover:block">{n.label}</span>
        </button>
      ))}
    </nav>
  );
}
