import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from './app';
import { MemoryStore } from './store/memory';

async function setup() {
  const store = new MemoryStore();
  const app = await buildApp({ store, redisUrl: undefined, runJobs: false, provider: null });
  const g = (await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: { name: 'Tester', farmName: 'Test Acres' } })).json();
  const auth = { authorization: `Bearer ${g.token}` };
  const act = (seq: number, action: unknown) => app.inject({ method: 'POST', url: '/v1/farm/actions', headers: auth, payload: { seq, action } });
  return { app, store, g, auth, act };
}

test('health check responds ok', async () => {
  const { app } = await setup();
  assert.equal((await app.inject({ method: 'GET', url: '/health' })).json().status, 'ok');
});

test('status reports stage, storage and queue mode', async () => {
  const { app } = await setup();
  const body = (await app.inject({ method: 'GET', url: '/v1/status' })).json();
  assert.equal(body.service, 'harvestia-api');
  assert.equal(body.stage, 7);
  assert.equal(body.database, 'memory');
  assert.equal(body.features.accounts, true);
});

test('CORS allows the Vercel frontend and its previews, not other sites', async () => {
  const { app } = await setup();
  const origin = async (o: string) => (await app.inject({ method: 'GET', url: '/health', headers: { origin: o } })).headers['access-control-allow-origin'];
  assert.equal(await origin('https://harvestia-one.vercel.app'), 'https://harvestia-one.vercel.app');
  assert.equal(await origin('https://harvestia-qvvt7v0sg-carynyx1.vercel.app'), 'https://harvestia-qvvt7v0sg-carynyx1.vercel.app');
  assert.equal(await origin('https://evil.example.com'), undefined);
});

test('guest sign-up creates a player, a farm and a session', async () => {
  const { app, g, auth } = await setup();
  assert.ok(g.token.length > 30);
  assert.equal(g.player.name, 'Tester');
  assert.equal(g.farm.name, 'Test Acres');
  const me = (await app.inject({ method: 'GET', url: '/v1/me', headers: auth })).json();
  assert.equal(me.player.id, g.player.id);
});

test('farm endpoints require a valid session', async () => {
  const { app } = await setup();
  assert.equal((await app.inject({ method: 'GET', url: '/v1/farm' })).statusCode, 401);
  assert.equal((await app.inject({ method: 'GET', url: '/v1/farm', headers: { authorization: 'Bearer not-a-real-token-at-all-xxxxxxxx' } })).statusCode, 401);
});

test('reading the farm returns server state and the world clock', async () => {
  const { app, auth } = await setup();
  const f = (await app.inject({ method: 'GET', url: '/v1/farm', headers: auth })).json();
  assert.equal(f.state.coins, 1250);
  assert.equal(f.lastSeq, 0);
  assert.ok(f.world.season);
  assert.ok(Math.abs(f.serverTime - Date.now()) < 5000);
});

test('actions are applied by the server and persist', async () => {
  const { app, auth, act } = await setup();
  const r = (await act(1, { type: 'buy', item: 'seed-corn', qty: 2 })).json();
  assert.equal(r.ok, true);
  assert.equal(r.state.coins, 1250 - 16);
  const f = (await app.inject({ method: 'GET', url: '/v1/farm', headers: auth })).json();
  assert.equal(f.state.coins, 1250 - 16);
  assert.equal(f.lastSeq, 1);
});

test('replayed and duplicate actions are refused', async () => {
  const { act } = await setup();
  assert.equal((await act(5, { type: 'buy', item: 'seed-corn', qty: 1 })).statusCode, 200);
  const again = await act(5, { type: 'buy', item: 'seed-corn', qty: 1 });
  assert.equal(again.statusCode, 409);
  assert.equal(again.json().state.coins, 1250 - 8); // charged once
  assert.equal((await act(3, { type: 'buy', item: 'seed-corn', qty: 1 })).statusCode, 409);
});

test('concurrent requests with the same sequence apply once', async () => {
  const { act } = await setup();
  const [a, b] = await Promise.all([act(1, { type: 'buy', item: 'seed-corn', qty: 1 }), act(1, { type: 'buy', item: 'seed-corn', qty: 1 })]);
  assert.deepEqual([a.statusCode, b.statusCode].sort(), [200, 409]);
});

test('forged or malformed actions are rejected', async () => {
  const { act } = await setup();
  assert.equal((await act(1, { type: 'setCoins', coins: 1e9 })).statusCode, 400);
  assert.equal((await act(2, { type: 'sell', item: 'crop-wheat', qty: 1, price: 99999 })).statusCode, 400);
  assert.equal((await act(3, { type: 'buy', item: 'seed-corn', qty: -5 })).statusCode, 400);
  assert.equal((await act(-1, { type: 'refill' })).statusCode, 400);
});

test('rule violations are refused with a reason and logged', async () => {
  const { act, store } = await setup();
  const r = (await act(1, { type: 'plant', plot: 24, cell: 0, seed: 'seed-wheat' })).json();
  assert.equal(r.ok, false);
  assert.match(r.error, /paddy only grows rice/);
  assert.equal(store.logs.at(-1)?.ok, false);
});

test('inhumanly fast play is throttled and flagged', async () => {
  const { act, store } = await setup();
  const res = await Promise.all(Array.from({ length: 25 }, (_, i) => act(i + 1, { type: 'refill' })));
  assert.ok(res.some(r => r.statusCode === 429));
  assert.equal(store.flags[0]?.reason, 'too-fast');
});

test('leaderboard and public farm view', async () => {
  const { app, g } = await setup();
  const lb = (await app.inject({ method: 'GET', url: '/v1/leaderboard' })).json();
  assert.equal(lb.rows[0].name, 'Test Acres');
  const v = (await app.inject({ method: 'GET', url: `/v1/farms/${g.farm.id}` })).json();
  assert.equal(v.name, 'Test Acres');
  assert.equal(v.owner, 'Tester');
  assert.ok(v.fields > 0);
  assert.equal((await app.inject({ method: 'GET', url: '/v1/farms/x' })).statusCode, 400);
});

test('a player can start their farm over', async () => {
  const { app, auth, act } = await setup();
  await act(1, { type: 'buy', item: 'seed-corn', qty: 5 });
  const r = (await app.inject({ method: 'POST', url: '/v1/farm/reset', headers: auth })).json();
  assert.equal(r.state.coins, 1250);
  assert.equal(r.lastSeq, 1); // sequence keeps rising so old actions can't be replayed
});
