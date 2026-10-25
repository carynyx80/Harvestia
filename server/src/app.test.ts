import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from './app.js';

test('health check responds ok', async () => {
  const app = await buildApp();
  const res = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().status, 'ok');
});

test('status reports the service and stage', async () => {
  const app = await buildApp();
  const body = (await app.inject({ method: 'GET', url: '/v1/status' })).json();
  assert.equal(body.service, 'harvestia-api');
  assert.equal(typeof body.stage, 'number');
});

test('CORS allows the Vercel frontend and its previews, not other sites', async () => {
  const app = await buildApp();
  const origin = async (o: string) => (await app.inject({ method: 'GET', url: '/health', headers: { origin: o } })).headers['access-control-allow-origin'];
  assert.equal(await origin('https://harvestia-one.vercel.app'), 'https://harvestia-one.vercel.app');
  assert.equal(await origin('https://harvestia-qvvt7v0sg-carynyx1.vercel.app'), 'https://harvestia-qvvt7v0sg-carynyx1.vercel.app');
  assert.equal(await origin('https://evil.example.com'), undefined);
});
