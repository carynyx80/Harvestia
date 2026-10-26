'use client';
import { useEffect } from 'react';
import { useGame } from '@/store/game';
import { loadState, saveState } from '@/game/sim/state';
import { tick } from '@/game/sim/engine';

/**
 * Runs the farm on the client: loads the save (catching up on time spent away),
 * advances timers every second and autosaves. Stage 6 moves the authoritative
 * clock and saves to the server.
 */
export function FarmRuntime() {
  useEffect(() => {
    const st = useGame.getState();
    const now = Date.now();
    const loaded = loadState(now);
    const away = now - loaded.updatedAt;
    st.setFarm(tick(loaded, now, st.conditions()));
    if (away > 60_000) st.toast(`Welcome back! Your farm kept growing for ${Math.round(away / 60_000)} min while you were away`, 'info');

    let lastSave = 0;
    const id = setInterval(() => {
      const s = useGame.getState();
      if (!s.farm) return;
      const t = Date.now();
      const next = tick(s.farm, t, s.conditions());
      s.setFarm(next);
      if (t - lastSave > 5000) { saveState(next); lastSave = t; }
    }, 1000);
    const flush = () => { const f = useGame.getState().farm; if (f) saveState(f); };
    addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => { clearInterval(id); flush(); removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', flush); };
  }, []);
  return null;
}
