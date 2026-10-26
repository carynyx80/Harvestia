// Harvestia API: accounts, the server-authoritative farm, the shared world
// clock, leaderboard, farm visits and the live channel.
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { config } from './config';
import { cleanName, hashToken, newToken, randomFarmName, randomPlayerName, requirePlayer } from './auth';
import { SpeedGuard, readFarm, runAction } from './farm';
import { Jobs } from './jobs';
import { LiveHub } from './live';
import { MemoryStore } from './store/memory';
import { MarketService } from './market/service';
import { imfViaFred, type ReferenceProvider } from './market/providers';
import { COMMODITY_BY_KEY } from '../../shared/market';
import type { Store } from './store/types';
import { initialState } from '../../shared/sim/state';
import { worldAt } from '../../shared/world';

export const GAME_STAGE = 7;

declare module 'fastify' { interface FastifyInstance { market: MarketService } }

export interface AppOptions { store?: Store; redisUrl?: string; runJobs?: boolean; provider?: ReferenceProvider | null }

async function defaultStore(): Promise<Store> {
  if (config.databaseUrl) { const { PrismaStore } = await import('./store/prisma'); return new PrismaStore(); }
  if (config.production) throw new Error('DATABASE_URL is required in production');
  return new MemoryStore();
}

export async function buildApp(opts: AppOptions = {}) {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: 'info', redact: ['req.headers.authorization', 'req.query.token'] },
    trustProxy: true,
    bodyLimit: 16 * 1024,
  });
  const started = Date.now();
  const store = opts.store ?? await defaultStore();
  const redisUrl = 'redisUrl' in opts ? opts.redisUrl : config.redisUrl;
  const live = new LiveHub(redisUrl);
  const provider = 'provider' in opts ? opts.provider! : config.marketProvider === 'off' ? null : imfViaFred;
  const market = new MarketService(store.market, provider, (msg, extra) => app.log.warn({ extra }, msg));
  const jobs = new Jobs(store, redisUrl, opts.runJobs ?? config.worker, (msg, extra) => app.log.info({ extra }, msg), market, at => live.market(at));
  const speed = new SpeedGuard(15, (playerId, detail) => { void store.flag(playerId, 'too-fast', detail); app.log.warn({ playerId, detail }, 'flagged: too fast'); });
  const auth = requirePlayer(store);
  app.decorate('market', market);
  app.addHook('onClose', async () => { await live.close(); await jobs.close(); await store.close(); });

  await app.register(cors, {
    origin: (origin, cb) => {
      // no Origin header: server-to-server calls, health checks, curl
      if (!origin || config.corsOrigins.includes(origin) || config.corsPreviewPattern.test(origin)) cb(null, true);
      else cb(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  await app.register(rateLimit, {
    global: true, max: 600, timeWindow: '1 minute',
    keyGenerator: req => req.headers.authorization ? `t:${hashToken(req.headers.authorization)}` : `ip:${req.ip}`,
    errorResponseBuilder: () => ({ statusCode: 429, ok: false, error: 'Too many requests — slow down a little' }),
  });
  await app.register(websocket);

  app.get('/health', async () => ({ status: 'ok', uptimeSeconds: Math.round((Date.now() - started) / 1000) }));

  app.get('/v1/status', async () => ({
    service: 'harvestia-api',
    stage: GAME_STAGE,
    environment: config.env,
    commit: config.commit,
    time: new Date().toISOString(),
    database: store.kind,
    queue: jobs.mode,
    online: live.online,
    features: { accounts: true, farmState: true, liveChannel: true, commodityFeeds: !!provider, exchange: true, processing: true, contracts: true, wallet: false },
    market: { provider: provider?.name ?? null, publishedAt: market.snapshot?.updatedAt ?? null, feeds: market.snapshot?.commodities.filter(c => c.ref).map(c => ({ key: c.key, status: c.ref!.status, period: c.ref!.period })) ?? [] },
  }));

  // ---------------------------------------------------------------- market
  /** Every commodity's reference price (with source and timestamps), in-game price, quotes and the pricing breakdown. */
  app.get('/v1/market', async (_req, reply) => {
    const snap = market.snapshot ?? await market.reload();
    reply.header('cache-control', 'public, max-age=15');
    return snap;
  });

  app.get<{ Params: { key: string }; Querystring: { days?: string } }>('/v1/market/:key/history', async (req, reply) => {
    if (!Object.hasOwn(COMMODITY_BY_KEY, req.params.key)) return reply.code(404).send({ error: 'Unknown commodity' });
    const days = Math.min(30, Math.max(1, Number(req.query.days) || 7));
    reply.header('cache-control', 'public, max-age=30');
    return market.history(req.params.key, days);
  });

  /** The shared world clock as the server sees it; clients use serverTime to correct their own clocks. */
  app.get('/v1/world', async () => { const now = Date.now(); return { serverTime: now, world: worldAt(now) }; });

  // ---------------------------------------------------------------- accounts
  app.post('/v1/auth/guest', { config: { rateLimit: { max: 10, timeWindow: '1 minute', keyGenerator: req => `guest:${req.ip}` } } }, async req => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const now = Date.now();
    const { player, farm } = await store.createPlayerWithFarm(cleanName(body.name, randomPlayerName()), cleanName(body.farmName, randomFarmName()), initialState(now));
    const token = newToken();
    await store.createSession(player.id, hashToken(token), new Date(now + config.sessionDays * 86_400_000), req.headers['user-agent']);
    return { token, player: { id: player.id, name: player.name }, farm: { id: farm.id, name: farm.name }, serverTime: now };
  });

  app.get('/v1/me', { preHandler: auth }, async req => {
    const p = req.player!;
    void store.touch(p.id, new Date());
    return { player: { id: p.id, name: p.name, wallet: p.wallet, createdAt: p.createdAt } };
  });

  // ---------------------------------------------------------------- farm
  app.get('/v1/farm', { preHandler: auth }, async req => {
    const now = Date.now();
    const f = await readFarm(store, req.player!.id, now);
    return { ...f, serverTime: now, world: worldAt(now) };
  });

  app.post('/v1/farm/actions', { preHandler: auth }, async (req, reply) => {
    const now = Date.now(), playerId = req.player!.id;
    if (speed.tooFast(playerId, now)) return reply.code(429).send({ ok: false, error: 'Too many actions at once — slow down a little' });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const out = await runAction(store, playerId, body.seq, body.action, now, market);
    if (out.activity) live.activity(out.activity);
    if (out.trade) {
      const t = out.trade;
      await market.recordTrade(t.farmId, t.item, t.side, t.qty, t.price, t.total, t.fee, now).catch(e => app.log.error({ err: e }, 'trade record failed'));
    }
    return reply.code(out.status).send({ ...out.body, serverTime: now });
  });

  /** Starts the player's farm over from the starter farm (kept server-side and audited like any action). */
  app.post('/v1/farm/reset', { preHandler: auth, config: { rateLimit: { max: 3, timeWindow: '10 minutes' } } }, async req => {
    const now = Date.now();
    return store.withFarm(req.player!.id, farm => {
      const state = initialState(now);
      return { next: { ...farm, state }, log: { seq: farm.lastSeq, type: 'reset', payload: {}, ok: true }, value: { ok: true, state, lastSeq: farm.lastSeq, serverTime: now } };
    });
  });

  // ---------------------------------------------------------------- multiplayer foundations
  app.get('/v1/leaderboard', async () => {
    // the job refreshes every minute; refresh on demand if it hasn't run yet or is behind
    if (Date.now() - jobs.leaderboardAt > 60_000 || !jobs.leaderboard.length) await jobs.refreshLeaderboard();
    return { updatedAt: jobs.leaderboardAt, rows: jobs.leaderboard };
  });

  /** A read-only view of another player's farm (farm visits arrive in Stage 10). */
  app.get<{ Params: { id: string } }>('/v1/farms/:id', async (req, reply) => {
    if (!/^[A-Za-z0-9-]{8,40}$/.test(req.params.id)) return reply.code(400).send({ error: 'Invalid farm id' });
    const f = await store.publicFarm(req.params.id);
    if (!f) return reply.code(404).send({ error: 'Farm not found' });
    const s = f.state;
    return {
      id: f.id, name: f.name, owner: f.playerName, level: s.level,
      fields: s.plots.filter(p => p.unlocked).length,
      crops: s.plots.reduce((n, p) => n + p.cells.filter(c => c.crop).length, 0),
      animals: s.animals.reduce<Record<string, number>>((m, a) => ({ ...m, [a.kind]: (m[a.kind] ?? 0) + 1 }), {}),
      machines: Object.keys(s.machines),
    };
  });

  app.get('/v1/live', { websocket: true, preHandler: auth }, socket => { live.add(socket); });

  return app;
}
