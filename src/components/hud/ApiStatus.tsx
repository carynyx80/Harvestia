'use client';
import { API_URL } from '@/lib/api';
import { useGame } from '@/store/game';

/** Connection light for the farm server, with how many farmers are online. */
export function ApiStatus() {
  const connection = useGame(s => s.connection), online = useGame(s => s.live.online);
  const dot = connection === 'online' ? 'bg-[#4ce06a]' : connection === 'offline' ? 'bg-down' : 'bg-gold animate-pulse';
  const text = connection === 'online' ? `Online · ${online} farmer${online === 1 ? '' : 's'} here` : connection === 'offline' ? 'Offline · retrying' : 'Connecting…';
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted" title={API_URL}>
      <i className={`inline-block size-2 border border-wood-d ${dot}`} />{text}
    </span>
  );
}
