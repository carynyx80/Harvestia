'use client';
import { useEffect } from 'react';
import { useGame, type PanelId } from '@/store/game';
import { InventoryPanel } from './InventoryPanel';
import { ShopPanel } from './ShopPanel';
import { EquipmentPanel, FarmPanel, LivestockPanel, ProfilePanel } from './FarmPanels';
import { CompetitionsPanel, CoopPanel, ExchangePanel } from './MarketPanels';
import { WalletPanel } from './WalletPanel';
import { ContractsPanel, ProcessingPanel } from './EconomyPanels';

const HOTKEYS: Record<string, [PanelId, string?]> = {
  i: ['inventory'], b: ['shop', 'seeds'], e: ['exchange'], r: ['processing'], c: ['contracts'], p: ['profile'], l: ['livestock'], m: ['equipment'], f: ['farm'], v: ['wallet'],
};

/** Shows the open game window and owns the window keyboard shortcuts. */
export function PanelHost() {
  const panel = useGame(s => s.panel);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) || e.metaKey || e.ctrlKey || e.altKey) return;
      const st = useGame.getState();
      if (e.key === 'Escape' && st.panel) { st.closePanel(); return; }
      const hk = HOTKEYS[e.key.toLowerCase()];
      if (hk) st.togglePanel(hk[0], hk[1]);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
  if (!panel) return null;
  const tab = panel.tab;
  switch (panel.id) {
    case 'inventory': return <InventoryPanel tab={tab} />;
    case 'shop': return <ShopPanel tab={tab} />;
    case 'profile': return <ProfilePanel />;
    case 'farm': return <FarmPanel />;
    case 'equipment': return <EquipmentPanel />;
    case 'livestock': return <LivestockPanel tab={tab} />;
    case 'exchange': return <ExchangePanel tab={tab} />;
    case 'processing': return <ProcessingPanel tab={tab} />;
    case 'contracts': return <ContractsPanel />;
    case 'wallet': return <WalletPanel />;
    case 'coop': return <CoopPanel />;
    case 'competitions': return <CompetitionsPanel />;
  }
}
