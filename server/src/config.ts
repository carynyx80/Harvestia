// Runtime configuration, read once from the environment.
const list = (v: string | undefined) => (v ?? '').split(',').map(s => s.trim()).filter(Boolean);
const production = process.env.NODE_ENV === 'production';

export const config = {
  production,
  port: Number(process.env.PORT ?? 4000),
  // Railway routes to the container, so listen on all interfaces there; loopback locally.
  host: process.env.HOST ?? (process.env.RAILWAY_ENVIRONMENT ? '0.0.0.0' : '127.0.0.1'),
  env: process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.NODE_ENV ?? 'development',
  commit: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
  /** PostgreSQL; without it the API keeps data in memory (development and tests only). */
  databaseUrl: process.env.DATABASE_URL,
  /** Redis for BullMQ jobs and cross-instance live events; optional in development. */
  redisUrl: process.env.REDIS_URL,
  /** Run scheduled jobs in this process (set WORKER=0 on extra API replicas). */
  worker: process.env.WORKER !== '0',
  sessionDays: 90,
  /** Reference price provider: 'imf' (IMF Primary Commodity Prices via FRED) or 'off'. */
  marketProvider: process.env.MARKET_PROVIDER ?? 'imf',
  /** Exact origins allowed to call the API (the Vercel frontend and local dev). */
  corsOrigins: list(process.env.CORS_ORIGINS ?? 'https://harvestia-one.vercel.app,http://localhost:5180'),
  /** Vercel preview deployments of this project, e.g. harvestia-abc123-carynyx1.vercel.app */
  corsPreviewPattern: /^https:\/\/harvestia-[a-z0-9-]+-carynyx1\.vercel\.app$/,
};
