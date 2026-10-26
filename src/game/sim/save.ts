// Browser cache of the farm, used offline and for instant start-up; the server copy is authoritative.
import { PLOTS } from '../world/geometry';
import { initialState, type FarmState } from '../../../shared/sim/state';

const KEY = 'harvestia.save.v1';

/** Local save until accounts and server persistence arrive in Stage 6. */
export function loadState(now: number): FarmState {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (raw) {
      const s = JSON.parse(raw) as FarmState;
      if (s && s.v === 1 && Array.isArray(s.plots) && s.plots.length === PLOTS.length) return s;
    }
  } catch { /* corrupt or blocked storage: start fresh */ }
  return initialState(now);
}
export function saveState(s: FarmState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full or blocked */ }
}
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
