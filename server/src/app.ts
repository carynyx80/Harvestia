// Harvestia API: accounts, the server-authoritative farm, the shared world
// clock, leaderboard, farm visits and the live channel.
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { config } from './config';
import { bearer, cleanName, hashToken, newToken, randomFarmName, randomPlayerName, requirePlayer } from './auth';
import { newNonce, verifySignIn } from './wallet';
import { CHAINS, NONCE_TTL_MS } from '../../shared/chains';
import { SpeedGuard, readFarm, runAction } from './farm';
import { Jobs } from './jobs';
import { LiveHub } from './live';
import { MemoryStore } from './store/memory';
import { MarketService } from './market/service';
import { imfViaFred, type ReferenceProvider } from './market/providers';
import { COMMODITY_BY_KEY } from '../../shared/market';
import { VaultError, VaultService, vaultConfigFromEnv, type VaultConfig } from './chain/vault';
import { SPEND_TYPES } from '../../shared/vault';
import { CATALOG_BY_ID } from '../../shared/catalog';
import { buy, tick } from '../../shared/sim/engine';
import { conditionsAt } from './farm';
import { formatUnits, getAddress, type Address, type Hex } from 'viem';
import type { Store } from './store/types';
import { initialState } from '../../shared/sim/state';
import { worldAt } from '../../shared/world';

export const GAME_STAGE = 8;

declare module 'fastify' { interface FastifyInstance { market: MarketService; vault: VaultService } }

