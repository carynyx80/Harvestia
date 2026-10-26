import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from './app';
import { MemoryStore } from './store/memory';
import { validate } from './market/service';
import { parseFredCsv, type ReferenceProvider } from './market/providers';
import { COMMODITY_BY_KEY, MARKET } from '../../shared/market';

const NOW = Date.UTC(2026, 9, 26);
/** Monthly points ending last month, rising gently so the latest is above the 24-month average. */
const months = (start: number, step: number, n = 26, endMonth = 8) =>
  Array.from({ length: n }, (_, k) => ({ period: new Date(Date.UTC(2026, endMonth - (n - 1 - k), 1)), value: start + step * k }));

function fakeProvider(points: (key: string) => { period: Date; value: number }[], fail = false): ReferenceProvider {
  return {
    id: 'test', name: 'Test Feed', attribution: 'Test data', license: 'test', frequency: 'monthly',
    sourceUrl: () => null,
    fetch: async def => { if (fail) throw new Error('provider down'); return points(def.key); },
  };
}

async function setup(provider: ReferenceProvider | null) {
  const store = new MemoryStore();
  const app = await buildApp({ store, redisUrl: undefined, runJobs: false, provider });
  const g = (await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: {} })).json();
  const auth = { authorization: `Bearer ${g.token}` };
  const act = (seq: number, action: unknown) => app.inject({ method: 'POST', url: '/v1/farm/actions', headers: auth, payload: { seq, action } });
  return { app, store, act };
}

const fred = (key: string) => key === 'coffee' ? months(250, 4) : key === 'cocoa' ? months(4000, 60) : months(200, 2);

test('parses FRED CSV and validates reference prints', () => {
  assert.deepEqual(parseFredCsv('observation_date,X\n2026-08-01,237.8\n2026-09-01,.\n').map(p => p.value), [237.8]);
  const pts = [
    { period: new Date(Date.UTC(2026, 5, 1)), value: 220 },
    { period: new Date(Date.UTC(2026, 6, 1)), value: 9000 }, // out of range
    { period: new Date(Date.UTC(2026, 7, 1)), value: 400 }, // +82% in a month: outlier
    { period: new Date(Date.UTC(2026, 8, 1)), value: 240 },
    { period: new Date(Date.UTC(2027, 0, 1)), value: 240 }, // in the future
  ];
  const r = validate(COMMODITY_BY_KEY.wheat, pts, 'test', NOW);
  assert.deepEqual(r.rows.map(x => x.value), [220, 240]);
  assert.equal(r.rejected, 3);
  // coffee arrives in US cents per pound and is normalised to USD per tonne
  const c = validate(COMMODITY_BY_KEY.coffee, [{ period: new Date(Date.UTC(2026, 8, 1)), value: 330 }], 'test', NOW);
  assert.equal(Math.round(c.rows[0].usdPerTonne), 7275);
});

test('publishes bounded prices with source attribution and timestamps', async () => {
  const { app } = await setup(fakeProvider(fred));
  await app.market.refreshReferences(NOW);
  await app.market.publish(NOW);
  const snap = (await app.inject({ method: 'GET', url: '/v1/market' })).json();
  const wheat = snap.commodities.find((c: { key: string }) => c.key === 'wheat');
  assert.equal(wheat.ref.status, 'ok');
  assert.equal(wheat.ref.source, 'Test Feed');
  assert.equal(wheat.ref.period, '2026-09');
  assert.ok(wheat.ref.ratio > 1);
  assert.ok(wheat.price.mid > 0 && wheat.price.bid < wheat.price.mid && wheat.price.ask > wheat.price.mid);
  const refPart = wheat.price.parts.find((p: { key: string }) => p.key === 'reference');
  assert.ok(refPart.value > 1 && refPart.value <= MARKET.refBounds[1]);
  // in-game-only crops have no reference and a neutral factor
  const rice = snap.commodities.find((c: { key: string }) => c.key === 'rice');
  assert.equal(rice.ref, null);
  // the next publish can move at most one step
  await app.market.publish(NOW + MARKET.publishEveryMs);
  const next = (await app.inject({ method: 'GET', url: '/v1/market' })).json().commodities.find((c: { key: string }) => c.key === 'wheat');
  assert.ok(Math.abs(next.price.mid / wheat.price.mid - 1) <= MARKET.step + 0.001);
});

test('stale references stop moving the price; outages keep the cached value', async () => {
  // data that ended over 75 days ago is stale
  const { app } = await setup(fakeProvider(() => months(200, 2, 26, 4)));
  await app.market.refreshReferences(NOW);
  await app.market.publish(NOW);
  const wheat = app.market.snapshot!.commodities.find(c => c.key === 'wheat')!;
  assert.equal(wheat.ref!.status, 'stale');
  assert.equal(wheat.price!.parts.find(p => p.key === 'reference')!.value, 1);

  const { app: app2, store } = await setup(fakeProvider(fred));
  await app2.market.refreshReferences(NOW);
  // the provider goes down: the error is recorded, cached prices are still used
  const down = new (app2.market.constructor as typeof import('./market/service').MarketService)(store.market, fakeProvider(fred, true));
  await down.refreshReferences(NOW + 1000);
  const info = await down.refInfo(COMMODITY_BY_KEY.wheat, NOW + 2000);
  assert.equal(info.status, 'outage');
  assert.equal(info.lastError, 'provider down');
  assert.equal(info.period, '2026-09');
});

test('exchange trades fill at the server quote, respect the limit and move supply and demand', async () => {
  const { app, store, act } = await setup(fakeProvider(fred));
  await app.market.refreshReferences(NOW);
  await app.market.publish(Date.now());
  const q = app.market.quotes()['crop-wheat'];
  // asking more than the bid is refused, not filled lower
  const greedy = (await act(1, { type: 'trade', item: 'crop-wheat', side: 'sell', qty: 10, limit: q.bid + 1 })).json();
  assert.equal(greedy.ok, false);
  assert.match(greedy.error, /price moved/);
  const before = greedy.state.coins;
  const r = (await act(2, { type: 'trade', item: 'crop-wheat', side: 'sell', qty: 10, limit: q.bid })).json();
  assert.equal(r.ok, true);
  assert.ok(r.state.coins > before);
  assert.equal(store.market.tradeRows.length, 1);
  assert.equal(store.market.tradeRows[0].side, 'sell');
  assert.ok(store.market.bookRows.get('wheat')!.pressure > 0);
  const hist = (await app.inject({ method: 'GET', url: '/v1/market/wheat/history?days=7' })).json();
  assert.equal(hist.trades.length, 1);
  assert.ok(hist.reference.length > 20);
  assert.equal((await app.inject({ method: 'GET', url: '/v1/market/toString/history' })).statusCode, 404);
});

test('trades are refused when the exchange has no price', async () => {
  const { act } = await setup(null);
  const r = (await act(1, { type: 'trade', item: 'crop-wheat', side: 'sell', qty: 1, limit: 1 })).json();
  assert.equal(r.ok, false);
  assert.match(r.error, /no price/);
});
