// Server-authoritative farm logic: every read advances timers using the
// server's clock and world, every action is validated, sequenced, applied with
// the shared engine and written to the audit log.
import { tick, type FarmEvent } from '../../shared/sim/engine';
import { applyAction, parseAction } from '../../shared/sim/actions';
import type { FarmState } from '../../shared/sim/state';
import { worldAt } from '../../shared/world';
import type { Store } from './store/types';

export const conditionsAt = (now: number) => { const w = worldAt(now); return { weather: w.weather, season: w.season }; };

export async function readFarm(store: Store, playerId: string, now: number) {
  return store.withFarm(playerId, farm => {
    const state = tick(farm.state, now, conditionsAt(now));
    return { next: { ...farm, state }, value: { farmId: farm.id, name: farm.name, state, lastSeq: farm.lastSeq } };
  });
}

export interface ActionOutcome {
  status: 200 | 400 | 409;
  body: { ok: boolean; state?: FarmState; events?: FarmEvent[]; error?: string; lastSeq?: number; duplicate?: boolean };
  /** set when the action is worth telling the village about */
  activity?: string;
}

/** Applies one client action. `seq` must be higher than any applied before (stops replays and double-sends). */
export async function runAction(store: Store, playerId: string, seq: unknown, raw: unknown, now: number): Promise<ActionOutcome> {
  const action = parseAction(raw);
  if (!action) return { status: 400, body: { ok: false, error: 'Invalid action' } };
  if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 1 || seq > 2 ** 31 - 1) return { status: 400, body: { ok: false, error: 'Invalid sequence number' } };

  return store.withFarm<ActionOutcome>(playerId, farm => {
    if (seq <= farm.lastSeq) {
      // already applied (a retry) or replayed: return the authoritative state without re-applying
      return { value: { status: 409, body: { ok: false, duplicate: true, error: 'Action already processed', state: farm.state, lastSeq: farm.lastSeq } } };
    }
    const c = conditionsAt(now);
    const ticked = tick(farm.state, now, c);
    const r = applyAction(ticked, action, now, c);
    return {
      next: { ...farm, state: r.state, lastSeq: seq },
      log: { seq, type: action.type, payload: action, ok: !r.error, error: r.error },
      value: { status: 200, body: { ok: !r.error, state: r.state, events: r.events, error: r.error, lastSeq: seq }, activity: r.error ? undefined : describe(farm.name, r.events, ticked, r.state) },
    };
  });
}

/** A short public line for notable moments (big harvests, level-ups, new animals and land). */
function describe(name: string, events: FarmEvent[], before: FarmState, after: FarmState): string | undefined {
  if (after.level > before.level) return `${name} reached level ${after.level}`;
  const harvested = (after.stats.harvested ?? 0) - (before.stats.harvested ?? 0);
  if (harvested >= 10) return `${name} harvested ${harvested} crops`;
  if (after.animals.length > before.animals.length) return `${name} welcomed a new ${after.animals[after.animals.length - 1].kind}`;
  if (after.plots.filter(p => p.unlocked).length > before.plots.filter(p => p.unlocked).length) return `${name} bought new land`;
  void events;
  return undefined;
}

/**
 * Flags inhumanly fast play. Real clicking tops out around 8–10 actions a
 * second; scripts go far faster. Returns true when the action should be refused.
 */
export class SpeedGuard {
  private hits = new Map<string, number[]>();
  private flagged = new Map<string, number>();
  constructor(private limitPerSecond = 15, private onFlag: (playerId: string, detail: unknown) => void = () => {}) {}
  tooFast(playerId: string, now: number) {
    const list = (this.hits.get(playerId) ?? []).filter(t => now - t < 1000);
    list.push(now); this.hits.set(playerId, list);
    if (list.length <= this.limitPerSecond) return false;
    if (now - (this.flagged.get(playerId) ?? 0) > 60_000) { this.flagged.set(playerId, now); this.onFlag(playerId, { actionsPerSecond: list.length }); }
    return true;
  }
}