export interface AppOptions { store?: Store; redisUrl?: string; runJobs?: boolean; provider?: ReferenceProvider | null; vault?: VaultConfig | null }

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
  const vault = new VaultService('vault' in opts ? opts.vault! : vaultConfigFromEnv(), store.chain, (msg, extra) => app.log.warn({ extra }, msg));
  app.decorate('vault', vault);
  if ((opts.runJobs ?? config.worker) && vault.enabled) {
    let running = false;
    const t = setInterval(() => {
      if (running) return; running = true;
      vault.index().then(n => { if (n) live.vault(); }, e => app.log.warn({ err: (e as Error).message }, 'vault index failed')).finally(() => { running = false; });
    }, 5_000);
    t.unref(); app.addHook('onClose', async () => clearInterval(t));
  }
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
    features: { accounts: true, farmState: true, liveChannel: true, commodityFeeds: !!provider, exchange: true, processing: true, contracts: true, walletSignIn: true, vault: vault.enabled },
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

  /** Starts a session for a player and returns what the client needs. */
  const startSession = async (playerId: string, playerName: string, wallet: string | null, userAgent?: string) => {
    const token = newToken(), now = Date.now();
    await store.createSession(playerId, hashToken(token), new Date(now + config.sessionDays * 86_400_000), userAgent);
    const farm = await store.farmOf(playerId);
    return { token, player: { id: playerId, name: playerName, wallet }, farm: farm!, serverTime: now };
  };
  const signInHost = (host: string) => [...config.corsOrigins.map(o => { try { return new URL(o).host; } catch { return ''; } })].includes(host) || config.corsPreviewPattern.test(`https://${host}`);

  // ---------------------------------------------------------------- wallet sign-in (EIP-4361)
  /** A single-use challenge for the wallet to sign. */
  app.post('/v1/wallet/nonce', { config: { rateLimit: { max: 30, timeWindow: '1 minute', keyGenerator: req => `nonce:${req.ip}` } } }, async () => {
    const nonce = newNonce(), now = Date.now();
    await store.createNonce(nonce, new Date(now + NONCE_TTL_MS));
    return { nonce, issuedAt: now, expiresAt: now + NONCE_TTL_MS, chains: CHAINS.map(c => c.id) };
  });

  /**
   * Verifies a signed sign-in message. If the wallet already belongs to a farm, that farm is signed in
   * (so the same wallet restores the same farm on any device); otherwise it is linked to the current
   * guest farm, or a new farm is created for it.
   */
  app.post('/v1/wallet/verify', { config: { rateLimit: { max: 20, timeWindow: '1 minute', keyGenerator: req => `verify:${req.ip}` } } }, async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>, now = Date.now();
    const check = await verifySignIn(body.message, body.signature, signInHost, now);
    if (!check.ok) return reply.code(400).send({ ok: false, error: check.error });
    if (!(await store.consumeNonce(check.nonce!, new Date(now)))) return reply.code(400).send({ ok: false, error: 'This sign-in request was already used or has expired — try again' });
    const wallet = check.address, ua = req.headers['user-agent'];

    const owner = await store.playerByWallet(wallet);
    if (owner) return { ok: true, outcome: 'signed-in', ...await startSession(owner.id, owner.name, wallet, ua) };

    const token = bearer(req);
    const current = token && token.length >= 20 && token.length <= 100 ? await store.sessionPlayer(hashToken(token), new Date(now)) : null;
    if (current && !current.wallet && await store.linkWallet(current.id, wallet)) {
      return { ok: true, outcome: 'linked', ...await startSession(current.id, current.name, wallet, ua) };
    }
    const { player } = await store.createPlayerWithFarm(randomPlayerName(), randomFarmName(), initialState(now), wallet);
    return { ok: true, outcome: 'created', ...await startSession(player.id, player.name, wallet, ua) };
  });

  // ---------------------------------------------------------------- Game Vault ($HRV)
  const walletOf = (req: { player?: { wallet: string | null } }) => {
    const w = req.player?.wallet;
    if (!w) throw new VaultError(403, 'Sign in with your wallet first');
    return getAddress(w) as Address;
  };
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof VaultError) return reply.code(err.status).send({ ok: false, error: err.message });
    reply.send(err);
  });

  /** Vault address, chain, $HRV price source and live treasury statistics. */
  app.get('/v1/vault', async () => vault.info());

  /** Public burn and treasury history, straight from indexed chain events. */
  app.get<{ Querystring: { limit?: string } }>('/v1/vault/history', async req => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const rows = await store.chain.events({ kinds: ['Spent', 'Burned', 'RewardsFunded', 'RewardClaimed'], limit });
    return { events: rows.map(e => ({ kind: e.kind, player: e.player, amount: e.amount, extra: e.extra, txHash: e.txHash, block: e.block.toString(), at: +e.at })) };
  });

  app.get('/v1/vault/me', { preHandler: auth }, async req => {
    const wallet = walletOf(req);
    const [balance, rewards, purchases, events] = await Promise.all([
      vault.balance(wallet), vault.rewards(wallet), store.chain.purchases(req.player!.id, 10), store.chain.events({ player: wallet, limit: 15 }),
    ]);
    return {
      wallet, balance: balance.toString(),
      rewards: { earned: rewards.earned.toString(), claimed: rewards.claimed.toString(), claimable: rewards.claimable.toString() },
      purchases: purchases.map(p => ({ id: p.id, item: p.item, qty: p.qty, amountWei: p.amountWei, status: p.status, txHash: p.txHash, error: p.error, at: +p.createdAt })),
      events: events.map(e => ({ kind: e.kind, amount: e.amount, extra: e.extra, txHash: e.txHash, at: +e.at })),
    };
  });

  /** Prices a shop item in $HRV and returns the exact message for the player to sign. */
  app.post('/v1/vault/quote', { preHandler: auth, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const wallet = walletOf(req), body = (req.body ?? {}) as Record<string, unknown>, now = Date.now();
    const item = body.item, qty = body.qty;
    if (typeof item !== 'string' || !Object.hasOwn(CATALOG_BY_ID, item) || !Number.isInteger(qty) || (qty as number) < 1 || (qty as number) > 99) return reply.code(400).send({ ok: false, error: 'Invalid item or quantity' });
    const farm = await readFarm(store, req.player!.id, now);
    const check = buy(farm.state, item, qty as number, now, 'hrv');
    if (check.error) return reply.code(400).send({ ok: false, error: check.error });
    const q = await vault.quote(req.player!.id, wallet, item, qty as number, now);
    return {
      ok: true, purchaseId: q.id, item, qty, usd: q.usd, usdPerHrv: q.usdPerHrv, priceSource: q.priceSource,
      amountWei: q.amountWei, hrv: formatUnits(BigInt(q.amountWei), 18), deadline: q.deadlineSeconds,
      typedData: { domain: q.domain, types: SPEND_TYPES, primaryType: 'Spend', message: { player: wallet, amount: q.amountWei, purchaseId: q.id, deadline: String(q.deadlineSeconds) } },
    };
  });

  /** Settles a signed quote on-chain, then grants the item. */
  app.post('/v1/vault/purchase', { preHandler: auth, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const wallet = walletOf(req), body = (req.body ?? {}) as Record<string, unknown>, now = Date.now();
    if (typeof body.purchaseId !== 'string' || typeof body.signature !== 'string' || !/^0x[0-9a-fA-F]+$/.test(body.signature) || body.signature.length > 4000) return reply.code(400).send({ ok: false, error: 'Invalid request' });
    const p = await store.chain.purchase(body.purchaseId);
    if (!p || p.playerId !== req.player!.id || p.wallet !== wallet) return reply.code(404).send({ ok: false, error: 'Quote not found' });
    // re-check the farm can take the item before taking any payment
    const pre = buy((await readFarm(store, req.player!.id, now)).state, p.item, p.qty, now, 'hrv');
    if (pre.error) return reply.code(400).send({ ok: false, error: pre.error });
    const txHash = await vault.settle(p, body.signature as Hex, now);
    // paid: grant the item (if the farm changed meanwhile and can't take it, compensate in Farm Coins)
    const granted = await store.withFarm(req.player!.id, farm => {
      const t = Date.now(), c = conditionsAt(t), ticked = tick(farm.state, t, c);
      const r = buy(ticked, p.item, p.qty, t, 'hrv');
      if (!r.error) return { next: { ...farm, state: r.state }, log: { seq: farm.lastSeq, type: 'buyHrv', payload: { purchaseId: p.id, item: p.item, qty: p.qty, txHash }, ok: true }, value: { state: r.state, events: r.events, compensated: false } };
      const coins = Math.round(p.usd * 100), state = { ...ticked, coins: ticked.coins + coins };
      return { next: { ...farm, state }, log: { seq: farm.lastSeq, type: 'buyHrv', payload: { purchaseId: p.id, compensated: coins, txHash }, ok: false, error: r.error }, value: { state, events: [{ kind: 'toast' as const, text: `${r.error} — refunded ${coins} Farm Coins`, tone: 'bad' as const }], compensated: true } };
    });
    if (granted.compensated) await store.chain.movePurchase(p.id, 'settled', { status: 'compensated' });
    return { ok: true, txHash, ...granted };
  });

  /** Pays the player's unclaimed $HRV rewards into their Game Vault balance (relayed; no gas for the player). */
  app.post('/v1/vault/claim', { preHandler: auth, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async req => {
    const wallet = walletOf(req);
    return { ok: true, ...await vault.claim(wallet) };
  });

  /** Ends this session (the farm and any linked wallet stay; sign in again with the wallet to return). */
  app.post('/v1/auth/logout', { preHandler: auth }, async req => {
    await store.deleteSession(hashToken(bearer(req)!));
    return { ok: true };
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
    // delivered contracts earn $HRV rewards for wallet-linked farms, within a daily cap
    if (out.body.ok && (body.action as { type?: string })?.type === 'deliver' && req.player!.wallet && vault.enabled) {
      const hrv = await vault.accrueContractReward(req.player!.wallet, playerId, now).catch(() => 0);
      if (hrv > 0) out.body.events = [...(out.body.events ?? []), { kind: 'toast', text: `+${hrv} HRV reward earned — claim it in your wallet`, tone: 'good' }];
    }
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
