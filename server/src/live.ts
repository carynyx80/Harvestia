// Live channel: players connect over WebSocket and receive the online count and
// a village activity feed. Events fan out through Redis pub/sub when available,
// so several API instances share one feed.
import { Redis } from 'ioredis';
import type { WebSocket } from 'ws';

const CHANNEL = 'harvestia:live';
export interface LiveMessage { type: 'presence' | 'activity' | 'hello' | 'market'; online?: number; text?: string; at?: number }

export class LiveHub {
  private sockets = new Set<WebSocket>();
  private pub?: Redis;
  private sub?: Redis;
  readonly recent: LiveMessage[] = [];

  constructor(redisUrl?: string) {
    if (!redisUrl) return;
    this.pub = new Redis(redisUrl, { lazyConnect: false, maxRetriesPerRequest: 2 });
    this.sub = new Redis(redisUrl, { lazyConnect: false, maxRetriesPerRequest: 2 });
    this.sub.subscribe(CHANNEL).catch(() => {});
    this.sub.on('message', (_c, raw) => { try { this.deliver(JSON.parse(raw)); } catch { /* ignore malformed */ } });
  }

  get online() { return this.sockets.size; }

  add(ws: WebSocket) {
    this.sockets.add(ws);
    ws.send(JSON.stringify({ type: 'hello', online: this.online, recent: this.recent }));
    this.broadcastPresence();
    ws.on('close', () => { this.sockets.delete(ws); this.broadcastPresence(); });
  }

  /** Publishes a public activity line to every connected player (on every instance). */
  activity(text: string) {
    const msg: LiveMessage = { type: 'activity', text, at: Date.now() };
    if (this.pub) this.pub.publish(CHANNEL, JSON.stringify(msg)).catch(() => this.deliver(msg));
    else this.deliver(msg);
  }

  /** Tells every player that new market prices were published (they refetch /v1/market). */
  market(at: number) {
    const msg: LiveMessage = { type: 'market', at };
    if (this.pub) this.pub.publish(CHANNEL, JSON.stringify(msg)).catch(() => this.deliver(msg));
    else this.deliver(msg);
  }

  private deliver(msg: LiveMessage) {
    if (msg.type === 'activity') { this.recent.unshift(msg); this.recent.length = Math.min(this.recent.length, 12); }
    const raw = JSON.stringify(msg);
    for (const ws of this.sockets) if (ws.readyState === 1) ws.send(raw);
  }

  private broadcastPresence() {
    const raw = JSON.stringify({ type: 'presence', online: this.online });
    for (const ws of this.sockets) if (ws.readyState === 1) ws.send(raw);
  }

  async close() {
    for (const ws of this.sockets) ws.close();
    await Promise.allSettled([this.pub?.quit(), this.sub?.quit()]);
  }
}
