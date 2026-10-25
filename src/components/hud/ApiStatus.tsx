'use client';
import { useEffect, useState } from 'react';
import { API_URL, fetchStatus } from '@/lib/api';

type State = { kind: 'checking' } | { kind: 'online'; env: string; commit: string } | { kind: 'offline' };

/** Small connection light for the backend API; re-checks every minute. */
export function ApiStatus() {
  const [state, setState] = useState<State>({ kind: 'checking' });
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 6000);
      try { const s = await fetchStatus(ctrl.signal); if (alive) setState({ kind: 'online', env: s.environment, commit: s.commit }); }
      catch { if (alive) setState({ kind: 'offline' }); }
      finally { clearTimeout(timer); }
    };
    void check();
    const id = setInterval(check, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  const dot = state.kind === 'online' ? 'bg-[#4ce06a]' : state.kind === 'offline' ? 'bg-down' : 'bg-gold animate-pulse';
  const text = state.kind === 'online' ? `API online · ${state.commit}` : state.kind === 'offline' ? 'API offline' : 'Checking API…';
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted" title={API_URL}>
      <i className={`inline-block size-2 border border-wood-d ${dot}`} />{text}
    </span>
  );
}
