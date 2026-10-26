// Scheduled background work. With Redis, jobs run through BullMQ (repeatable,
// retried, shared safely across instances); without it, plain timers do the same
// work in this process for development.
import { Queue, Worker } from 'bullmq';
import type { Store, LeaderRow } from './store/types';
import type { MarketService } from './market/service';
import { MARKET } from '../../shared/market';

export const LEADERBOARD_EVERY_MS = 60_000;
/** Monthly reference data is checked a few times a day. */
export const REFERENCES_EVERY_MS = 6 * 3600_000;

export class Jobs {
  leaderboard: LeaderRow[] = [];
  leaderboardAt = 0;
  readonly mode: 'bullmq' | 'timers';
  private queue?: Queue;
  private worker?: Worker;
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private store: Store, redisUrl: string | undefined, runWorker: boolean, private log: (msg: string, extra?: unknown) => void,
    private market?: MarketService, private onPublished: (at: number) => void = () => {},
  ) {
    this.mode = redisUrl ? 'bullmq' : 'timers';
    // every instance keeps its quotes fresh from the database, whether or not it runs the jobs
    if (market) { void market.reload().catch(e => log('market reload failed', (e as Error).message)); this.timers.push(setInterval(() => void market.reload().catch(() => {}), 60_000).unref()); }
    if (!runWorker) return;
    if (redisUrl) {
      const connection = { url: redisUrl, maxRetriesPerRequest: null };
      this.queue = new Queue('harvestia', { connection });
      void this.queue.upsertJobScheduler('leaderboard', { every: LEADERBOARD_EVERY_MS }, { name: 'leaderboard' });
      void this.queue.upsertJobScheduler('cleanup', { pattern: '0 4 * * *' }, { name: 'cleanup' });
      if (market) {
        void this.queue.upsertJobScheduler('market-references', { every: REFERENCES_EVERY_MS }, { name: 'market-references' });
        void this.queue.upsertJobScheduler('market-publish', { every: MARKET.publishEveryMs }, { name: 'market-publish' });
      }
      this.worker = new Worker('harvestia', async job => {
        switch (job.name) {
          case 'cleanup': return this.cleanup();
          case 'market-references': return this.refreshReferences();
          case 'market-publish': return this.publishPrices();
          default: return this.refreshLeaderboard();
        }
      }, { connection });
      this.worker.on('failed', (job, err) => this.log('job failed', { job: job?.name, err: err.message }));
    } else {
      this.timers.push(setInterval(() => void this.refreshLeaderboard(), LEADERBOARD_EVERY_MS));
      this.timers.push(setInterval(() => void this.cleanup(), 86_400_000));
      if (market) {
        this.timers.push(setInterval(() => void this.refreshReferences(), REFERENCES_EVERY_MS));
        this.timers.push(setInterval(() => void this.publishPrices(), MARKET.publishEveryMs));
      }
    }
    void this.refreshLeaderboard();
    if (market) void this.warmUp();
  }

  /** On start: fetch references if we have none and publish if the last price is missing or overdue. */
  private async warmUp() {
    try {
      const snap = this.market!.snapshot ?? await this.market!.reload();
      if (snap.commodities.some(c => c.ref && c.ref.status === 'none')) await this.refreshReferences();
      const last = Math.max(0, ...snap.commodities.map(c => c.price?.at ?? 0));
      if (Date.now() - last >= MARKET.publishEveryMs) await this.publishPrices();
    } catch (e) { this.log('market warm-up failed', (e as Error).message); }
  }

  async refreshReferences() {
    const r = await this.market!.refreshReferences();
    this.log('market references', r);
    return r;
  }

  async publishPrices() {
    const r = await this.market!.publish();
    this.onPublished(Date.now());
    return r;
  }

  async refreshLeaderboard() {
    this.leaderboard = await this.store.leaderboard(20);
    this.leaderboardAt = Date.now();
    return { rows: this.leaderboard.length };
  }

  async cleanup() {
    const r = await this.store.cleanup(new Date(), 30);
    this.log('cleanup', r);
    return r;
  }

  async close() {
    for (const t of this.timers) clearInterval(t);
    await Promise.allSettled([this.worker?.close(), this.queue?.close()]);
  }
}
