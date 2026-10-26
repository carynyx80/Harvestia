// Scheduled background work. With Redis, jobs run through BullMQ (repeatable,
// retried, shared safely across instances); without it, plain timers do the same
// work in this process for development.
import { Queue, Worker } from 'bullmq';
import type { Store, LeaderRow } from './store/types';

export const LEADERBOARD_EVERY_MS = 60_000;

export class Jobs {
  leaderboard: LeaderRow[] = [];
  leaderboardAt = 0;
  readonly mode: 'bullmq' | 'timers';
  private queue?: Queue;
  private worker?: Worker;
  private timers: NodeJS.Timeout[] = [];

  constructor(private store: Store, redisUrl: string | undefined, runWorker: boolean, private log: (msg: string, extra?: unknown) => void) {
    this.mode = redisUrl ? 'bullmq' : 'timers';
    if (!runWorker) return;
    if (redisUrl) {
      const connection = { url: redisUrl, maxRetriesPerRequest: null };
      this.queue = new Queue('harvestia', { connection });
      void this.queue.upsertJobScheduler('leaderboard', { every: LEADERBOARD_EVERY_MS }, { name: 'leaderboard' });
      void this.queue.upsertJobScheduler('cleanup', { pattern: '0 4 * * *' }, { name: 'cleanup' });
      this.worker = new Worker('harvestia', async job => job.name === 'cleanup' ? this.cleanup() : this.refreshLeaderboard(), { connection });
      this.worker.on('failed', (job, err) => this.log('job failed', { job: job?.name, err: err.message }));
    } else {
      this.timers.push(setInterval(() => void this.refreshLeaderboard(), LEADERBOARD_EVERY_MS));
      this.timers.push(setInterval(() => void this.cleanup(), 86_400_000));
    }
    void this.refreshLeaderboard();
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
