// Keeps the browser's farm in step with the server, which is authoritative.
//
// Actions are applied locally straight away (prediction), then sent in order
// with increasing sequence numbers. Each server reply replaces the confirmed
// state, and any actions still in flight are re-applied on top of it, so the
// screen never waits on the network yet always converges on the server's truth.
import { applyAction, type FarmAction } from '../../shared/sim/actions';
import { tick } from '../../shared/sim/engine';
import type { FarmState } from '../../shared/sim/state';
import { ApiError, getFarm, getMarket, loadSession, logout, openLive, postAction, resetFarm, saveSession, signInGuest, type Session } from './api';
import { loadState, saveState } from '@/game/sim/save';
import { pushEvents, setActionSender, useGame } from '@/store/game';

let token: string | null = null;
let seq = 0;
let confirmed: FarmState | null = null;
const pending: { seq: number; action: FarmAction }[] = [];
let flushing = false;
let retryDelay = 2000;
let live: { close(): void } | null = null;

const now = () => Date.now() + useGame.getState().serverOffset;

/** Loads the latest published prices; quotes for trades come from here. */
async function refreshMarket() {
  try { useGame.setState({ market: await getMarket() }); } catch { /* keep the last prices; trades re-check on the server */ }
}

/** Confirmed server state with every unconfirmed action re-applied on top. */
function rebase() {
  if (!confirmed) return;
  const st = useGame.getState(), c = st.conditions(), t = now();
  let s = tick(confirmed, t, c);
  for (const p of pending) { const r = applyAction(s, p.action, t, c); if (!r.error) s = r.state; }
  st.setFarm(s);
}

async function flush() {
  if (flushing || !token) return;
  flushing = true;
  try {
    while (pending.length) {
      const item = pending[0];
      try {
        const r = await postAction(token, item.seq, item.action);
        useGame.setState({ serverOffset: r.serverTime - Date.now(), connection: 'online' });
        retryDelay = 2000;
        pending.shift();
        if (r.state) confirmed = r.state;
        if (r.lastSeq && r.lastSeq > seq) seq = r.lastSeq;
        // the prediction said yes but the server said no (e.g. timing at a boundary): tell the player
        if (!r.ok && !r.duplicate && r.error) pushEvents([{ kind: 'toast', text: r.error, tone: 'bad' }]);
        if (!r.ok && item.action.type === 'trade') void refreshMarket();
        rebase();
      } catch (e) {
        if (e instanceof ApiError && e.status === 429) { pushEvents([{ kind: 'toast', text: 'Slow down a little — too many actions at once', tone: 'bad' }]); pending.shift(); rebase(); continue; }
        if (e instanceof ApiError && e.status < 500 && e.status !== 401) { pending.shift(); rebase(); continue; }
        // network or server trouble: keep the queue in order and try again
        useGame.setState({ connection: 'offline' });
        setTimeout(() => void flush(), retryDelay = Math.min(retryDelay * 2, 30_000));
        return;
      }
    }
  } finally { flushing = false; }
}

function send(action: FarmAction) {
  if (!token) { saveState(useGame.getState().farm!); return; } // offline play: local only
  pending.push({ seq: ++seq, action });
  void flush();
}

async function connect(given?: Session): Promise<boolean> {
  let session = given ?? loadSession();
  try {
    if (!session) { session = await signInGuest(); saveSession(session); }
    let f;
    try { f = await getFarm(session.token); }
    catch (e) {
      if (!(e instanceof ApiError && (e.status === 401 || e.status === 404))) throw e;
      session = await signInGuest(); saveSession(session); f = await getFarm(session.token);
    }
    token = session.token; seq = f.lastSeq; confirmed = f.state;
    useGame.setState({
      serverOffset: f.serverTime - Date.now(), connection: 'online',
      session: { playerId: session.player.id, playerName: session.player.name, farmId: f.farmId, farmName: f.name, wallet: session.player.wallet ?? null },
    });
    rebase();
    live?.close();
    live = openLive(token, m => {
      const st = useGame.getState();
      if (m.type === 'hello') useGame.setState({ live: { online: m.online ?? 0, feed: (m.recent ?? []).map(r => ({ text: r.text, at: r.at })) } });
      else if (m.type === 'presence') useGame.setState({ live: { ...st.live, online: m.online ?? 0 } });
      else if (m.type === 'market') void refreshMarket();
      else if (m.type === 'activity' && m.text) {
        useGame.setState({ live: { ...st.live, feed: [{ text: m.text, at: m.at ?? Date.now() }, ...st.live.feed].slice(0, 12) } });
        if (!m.text.startsWith(st.session?.farmName ?? '\u0000')) pushEvents([{ kind: 'toast', text: m.text, tone: 'info' }]);
      }
    });
    return true;
  } catch {
    return false;
  }
}

/** Starts syncing: signs in (as a guest the first time), loads the farm and keeps it fresh. */
export function startSync() {
  setActionSender(send);
  const st = useGame.getState();
  // show something immediately: the cached farm, then the server's copy replaces it
  if (!st.farm) st.setFarm(tick(loadState(Date.now()), Date.now(), st.conditions()));
  void refreshMarket();
  void connect().then(ok => {
    if (!ok) { useGame.setState({ connection: 'offline' }); pushEvents([{ kind: 'toast', text: "Can't reach the farm server — playing offline; progress here won't be saved to your account", tone: 'bad' }]); }
  });

  // local clock keeps crops and animals moving between server updates
  const tickId = setInterval(() => {
    const s = useGame.getState();
    if (s.farm) s.setFarm(tick(s.farm, now(), s.conditions()));
  }, 1000);
  // periodic resync (and reconnect when the server comes back)
  const syncId = setInterval(async () => {
    if (!token) { await connect(); return; }
    if (pending.length) return;
    try {
      const f = await getFarm(token);
      confirmed = f.state; if (f.lastSeq > seq) seq = f.lastSeq;
      useGame.setState({ serverOffset: f.serverTime - Date.now(), connection: 'online' });
      rebase();
    } catch { useGame.setState({ connection: 'offline' }); }
  }, 30_000);
  const cacheId = setInterval(() => { const f = useGame.getState().farm; if (f) saveState(f); }, 10_000);
  const marketId = setInterval(() => void refreshMarket(), 60_000);
  return () => { clearInterval(tickId); clearInterval(syncId); clearInterval(cacheId); clearInterval(marketId); live?.close(); setActionSender(null); };
}

/** The current session token (for wallet sign-in, which links the wallet to this guest farm). */
export const currentToken = () => token;

/** Switches to a session returned by wallet sign-in: drops queued actions for the old farm and loads the new one. */
export async function adoptSession(session: Session) {
  saveSession(session);
  pending.length = 0; token = null; confirmed = null;
  const ok = await connect(session);
  if (!ok) useGame.setState({ connection: 'offline' });
  return ok;
}

/** Ends this session and starts a fresh guest farm. A wallet-linked farm comes back by signing in with the wallet again. */
export async function signOut() {
  const t = token;
  if (t) await logout(t).catch(() => {});
  saveSession(null);
  pending.length = 0; token = null; confirmed = null;
  useGame.setState({ session: null });
  return connect();
}

/** Starts the farm over on the server. */
export async function resetOnlineFarm() {
  if (!token) return false;
  const r = await resetFarm(token);
  pending.length = 0; confirmed = r.state; if (r.lastSeq > seq) seq = r.lastSeq;
  rebase();
  return true;
}
