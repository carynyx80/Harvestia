// Client for the Harvestia backend API (Railway).
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'https://harvestia-api.up.railway.app').replace(/\/$/, '');

export interface ApiStatus { service: string; stage: number; environment: string; commit: string; time: string }

export async function fetchStatus(signal?: AbortSignal): Promise<ApiStatus> {
  const res = await fetch(`${API_URL}/v1/status`, { signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`API responded ${res.status}`);
  return res.json();
}
