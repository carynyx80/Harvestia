// Harvestia API. Stages 2–4 ship the service skeleton only; player accounts,
// persistent farm state, timers and anti-cheat arrive in Stage 6.
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';

export const GAME_STAGE = 4;

export async function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV === 'test' ? false : { level: 'info' } });
  const started = Date.now();

  await app.register(cors, {
    origin: (origin, cb) => {
      // no Origin header: server-to-server calls, health checks, curl
      if (!origin || config.corsOrigins.includes(origin) || config.corsPreviewPattern.test(origin)) cb(null, true);
      else cb(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  app.get('/health', async () => ({ status: 'ok', uptimeSeconds: Math.round((Date.now() - started) / 1000) }));

  app.get('/v1/status', async () => ({
    service: 'harvestia-api',
    stage: GAME_STAGE,
    environment: config.env,
    commit: config.commit,
    time: new Date().toISOString(),
    features: { accounts: false, farmState: false, commodityFeeds: false, wallet: false },
  }));

  return app;
}
